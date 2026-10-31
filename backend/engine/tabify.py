"""MusicXML score -> guitar tablature, as ascii-tabs columns and as an engraved PDF.

Pure operations on artifacts (no sessions): `prepare` and `export`, at the end
of this module. OMR (Audiveris) is not part of this module: it runs in its own
container (backend/ocr) and its MusicXML output is this module's input.

Pipeline:
  1. (Elsewhere) Audiveris turns the PDF into MusicXML.
  2. music21 reads the first part; every onset of a measure (all voices
     together) becomes one tab Column. Tied continuations are not re-plucked.
  3. A Viterbi search picks string/fret for every Column (chords included),
     keeping each chord within a hand span and minimising position shifts.
  4. The page edits the Columns with ascii-tabs; build_output() writes the
     edited frets as a TAB staff under the notation (one MusicXML part with two
     staves) and Verovio engraves it to SVG pages, merged into a PDF by
     rsvg-convert.
"""

import copy
import itertools
import json
import math
import os
import re
import subprocess
import tempfile
from fractions import Fraction
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

import music21 as m21
import verovio

import engraving
import fingering
import rhythm
from uneven import uneven_measures

verovio.enableLog(False)
# The wrapper only finds its fonts by itself on the main thread; the web app
# renders from request threads.
VEROVIO_DATA = os.path.join(os.path.dirname(verovio.__file__), "data")

STANDARD_TUNING = "E2,A2,D3,G3,B3,E4"  # string 6 -> string 1
DROP_D_TUNING = "D2,A2,D3,G3,B3,E4"
LOW_F_TUNING = "F2,A2,D3,G3,B3,E4"  # sixth string up to F (Sor Op. 35 No. 12); only asked for by name, never guessed
MAX_FRET = 19
MAX_SPAN = 4  # frets the hand covers without stretching
MAX_HELD_FRETS = 4  # distinct frets pressed at once: one per finger
CANDIDATES_PER_COLUMN = 40
GUITAR_LOWEST = 38  # D2, the 6th string in Drop D
# Share of notes below the written guitar range that marks a score as already in sound.
# One misread note (OMR noise) must not flip a whole piece an octave.
IN_SOUND_SHARE = 0.05
KEEP_TEXT = False  # keep <words> directions; off for uploads, where they are OCR noise
# Two voices sounding the same pitch at the same instant (a melody note over the bass note it shares) are one note on
# the guitar: only the first gets a string and fret, as engravers merge their heads. Off by default for the curated
# collections (their output is published); `prepare` turns it on for uploads, where OMR often reads one note in
# two voices and the second would pull its Column away from the first.
MERGE_UNISONS = False
# Per-voice rhythm repair (rhythm.py): voices that run past the barline, glued voices, lost dots. It rewrites OMR rhythm,
# so it is off for the curated collections and `prepare` turns it on for uploads; its result is persisted in
# normalized.musicxml, which is why `export` does not need it.
REPAIR_VOICES = False
# Natural harmonics (fingering.parse_harmonic): a diamond head, <harmonic> or a «Hr. 12» mark pins the note to fret 12 of the
# string an octave below it. Off for the collections (their harmonics are fingered by hand); `prepare` turns it on.
HARMONICS = False
# Sustained notes in the Viterbi (M2-M4, N7, N9 of docs/catalogo-de-heuristicas-de-digitacion.md): the cost of lifting a finger whose
# note still rings, of cutting a ringing note with a new one on its string, of two notes held by the same finger and of
# breaking the position the written fingers imply. It changes the engine's choices, so the collections keep it off and
# `prepare` turns it on for uploads (their suggestion is persisted, so `export` does not need it).
SUSTAIN = False

PREVIEW_OPTIONS = {
    "pageWidth": 2100, "pageHeight": 60000, "scale": 40, "adjustPageHeight": True,
    "breaks": "none", "pageMarginLeft": 60, "pageMarginRight": 20,  # left: string names
    "pageMarginTop": 0, "pageMarginBottom": 0, "header": "none", "footer": "none",
    "svgViewBox": True, "svgHtml5": True,
}
# Staff space in the preview SVGs' viewBox units (18 per 100 % of scale); the
# page sizes rows and tab digits from it so every row shares one scale.
PREVIEW_STAFF_SPACE = 18 * PREVIEW_OPTIONS["scale"] / 100
# Measure natural widths before justification; dense rows take fewer measures.
PREVIEW_MAX_ROW = 100 * PREVIEW_STAFF_SPACE
PREVIEW_MIN_ROW = 90 * PREVIEW_STAFF_SPACE
PDF_OPTIONS = {  # A4 at Verovio's 10 units per mm
    "pageWidth": 2100, "pageHeight": 2970, "scale": 45, "breaks": "auto",
    "pageMarginLeft": 160, "pageMarginRight": 100, "pageMarginTop": 80,  # left: string names
    "pageMarginBottom": 80, "header": "auto", "footer": "none",
    "spacingStaff": 9, "spacingSystem": 7,  # air around the TAB: below the notation and before the next system
}
# Verovio draws rhythm stems on tab staves; the reference layout has frets only.
HIDE_TAB_RHYTHM = "<style>g.tabDurSym, g.tabRhythm { display: none; }</style>"


def open_midis(tuning):
    """String 1 (high) first, like ascii-tabs Columns."""
    return [m21.pitch.Pitch(p).midi for p in tuning.split(",")][::-1]


def string_names(tuning):
    """American letters, string 1 (high) first."""
    return [m21.pitch.Pitch(p).name.replace("-", "♭") for p in reversed(tuning.split(","))]


_nominal = rhythm.nominal


def repair_orphan_tuplets(root):
    """Strip tuplets the OMR left unfinished and realign the voices that followed them.

    Audiveris sometimes reads one note as a lone tuplet member (a 16th lasting 2/3), or
    opens a tuplet in one voice and closes it in another. The voices then disagree about
    where the beat ends, so the same bass note is engraved far from the melody note it
    sounds with and loses its column. A tuplet is kept only when each run of tuplet
    notes in a voice is a whole number of groups. Otherwise its notes go back to their
    written lengths and every <forward>/<backup> is re-derived so the voices still meet
    at the same instants. Returns whether anything changed."""
    changed = False
    for part in root.findall("part"):
        divisions = beats = beat_type = None
        for measure in part.findall("measure"):
            for attributes in measure.findall("attributes"):
                if attributes.findtext("divisions") is not None:
                    divisions = Fraction(attributes.findtext("divisions"))
                if attributes.findtext("time/beats") is not None:
                    beats = attributes.findtext("time/beats")
                    beat_type = attributes.findtext("time/beat-type")
            if not divisions or divisions <= 0:
                continue
            changed = _repair_measure(measure, divisions, beats, beat_type) or changed
    return changed


def _repair_measure(measure, divisions, beats, beat_type):
    """`repair_orphan_tuplets` for one measure."""
    # Document order of notes per voice, to find runs of tuplet notes.
    runs, voice_run = [], {}
    voices = {}
    notes = [n for n in measure.findall("note") if n.find("chord") is None and n.find("grace") is None]
    for note in notes:
        voice = note.findtext("voice")
        voices.setdefault(voice, []).append(note)
        if note.find("time-modification") is None:
            voice_run.pop(voice, None)
            continue
        run = voice_run.get(voice)
        if run is None:
            run = voice_run[voice] = []
            runs.append(run)
        run.append(note)
    orphans = [n for run in runs for n in run
               if len(run) % int(run[0].find("time-modification").findtext("actual-notes")) != 0]
    # A voice that fills the measure only once its tuplets are written at face value
    # was misread, even when the tuplet groups look whole.
    try:
        whole = Fraction(4) * divisions * int(beats) / int(beat_type)
    except (TypeError, ValueError, ZeroDivisionError):
        whole = None
    for voice_notes in voices.values():
        tupleted = [n for n in voice_notes if n.find("time-modification") is not None]
        if not tupleted or whole is None:
            continue
        actual = sum(Fraction(n.findtext("duration")) for n in voice_notes)
        nominal = sum(_nominal(n, divisions) if n in tupleted else Fraction(n.findtext("duration"))
                      for n in voice_notes)
        if actual != whole and nominal == whole:
            orphans.extend(n for n in tupleted if n not in orphans)
    if not orphans:
        return False
    # Walk the measure once in the old clock, collecting where each orphan ended.
    position, deltas = Fraction(0), []
    for element in measure:
        duration = element.findtext("duration")
        if element.tag == "note" and element.find("chord") is None and element.find("grace") is None:
            if element in orphans:
                deltas.append((position + Fraction(duration), _nominal(element, divisions) - Fraction(duration)))
            position += Fraction(duration)
        elif element.tag == "forward":
            position += Fraction(duration)
        elif element.tag == "backup":
            position -= Fraction(duration)

    def remap(instant):
        return instant + sum((delta for end, delta in deltas if end <= instant), Fraction(0))

    old, new = Fraction(0), Fraction(0)
    for element in list(measure):
        duration = element.findtext("duration")
        if element.tag == "note" and element.find("chord") is None and element.find("grace") is None:
            length = Fraction(duration)
            if element in orphans:
                length = _nominal(element, divisions)
                element.find("duration").text = str(int(length))
                element.remove(element.find("time-modification"))
                for notations in element.findall("notations"):
                    for tuplet in notations.findall("tuplet"):
                        notations.remove(tuplet)
                    if len(notations) == 0:
                        element.remove(notations)
            old += Fraction(duration)
            new += length
        elif element.tag == "forward":
            old += Fraction(duration)
            length = remap(old) - new
            element.find("duration").text = str(int(length))
            new += length
        elif element.tag == "backup":
            old -= Fraction(duration)
            length = new - remap(old)
            element.find("duration").text = str(int(length))
            new -= length
    return True


