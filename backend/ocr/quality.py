"""How trustworthy is an OMR result? Counts the measures whose rhythm adds up.

OMR engines fail in different ways (lost voices, wrong durations, missing time
signature) but a good reading has measures that all last the same. The most
common measure length is taken as the real one, so no time signature is needed.
Only the first part is looked at, like the engine that consumes the result.
"""

import collections
import zipfile
from xml.etree import ElementTree as ET


def _score_xml(path):
    with open(path, "rb") as f:
        head = f.read(4)
    if head != b"PK\x03\x04":
        return ET.parse(path).getroot()
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith((".xml", ".musicxml")) and not n.startswith("META-INF"))
        return ET.fromstring(z.read(name))


def _measures(root):
    """Per measure: (note count, {voice: quarter notes}), across the first part."""
    part = root.find("part")
    if part is None:
        return []
    divisions = 1
    out = []
    for measure in part.findall("measure"):
        d = measure.find("attributes/divisions")
        if d is not None and d.text and int(d.text) > 0:
            divisions = int(d.text)
        notes, voices = 0, collections.defaultdict(float)
        for note in measure.findall("note"):
            if note.find("rest") is None:
                notes += 1
            if note.find("chord") is not None or note.find("grace") is not None:
                continue
            duration = note.find("duration")
            if duration is not None and duration.text:
                voices[note.findtext("voice", "1")] += int(duration.text) / divisions
        out.append((notes, dict(voices)))
    return out


MIN_NOTES_FOR_KEY = 12  # with fewer notes the key says nothing
STEP_PITCH_CLASS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
MAJOR_SCALE = (0, 2, 4, 5, 7, 9, 11)


def _pitch_classes(root):
    part = root.find("part")
    if part is None:
        return []
    classes = []
    for pitch in part.iter("pitch"):
        step = STEP_PITCH_CLASS.get(pitch.findtext("step"))
        if step is not None:
            classes.append((step + round(float(pitch.findtext("alter") or 0))) % 12)
    return classes


def out_of_key_ratio(paths):
    """Share of notes outside the best-fitting major scale (relative minors fit the same one).

    A correct reading of tonal music keeps this low (a few chromatic notes). Misread fingerings and
    letters show up as accidentals and stray notes and push it up, even when every measure's rhythm
    adds up, which is all `measure_quality` can see. 0.0 when there are too few notes to tell.
    """
    classes = []
    for path in paths:
        classes += _pitch_classes(_score_xml(path))
    if len(classes) < MIN_NOTES_FOR_KEY:
        return 0.0
    counts = collections.Counter(classes)
    best = max(sum(counts[(tonic + degree) % 12] for degree in MAJOR_SCALE) for tonic in range(12))
    return round(1 - best / len(classes), 3)


def measure_quality(paths):
    """{'measures', 'consistent', 'notes'} summed over the MusicXML files of one result."""
    measures = []
    for path in paths:
        measures += _measures(_score_xml(path))
    lengths = [round(max(v.values()), 3) for _, v in measures if v]
    mode = collections.Counter(lengths).most_common(1)[0][0] if lengths else 0
    consistent = sum(1 for _, v in measures
                     if v and round(max(v.values()), 3) == mode and all(round(x, 3) <= mode for x in v.values()))
    return {"measures": len(measures), "consistent": consistent, "notes": sum(n for n, _ in measures)}
