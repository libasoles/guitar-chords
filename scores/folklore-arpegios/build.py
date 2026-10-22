#!/usr/bin/env python3
"""Compile the editable collection into checked MusicXML and an A4 score book.

Requires verovio==6.*, rsvg-convert and Poppler's pdfinfo. No source PDFs,
network calls, fonts installed by this script, or automatic fingering search.
"""

import argparse
import copy
import json
from pathlib import Path
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

import verovio

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OPEN = [64, 59, 55, 50, 45, 40]
PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
KINDS = {1: ("16th", False), 2: ("eighth", False), 3: ("eighth", True),
         4: ("quarter", False), 6: ("quarter", True), 8: ("half", False), 12: ("half", True)}
CHORDS = {"C": {0, 4, 7}, "G": {7, 11, 2}, "G7": {7, 11, 2, 5},
          "Am": {9, 0, 4}, "A7": {9, 1, 4, 7}, "E7": {4, 8, 11, 2},
          "Dm": {2, 5, 9}, "D7": {2, 6, 9, 0}, "Em": {4, 7, 11},
          "B7": {11, 3, 6, 9}, "F": {5, 9, 0}}


def sub(parent, tag, value=None, **attributes):
    child = ET.SubElement(parent, tag, attributes)
    if value is not None:
        child.text = str(value)
    return child


def position(cell):
    string, fret = map(int, cell.split("/"))
    assert 1 <= string <= 6 and 0 <= fret <= 5, cell
    return string, fret


def pitches(cells):
    return [OPEN[s - 1] + f for s, f in map(position, cells)]


def resolve(token, shape):
    """Roles or literal string/fret positions; lists make simultaneous notes."""
    if isinstance(token, list):
        return [cell for item in token for cell in resolve(item, shape)]
    return resolve(shape[token], shape) if token in shape else [token]


def expand(collection, exercise):
    length = 8 if exercise["compas"] == "2/4" else 12
    bars = []
    for index, specification in enumerate(exercise["compases"]):
        spec = {"acorde": specification} if isinstance(specification, str) else specification
        shape = collection["formas"][spec["acorde"]]
        pattern_name = spec.get("patron", exercise["patron"])
        pattern = copy.deepcopy(collection["patrones"][pattern_name])
        if index == len(exercise["compases"]) - 1:
            pattern = copy.deepcopy(exercise["final"])
        voices = {}
        for name, events in pattern.items():
            voices[name] = [{"at": at, "duration": duration,
                             "cells": resolve(token, shape),
                             "accent": bool(extra and extra[0])}
                            for at, duration, token, *extra in events]
        bars.append({"chord": spec["acorde"], "pattern": pattern_name,
                     "length": length, "voices": voices})
    return bars


def validate(exercise, bars):
    assert 0 < exercise["repetir_hasta"] < len(bars)
    for number, bar in enumerate(bars, 1):
        context = f"ejercicio {exercise['numero']}, compás {number}"
        for events in bar["voices"].values():
            end = 0
            for event in events:
                assert end <= event["at"] and event["duration"] in KINDS, context
                end = event["at"] + event["duration"]
                assert end <= bar["length"], context
                assert all(midi % 12 in CHORDS[bar["chord"]] for midi in pitches(event["cells"])), context
        # Check sustained notes as well as new attacks. A lower voice cannot
        # keep sounding on a string that the upper voice needs to re-fret.
        for slot in range(bar["length"]):
            held = [cell for events in bar["voices"].values() for event in events
                    if event["at"] <= slot < event["at"] + event["duration"] for cell in event["cells"]]
            positions = list(map(position, held))
            assert len({s for s, _ in positions}) == len(positions), (context, slot, held)
            fretted = [f for _, f in positions if f]
            assert len(fretted) <= 4, (context, slot, held)
            assert not fretted or max(fretted) - min(fretted) <= 3, (context, slot, held)
    assert bars[-1]["chord"] in {"Am", "Em", "C", "G"}


def segments(events, length):
    result, cursor = [], 0
    for event in events:
        if event["at"] > cursor:
            result.extend(rests(cursor, event["at"] - cursor))
        result.append(event)
        cursor = event["at"] + event["duration"]
    result.extend(rests(cursor, length - cursor))
    return result


def rests(at, duration):
    out = []
    for length in (12, 8, 6, 4, 3, 2, 1):
        while duration >= length:
            out.append({"at": at, "duration": length, "cells": [], "accent": False})
            at += length
            duration -= length
    return out