def order_slurs(root):
    """Give each slur its `start` on the note that comes first in the document.

    A slur that begins in a lower voice (after a <backup>) and ends on the upper voice's
    earlier note lists its `stop` before its `start`. music21 then loses the start, and
    Verovio pairs by document order too. Both ends stay on the same two notes; only their
    start/stop roles are swapped. Returns whether anything changed."""
    changed = False
    for part in root.findall("part"):
        stray = {}  # slur number -> a `stop` seen with no open start
        open_numbers = set()
        for slur in part.iter("slur"):
            number, kind = slur.get("number", "1"), slur.get("type")
            if kind == "start":
                if number in stray:
                    stray.pop(number).set("type", "start")
                    slur.set("type", "stop")
                    changed = True
                else:
                    open_numbers.add(number)
            elif kind == "stop":
                if number in open_numbers:
                    open_numbers.discard(number)
                else:
                    stray[number] = slur
    return changed


def read_score(path, repair_voices=None):
    """Repair zero divisions from OMR using the written note lengths.

    Audiveris can export a half note with duration 1 and divisions 0 (the
    real scale is 1/2). Rescale the affected section to integer divisions;
    replacing zero with 1 alone would halve every note's duration.
    Keep the original MusicXML/MXL on disk intact.
    """
    if str(path).lower().endswith(".mxl"):
        xml = m21.converter.ArchiveManager(path).getData()
    else:
        with open(path, "rb") as source:
            xml = source.read()
    root = ET.fromstring(xml)
    repaired = False
    for part in root.findall("part"):
        sections = []
        section = None
        for element in part.iter():
            if element.tag == "divisions":
                section = None
                if Fraction(element.text) <= 0:
                    section = {"divisions": element, "notes": [], "durations": []}
                    sections.append(section)
            elif section is not None:
                if element.tag == "note":
                    section["notes"].append(element)
                elif element.tag == "duration":
                    section["durations"].append(element)
        for section in sections:
            scales = set()
            for note in section["notes"]:
                kind, duration = note.findtext("type"), note.findtext("duration")
                if kind is None or duration is None or note.find("grace") is not None:
                    continue
                written = m21.duration.Duration(type=kind)
                written.dots = len(note.findall("dot"))
                length = Fraction(written.quarterLength)
                tuplet = note.find("time-modification")
                if tuplet is not None:
                    length *= Fraction(int(tuplet.findtext("normal-notes")),
                                       int(tuplet.findtext("actual-notes")))
                if length > 0 and Fraction(duration) > 0:
                    scales.add(Fraction(duration) / length)
            if len(scales) != 1:
                raise ValueError("El MusicXML tiene una escala rítmica inválida (divisions=0) "
                                 "que no se puede reconstruir. Corregí el OMR en MuseScore "
                                 "y volvé a subir el MusicXML.")
            scale = scales.pop()
            # Include backup/forward durations when choosing an integer scale.
            factor = scale.denominator
            for duration in section["durations"]:
                factor = math.lcm(factor, Fraction(duration.text).denominator)
            section["divisions"].text = str(int(scale * factor))
            for duration in section["durations"]:
                duration.text = str(int(Fraction(duration.text) * factor))
            repaired = True
    repaired = repair_orphan_tuplets(root) or repaired
    if REPAIR_VOICES if repair_voices is None else repair_voices:
        repaired = bool(rhythm.repair_voices(root)) or repaired
    repaired = order_slurs(root) or repaired
    if repaired:
        return m21.converter.parseData(ET.tostring(root, encoding="unicode"), format="musicxml")
    return m21.converter.parse(path)


MAX_SLUR_MEASURES = 2  # a guitar slur (hammer-on, pull-off, short phrase) never reaches further


def repair_slurs(score):
    """Make every slur a pair of distinct notes, earliest first, within a short reach.

    OMR leaves slurs it could not close, and the numbers of a slur it did close are reused
    every system, so music21 pairs a start with a stop many measures later and Verovio
    draws one giant curve. A slur opened in a lower voice (after a <backup>) is also listed
    after the stop that closes it in the upper voice. Such pairs are put in time order;
    those on one note (or two notes sounding together) or longer than MAX_SLUR_MEASURES are dropped."""
    for slur in list(score.recurse().getElementsByClass(m21.spanner.Slur)):
        notes = [n for n in slur.getSpannedElements() if isinstance(n, m21.note.GeneralNote)]
        site = slur.activeSite
        keep = None
        if len(notes) >= 2 and site is not None:
            ordered = sorted(notes, key=lambda n: n.getOffsetInHierarchy(score))
            first, last = ordered[0], ordered[-1]
            reach = (last.measureNumber or 0) - (first.measureNumber or 0)
            same_instant = first.getOffsetInHierarchy(score) == last.getOffsetInHierarchy(score)
            if first is not last and not same_instant and reach <= MAX_SLUR_MEASURES:
                keep = (first, last)
        if keep is None:
            if site is not None:
                site.remove(slur)
        elif keep != (notes[0], notes[-1]):
            site.remove(slur)
            fixed = m21.spanner.Slur(list(keep))
            fixed.placement = slur.placement
            site.insert(0, fixed)


KEY_MIN_NOTES = 12  # with fewer notes the key says nothing
KEY_WRONG_SHARE = 0.12  # share of notes outside the written key that marks it as misread
KEY_FIT_SHARE = 0.04  # ...and the share another key must stay under to replace it
MAJOR_SCALE = (0, 2, 4, 5, 7, 9, 11)


def _out_of_key(pitch_classes, fifths):
    scale = {(p + 7 * fifths) % 12 for p in MAJOR_SCALE}
    return sum(1 for pc in pitch_classes if pc not in scale) / len(pitch_classes)


def fix_key_signature(part):
    """Replace a key signature the OMR misread when the notes plainly belong to another one.

    Notes carry their own pitches in MusicXML, so a wrong signature only changes which
    accidentals get printed. When the written key leaves more than KEY_WRONG_SHARE of the notes
    outside its scale and a different signature leaves under KEY_FIT_SHARE, the signature is
    replaced and the accidentals are recomputed. Only parts with a single signature are
    touched: with key changes the notes of each section would have to be judged apart."""
    keys = list(part.recurse().getElementsByClass(m21.key.KeySignature))
    notes = [p for n in part.recurse().notes if not n.duration.isGrace for p in n.pitches]
    if len(keys) != 1 or len(notes) < KEY_MIN_NOTES:
        return False
    classes = [p.pitchClass for p in notes]
    written = keys[0].sharps
    if _out_of_key(classes, written) < KEY_WRONG_SHARE:
        return False
    best = min(range(-7, 8), key=lambda f: (_out_of_key(classes, f), abs(f)))
    if best == written or _out_of_key(classes, best) > KEY_FIT_SHARE:
        return False
    keys[0].sharps = best
    part.makeAccidentals(inPlace=True, overrideStatus=True)
    return True


def fix_slur_placement(score):
    """Audiveris writes slur `placement` from the curve's control point, which often puts a
    slur above notes that hang below the staff. A slur whose two heads are both outside
    the staff goes on the side they hang: below for ledger notes under it (stems down, the
    beam side), above for those over it. Slurs that touch the staff keep the OCR's choice."""
    for slur in score.recurse().getElementsByClass(m21.spanner.Slur):
        first, last = slur.getFirst(), slur.getLast()
        clef = first.getContextByClass(m21.clef.Clef)
        if clef is None or not hasattr(clef, "lowestLine") or not first.pitches or not last.pitches:
            continue
        low = min(p.diatonicNoteNum for n in (first, last) for p in n.pitches)
        high = max(p.diatonicNoteNum for n in (first, last) for p in n.pitches)
        if high < clef.lowestLine:
            slur.placement = "below"
        elif low > clef.lowestLine + 8:
            slur.placement = "above"


