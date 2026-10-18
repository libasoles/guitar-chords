"""Genera los ejemplos del articulo «Descomposicion de acordes para arpegios en
Carcassi»: un MusicXML por ejemplo (partitura + tablatura) y su SVG estatico.

Cada ejemplo se describe con (cuerda, traste) por nota: la altura sale de la
afinacion estandar, asi la partitura y la tablatura no pueden contradecirse.
Los MusicXML y los SVG se versionan; los SVG los dibuja Verovio.

    python3 -m venv .venv && .venv/bin/pip install "verovio==6.*"
    .venv/bin/python scripts/articles/carcassi/build.py
"""
import os
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

import verovio

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(ROOT, "src", "site", "articles", "carcassi")

# Alturas MIDI de las cuerdas al aire, afinacion estandar. Cuerda 1 = mi agudo.
OPEN_MIDI = {1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40}
NAMES = [("C", 0), ("C", 1), ("D", 0), ("D", 1), ("E", 0), ("F", 0),
         ("F", 1), ("G", 0), ("G", 1), ("A", 0), ("A", 1), ("B", 0)]
TYPES = {1: "16th", 2: "eighth", 4: "quarter", 8: "half"}
DIVISIONS = 4  # por negra: 1 = semicorchea


class N:
    """Nota: cuerda, traste y duracion en semicorcheas."""
    def __init__(self, string, fret, dur):
        self.string, self.fret, self.dur = string, fret, dur


class R:
    """Silencio; hidden=True ocupa tiempo sin dibujarse (el PDF no lo muestra)."""
    def __init__(self, dur, hidden=False, whole=False):
        self.dur, self.hidden, self.whole = dur, hidden, whole