def beam_map(events, bounds):
    beams = {}
    for start, end in zip(bounds, bounds[1:]):
        # A rest breaks the beam. Dotted eighth + sixteenth is one group.
        runs, run = [], []
        for i, event in enumerate(events):
            if start <= event["at"] < end:
                if event["cells"] and event["duration"] <= 3:
                    run.append(i)
                elif run:
                    runs.append(run)
                    run = []
        if run:
            runs.append(run)
        for run in runs:
            if len(run) < 2:
                continue
            for j, i in enumerate(run):
                beams[i] = {1: "begin" if j == 0 else "end" if j == len(run) - 1 else "continue"}
                if events[i]["duration"] == 1:
                    prev = j > 0 and events[run[j - 1]]["duration"] == 1
                    nxt = j < len(run) - 1 and events[run[j + 1]]["duration"] == 1
                    beams[i][2] = "continue" if prev and nxt else "end" if prev else "begin" if nxt else "backward hook" if j else "forward hook"
    return beams


def add_note(measure, event, staff, voice, accidentals, beams, fermata=False, visible_rest=False):
    cells = event["cells"] or [None]
    for i, cell in enumerate(cells):
        n = sub(measure, "note", **({"print-object": "no"} if cell is None and not visible_rest else {}))
        if i:
            sub(n, "chord")
        if cell:
            string, fret = position(cell)
            # With an octave-transposing treble clef, MusicXML carries the
            # sounding pitch. Verovio places it one octave higher on paper.
            midi = OPEN[string - 1] + fret
            spelling = PITCHES[midi % 12]
            step, alter, octave = spelling[0], int("#" in spelling), midi // 12 - 1
            pitch = sub(n, "pitch")
            sub(pitch, "step", step)
            if alter:
                sub(pitch, "alter", alter)
            sub(pitch, "octave", octave)
        else:
            sub(n, "rest")
        sub(n, "duration", event["duration"])
        sub(n, "voice", voice)
        kind, dotted = KINDS[event["duration"]]
        sub(n, "type", kind)
        if dotted:
            sub(n, "dot")
        if cell and staff == 1:
            previous = accidentals.get((step, octave), accidentals.get(step, 0))
            if previous != alter:
                sub(n, "accidental", "sharp" if alter else "natural")
            accidentals[(step, octave)] = alter
        if cell:
            sub(n, "stem", "up" if voice == 1 else "down" if staff == 1 else "none")
        sub(n, "staff", staff)
        if cell and staff == 1 and i == 0:
            for level, state in beams.items():
                sub(n, "beam", state, number=str(level))
        if cell and (staff == 2 or event["accent"] or fermata):
            notations = sub(n, "notations")
            if fermata and i == 0 and staff == 1:
                sub(notations, "fermata")
            if event["accent"] and i == 0 and staff == 1:
                sub(sub(notations, "articulations"), "accent")
            if staff == 2:
                technical = sub(notations, "technical")
                sub(technical, "string", string)
                sub(technical, "fret", fret)


