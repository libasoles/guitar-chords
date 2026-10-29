"""Measures of a MusicXML part whose rhythm does not add up, so the preview can flag them.

The most common measure length is taken as the real one (no time signature needed). A measure is uneven
when a voice is longer than that, or no voice reaches it. A pickup (first measure) and the closing measure
(last) may legitimately be short. Same idea as `backend/ocr/quality.py`, which runs in the OCR image.
"""

import collections
from xml.etree import ElementTree as ET


def _lengths(root):
    """Per measure of the first part: {voice: quarter notes}, chord members and grace notes take no time."""
    part = root.find("part")
    if part is None:
        return []
    divisions, out = 1, []
    for measure in part.findall("measure"):
        d = measure.find("attributes/divisions")
        if d is not None and d.text and int(d.text) > 0:
            divisions = int(d.text)
        voices = collections.defaultdict(float)
        for note in measure.findall("note"):
            if note.find("chord") is not None or note.find("grace") is not None:
                continue
            duration = note.find("duration")
            if duration is not None and duration.text:
                voices[note.findtext("voice", "1")] += int(duration.text) / divisions
        out.append({v: round(x, 3) for v, x in voices.items()})
    return out


def uneven_measures(path):
    """0-based indices of the measures whose rhythm does not add up (same order as the score's measures)."""
    measures = _lengths(ET.parse(path).getroot())
    mode = collections.Counter(max(v.values()) for v in measures if v).most_common(1)
    if not mode:
        return []
    mode = mode[0][0]
    last = max((i for i, v in enumerate(measures) if v), default=-1)
    out = []
    for i, v in enumerate(measures):
        if not v:
            continue
        longest = max(v.values())
        if longest > mode or (longest < mode and i not in (0, last)):
            out.append(i)
    return out