def pitch_xml(string, fret):
    midi = OPEN_MIDI[string] + fret
    step, alter = NAMES[midi % 12]
    return ("<pitch><step>%s</step>%s<octave>%d</octave></pitch>"
            % (step, "<alter>1</alter>" if alter else "", midi // 12 - 1))


def beam_states(groups):
    """Estado de barra por evento: solo grupos de 2 o mas notas, una barra por
    corchea y dos por semicorchea."""
    states = {}
    for group in groups:
        if len(group) < 2:
            continue
        for i, ev in enumerate(group):
            states[id(ev)] = "begin" if i == 0 else "end" if i == len(group) - 1 else "continue"
    return states


def event_xml(ev, voice, staff, stem, states, tab):
    dur = ev.dur
    if isinstance(ev, R):
        # La TAB no dibuja silencios.
        attrs = ' print-object="no"' if ev.hidden or staff == 2 else ""
        if ev.whole:
            return ("<note%s><rest measure=\"yes\"/><duration>%d</duration><voice>%d</voice>"
                    "<staff>%d</staff></note>" % (attrs, dur, voice, staff))
        return ("<note%s><rest/><duration>%d</duration><voice>%d</voice><type>%s</type>"
                "<staff>%d</staff></note>" % (attrs, dur, voice, TYPES[dur], staff))
    beams = ""
    state = states.get(id(ev))
    if state:
        levels = 2 if dur == 1 else 1
        beams = "".join('<beam number="%d">%s</beam>' % (n, state) for n in range(1, levels + 1))
    technical = ("<notations><technical><string>%d</string><fret>%d</fret></technical></notations>"
                 % (ev.string, ev.fret))
    return ("<note>%s<duration>%d</duration><voice>%d</voice><type>%s</type>"
            "<stem>%s</stem><staff>%d</staff>%s%s</note>"
            % (pitch_xml(ev.string, ev.fret), dur, voice, TYPES[dur], stem, staff, beams, technical))


def voice_xml(events, groups, voice, staff, stem):
    states = beam_states(groups)
    return "".join(event_xml(ev, voice, staff, stem, states, False) for ev in events)


def measure_xml(number, bars, first, time, left_repeat=False, right_repeat=False, implicit=False):
    """bars: {'melody': (events, beam groups), 'bass': (events, beam groups)}.
    Cada voz se escribe en la pentagrama (voces 1-2) y repetida en la TAB (5-6)."""
    total = sum(ev.dur for ev in bars["melody"][0])
    xml = '<measure number="%d"%s>' % (number, ' implicit="yes"' if implicit else "")
    if left_repeat:
        xml += '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
    if first:
        beats, beat_type = time
        xml += ("<attributes><divisions>%d</divisions><key><fifths>0</fifths></key>"
                "<time><beats>%d</beats><beat-type>%d</beat-type></time><staves>2</staves>"
                "<clef number=\"1\"><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>"
                "<clef number=\"2\"><sign>TAB</sign><line>5</line></clef>"
                "<staff-details number=\"2\"><staff-lines>6</staff-lines></staff-details>"
                "</attributes>" % (DIVISIONS, beats, beat_type))
    for name, voice, staff, stem in (("melody", 1, 1, "up"), ("bass", 2, 1, "down")):
        if name not in bars:
            continue
        events, groups = bars[name]
        xml += voice_xml(events, groups, voice, staff, stem)
        xml += "<backup><duration>%d</duration></backup>" % total
    for name, voice, staff, stem in (("melody", 5, 2, "up"), ("bass", 6, 2, "down")):
        if name not in bars:
            continue
        events, groups = bars[name]
        xml += voice_xml(events, groups, voice, staff, stem)
        xml += "<backup><duration>%d</duration></backup>" % total
    xml = xml[: xml.rfind("<backup>")]  # la ultima voz no necesita backup
    if right_repeat:
        xml += '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
    return xml + "</measure>"


def score_xml(title, measures):
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<score-partwise version="3.1">\n'
            "<work><work-title>%s</work-title></work>\n"
            '<part-list><score-part id="P1"><part-name print-object="no"></part-name></score-part></part-list>\n'
            '<part id="P1">\n%s\n</part>\n</score-partwise>\n' % (escape(title), "\n".join(measures)))


def arpeggio(bass, melody_frets, split, last=None):
    """Compas de arpegio en semicorcheas: bajo en blanca, silencio oculto de
    semicorchea y la melodia en dos grupos. `split` = cuantas notas van en el
    primer grupo de barra."""
    notes = [N(s, f, 1) for s, f in melody_frets]
    events = [R(1, hidden=True)] + notes
    return {"melody": (events, [notes[:split], notes[split:]]), "bass": ([N(*bass, 8)], [])}


# ---- Ejemplo 1: Allegretto in C, compases 1-4 (con anacrusa) -----------------
# 2/4. C y G7 en loop (barras de repeticion en los compases 3-4).

def allegretto():
    pickup = [N(1, 0, 2)]
    line = [N(1, 3, 2), N(1, 1, 2), N(2, 3, 2), N(1, 0, 2)]
    c = [N(3, 0, 1), N(2, 1, 1), N(3, 0, 1)]
    c_tail = [N(1, 0, 2), N(2, 1, 2)]
    g7 = [N(3, 0, 1), N(2, 0, 1), N(3, 0, 1)]
    g7_tail = [N(1, 1, 2), N(2, 0, 2)]
    m1 = {"melody": (pickup, []), "bass": ([R(2, hidden=True)], [])}
    m2 = {"melody": (line, [line]), "bass": ([R(8, whole=True)], [])}
    m3 = {"melody": ([R(1, hidden=True)] + c + c_tail, [c, c_tail]), "bass": ([N(5, 3, 8)], [])}
    m4 = {"melody": ([R(1, hidden=True)] + g7 + g7_tail, [g7, g7_tail]), "bass": ([N(6, 3, 8)], [])}
    return score_xml("Allegretto in C", [
        measure_xml(0, m1, True, (2, 4), implicit=True),
        measure_xml(1, m2, False, (2, 4)),
        measure_xml(2, m3, False, (2, 4), left_repeat=True),
        measure_xml(3, m4, False, (2, 4), right_repeat=True),
    ])


# ---- Ejemplo 3: Prelude A Minor Op.59, compases 3-4 --------------------------
# 4/4. Am G7 C E7; la repeticion alrededor de los dos compases no esta en el PDF.

def prelude_half(bass, first_group, second_group):
    first = [N(s, f, 1) for s, f in first_group]
    second = [N(s, f, 1) for s, f in second_group]
    return [N(*bass, 8)], [R(1, hidden=True)] + first + second, [first, second]


def prelude():
    halves = [
        ((5, 0), [(3, 2), (2, 1), (3, 2)], [(1, 0), (3, 2), (2, 1), (3, 2)]),     # Am
        ((6, 3), [(3, 0), (2, 0), (3, 0)], [(1, 1), (3, 0), (2, 0), (3, 0)]),     # G7
        ((5, 3), [(3, 0), (2, 1), (3, 0)], [(1, 0), (3, 0), (2, 1), (3, 0)]),     # C
        ((5, 2), [(3, 1), (2, 3), (3, 1)], [(1, 0), (3, 1), (2, 3), (3, 1)]),     # E7 (si en el bajo)
    ]
    bars = []
    for i in range(0, 4, 2):
        melody, bass, groups = [], [], []
        for bass_pos, first, second in halves[i:i + 2]:
            bass_events, melody_events, half_groups = prelude_half(bass_pos, first, second)
            bass += bass_events
            melody += melody_events
            groups += half_groups
        bars.append({"melody": (melody, groups), "bass": (bass, [])})
    return score_xml("Prelude A Minor, Op.59", [
        measure_xml(1, bars[0], True, (4, 4), left_repeat=True),
        measure_xml(2, bars[1], False, (4, 4), right_repeat=True),
    ])


EXAMPLES = {
    "allegretto-compases-1-4": allegretto,
    "prelude-compases-3-4": prelude,
}


SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)


