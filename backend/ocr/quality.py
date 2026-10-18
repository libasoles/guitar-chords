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