def load_score(paths, repair_voices=None, harmonics=None):
    """First part of the first movement; later movements are appended.

    The first measure of each movement gets `editorial.movementStart`: clefs do
    not carry over between Audiveris movements (see `octave_shifts`).
    """
    scores = [read_score(p, repair_voices) for p in paths]
    for score in scores:
        # Audiveris files footer and publisher text as lyrics on nearby notes;
        # a guitar score has none, so drop them or they print under the staff.
        for n in score.recurse().getElementsByClass(m21.note.GeneralNote):
            n.lyrics = []
        repair_slurs(score)
        if HARMONICS if harmonics is None else harmonics:
            mark_harmonics(score.parts[0])  # before the OCR's text directions are dropped below
        fix_key_signature(score.parts[0])
        fix_slur_placement(score)
        # The same text can arrive as free text directions (<words>); only the
        # header credits are kept, so drop every other printed text.
        # Curated scores (the site's Carcassi collections) set KEEP_TEXT to print their tempo and D.C. marks.
        for el in list(score.recurse().getElementsByClass(
                (m21.expressions.TextExpression, m21.expressions.RehearsalMark, m21.tempo.TempoIndication))):
            if isinstance(el, m21.expressions.TextExpression) and (KEEP_TEXT or fingering.parse_barre(el.content)):
                continue  # a barre mark is a playing instruction, not OCR noise
            el.activeSite.remove(el)
    part = scores[0].parts[0]
    first = part.getElementsByClass(m21.stream.Measure).first()
    if first is not None:
        first.editorial.movementStart = True
    for extra in scores[1:]:
        last = part.getElementsByClass(m21.stream.Measure).last()
        number = last.number if last is not None else 0
        for i, measure in enumerate(extra.parts[0].getElementsByClass(m21.stream.Measure)):
            number += 1
            measure.number = number
            measure.editorial.movementStart = i == 0
            part.append(measure)
    return scores[0], part


# --- Columns ---------------------------------------------------------------

def octave_shifts(measures):
    """Per measure, the semitones from the read pitch to the sounding one.

    Guitar is written an octave above sounding pitch. Audiveris keeps the '8'
    of a treble-8vb clef as an octave change (pitches already sound right);
    under a plain treble clef they need -12. The clef in force is tracked per
    measure and reset at each movement: Audiveris can split a pickup into its
    own movement without the clef, and MusicXML reads that as plain treble.
    """
    octave_clef = []
    clef = None
    for measure in measures:
        if getattr(measure.editorial, "movementStart", False):
            clef = None
        for c in measure.recurse().getElementsByClass(m21.clef.Clef):
            clef = c
        octave_clef.append(getattr(clef, "octaveChange", 0) == -1)
    written = [p.midi for m, octave in zip(measures, octave_clef) if not octave
               for n in m.recurse().notes for p in n.pitches]
    # Many notes too low to be written guitar pitch: the score is already in sound.
    too_low = sum(1 for midi in written if midi - 12 < GUITAR_LOWEST)
    plain = 0 if too_low and too_low > IN_SOUND_SHARE * len(written) else -12
    return [0 if octave else plain for octave in octave_clef]


def build_columns(part, shifts=None, merge_unisons=None, harmonics=None):
    """Per measure, the list of Columns: {offset, notes: [(note, midi)]}.

    `note` is the music21 Note (a chord's component for chords). Every note of
    the part gets `editorial.tabKey` so the deep copy used for the TAB staff
    can find its own copy of it.
    """
    source = list(part.getElementsByClass(m21.stream.Measure))
    if shifts is None:
        shifts = octave_shifts(source)
    elif len(shifts) != len(source):
        raise ValueError("Las transposiciones guardadas no coinciden con los compases.")
    measures = []
    key = 0
    barres = barre_spans(part)
    ends, tie_root = {}, {}  # when each plucked note stops sounding (ties included), by note key / by tied pitch
    for measure, shift in zip(source, shifts):
        by_offset = {}
        hints = {}
        start = float(measure.getOffsetInHierarchy(part))
        for general in measure.recurse().notes:
            if general.duration.isGrace:
                continue
            offset = float(general.getOffsetInHierarchy(measure))
            stops = round(start + offset + float(general.duration.quarterLength), 4)
            members = general.notes if isinstance(general, m21.chord.Chord) else [general]
            for note in members:
                note.editorial.tabKey = key
                # String IDs survive deepcopy -> MusicXML -> Verovio data-id.
                note.id = f"tab-note-{key}"
                note.editorial.tabHarmonic = (HARMONICS if harmonics is None else harmonics) and is_harmonic(note, general)
                note.editorial.tabBass = (note.stemDirection if note.stemDirection in ("up", "down")
                                          else general.stemDirection) == "down"
                key += 1
                hints[midi_key(note, shift)] = merge_hints(hints.get(midi_key(note, shift)), note_hints(note))
                tie = note.tie or general.tie
                if tie is not None and tie.type in ("stop", "continue"):
                    root = tie_root.get(midi_key(note, shift))
                    if root is not None:
                        ends[root] = stops
                        if tie.type == "stop":
                            del tie_root[midi_key(note, shift)]
                    continue
                column = by_offset.setdefault(offset, [])
                if (MERGE_UNISONS if merge_unisons is None else merge_unisons) and any(m == note.pitch.midi + shift for _, m in column):
                    continue
                column.append((note, note.pitch.midi + shift))
                ends[note.editorial.tabKey] = stops
                if tie is not None and tie.type == "start":
                    tie_root[midi_key(note, shift)] = note.editorial.tabKey
        columns = [{"offset": o, "notes": by_offset[o]} for o in sorted(by_offset)]
        for column in columns:
            column["time"] = round(start + column["offset"], 4)
            column["hints"] = {m: hints[m] for _, m in column["notes"] if hints.get(m)}
            column["barre"] = next((b["barre"] for b in barres if b["start"] - 1e-6 <= start + column["offset"] <= b["end"] + 1e-6),
                                   None)
        measures.append({"number": measure.number, "measure": measure, "columns": columns})
    for measure in measures:
        for column in measure["columns"]:
            column["until"] = {m: ends[note.editorial.tabKey] for note, m in column["notes"]}
    mark_slurred_columns(part, measures)
    # Reported shift: the one most measures use.
    return measures, max(set(shifts), key=shifts.count, default=0)


MAX_STATES = 64  # sustained states kept per column in the Viterbi
SLUR_OFF_STRING = 8  # cost of leaving the string at a hammer-on/pull-off: far above any position move
SLUR_MAX_STEP = 4  # semitones a finger can hammer on or pull off along one string


def mark_slurred_columns(part, measures):
    """Flags (`slurred`) the Column that a two-note slur reaches from the previous one.

    A slur between two neighbouring single notes a few semitones apart is a hammer-on or
    pull-off, and both notes sound on one string (Carcassi, «Of the Slur»; M5 in
    docs/catalogo-de-heuristicas-de-digitacion.md). Longer slurs are phrasing and say
    nothing about strings."""
    flat = [col for m in measures for col in m["columns"]]
    owner = {id(note): col for col in flat for note, _ in col["notes"]}
    for slur in part.recurse().getElementsByClass(m21.spanner.Slur):
        first, last = slur.getFirst(), slur.getLast()
        a, b = owner.get(id(first)), owner.get(id(last))
        if a is None or b is None or a is b or len(a["notes"]) != 1 or len(b["notes"]) != 1:
            continue
        i = next(k for k, col in enumerate(flat) if col is a)
        if i + 1 < len(flat) and flat[i + 1] is b and 0 < abs(a["notes"][0][1] - b["notes"][0][1]) <= SLUR_MAX_STEP:
            b["slurred"] = True


def text_spans(part, parse):
    """The passages marked by a text direction `parse` recognises: [{start, end, value}] with offsets in quarter lengths from the
    start of the part (both ends included). `parse(text)` is falsy for any other text. A mark is followed by the dashed line
    that shows how far it lasts, which ends with the last note it covers (that note's whole length); without a line it lasts to the
    end of its measure."""
    lines = sorted((float(line.getFirst().getOffsetInHierarchy(part)),
                    float(line.getLast().getOffsetInHierarchy(part) + line.getLast().duration.quarterLength) - 1e-3)
                   for line in part.recurse().getElementsByClass(m21.spanner.Line)
                   if line.lineType == "dashed" and line.getFirst() is not None and line.getLast() is not None)
    marks = sorted(((float(text.getOffsetInHierarchy(part)), parse(text.content), text)
                    for text in part.recurse().getElementsByClass(m21.expressions.TextExpression)
                    if parse(text.content)), key=lambda mark: mark[0])
    spans = []
    for start, value, text in marks:
        line = next((l for l in lines if l[0] >= start - 1e-6), None)
        if line is not None:
            lines.remove(line)
            end = line[1]
        else:
            measure = text.getContextByClass(m21.stream.Measure)
            end = float(measure.getOffsetInHierarchy(part) + measure.duration.quarterLength) - 1e-3 if measure else start
        spans.append({"start": start, "end": end, "value": value})
    return spans


def barre_spans(part):
    """The barres written in the part: [{start, end, barre: (fret, strings)}] (see `text_spans` and `fingering.parse_barre`)."""
    return [{"start": s["start"], "end": s["end"], "barre": s["value"]} for s in text_spans(part, fingering.parse_barre)]


def mark_harmonics(part):
    """Gives a diamond head to the notes under a harmonic mark («Hr. 12», «Harm.»), so the mark survives in the normalized
    MusicXML after the text itself is dropped. Only notes on a pitch class an open string can sound an octave up are marked;
    which string, if any, is decided with the tuning (`assign_frets`)."""
    for span in text_spans(part, fingering.parse_harmonic):
        for general in part.recurse().notes:
            if span["start"] - 1e-6 <= float(general.getOffsetInHierarchy(part)) <= span["end"] + 1e-6:
                for note in (general.notes if isinstance(general, m21.chord.Chord) else [general]):
                    if note.pitch.pitchClass in fingering.HARMONIC_PITCH_CLASSES:
                        note.notehead = "diamond"