def clean(svg):
    """Quita lo que el PDF no dibuja: etiqueta y llave de la parte, el compas de
    la TAB y las plicas, barras y banderas de duracion bajo la TAB."""
    root = ET.fromstring(svg)
    tag = lambda name: "{%s}%s" % (SVG_NS, name)
    parents = {child: parent for parent in root.iter() for child in parent}

    def classes(el):
        return (el.get("class") or "").split()

    for el in list(root.iter(tag("g"))):
        if {"label", "grpSym", "mNum", "tabDurSym"} & set(classes(el)):
            parents[el].remove(el)
    for staff in root.iter(tag("g")):
        if "staff" not in classes(staff) or not any("tabGrp" in classes(g) for g in staff.iter(tag("g"))):
            continue
        for el in list(staff.iter(tag("g"))):
            if "meterSig" in classes(el):
                parents[el].remove(el)
            if "beam" in classes(el):
                for child in list(el):
                    if child.tag == tag("polygon"):
                        el.remove(child)
    return ET.tostring(root, encoding="unicode")


def render(musicxml_path, svg_path):
    tk = verovio.toolkit()
    tk.setOptions({
        "pageWidth": 2000,
        "scale": 40,
        "adjustPageHeight": True,
        "breaks": "none",
        "svgViewBox": True,
        "svgRemoveXlink": True,
        "pageMarginTop": 20, "pageMarginBottom": 20,
        "pageMarginLeft": 20, "pageMarginRight": 20,
        "header": "none", "footer": "none",
        "spacingStaff": 4,
    })
    if not tk.loadFile(musicxml_path):
        raise SystemExit("Verovio no pudo leer " + musicxml_path)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(clean(tk.renderToSVG(1)) + "\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, build in EXAMPLES.items():
        musicxml = os.path.join(OUT, name + ".musicxml")
        with open(musicxml, "w", encoding="utf-8") as f:
            f.write(build())
        render(musicxml, os.path.join(OUT, name + ".svg"))
        print(name)


if __name__ == "__main__":
    main()
