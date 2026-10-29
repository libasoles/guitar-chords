"""Per-voice rhythm repair of OMR MusicXML (used by uploads, see `tabify.REPAIR_VOICES`).

A MusicXML measure is a set of voices laid on one clock with <backup>/<forward>. OMR gets the
durations of a voice wrong in a few recurring ways, and the voices then disagree about where the
beat ends, so notes sounding together land in different columns:

  * a voice runs past the barline because a chord was read as two notes in a row, or because of a
    tuplet that was never one (the lengths only fit the measure once both are undone);
  * a voice is two voices glued together (the bass followed by its arpeggio);
  * a bass note lost its dot, leaving a hole in its stem lane before the next bass note;
  * a voice opens inside the note of the voice it continues (a <forward> that is too short).

Each rule only edits a measure when the result is clearly better: the voice then adds up to the
measure, or the lane closes. Anything ambiguous (several ways to fit, or none) is left as it was.
Pure functions on an ElementTree; `repair_voices(root)` is the entry point."""

import itertools
from fractions import Fraction
from xml.etree import ElementTree as ET

import music21 as m21

MAX_STACK_SPAN = 12  # semitones: the notes of one chord stay within an octave
MAX_FIXES = 3  # edits tried together on one voice
STEPS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def nominal(note, divisions):
    """Written length of a note in `divisions` units, ignoring any tuplet."""
    written = m21.duration.Duration(type=note.findtext("type"))
    written.dots = len(note.findall("dot"))
    return Fraction(written.quarterLength) * divisions


class _Event:
    """One onset of one voice: a note (plus the chord members that follow it) or a rest."""

    def __init__(self, base, voice, start, duration):
        self.members = [base]
        self.voice = voice
        self.start = start
        self.duration = duration

    @property
    def base(self):
        return self.members[0]

    @property
    def end(self):
        return self.start + self.duration

    @property
    def rest(self):
        return self.base.find("rest") is not None

    @property
    def stem(self):
        return self.base.findtext("stem")

    @property
    def tuplet(self):
        return self.base.find("time-modification") is not None


def _events(measure):
    """The measure's onsets on one clock, or None when it cannot be read reliably."""
    position, events = Fraction(0), []
    for element in measure:
        if element.tag == "note":
            if element.find("grace") is not None:
                continue
            duration = element.findtext("duration")
            if duration is None:
                return None
            if element.find("chord") is not None:
                if not events:
                    return None
                events[-1].members.append(element)
                continue
            events.append(_Event(element, element.findtext("voice") or "1", position, Fraction(duration)))
            position += events[-1].duration
        elif element.tag == "forward":
            position += Fraction(element.findtext("duration"))
        elif element.tag == "backup":
            position -= Fraction(element.findtext("duration"))
        if position < 0:
            return None
    if len({e.base.findtext("staff") for e in events}) > 1:
        return None
    return events


def _by_voice(events):
    voices = {}
    for event in events:
        voices.setdefault(event.voice, []).append(event)
    return voices


def _move(tag, length, voice):
    element = ET.Element(tag)
    ET.SubElement(element, "duration").text = str(int(length))
    if tag == "forward":
        ET.SubElement(element, "voice").text = voice
    return element


def _emit(measure, events):
    """Rewrites every <forward>/<backup> so each event sits at its `start`."""
    for element in list(measure):
        if element.tag in ("forward", "backup"):
            measure.remove(element)
    order = {id(element): i for i, element in enumerate(measure)}
    position = Fraction(0)
    for event in sorted(events, key=lambda e: order[id(e.base)]):
        if event.start != position:
            index = list(measure).index(event.base)
            while index > 0 and measure[index - 1].tag == "note" and measure[index - 1].find("grace") is not None:
                index -= 1  # a grace note travels with the note it leans on
            move = _move("forward" if event.start > position else "backup", abs(event.start - position), event.voice)
            measure.insert(index, move)
        position = event.end


def _set_duration(event, duration):
    for note in event.members:
        note.find("duration").text = str(int(duration))
    event.duration = duration


def _pitch(note):
    step = STEPS.get(note.findtext("pitch/step"))
    if step is None:
        return None
    return int(note.findtext("pitch/octave")) * 12 + step + round(float(note.findtext("pitch/alter") or 0))