def is_harmonic(note, general):
    """A diamond head or <harmonic> on the note (or on the chord that holds it)."""
    return any(n.notehead == "diamond" or any(isinstance(a, m21.articulations.StringHarmonic) for a in n.articulations)
               for n in (note, general))


def midi_key(note, shift):
    return note.pitch.midi + shift


def note_hints(note):
    """What the score says about how to play `note`: left-hand finger (0-4), string (0 = highest) and fret, from
    MusicXML <fingering>, <string> and <fret>. Right-hand letters (p i m a) and anything else are ignored."""
    hint = {}
    for articulation in note.articulations:
        if isinstance(articulation, m21.articulations.StringIndication) and articulation.number:
            hint["string"] = int(articulation.number) - 1
        elif isinstance(articulation, m21.articulations.FretIndication) and articulation.number is not None:
            hint["fret"] = int(articulation.number)
        elif isinstance(articulation, m21.articulations.Fingering) and str(articulation.fingerNumber).isdigit():
            if 0 <= int(articulation.fingerNumber) <= 4:
                hint["finger"] = int(articulation.fingerNumber)
    return hint


def merge_hints(old, new):
    return {**(old or {}), **new} if new else old


def guess_tuning(measures):
    """Standard, unless the part goes below E2 and Drop D (6th string in D, the
    usual scordatura in guitar music) reaches it."""
    drop_d = open_midis(DROP_D_TUNING)[-1]
    # Notes below Drop D are out of reach in any tuning; a misread one must not hide the real bass.
    midis = [m for meas in measures for col in meas["columns"] for _, m in col["notes"] if m >= drop_d]
    lowest = open_midis(STANDARD_TUNING)[-1]
    if midis and min(midis) < lowest:
        return DROP_D_TUNING
    return STANDARD_TUNING


def dropped_notes(measures):
    """Notes `assign_frets` left off the tab (out of range or no room), as
    (measure number, pitch name)."""
    return [(m["number"], note.pitch.nameWithOctave)
            for m in measures for col in m["columns"]
            for note, midi in col["notes"] if midi not in col["midis"]]


# --- String/fret assignment ------------------------------------------------

def candidates(midis, opens, hints=None, barre=None):
    """Every way to put the (distinct) pitches on distinct strings. `hints` ({midi: {string, fret, finger}}, from
    the score's annotations) narrow the cells of a note and rule out finger combinations nobody can hold; if the
    annotations leave nothing playable they are ignored for this column. `barre` ((fret, strings), see
    `fingering.parse_barre`) keeps the notes of the strings it covers at its fret or higher."""
    hints = hints or {}
    options = [fingering.allowed_cells(m, opens, hints.get(m, {}), MAX_FRET, barre) for m in midis]
    out = []
    for combo in itertools.product(*options):
        strings = [s for s, _ in combo]
        if len(set(strings)) == len(strings):
            out.append(combo)
    # One finger per fret (a barre counts as one): a chord that needs a fifth fret held at once cannot be played.
    # Kept as a fallback when nothing else fits, so a note is never dropped for it.
    out = [combo for combo in out if len({f for _, f in combo if f > 0}) <= MAX_HELD_FRETS] or out
    fingers = [hints.get(m, {}).get("finger") for m in midis]
    if any(d for d in fingers):
        playable = [combo for combo in out if fingering.fingers_possible(combo, fingers)]
        out = playable or out
    return out


PRESS_COST = 0.25  # per fret of every pressed note in `local_cost`; a finger already down is not charged it again


def local_cost(combo):
    fretted = [f for _, f in combo if f > 0]
    if not fretted:
        return 0.0
    span = max(fretted) - min(fretted)
    cost = span + 10 * max(0, span - MAX_SPAN)
    cost += 0.3 * min(fretted) + 0.5 * max(0, max(fretted) - 12)
    # Every pressed fret counts, so an open string in the chord beats a compact shape higher up the neck (A-C#-G
    # as 5-2-0, not 5-6-5): the books keep chords in low position. Measured against Sagreras' printed tab
    # (scripts/sagreras/compare_positions.py): 53 -> 18 differing cells of 3070, none worse.
    cost += PRESS_COST * sum(fretted)
    return cost


def hand(combo):
    fretted = [f for _, f in combo if f > 0]
    return min(fretted) if fretted else None


