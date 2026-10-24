"""Writes barre marks («C 7» over a dashed line) into a MusicXML score.

The collections' MusicXML comes from several readers (MuseScore files, hand transcriptions, PDF geometry); each
only has to say *where* a barre is, and this module writes it the one way `tabify.barre_spans` reads it back:

    <direction><direction-type><words>C 7</words></direction-type></direction>      before the first covered note
    <direction><direction-type><dashes type="start" number="1"/></direction-type></direction>
    ... covered notes ...
    <direction><direction-type><dashes type="stop" number="1"/></direction-type></direction>   after the last one

The line ends on the last note it covers (music21 attaches a `stop` to the note before it). A span is a dict:

    {"bar": 4, "at": 1.5, "fret": 7, "strings": 6, "end_bar": 5, "end_at": 0.0}

`bar` counts the part's measures from 1, `at` is the quarter-note offset inside it where the first covered note
starts; the barre covers every note that starts before `end_bar`/`end_at` (exclusive). Without an end it lasts to the
end of its bar. `strings` is 6 for a full barre, 3 for a half one (`fingering.barre_text`).
"""

import re
from fractions import Fraction
from xml.etree import ElementTree as ET

import fingering

SPAN_EPSILON = Fraction(1, 1000)


def note_events(root):
    """Every note and rest of the first part, in document order, as
    {element, measure, onset (Fraction, quarters in the measure), voice, rest, chord}; chord members follow the
    note that opens the chord."""
    events = []
    part = root.find("part")
    divisions = None  # set once, valid until the next <divisions>
    for number, measure in enumerate(part.findall("measure"), 1):
        clock = Fraction(0)
        for child in measure:
            if child.tag == "attributes" and child.findtext("divisions"):
                divisions = Fraction(child.findtext("divisions"))
            elif child.tag in ("backup", "forward"):
                step = Fraction(child.findtext("duration"))
                clock += step if child.tag == "forward" else -step
            elif child.tag == "note":
                if child.find("grace") is not None:
                    continue
                chord = child.find("chord") is not None
                if chord:
                    onset = events[-1]["onset"]
                else:
                    onset = clock
                    clock += Fraction(child.findtext("duration") or 0)
                events.append({"element": child, "measure": number, "onset": onset / divisions,
                               "voice": child.findtext("voice") or "1", "rest": child.find("rest") is not None,
                               "chord": chord})
    return events


def direction(inner):
    element = ET.fromstring(f'<direction placement="above"><direction-type>{inner}</direction-type></direction>')
    return element


def strip(xml):
    """`xml` without its barre marks (the directions `inject` writes), so a source can be marked again."""
    root = ET.fromstring(xml)
    for measure in root.find("part").findall("measure"):
        for element in list(measure):
            if element.tag != "direction":
                continue
            words = element.findtext("direction-type/words")
            if element.find("direction-type/dashes") is not None or (words and fingering.parse_barre(words)):
                measure.remove(element)
    return xml[:xml.index("<score-partwise")] + ET.tostring(root, encoding="unicode").replace(" />", "/>") + (
        "\n" if xml.endswith("\n") else "")


def replace(xml, spans):
    """`xml` with exactly the barres `spans` (any it already had are removed first)."""
    return inject(strip(xml), spans) if spans else strip(xml)


def inject(xml, spans):
    """`xml` (text) with the barres `spans` written in. Spans that overlap in time are not supported."""
    header = xml[:xml.index("<score-partwise")]
    root = ET.fromstring(xml)
    part = root.find("part")
    measures = part.findall("measure")
    events = note_events(root)
    heads = [e for e in events if not e["chord"]]
    parents = {child: measure for measure in measures for child in measure}
    for span in sorted(spans, key=lambda s: (s["bar"], s["at"]), reverse=True):  # later spans first: indexes stay valid
        bar, at = span["bar"], Fraction(span["at"]).limit_denominator(1000)
        end_bar = span.get("end_bar") or bar + 1  # without an end: the rest of its bar
        end_at = Fraction(span.get("end_at") or 0).limit_denominator(1000)
        if span.get("end_bar") is None and span.get("end_at") is not None:
            end_bar = bar
        covered = [e for e in heads
                   if (e["measure"], e["onset"]) >= (bar, at - SPAN_EPSILON) and (e["measure"], e["onset"]) < (end_bar, end_at)]
        first = next((e for e in covered if not e["rest"]), covered[0] if covered else None)
        if first is None:
            raise ValueError(f"No hay notas bajo la cejilla del compás {bar} (posición {span['at']})")
        same_voice = [e for e in covered if e["voice"] == first["voice"]]
        last = same_voice[-1]
        # The stop goes after the last note's chord; the start before the first note's own element.
        group_end = events.index(last)
        while group_end + 1 < len(events) and events[group_end + 1]["chord"]:
            group_end += 1
        stop_after = events[group_end]["element"]
        container = parents[stop_after]
        container.insert(list(container).index(stop_after) + 1, direction('<dashes type="stop" number="1"/>'))
        container = parents[first["element"]]
        index = list(container).index(first["element"])
        text = fingering.barre_text(span["fret"], span.get("strings", 6))
        container.insert(index, direction('<dashes type="start" number="1"/>'))
        container.insert(index, direction(f"<words>{text}</words>"))
    body = ET.tostring(root, encoding="unicode").replace(" />", "/>")  # keeps the writers' own style: diffs show the marks only
    return header + body + ("\n" if xml.endswith("\n") else "")