# --- Rule 1: a voice that overruns the measure -------------------------------

def _stackable(previous, event):
    """Whether `event` could be a second head on the stem of `previous` that OMR read as the next note."""
    if previous.rest or event.rest or previous.duration != event.duration:
        return False
    if (previous.base.findtext("type"), len(previous.base.findall("dot"))) != \
            (event.base.findtext("type"), len(event.base.findall("dot"))):
        return False
    if previous.stem != event.stem or previous.tuplet != event.tuplet:
        return False
    a, b = _pitch(previous.members[-1]), _pitch(event.base)
    return a is not None and b is not None and 0 < abs(a - b) <= MAX_STACK_SPAN


def _tuplet_runs(voice_events):
    runs, current = [], None
    for event in voice_events:
        if not event.tuplet:
            current = None
            continue
        if current is None:
            current = []
            runs.append(current)
        current.append(event)
    return runs


def _strip_tuplet(event, divisions):
    for note in event.members:
        if note.find("time-modification") is not None:
            note.remove(note.find("time-modification"))
        for notations in note.findall("notations"):
            for tuplet in notations.findall("tuplet"):
                notations.remove(tuplet)
            if len(notations) == 0:
                note.remove(notations)
    _set_duration(event, nominal(event.base, divisions))


def _stack(events, event, previous):
    """Makes `event` a chord member of `previous`."""
    event.base.insert(0, ET.Element("chord"))
    previous.members.extend(event.members)
    events.remove(event)


def _fit_overrun(events, voice, whole, divisions):
    """Undoes tuplets and stacks notes so the voice ends exactly at the barline. Needs one way only."""
    own = _by_voice(events)[voice]
    excess = own[-1].end - whole
    options = [("tuplet", run) for run in _tuplet_runs(own)]
    options += [("stack", own[i]) for i in range(1, len(own)) if _stackable(own[i - 1], own[i])]
    if excess <= 0 or not options:
        return False

    def effect(option):
        kind, target = option
        return -target.duration if kind == "stack" else sum(nominal(e.base, divisions) - e.duration for e in target)

    solutions = []
    for size in range(1, min(MAX_FIXES, len(options)) + 1):
        solutions = [subset for subset in itertools.combinations(options, size)
                     if sum(effect(o) for o in subset) == -excess]
        if solutions:
            break
    if len(solutions) != 1:
        return False
    # The voice keeps the distance that separated each of its onsets from the one before.
    gaps = {id(after): after.start - before.end for before, after in zip(own, own[1:])}
    stacked = [target for kind, target in solutions[0] if kind == "stack"]
    for kind, target in solutions[0]:
        if kind == "tuplet":
            for event in target:
                _strip_tuplet(event, divisions)
    for event in stacked:
        previous = own[own.index(event) - 1]
        while previous in stacked:
            previous = own[own.index(previous) - 1]
        _stack(events, event, previous)
    cursor = None
    for event in (e for e in own if e not in stacked):
        cursor = event.start if cursor is None else cursor + gaps[id(event)]
        event.start = cursor
        cursor = event.end
    return True


# --- Rule 2: two voices read as one ------------------------------------------

def _split_glued(events, voice, whole):
    """A voice that fills one measure and goes on: what follows is another voice laid on the same clock
    (the bass sustained while the arpeggio runs). It is split off only when that remainder fills a
    measure by itself, from its first onset to the last."""
    own = _by_voice(events)[voice]
    start = own[0].start
    cut = next((i for i, e in enumerate(own) if e.end - start == whole), None)
    if cut is None or cut + 1 >= len(own):
        return False
    tail = own[cut + 1:]
    if tail[-1].end - tail[0].start != whole or any(b.start != a.end for a, b in zip(tail, tail[1:])):
        return False
    numbers = [int(v) for v in {e.voice for e in events} if v.isdigit()]
    new = str(max(numbers) + 1) if numbers else voice + "b"
    shift = tail[0].start - start
    for event in tail:
        event.voice = new
        event.start -= shift
        for note in event.members:
            if note.find("voice") is not None:
                note.find("voice").text = new
    return True


# --- Rule 3: a note that lost its dot ----------------------------------------