def playable_subset(midis, opens, hints=None, barre=None):
    """Drops pitches until the rest fit on the strings: out-of-range ones first,
    then inner voices (keep bass and melody)."""
    midis = [m for m in midis if any(0 <= m - o <= MAX_FRET for o in opens)]
    while midis and not candidates(midis, opens, hints, barre):
        midis.pop(len(midis) // 2)
    return midis


def assign_frets(measures, tuning=STANDARD_TUNING, arpeggio=False, sustain=None):
    """Fills `cells` (ascii-tabs Column) and `fingering` {id(note): (string, fret)}
    on every Column, via Viterbi over the whole piece.

    `arpeggio` applies the string rules of `fingering` (no two different notes in a row on one string, a repeated
    note keeps its string, one cell per pitch in a measure): False never, True to every measure, "auto" to the
    measures `fingering.detect_arpeggios` reads as arpeggios. Each measure's `arpeggio` flag records the outcome.
    `sustain` adds the costs of notes that ring on (see `SUSTAIN` and `sustained_path`): None follows the module flag."""
    opens = open_midis(tuning)
    flat = [col for m in measures for col in m["columns"]]
    layers = []
    for col in flat:
        pin_harmonics(col, opens)
    for measure in measures:
        fingering.mark_fretted({m: h for col in measure["columns"] for m, h in col.get("hints", {}).items()}, opens, MAX_FRET)
    for col in flat:
        midis = sorted({m for _, m in col["notes"]}, reverse=True)
        midis = playable_subset(midis, opens, col.get("hints"), col.get("barre"))
        col["midis"] = midis
        combos = candidates(midis, opens, col.get("hints"), col.get("barre")) or [()]
        combos.sort(key=local_cost)
        layers.append([(c, local_cost(c)) for c in combos[:CANDIDATES_PER_COLUMN]])

    if (SUSTAIN if sustain is None else sustain) and layers and all("time" in col and "until" in col for col in flat):
        for i, k in enumerate(sustained_path(flat, layers, opens)):
            set_column(flat[i], layers[i][k][0], opens)
        apply_arpeggio_rules(measures, opens, arpeggio)
        return

    # Viterbi; the state is the candidate plus the last known hand position.
    best = [[(cost, None, hand(c)) for c, cost in layers[0]]] if layers else []
    for i in range(1, len(layers)):
        row = []
        slurred = flat[i].get("slurred")
        for combo, cost in layers[i]:
            h = hand(combo)
            choice = None
            for j, (prev_cost, _, prev_hand) in enumerate(best[i - 1]):
                move = abs(h - prev_hand) * 0.6 if h is not None and prev_hand is not None else 0
                if slurred and combo and layers[i - 1][j][0] and combo[0][0] != layers[i - 1][j][0][0][0]:
                    move += SLUR_OFF_STRING
                total = prev_cost + cost + move
                if choice is None or total < choice[0]:
                    choice = (total, j, h if h is not None else prev_hand)
            row.append(choice)
        best.append(row)

    if best:
        k = min(range(len(best[-1])), key=lambda j: best[-1][j][0])
        for i in range(len(layers) - 1, -1, -1):
            set_column(flat[i], layers[i][k][0], opens)
            k = best[i][k][1]
    apply_arpeggio_rules(measures, opens, arpeggio)


def sustained_path(flat, layers, opens):
    """Viterbi over the columns where the state also carries the pressed notes still ringing (M2-M4, N9) and the position the
    written fingers imply (N7). `layers[i]` are the (combo, cost) candidates of `flat[i]`; returns the index chosen in each.

    A ringing note outlives its own column, so what it costs to play column i depends on columns well before it: a bass held
    through four melody notes constrains all of them. The state is (candidate, held notes); the cheapest path per state is kept,
    at most `MAX_STATES` per column."""
    fingers = [[col.get("hints", {}).get(m, {}).get("finger") for m in col["midis"]] for col in flat]
    # row[i]: {(candidate, held): (cost, previous key, hand, written position)}
    rows = []
    first = {}
    for k, (combo, cost) in enumerate(layers[0]):
        held = _held_after(flat, 0, combo, [], opens)
        first[(k, held)] = (cost, None, hand(combo), fingering.written_position(combo, fingers[0]))
    rows.append(first)
    for i in range(1, len(layers)):
        slurred = flat[i].get("slurred")
        same_measure = flat[i].get("offset", 1) > flat[i - 1].get("offset", 0)  # a bar's bass pattern keeps its strings; a new bar may not
        row = {}
        for key, (prev_cost, _, prev_hand, prev_position) in rows[i - 1].items():
            prev_combo = layers[i - 1][key[0]][0]
            alive = [cell for cell in key[1] if cell[2] > flat[i]["time"] + 1e-6]
            for k, (combo, cost) in enumerate(layers[i]):
                h = hand(combo)
                move = abs(h - prev_hand) * 0.6 if h is not None and prev_hand is not None else 0
                if slurred and combo and prev_combo and combo[0][0] != prev_combo[0][0]:
                    move += SLUR_OFF_STRING
                position = fingering.written_position(combo, fingers[i])
                if position is not None and prev_position is not None:
                    move += fingering.position_jump(position, prev_position)
                ringing, kept = fingering.ringing_cost(alive, combo, fingers[i], MAX_SPAN)
                own = cost
                if same_measure:
                    again, moved = fingering.repeated_notes(prev_combo, combo, opens, flat[i - 1].get("until"), flat[i].get("time"))
                    own = cost - PRESS_COST * sum(f for _, f in again) + fingering.REPEAT_MOVED * moved
                total = prev_cost + own + move + ringing
                new_key = (k, _held_after(flat, i, combo, kept, opens))
                if new_key not in row or total < row[new_key][0]:
                    row[new_key] = (total, key, h if h is not None else prev_hand,
                                    position if position is not None else prev_position)
        if len(row) > MAX_STATES:
            row = dict(sorted(row.items(), key=lambda item: (item[1][0], item[0][0]))[:MAX_STATES])
        rows.append(row)
    key = min(rows[-1], key=lambda k: (rows[-1][k][0], k[0]))
    path = [0] * len(layers)
    for i in range(len(layers) - 1, -1, -1):
        path[i] = key[0]
        key = rows[i][key][1]
    return path


def _held_after(flat, i, combo, kept, opens):
    """The pressed notes ringing after column i plays `combo`: those it left ringing plus its own that outlast the next onset."""
    following = flat[i + 1]["time"] if i + 1 < len(flat) else None
    fingers = [flat[i].get("hints", {}).get(m, {}).get("finger") for m in flat[i]["midis"]]
    own = [(s, f, flat[i]["until"].get(opens[s] + f, flat[i]["time"]), d) for (s, f), d in zip(combo, fingers)]
    ringing = kept + [cell for cell in own if following is not None and cell[2] > following + 1e-6]
    return tuple(sorted(ringing, key=lambda cell: (cell[0], cell[1], cell[2], cell[3] or 0)))


def pin_harmonics(col, opens):
    """`col["harmonics"]`: {midi: string} for the notes of the Column that are natural harmonics, each narrowed (in the Column's
    hints) to fret 12 of its string. A marked note no open string sounds an octave up stays an ordinary note."""
    hints = col.get("hints") or {}
    col["harmonics"] = {}
    for note, midi in col["notes"]:
        string = fingering.harmonic_string(midi, opens, hints.get(midi)) if getattr(note.editorial, "tabHarmonic", False) else None
        if string is not None:
            col["harmonics"][midi] = string
    if col["harmonics"]:
        col["hints"] = {**hints, **{m: {**hints.get(m, {}), "string": s, "fret": fingering.HARMONIC_FRET}
                                    for m, s in col["harmonics"].items()}}


def apply_arpeggio_rules(measures, opens, arpeggio):
    """Re-chooses the single notes of arpeggio measures (see `assign_frets`)."""
    if arpeggio == "auto":
        flags = fingering.detect_arpeggios([[(c["offset"], c["midis"]) for c in m["columns"]] for m in measures])
    else:
        flags = [bool(arpeggio)] * len(measures)
    for m, flag in zip(measures, flags):
        m["arpeggio"] = flag
    active = [i for i, flag in enumerate(flags) if flag]
    if not active:
        return
    tabs = [[list(c["cells"]) for c in m["columns"]] for m in measures]
    fingering.avoid_repeated_strings(tabs, opens, measures=active, economy=True,
                                     barres=[[c.get("barre") for c in m["columns"]] for m in measures],
                                     pinned=[[bool(c.get("harmonics")) for c in m["columns"]] for m in measures],
                                     groups=[beam_groups(m["columns"]) for m in measures])
    for m, tab in zip(measures, tabs):
        for col, cells in zip(m["columns"], tab):
            if cells != col["cells"]:
                col["cells"] = cells
                col["fingering"] = fingering_from_cells(col, cells, opens)


def beam_groups(columns):
    """Per column, the id of the group of notes it belongs to (a tuplet, else a beamed run; a single note), None
    otherwise."""
    ids, current, open_group = [], 0, False
    for col in columns:
        note = col["notes"][0][0] if len(col["notes"]) == 1 else None
        tuplets = note.duration.tuplets if note is not None else []
        beams = note.beams.beamsList if note is not None else []
        if tuplets:
            kind, ending = tuplets[0].type, tuplets[0].type == "stop"
        elif beams:
            kind, ending = beams[0].type, beams[0].type == "stop"
        else:
            kind, ending = None, True
        if note is None or (kind is None and not tuplets and not beams):
            ids.append(None)
            open_group = False
            continue
        if kind == "start" or not open_group:
            current += 1
        ids.append(current)
        open_group = not ending
    return ids


def set_column(col, combo, opens):
    cells = [None] * 6
    for s, f in combo:
        cells[s] = f
    col["cells"] = cells
    col["fingering"] = fingering_from_cells(col, cells, opens)


def fingering_from_cells(col, cells, opens):
    """Maps the Column's notes onto edited cells: same pitch first; cells whose
    pitch matches no note (edited frets) go to the remaining notes, low to low."""
    free = [(s, f) for s, f in enumerate(cells) if f is not None]
    notes = sorted(col["notes"], key=lambda nm: -nm[1])
    result = {}
    pending = []
    for note, midi in notes:
        hit = next((sf for sf in free if opens[sf[0]] + sf[1] == midi), None)
        if hit:
            free.remove(hit)
            result[id(note)] = hit
        else:
            pending.append(note)
    # Leftover cells, highest string number (lowest) last, onto leftover notes
    for note, sf in zip(pending, sorted(free)):
        result[id(note)] = sf
    col["extra"] = sorted(free)[len(pending):]  # more cells than notes
    return result


def apply_edits(measures, edited, tuning=STANDARD_TUNING):
    """`edited` is one ascii-tabs Tab (Column list) per measure."""
    opens = open_midis(tuning)
    for m, tab in zip(measures, edited):
        for i, col in enumerate(m["columns"]):
            raw = tab[i] if i < len(tab) else [None] * 6
            cells = [v if isinstance(v, int) and 0 <= v <= 24 else None for v in (raw + [None] * 6)[:6]]
            pin_harmonics(col, opens)
            col["cells"] = cells
            col["fingering"] = fingering_from_cells(col, cells, opens)


def preview_columns(measure):
    """Anchors and original voice hints indexed by logical column/string."""
    return [{"note_ids": [note.id for note, _ in col["notes"]],
             "bass_strings": sorted({col["fingering"][id(note)][0]
                                     for note, _ in col["notes"]
                                     if note.editorial.tabBass and id(note) in col["fingering"]})}
            for col in measure["columns"]]


# --- Rendering -------------------------------------------------------------

def new_toolkit(options):
    toolkit = verovio.toolkit(False)
    toolkit.setResourcePath(VEROVIO_DATA)
    toolkit.setOptions(options)
    return toolkit


def to_musicxml(score_or_part):
    with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=False) as tmp:
        path = tmp.name
    try:
        # Imported measures already carry their notation. Re-running
        # makeNotation rewrites OMR rhythms and can fail when voice IDs change
        # between measures (makeTies assumes the next measure has the same IDs).
        score = score_or_part if isinstance(score_or_part, m21.stream.Score) else m21.stream.Score([score_or_part])
        score.write("musicxml", fp=path, makeNotation=False)
        with open(path, encoding="utf-8") as f:
            return f.read()
    finally:
        os.unlink(path)


def preview_tab_spacing(svg, measures):
    """Required/current spacing ratio for numeric frets on each string.

    Row breaks always use numbers, independently of the browser's solfege
    display toggle. Textual note names do not participate in this calculation.

    Verovio notehead uses carry absolute engraving coordinates, shared by all
    measures. Compare those same anchors used by the browser, including labels
    across barlines and strings with empty cells between two occupied cells.
    """
    root = ET.fromstring(svg)
    ns = {"s": "http://www.w3.org/2000/svg"}
    anchors = {}
    for note in root.findall('.//s:g[@class="note"]', ns):
        use = note.find('s:g[@class="notehead"]/s:use', ns)
        if use is None:
            continue
        match = re.search(r'translate\(([-\d.]+)[, ]', use.get("transform", ""))
        if match:
            anchors[note.get("data-id", note.get("id"))] = float(match.group(1))
    # Engraving coordinates have 180 units per staff space. The UI uses
    # 1.5 staff spaces for digits; allow 0.8 em per digit plus a visible gap.
    font = 1.5 * 180
    previous = [None] * 6
    ratio = 1.0
    for measure in measures:
        for col in measure["columns"]:
            xs = [anchors[n.id] for n, _ in col["notes"] if n.id in anchors]
            if not xs:
                continue
            x = min(xs)
            for string, fret in enumerate(col["cells"]):
                if fret is None:
                    continue
                half_width = len(str(fret)) * .8 * font / 2
                if previous[string] is not None:
                    old_x, old_half_width = previous[string]
                    gap = x - old_x
                    if gap > 0:
                        ratio = max(ratio, (old_half_width + half_width + .35 * font) / gap)
                previous[string] = (x, half_width)
    return ratio