def musicxml(exercise, bars):
    root = ET.Element("score-partwise", version="4.0")
    sub(sub(root, "work"), "work-title", f"{exercise['numero']:02d}. {exercise['titulo']}")
    sub(sub(root, "identification"), "creator", "Estudio original · folklore argentino", type="composer")
    score_part = sub(sub(root, "part-list"), "score-part", id="P1")
    sub(score_part, "part-name", "Guitarra", **{"print-object": "no"})
    part = sub(root, "part", id="P1")
    for index, bar in enumerate(bars):
        measure = sub(part, "measure", number=str(index + 1))
        if index % 4 == 0 and index:
            sub(measure, "print", **{"new-system": "yes"})
        if index == 0:
            attrs = sub(measure, "attributes")
            sub(attrs, "divisions", 4)
            sub(sub(attrs, "key"), "fifths", exercise["quintas"])
            beats, unit = exercise["compas"].split("/")
            time = sub(attrs, "time")
            sub(time, "beats", beats)
            sub(time, "beat-type", unit)
            sub(attrs, "staves", 2)
            clef = sub(attrs, "clef", number="1")
            sub(clef, "sign", "G")
            sub(clef, "line", 2)
            sub(clef, "clef-octave-change", -1)
            sub(sub(attrs, "clef", number="2"), "sign", "TAB")
            details = sub(attrs, "staff-details", number="2")
            sub(details, "staff-lines", 6)
            for line, midi in enumerate(reversed(OPEN), 1):
                tuning = sub(details, "staff-tuning", line=str(line))
                sub(tuning, "tuning-step", PITCHES[midi % 12])
                sub(tuning, "tuning-octave", midi // 12 - 1)
            sub(sub(measure, "barline", location="left"), "repeat", direction="forward")
        acc = {step: 1 for step in "FCGDAEB"[:exercise["quintas"]]}
        for staff in (1, 2):
            for offset, name in enumerate(("agudo", "bajo")):
                voice = (staff - 1) * 2 + offset + 1
                events = segments(bar["voices"][name], bar["length"])
                size = 6 if exercise["compas"] == "6/8" and bar["pattern"] != "zamba-repique" else 4
                bounds = list(range(0, bar["length"] + 1, size))
                beams = beam_map(events, bounds)
                last_note = max((i for i, e in enumerate(events) if e["cells"]), default=-1)
                for i, event in enumerate(events):
                    add_note(measure, event, staff, voice, acc, beams.get(i, {}),
                             fermata=index == len(bars) - 1 and name == "agudo" and i == last_note,
                             visible_rest=staff == 1 and name == "agudo" and bar["pattern"] == "zamba-base")
                if not (staff == 2 and name == "bajo"):
                    sub(sub(measure, "backup"), "duration", bar["length"])
        if index + 1 == exercise["repetir_hasta"]:
            end = sub(measure, "barline", location="right")
            sub(end, "bar-style", "light-heavy")
            sub(end, "repeat", direction="backward", times="2")
        if index == len(bars) - 1:
            sub(sub(measure, "barline", location="right"), "bar-style", "light-heavy")
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def check_xml(xml, bars):
    """Check the serialized product, including duration and exact TAB pitches."""
    root = ET.fromstring(xml)
    for measure, bar in zip(root.findall("part/measure"), bars, strict=True):
        cursor, ends, notation, tab = 0, {}, [], []
        previous = 0
        for node in measure:
            if node.tag == "backup":
                cursor -= int(node.findtext("duration"))
                assert cursor == 0
            elif node.tag == "note":
                onset = previous if node.find("chord") is not None else cursor
                duration = int(node.findtext("duration"))
                voice = int(node.findtext("voice"))
                ends[voice] = max(ends.get(voice, 0), onset + duration)
                pitch = node.find("pitch")
                if pitch is not None:
                    step = pitch.findtext("step")
                    midi = (int(pitch.findtext("octave")) + 1) * 12 + PITCHES.index(step) + int(pitch.findtext("alter", "0"))
                    if node.findtext("staff") == "1":
                        notation.append((onset, duration, midi))
                    else:
                        string = int(node.findtext("notations/technical/string"))
                        fret = int(node.findtext("notations/technical/fret"))
                        assert midi == OPEN[string - 1] + fret
                        tab.append((onset, duration, midi))
                if node.find("chord") is None:
                    previous = cursor
                    cursor += duration
        assert set(ends.values()) == {bar["length"]}, ends
        assert sorted(notation) == sorted(tab)


def text_line(x, y, text, size=31, weight="normal", color="#252525"):
    return f'<text x="{x}" y="{y}" font-family="Helvetica, Arial, sans-serif" font-size="{size}" font-weight="{weight}" fill="{color}">{escape(text)}</text>'


def wrap(text, limit=100):
    lines, current = [], ""
    for word in text.split():
        if len(current) + len(word) + 1 > limit:
            lines.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    return lines + ([current] if current else [])


def page_svg(collection, exercise, xml):
    verovio.enableLog(False)
    toolkit = verovio.toolkit()
    toolkit.setOptions({"pageWidth": 2100, "pageHeight": 12000, "scale": 50,
                        "adjustPageHeight": True, "breaks": "encoded", "header": "none", "footer": "none",
                        "pageMarginTop": 0, "pageMarginBottom": 0, "pageMarginLeft": 40, "pageMarginRight": 10,
                        "spacingStaff": 8, "spacingSystem": 5, "svgViewBox": True,
                        "minLastJustification": 0.0,
                        "svgHtml5": True, "svgFormatRaw": True, "xmlIdSeed": exercise["numero"]})
    assert toolkit.loadData(xml), "Verovio no pudo leer el MusicXML"
    # Suppress TAB rhythm before layout, not only with SVG CSS: invisible
    # stems would otherwise still reserve a large gap below the notation.
    mei_ns = "http://www.music-encoding.org/ns/mei"
    mei = ET.fromstring(toolkit.getMEI())
    for parent in mei.iter():
        for child in list(parent):
            if child.tag in {f"{{{mei_ns}}}tabDurSym", f"{{{mei_ns}}}grpSym"}:
                parent.remove(child)
            elif parent.tag == f"{{{mei_ns}}}staffDef" and parent.get("n") == "2" and child.tag == f"{{{mei_ns}}}meterSig":
                parent.remove(child)
    ET.register_namespace("", mei_ns)
    assert toolkit.loadData(ET.tostring(mei, encoding="unicode"))
    assert toolkit.getPageCount() == 1
    score = toolkit.renderToSVG(1)
    # The rhythm belongs to the standard staff; the TAB only locates fingers.
    score = score.replace("</svg>", '<style>g.tabDurSym,g.tabRhythm{display:none}</style></svg>', 1)
    w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', score).groups())
    score_height = h * 1880 / w
    assert score_height < 2050, (exercise["numero"], score_height)
    # Keep Verovio's root id: its scoped CSS draws staff lines and stems.
    score = re.sub(r'<svg\b([^>]*)>',
                   lambda m: f'<svg{m.group(1)} x="110" y="475" width="1880" height="{score_height}">',
                   score, count=1)
    score = re.sub(r'^<\?xml[^>]*>\s*', '', score)
    n = exercise["numero"]
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="210mm" height="297mm" viewBox="0 0 2100 2970">',
             '<rect width="2100" height="2970" fill="white"/>',
             text_line(110, 100, collection["titulo"].upper(), 26, color="#666666"),
             text_line(110, 190, f"{n:02d}  {exercise['titulo']}", 54, "bold"),
             text_line(110, 252, f"{exercise['ritmo']} · {exercise['compas']}" + (" · cruce con 3/4" if exercise["compas"] == "6/8" else ""), 32),
             '<line x1="110" y1="290" x2="1990" y2="290" stroke="#999" stroke-width="1"/>']
    for i, line in enumerate(wrap(exercise["objetivo"], 103)):
        parts.append(text_line(110, 345 + i * 39, line, 31))
    repeat = exercise["repetir_hasta"]
    parts.append(text_line(110, 427, f"Repetí los compases 1-{repeat}; después continuá hasta el final.", 28, color="#555555"))
    parts.append(score)
    y = max(475 + score_height + 95, 2330)
    assert y < 2600
    parts.append(text_line(110, y, "PARA ESTUDIAR", 24, "bold", "#666666"))
    for i, line in enumerate(wrap(exercise["practica"], 108)):
        parts.append(text_line(110, y + 48 + i * 37, line, 28))
    parts.extend(['<line x1="110" y1="2770" x2="1990" y2="2770" stroke="#bbb" stroke-width="1"/>',
                  text_line(110, 2820, "Afinación estándar · pentagrama y TAB · sin digitaciones de dedos", 24, color="#666666"),
                  text_line(110, 2860, "Versión 1 · material de estudio original · octubre de 2026", 23, color="#666666"),
                  text_line(1930, 2860, f"{n:02d}", 26), '</svg>'])
    return "\n".join(parts)