def _redot(events, whole):
    """A note whose next onset in the same stem direction comes exactly half its length later (a sixth,
    for a dotted one) is that note with its dot lost: a lane of bass notes (or of melody notes) would
    otherwise have a hole nothing in it sounds through."""
    changed = False
    for event in sorted(events, key=lambda e: e.start):
        dots = len(event.base.findall("dot"))
        if event.rest or event.tuplet or event.stem not in ("up", "down") or event.end >= whole or dots > 1:
            continue
        lane = [e for e in events if e is not event and not e.rest and e.stem == event.stem]
        if any(e.start < event.end < e.end for e in lane):
            continue
        following = min((e for e in lane if e.start >= event.end), key=lambda e: e.start, default=None)
        if following is None or following.start - event.end != event.duration / (2 if dots == 0 else 6):
            continue
        gap = following.start - event.end
        for note in event.members:
            note.insert(list(note).index(note.find("type")) + 1 + dots, ET.Element("dot"))
        _set_duration(event, event.duration + gap)
        changed = True
    return changed


# --- Rule 4: a voice that starts inside the note it follows -------------------

def _snap_overlaps(events, whole):
    """Voices in the same stem direction share one lane: the second starts where the first one's note ends.
    OMR sometimes opens the later voice (a <forward> too short) inside that note. It is moved to the note's
    end when it overlaps by less than half the note, or, when it starts together with it, only if the voice
    then ends exactly at the barline (otherwise the two may be one chord read as two voices)."""
    changed = False
    for event in sorted(events, key=lambda e: e.start):
        if event.rest or event.stem not in ("up", "down"):
            continue
        covering = [p for p in events if p.voice != event.voice and not p.rest and p.stem == event.stem
                    and p.start <= event.start < p.end]
        if not covering:
            continue
        previous = max(covering, key=lambda p: p.end)
        own = [e for e in _by_voice(events)[event.voice] if e.start >= event.start]
        shift = previous.end - event.start
        end = own[-1].end + shift
        if previous.start == event.start:
            fits = end == whole
        else:
            fits = event.start - previous.start >= previous.duration / 2 and end <= whole
        if not fits:
            continue
        for moved in own:
            moved.start += shift
        changed = True
    return changed


# --- Entry points ------------------------------------------------------------

def _attributes(measure, divisions, beats, beat_type):
    for attributes in measure.findall("attributes"):
        if attributes.findtext("divisions") is not None:
            divisions = Fraction(attributes.findtext("divisions"))
        if attributes.findtext("time/beats") is not None:
            beats, beat_type = attributes.findtext("time/beats"), attributes.findtext("time/beat-type")
    return divisions, beats, beat_type


def _whole(divisions, beats, beat_type):
    try:
        return Fraction(4) * divisions * int(beats) / int(beat_type) if divisions and divisions > 0 else None
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _measures(root):
    """(measure, divisions, whole-measure length) for the measures whose clock can be read."""
    for part in root.findall("part"):
        divisions = beats = beat_type = None
        for measure in part.findall("measure"):
            divisions, beats, beat_type = _attributes(measure, divisions, beats, beat_type)
            whole = _whole(divisions, beats, beat_type)
            if whole:
                yield measure, divisions, whole


def overruns(root):
    """Numbers of the measures where some voice goes past the barline."""
    found = []
    for measure, _, whole in _measures(root):
        events = _events(measure)
        if events and any(v[-1].end > whole for v in _by_voice(events).values()):
            found.append(measure.get("number"))
    return found


def repair_voices(root):
    """Applies the rules to every measure. Returns the numbers of the measures it changed."""
    changed = []
    for measure, divisions, whole in _measures(root):
        events = _events(measure)
        if not events:
            continue
        edited = False
        for voice in list(_by_voice(events)):
            for rule in (lambda: _fit_overrun(events, voice, whole, divisions), lambda: _split_glued(events, voice, whole)):
                if _by_voice(events)[voice][-1].end > whole:
                    edited = rule() or edited
        edited = _redot(events, whole) or edited
        edited = _snap_overlaps(events, whole) or edited
        if edited:
            _emit(measure, events)
            changed.append(measure.get("number"))
    return changed