def preview_rows(part, measures_per_row, measures=None):
    """One SVG per row of measures (notation only, the tab is ascii-tabs)."""
    toolkit = new_toolkit(PREVIEW_OPTIONS)
    shown = copy.deepcopy(part)
    # The row needs the width, not a label
    for named in [shown, *shown.recurse().getElementsByClass(m21.instrument.Instrument)]:
        named.partName = named.partAbbreviation = ""
    # Row breaks are chosen here, independently of the imported page layout.
    for layout in list(shown.recurse().getElementsByClass(m21.layout.LayoutBase)):
        layout.activeSite.remove(layout)
    single = m21.stream.Score([shown])
    if not toolkit.loadData(to_musicxml(single)):
        raise RuntimeError("Verovio no pudo leer el MusicXML")
    count = len(part.getElementsByClass(m21.stream.Measure))
    rows = []
    start = 1
    while start <= count:
        end = min(count, start + measures_per_row - 1)
        while True:
            # measureRange counts measures in document order, from 1
            toolkit.select({"measureRange": f"{start}-{end}"})
            toolkit.redoLayout()
            svg = toolkit.renderToSVG(1)
            if end == start or svg_width(svg) <= PREVIEW_MAX_ROW:
                break
            end -= 1
        rows.append({"first": start - 1, "last": end - 1, "svg": svg})
        start = end + 1
    # Justify with the engraver so only note spacing grows, not glyphs or
    # staff height. Keep a short final row at its natural width.
    target = max([PREVIEW_MIN_ROW, *(svg_width(row["svg"]) for row in rows)])
    page_width = math.ceil(target * 100 / PREVIEW_OPTIONS["scale"])
    toolkit.setOptions({"breaks": "encoded", "pageWidth": page_width,
                        "minLastJustification": 0})
    # Repack from the start: a rejected last measure becomes the first measure
    # of the next row. Test the final justified spacing, not natural widths.
    packed = []
    start = 0
    while start < count:
        end = min(count - 1, start + measures_per_row - 1)
        while True:
            toolkit.setOptions({"breaks": "none"})
            toolkit.select({"measureRange": f"{start + 1}-{end + 1}"})
            toolkit.redoLayout()
            natural = toolkit.renderToSVG(1)
            if end > start and svg_width(natural) > PREVIEW_MAX_ROW:
                end -= 1
                continue
            toolkit.setOptions({"breaks": "encoded"})
            toolkit.redoLayout()
            svg = toolkit.renderToSVG(1)
            fits = measures is None or preview_tab_spacing(svg, measures[start:end + 1]) <= 1
            if fits or end == start:
                # A short last row stays natural only if its frets also fit.
                if end == count - 1 and end - start + 1 < measures_per_row and (
                        measures is None or preview_tab_spacing(natural, measures[start:end + 1]) <= 1):
                    svg = natural
                packed.append({"first": start, "last": end, "svg": engraving.engrave(svg)})
                break
            end -= 1
        start = end + 1
    return packed


def svg_width(svg):
    match = re.search(r'<svg[^>]*\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+)', svg)
    return float(match.group(1)) if match else 0


def build_tab_staff(part, measures, tuning):
    """Deep copy of the notation staff turned into a TAB staff: every plucked
    note gets <technical><string/><fret/>; rests, tie continuations and
    unplayable notes become invisible rests that keep the rhythm."""
    opens = open_midis(tuning)
    frets, extras, harmonics = {}, {}, set()
    for m in measures:
        for col in m["columns"]:
            for note, midi in col["notes"]:
                if id(note) in col["fingering"]:
                    frets[note.editorial.tabKey] = col["fingering"][id(note)]
                    # Still a harmonic only while the edited cell is the string's twelfth fret.
                    if col.get("harmonics", {}).get(midi) is not None and frets[note.editorial.tabKey] == (col["harmonics"][midi], fingering.HARMONIC_FRET):
                        harmonics.add(note.editorial.tabKey)
            if col.get("extra") and col["notes"]:
                extras[col["notes"][0][0].editorial.tabKey] = col["extra"]

    tab = copy.deepcopy(part)
    drop = (m21.clef.Clef, m21.key.KeySignature, m21.meter.TimeSignature, m21.spanner.Spanner,
            m21.expressions.TextExpression, m21.tempo.TempoIndication, m21.dynamics.Dynamic,
            m21.expressions.RehearsalMark, m21.repeat.RepeatExpression, m21.layout.LayoutBase)
    for el in list(tab.recurse().getElementsByClass(drop)):
        el.activeSite.remove(el)
    first = tab.getElementsByClass(m21.stream.Measure).first()
    if first is not None:
        first.insert(0, m21.clef.TabClef())
        first.insert(0, m21.layout.StaffLayout(staffLines=6))

    def fretted(s, f, length, key=None):
        n = m21.note.Note(midi=opens[s] + f, quarterLength=length)
        if key in harmonics:
            n.id = f"{HARMONIC_ID}{key}"  # engraved as <12>: see `mark_harmonic_frets`
        # music21 only exports a chord's articulations on its first note, except
        # fingerings, which go one per note: carry "string/fret" in a fingering
        # and let fix_technical() rewrite it as <string>/<fret>.
        n.articulations = [m21.articulations.Fingering(f"{s + 1}/{f}")]
        return n

    for general in list(tab.recurse().notesAndRests):
        site, length = general.activeSite, general.duration.quarterLength
        if general.duration.isGrace:
            site.remove(general)
            continue
        members = [] if general.isRest else (
            general.notes if isinstance(general, m21.chord.Chord) else [general])
        tones, harmonic_tones = [], {}
        for note in members:
            key = getattr(note.editorial, "tabKey", None)
            if key in frets:
                tones.append(frets[key])
                if key in harmonics:
                    harmonic_tones[frets[key]] = key
            tones.extend(extras.get(key, []))
        if tones:
            notes = [fretted(s, f, length, harmonic_tones.get((s, f))) for s, f in sorted(set(tones))]
            if len(notes) == 1:
                new = notes[0]
            else:
                new = m21.chord.Chord(notes, quarterLength=length)
                new.articulations = [a for n in new.notes for a in n.articulations]
            new.duration = copy.deepcopy(general.duration)
            new.stemDirection = "noStem"
        else:
            new = m21.note.Rest(quarterLength=length)
            new.duration = copy.deepcopy(general.duration)
            new.style.hideObjectOnPrint = True
        site.replace(general, new)
    return tab


def extract_header(score):
    """Keep the title and its two nearby credits (author and transcriber).

    Audiveris also exports publishers, footers and stray notation as credits.
    Only consider text within six title font sizes of the title, rather than
    promoting every large text on the first page into the heading.
    """
    lines = []
    for box in score.getElementsByClass(m21.text.TextBox):
        size = float(box.style.fontSize or 0)
        text = (box.content or "").strip()
        if box.page in (1, None) and size >= 8 and not re.fullmatch(r"[\d\s/.,]*", text):
            lines.append((-float(box.style.absoluteY or 0), size, text))
    metadata = score.metadata
    if not lines:  # no positioned text (plain MusicXML): the declared credits
        credits = []
        if metadata:
            for role in ("composer", "transcriber"):
                for value in metadata[role]:
                    text = str(value).strip()
                    if text and text not in credits:
                        credits.append(text)
        return (metadata.title if metadata else None), credits
    # Positioned text exists: keep only what sits next to the title. Declared
    # credits are not trusted here, OMR may have filed footer text under them.
    y, size, title = max(lines, key=lambda line: line[1])
    nearby = sorted((line for line in lines
                     if line[2] != title and abs(line[0] - y) <= size * 6),
                    key=lambda line: abs(line[0] - y))[:2]
    return title, [text for _, _, text in sorted(nearby)]


def fix_technical(xml):
    return re.sub(r"<fingering[^>]*>(\d+)/(\d+)</fingering>", r"<string>\1</string><fret>\2</fret>", xml)


def clean_labels(xml):
    """No instrument name or abbreviation drawn left of the systems."""
    xml = re.sub(r"<part-name\b[^>]*>.*?</part-name>", '<part-name print-object="no"></part-name>', xml, flags=re.S)
    return re.sub(r"\s*<part-abbreviation\b[^>]*>.*?</part-abbreviation>", "", xml, flags=re.S)


def add_credits(xml, title, subtitles):
    """Page header as explicit credits (Verovio ignores the composer
    otherwise): the title centred and the authors right-aligned, plus a blank
    centred line that leaves room before the first system. Verovio ignores the
    credits' font; style_header() sets it on the SVG."""
    words = []
    if title:
        words.append(("center", 1050, title))
    if subtitles:
        words.append(("right", 1900, " · ".join(subtitles)))
    if words:
        words.append(("center", 1050, " "))
    credits = "".join(
        f'<credit page="1"><credit-words default-x="{x}" default-y="{1150 - i * 60}" justify="{j}" '
        f'valign="top">{escape(text)}</credit-words></credit>'
        for i, (j, x, text) in enumerate(words))
    return xml.replace("<part-list>", credits + "<part-list>", 1)