def build(output):
    collection = json.loads((HERE / "coleccion.json").read_text())
    assert collection["afinacion"] == ["E4", "B3", "G3", "D3", "A2", "E2"], "Esta edición usa afinación estándar"
    xml_dir = output / "musicxml" / "folklore-arpegios"
    pdf_dir = output / "pdf"
    xml_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pages = []
    with tempfile.TemporaryDirectory(prefix="folklore-arpegios-") as temporary:
        for exercise in collection["ejercicios"]:
            bars = expand(collection, exercise)
            validate(exercise, bars)
            xml = musicxml(exercise, bars)
            check_xml(xml, bars)
            name = f"ejercicio-{exercise['numero']:02d}"
            (xml_dir / f"{name}.musicxml").write_text(xml, encoding="utf-8")
            svg = Path(temporary) / f"{name}.svg"
            svg.write_text(page_svg(collection, exercise, xml), encoding="utf-8")
            pages.append(str(svg))
            print(f"{name}: {len(bars)} compases; voces, armonía, posiciones y TAB verificados")
        pdf = pdf_dir / "folklore-arpegios.pdf"
        subprocess.run(["rsvg-convert", "-f", "pdf", "-b", "white", "-o", str(pdf), *pages], check=True)
    info = subprocess.run(["pdfinfo", str(pdf)], check=True, capture_output=True, text=True).stdout
    assert re.search(r"Pages:\s+10\b", info), info
    print(pdf)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output")
    build(parser.parse_args().output.resolve())
