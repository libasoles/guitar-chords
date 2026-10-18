"""Transcripcion manual a MusicXML de preludios en 3/4 con tresillos de corchea.

Misma idea que `transcribe_lib` (bajo en voz 2, plica abajo; resto en voz 1, plica arriba; huecos con
silencios ocultos), pero en unidades de tresillo: 9 por compas, 3 por negra. Cada evento es
`(pos, dur, pitch, dedo)`: dur 1 = corchea de tresillo, 3 = negra, 6 = blanca, 9 = blanca con puntillo.
Pitch "R" = silencio visible; "B3~" empieza una ligadura y "B3_" la termina.
"""
import os
from xml.sax.saxutils import escape

from transcribe_lib import Accidentals, parse, pitch_xml

DIVISIONS = 3
TYPES = {1: "eighth", 3: "quarter", 6: "half", 9: "half"}
LENGTH = 9
MODIFICATION = "<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>"


def _split(n):
    parts = []
    for size in (9, 6, 3, 1):
        while n >= size:
            parts.append(size)
            n -= size
    return parts


def _note(event, voice, stem, acc, beam=None, tuplet=None):
    pos, dur, pitch, finger = event
    kind = f"<type>{TYPES[dur]}</type>" + ("<dot/>" if dur == 9 else "")
    modification = MODIFICATION if dur == 1 else ""
    tuplet_xml = f'<tuplet type="{tuplet}" bracket="no"/>' if tuplet else ""
    if pitch == "R":
        notations = f"<notations>{tuplet_xml}</notations>" if tuplet_xml else ""
        return f"<note><rest/><duration>{dur}</duration><voice>{voice}</voice>{kind}{modification}{notations}</note>"
    tie_start, tie_stop = pitch.endswith("~"), pitch.endswith("_")
    step, alter, octave = parse(pitch.rstrip("~_"))
    accidental = acc.xml(step, alter, octave)
    accidental = f"<accidental>{accidental}</accidental>" if accidental else ""
    ties = ('<tie type="stop"/>' if tie_stop else "") + ('<tie type="start"/>' if tie_start else "")
    tied = ('<tied type="stop"/>' if tie_stop else "") + ('<tied type="start"/>' if tie_start else "")
    technical = f"<technical><fingering>{finger}</fingering></technical>" if finger else ""
    notations = f"<notations>{tied}{tuplet_xml}{technical}</notations>" if (tied or tuplet_xml or technical) else ""
    beam_xml = f'<beam number="1">{beam}</beam>' if beam else ""
    return (f"<note>{pitch_xml(step, alter, octave)}<duration>{dur}</duration>{ties}<voice>{voice}</voice>{kind}"
            f"{modification}{accidental}<stem>{stem}</stem>{beam_xml}{notations}</note>")


def _hidden(dur, voice, tuplet=None):
    modification = MODIFICATION if dur == 1 else ""
    notations = f'<notations><tuplet type="{tuplet}" bracket="no"/></notations>' if tuplet else ""
    return (f'<note print-object="no"><rest/><duration>{dur}</duration><voice>{voice}</voice>'
            f"<type>{TYPES[dur]}</type>{modification}{notations}</note>")


def _items(events):
    """[(kind, payload, pos)]: eventos ordenados con huecos hasta el final del compas."""
    out, cursor = [], 0
    for event in sorted(events):
        if event[0] < cursor:
            raise ValueError(f"eventos solapados en la posicion {event[0]}")
        out += [("gap", g, cursor) for g in _split(event[0] - cursor)]
        out.append(("note", event, event[0]))
        cursor = event[0] + event[1]
    out += [("gap", g, cursor) for g in _split(LENGTH - cursor)]
    return out


def _dur(kind, payload):
    return payload if kind == "gap" else payload[1]


def measure_xml(number, fifths, bass, up, first=False):
    acc = Accidentals(fifths)
    attrs = ""
    if first:
        attrs = (f"<attributes><divisions>{DIVISIONS}</divisions><key><fifths>{fifths}</fifths></key>"
                 "<time><beats>3</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>")
    items1, items2 = _items(up), _items(bass)
    # Un grupo de tresillo por pulso en la voz 1: empieza en su primer elemento de dur 1 y acaba en el ultimo.
    tuplets, beams = {}, {}
    for beat in range(3):
        group = [i for i, (kind, payload, pos) in enumerate(items1)
                 if _dur(kind, payload) == 1 and beat * 3 <= pos < beat * 3 + 3]
        if group:
            tuplets[group[0]], tuplets[group[-1]] = "start", "stop"
        notes = [i for i in group if items1[i][0] == "note" and items1[i][1][2] != "R"]
        for n, i in enumerate(notes):
            if len(notes) > 1:
                beams[i] = "begin" if n == 0 else "end" if n == len(notes) - 1 else "continue"
    # Las alteraciones siguen el orden de lectura: las dos voces se mezclan por posicion.
    order = sorted([(e[0], 0, 1, i) for i, (k, e, _) in enumerate(items1) if k == "note"]
                   + [(e[0], 1, 2, i) for i, (k, e, _) in enumerate(items2) if k == "note"])
    rendered = {}
    for _, _, voice, i in order:
        if voice == 1:
            rendered[(1, i)] = _note(items1[i][1], 1, "up", acc, beams.get(i), tuplets.get(i))
        else:
            rendered[(2, i)] = _note(items2[i][1], 2, "down", acc)
    v1 = "".join(_hidden(payload, 1, tuplets.get(i)) if kind == "gap" else rendered[(1, i)]
                 for i, (kind, payload, _) in enumerate(items1))
    v2 = "".join(_hidden(payload, 2) if kind == "gap" else rendered[(2, i)] for i, (kind, payload, _) in enumerate(items2))
    return f'<measure number="{number}">{attrs}{v1}<backup><duration>{LENGTH}</duration></backup>{v2}</measure>'


def write(path, title, fifths, measures):
    """`measures`: [{"bass": [...], "up": [...]}]; escribe el MusicXML corregido en `path`."""
    body = "".join(measure_xml(i + 1, fifths, m["bass"], m["up"], first=i == 0) for i, m in enumerate(measures))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           f'<score-partwise version="3.1"><work><work-title>{escape(title)}</work-title></work>'
           '<identification><creator type="composer">Matteo Carcassi</creator></identification>'
           '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>'
           f'<part id="P1">{body}</part></score-partwise>\n')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    print("escrito", path)