HEADER_FONT = "Playfair Display, Times New Roman, Liberation Serif, DejaVu Serif, serif"


def style_header(svg):
    """Serif header: the title a bit larger than Verovio's default size, the
    authors smaller (the blank spacer line keeps the default)."""
    def restyle(head):
        count = iter(range(1000))

        def size(match):
            n = next(count)
            if match.group(2).strip() == "":
                return match.group(0)
            return f'{match.group(1)}{"470" if n == 0 else "300"}px">{match.group(2)}'

        body = re.sub(r'(<tspan font-size=")\d+px">([^<]*)', size, head.group(2))
        return f'{head.group(1)} font-family="{HEADER_FONT}">{body}'

    return re.sub(r'(<g [^>]*class="pgHead")>(.*?</g>)', restyle, svg, count=1, flags=re.S)


def draw_tab_clef(svg):
    """Replaces Verovio's TAB clef (SMuFL E06D, drawn large and black) with a
    solid black T-A-B with no background. The letters sit in the three
    middle spaces between lines, so no staff line crosses them."""

    def staff(match):
        body = match.group(0)
        ys = sorted({float(y) for _, y, _, y2 in re.findall(
            r'<path d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)"', body) if y == y2})[-6:]
        # Only the six strings: a first/second-ending bracket falling in this body (a system that starts inside
        # an ending) is a horizontal line too and would stretch the letters.
        if len(ys) < 4:
            return body
        gap = (ys[-1] - ys[0]) / (len(ys) - 1)
        mid = len(ys) // 2  # T, A, B fill the spaces around the staff's centre

        def clef(c):
            x = float(c.group(2))
            letters = "".join(
                f'<text x="{x + 0.65 * gap:.0f}" y="{(ys[mid - 2 + i] + ys[mid - 1 + i]) / 2 + 0.43 * gap:.0f}" text-anchor="middle" '
                f'font-family="sans-serif" font-weight="bold" font-size="{1.2 * gap:.0f}px" '
                f'fill="#000000" stroke="none">{ch}</text>' for i, ch in enumerate("TAB"))
            return f'{c.group(1)}>{letters}</g>'

        return re.sub(r'(<g [^>]*class="clef")>\s*<use xlink:href="#E06D[^>]*?translate\(([\d.]+), [\d.]+\)[^>]*/>\s*</g>',
                      clef, body, flags=re.S)

    return re.sub(r'<g [^>]*class="staff"[^>]*>.*?(?=<g [^>]*class="staff"|</svg>|\Z)', staff, svg, flags=re.S)


def mark_harmonic_frets(svg):
    """Natural harmonics are written between angle brackets on the TAB: <12>. Verovio draws the fret as a plain number, so the
    notes `build_tab_staff` gave a HARMONIC_ID get their number wrapped."""
    return re.sub(r'(<g [^>]*id="%s\d+"[^>]*>\s*<text[^>]*>\s*<tspan[^>]*>)(\d+)(</tspan>)' % HARMONIC_ID,
                  lambda m: f"{m.group(1)}&lt;{m.group(2)}&gt;{m.group(3)}", svg)


def drop_tab_meter(svg):
    """The meter belongs to the notation staff: remove it from every TAB staff
    (the second staff of each measure), where Verovio repeats it."""
    parts = re.split(r'(<g [^>]*class="staff"[^>]*>)', svg)
    for i in range(4, len(parts), 4):  # pre, staff, body, staff, body (TAB), ...
        parts[i] = re.sub(r'<g [^>]*class="meterSig"[^>]*>.*?</g>', "", parts[i], flags=re.S)
    return "".join(parts)


def drop_brace(svg):
    return re.sub(r'<g [^>]*class="grpSym"[^>]*>.*?</g>', "", svg, flags=re.S)


def add_staff_tuning(xml, tuning):
    """music21 drops the TAB staff's StaffLayout when it merges both staves
    into one part (Verovio then draws 5 lines), and never writes a tuning:
    add <staff-details> with 6 lines and the tuning after the TAB clef."""
    pitches = [m21.pitch.Pitch(p) for p in tuning.split(",")]
    tunings = "".join(
        f'<staff-tuning line="{i + 1}"><tuning-step>{p.step}</tuning-step>'
        + (f"<tuning-alter>{int(p.accidental.alter)}</tuning-alter>" if p.accidental else "")
        + f"<tuning-octave>{p.octave}</tuning-octave></staff-tuning>"
        for i, p in enumerate(pitches))
    details = f'<staff-details number="2"><staff-lines>{len(pitches)}</staff-lines>{tunings}</staff-details>'
    return re.sub(r'(<clef number="2">\s*<sign>TAB</sign>.*?</clef>)', lambda m: m.group(1) + details,
                  xml, count=1, flags=re.S)


def add_string_names(svg, names):
    """Writes the string names left of the first TAB staff of a Verovio page,
    one per line, left of the staff. Verovio draws no tuning. The names are
    centred on one column: right-aligned, glyphs of different widths leave
    ragged left edges."""
    system = re.search(r'<g [^>]*class="system"[^>]*>', svg)
    if not system:
        return svg
    staves = list(re.finditer(r'<g [^>]*class="staff"[^>]*>', svg[system.end():]))
    if len(staves) < 2:  # notation staff, then the TAB staff of the first measure
        return svg
    start = system.end() + staves[1].end()
    lines = svg[start:svg.find("<g ", start)]
    segments = [(float(x), float(y)) for x, y in re.findall(r'<path d="M([\d.]+) ([\d.]+) L', lines)]
    ys = sorted({y for _, y in segments})
    if len(ys) != len(names):
        return svg
    left = min(x for x, _ in segments)
    gap = (ys[-1] - ys[0]) / (len(ys) - 1)
    texts = "".join(f'<text x="{left - 0.9 * gap:.0f}" y="{y + 0.34 * gap:.0f}" text-anchor="middle" '
                    f'font-size="{0.95 * gap:.0f}px" font-family="sans-serif">{name}</text>'
                    for name, y in zip(names, ys))
    return svg[:system.end()] + f'<g class="stringNames">{texts}</g>' + svg[system.end():]


def inject_endings(xml, part):
    """First/second-time brackets (`RepeatBracket`) of `part` as MusicXML `<ending>`.

    music21 drops them when two staves share a part, but Verovio needs them to draw the brackets."""
    def edit(number, update):
        pattern = re.compile(r'(<measure\b[^>]*\bnumber="%s"[^>]*>)(.*?)(</measure>)' % number, re.S)
        return pattern.sub(lambda m: m.group(1) + update(m.group(2)) + m.group(3), xml, count=1)

    def add(body, location, element):
        barline = re.compile(r'(<barline location="%s">)(.*?)(</barline>)' % location, re.S)
        if barline.search(body):
            def put(m):
                inner = m.group(2)
                i = inner.find("<repeat")
                inner = inner[:i] + element + inner[i:] if i >= 0 else inner + element
                return m.group(1) + inner + m.group(3)
            return barline.sub(put, body, count=1)
        bar = '<barline location="%s">%s</barline>' % (location, element)
        if location == "right":
            return body + bar
        i = body.find("<note")
        return body[:i] + bar + body[i:]

    for bracket in part.recurse().getElementsByClass(m21.spanner.RepeatBracket):
        spanned = [m for m in bracket.getSpannedElements() if isinstance(m, m21.stream.Measure)]
        if not spanned:
            continue
        label = str(bracket.number).replace(",", ", ")
        first, last = spanned[0].number, spanned[-1].number
        xml = edit(first, lambda body: add(body, "left", '<ending number="%s" type="start"/>' % label))

        def close(body):
            kind = "stop" if re.search(r'<repeat direction="backward"', body) else "discontinue"
            return add(body, "right", '<ending number="%s" type="%s"/>' % (label, kind))
        xml = edit(last, close)
    return xml


def build_output(score, part, measures, tuning, title, out_base, header=None):
    """Writes <out_base>.musicxml and <out_base>.pdf; returns their paths.

    `header` is (title, subtitles) when the score no longer carries the credits
    (export rebuilds from persisted MusicXML)."""
    notation = m21.stream.PartStaff()
    tab_staff = m21.stream.PartStaff()
    for src, dst in ((copy.deepcopy(part), notation), (build_tab_staff(part, measures, tuning), tab_staff)):
        for el in src:
            dst.insert(src.elementOffset(el), el)
    group = m21.layout.StaffGroup([notation, tab_staff], symbol="bracket", barTogether=True)
    out = m21.stream.Score([notation, tab_staff, group])
    found, subtitles = header if header is not None else extract_header(score)
    out.metadata = m21.metadata.Metadata()
    out.metadata.title = title if found is None else found
    if subtitles:
        out.metadata.composer = " · ".join(subtitles)
    xml = inject_endings(add_staff_tuning(fix_technical(to_musicxml(out)), tuning), part)
    xml = add_credits(clean_labels(xml), out.metadata.title, subtitles)
    xml_path = out_base + ".musicxml"
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml)

    toolkit = new_toolkit(PDF_OPTIONS)
    if not toolkit.loadData(xml):
        raise RuntimeError("Verovio no pudo leer el MusicXML con tablatura")
    with tempfile.TemporaryDirectory() as tmp:
        pages = []
        for page in range(1, toolkit.getPageCount() + 1):
            svg = engraving.engrave(toolkit.renderToSVG(page))
            if page == 1:
                svg = add_string_names(svg, string_names(tuning))
                svg = style_header(svg)
            svg = mark_harmonic_frets(drop_brace(draw_tab_clef(drop_tab_meter(svg))))
            svg = svg.replace("</svg>", HIDE_TAB_RHYTHM + "</svg>", 1)
            path = os.path.join(tmp, f"page-{page:03d}.svg")
            with open(path, "w", encoding="utf-8") as f:
                f.write(svg)
            pages.append(path)
        pdf_path = out_base + ".pdf"
        subprocess.run(["rsvg-convert", "-f", "pdf", "-b", "white", "-o", pdf_path, *pages], check=True)
    return xml_path, pdf_path


# --- Pure operations on artifacts ------------------------------------------

TUNINGS = {"standard": STANDARD_TUNING, "dropd": DROP_D_TUNING, "lowf": LOW_F_TUNING}
SUGGESTION_VERSION = 1
HARMONIC_ID = "tab-harmonic-"
NORMALIZED_NAME = "normalized.musicxml"
SUGGESTION_NAME = "suggestion.json"
PREVIEW_NAME = "preview.json"
FINAL_NAMES = {"pdf": "score.pdf", "musicxml": "score.musicxml", "tabs": "tabs.json"}


class NoNotesError(ValueError):
    """The score has no playable notes (API code `no_notes`)."""


def tuning_key(tuning):
    return next(k for k, v in TUNINGS.items() if v == tuning)


def _read_normalized(path):
    _, part = load_score([str(path)])
    return part


def _write_json(path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)


def _suggestion(measures, tuning, shifts, title, subtitles, uneven=()):
    return {
        "version": SUGGESTION_VERSION,
        "tuning": tuning_key(tuning),
        "tuning_notes": tuning,
        "string_names": string_names(tuning),
        "title": title,
        "subtitles": subtitles,
        # Uploads merge a pitch sounding in two voices at once into one note; export must rebuild the same columns.
        "merge_unisons": True,
        # Notes under a diamond head / <harmonic> are natural harmonics (fret 12 of their string, `harmonic_cells`).
        "harmonics": True,
        "octave_shifts": shifts,
        "octave_shift": max(set(shifts), key=shifts.count, default=0),
        "measure_numbers": [m["number"] for m in measures],
        # Per measure, per Column: deterministic note ids and sounding midis.
        "columns": [[{"offset": c["offset"],
                      "note_ids": [n.id for n, _ in c["notes"]],
                      "midis": [midi for _, midi in c["notes"]]} for c in m["columns"]]
                    for m in measures],
        "dropped": [{"measure": n, "pitch": p} for n, p in dropped_notes(measures)],
        "arpeggio_measures": [m["number"] for m in measures if m.get("arpeggio")],
        # 0-based indices (into `tabs`) of the measures whose rhythm does not add up: the preview flags them.
        "uneven_measures": list(uneven),
        # One ascii-tabs Tab (Column[]) per measure: the Digitación sugerida.
        "tabs": [[c["cells"] for c in m["columns"]] for m in measures],
        # Per measure, per Column: the barre (fret, strings) written over it, or null (`fingering.parse_barre`).
        "barres": [[c.get("barre") for c in m["columns"]] for m in measures],
        "preview_columns": [preview_columns(m) for m in measures],
        # Per measure, per Column: the strings (0 = highest) whose cell is a natural harmonic, drawn <12> in the PDF.
        "harmonic_cells": [[sorted(c["harmonics"].values()) for c in m["columns"]] for m in measures],
    }


def prepare(input_path, kind, tuning, out_dir, per_row=4, arpeggio="auto"):
    """Input score -> normalized MusicXML + suggested fingering + preview.

    `input_path` is one MusicXML/MXL file or a list of them (OCR movements).
    `kind` is 'musicxml' or 'pdf-ocr-output' (the MusicXML Audiveris wrote);
    both are read the same way. `tuning` is 'auto', 'standard' or 'dropd'.
    `arpeggio` is 'auto' (detect arpeggio measures), True or False: see `assign_frets`.
    Writes normalized.musicxml, suggestion.json, preview.json and
    preview-NN.svg into out_dir and returns a dict describing them.
    """
    if kind not in ("musicxml", "pdf-ocr-output"):
        raise ValueError(f"kind inválido: {kind}")
    if tuning not in ("auto", *TUNINGS):
        raise ValueError(f"afinación inválida: {tuning}")
    paths = [input_path] if isinstance(input_path, (str, os.PathLike)) else list(input_path)
    os.makedirs(out_dir, exist_ok=True)

    score, part = load_score([str(p) for p in paths], repair_voices=True, harmonics=True)
    shifts = octave_shifts(list(part.getElementsByClass(m21.stream.Measure)))
    title, subtitles = extract_header(score)
    xml_path = os.path.join(out_dir, NORMALIZED_NAME)
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(to_musicxml(m21.stream.Score([part])))

    # Everything downstream reads the persisted artifact, exactly like export,
    # so the deterministic note ids are the same in both operations.
    part = _read_normalized(xml_path)
    measures, _ = build_columns(part, shifts, merge_unisons=True, harmonics=True)
    if not any(m["columns"] for m in measures):
        raise NoNotesError("No se reconocieron notas en la partitura.")
    resolved = TUNINGS.get(tuning) or guess_tuning(measures)
    assign_frets(measures, resolved, arpeggio, sustain=True)
    suggestion = _suggestion(measures, resolved, shifts, title, subtitles, uneven_measures(xml_path))
    suggestion_path = os.path.join(out_dir, SUGGESTION_NAME)
    _write_json(suggestion_path, suggestion)

    rows = preview_rows(part, max(1, min(8, per_row)), measures)
    svg_paths, rows_meta = [], []
    for i, row in enumerate(rows):
        name = f"preview-{i + 1:02d}.svg"
        svg_paths.append(os.path.join(out_dir, name))
        with open(svg_paths[-1], "w", encoding="utf-8") as f:
            f.write(row["svg"])
        rows_meta.append({"svg": name, "first": row["first"], "last": row["last"]})
    preview_path = os.path.join(out_dir, PREVIEW_NAME)
    _write_json(preview_path, {"staff_space": PREVIEW_STAFF_SPACE, "rows": rows_meta})
    return {
        "kind": kind,
        "musicxml": xml_path,
        "suggestion": suggestion_path,
        "preview": preview_path,
        "preview_svgs": svg_paths,
        "tuning": suggestion["tuning"],
        "title": title,
        "dropped": suggestion["dropped"],
        "measures": len(measures),
    }


def export(musicxml_path, suggestion_path, tabs, tuning, out_dir, title=None, subtitle=None):
    """Persisted artifacts + edited tabs -> PDF, final MusicXML, tabs JSON.

    `tabs` is one ascii-tabs Tab (Column list) per measure. `tuning` is
    'standard', 'dropd' or None/'auto' to keep the suggestion's tuning.
    Edited cells map to notes by pitch; cells matching no note only reach the
    TAB staff, never the notation. `title` and `subtitle` (the author line)
    replace the extracted header when given; an empty string clears it.
    """
    with open(suggestion_path, encoding="utf-8") as f:
        suggestion = json.load(f)
    part = _read_normalized(musicxml_path)
    measures, _ = build_columns(part, suggestion["octave_shifts"], suggestion.get("merge_unisons", False),
                                suggestion.get("harmonics", False))
    if [[[n.id for n, _ in c["notes"]] for c in m["columns"]] for m in measures] != \
            [[c["note_ids"] for c in m] for m in suggestion["columns"]]:
        raise ValueError("El MusicXML no coincide con la sugerencia guardada.")
    if not isinstance(tabs, list) or len(tabs) != len(measures):
        raise ValueError("La tablatura enviada no coincide con los compases de la partitura.")
    chosen = TUNINGS.get(tuning) or suggestion["tuning_notes"]
    apply_edits(measures, tabs, chosen)
    os.makedirs(out_dir, exist_ok=True)
    header_title = suggestion.get("title") if title is None else title.strip()
    subtitles = suggestion.get("subtitles") or []
    if subtitle is not None:
        subtitles = [subtitle.strip()] if subtitle.strip() else []
    xml_path, pdf_path = build_output(
        None, part, measures, chosen, header_title or "Partitura",
        os.path.join(out_dir, "score"), header=(header_title, subtitles))
    tabs_path = os.path.join(out_dir, FINAL_NAMES["tabs"])
    _write_json(tabs_path, tabs)
    return {"pdf": pdf_path, "musicxml": xml_path, "tabs": tabs_path, "tuning": tuning_key(chosen)}
