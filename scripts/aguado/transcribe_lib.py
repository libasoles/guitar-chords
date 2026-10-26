"""Transcripcion manual a MusicXML de las lecciones de Aguado que TabGuitar no publica (facsimil de 1843).

Cada compas se describe en treintaidosavos (`pos` 0..N dentro del compas, `dur` en treintaidosavos; una negra son 8):

    voices: {1: [evento, ...], 2: [evento, ...]}   voz 1 con plicas arriba, voz 2 con plicas abajo
    evento: (pos, dur, altura, dedos)

`altura` es la del libro (clave de sol escrita, como en los preludios de Carcassi): "G4", "F#4", "Bb3"; "R" es un
silencio visible; un acorde se escribe "A4+C5" y cada nota puede llevar su propia digitacion "A4:2+C5:1". El sufijo
"~" de una altura abre una ligadura de union ("C5~") y el prefijo "~" la cierra ("~C5"). `dedos` junta con "|" los dedos
de la izquierda (1-4) y las letras p i m a de la derecha: "4|i". Los huecos se rellenan con silencios ocultos.
Alteraciones: se escribe la primera aparicion en el compas de cada altura cuyo estado difiere del anterior.

`measure(...)` devuelve el dict de un compas; `write(...)` escribe la fuente curada `sources/NN.musicxml`.
"""
import os
import re
from xml.sax.saxutils import escape

DIVISIONS = 8  # por negra: 1 = treintaidosavo
TYPES = {1: "32nd", 2: "16th", 3: "16th", 4: "eighth", 6: "eighth", 8: "quarter", 12: "quarter",
         16: "half", 24: "half", 32: "whole"}
DOTTED = {3, 6, 12, 24}
FLAGS = {"32nd": 3, "16th": 2, "eighth": 1}
SHARP_ORDER = "FCGDAEB"
FLAT_ORDER = "BEADGCF"
HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.join(HERE, "sources")


def key_alters(fifths):
    alters = {}
    for step in (SHARP_ORDER[:fifths] if fifths > 0 else FLAT_ORDER[:-fifths]):
        alters[step] = 1 if fifths > 0 else -1
    return alters


def parse(pitch):
    step, rest = pitch[0], pitch[1:]
    alter = 1 if rest.startswith("#") else -1 if rest.startswith("b") else 0
    return step, alter, int(rest.lstrip("#b"))


class Accidentals:
    """Estado de alteraciones dentro de un compas."""

    def __init__(self, fifths):
        self.key, self.state = key_alters(fifths), {}

    def xml(self, step, alter, octave):
        current = self.state.get((step, octave), self.key.get(step, 0))
        self.state[(step, octave)] = alter
        if alter == current:
            return ""
        return {1: "sharp", -1: "flat", 0: "natural"}[alter]


def kind_of(dur):
    return f"<type>{TYPES[dur]}</type>" + ("<dot/>" if dur in DOTTED else "")


def note_xml(event, voice, stem, acc, beams):
    """Una nota o un acorde (las notas siguientes de un acorde llevan <chord/>)."""
    pos, dur, pitch, finger = event
    if pitch == "R":
        return f"<note><rest/><duration>{dur}</duration><voice>{voice}</voice>{kind_of(dur)}</note>"
    out = ""
    for i, part in enumerate(pitch.split("+")):
        name, _, own = part.partition(":")
        tie_stop, tie_start = name.startswith("~"), name.endswith("~")
        step, alter, octave = parse(name.strip("~"))
        accidental = acc.xml(step, alter, octave)
        accidental = f"<accidental>{accidental}</accidental>" if accidental else ""
        a = f"<alter>{alter}</alter>" if alter else ""
        ties = ('<tie type="stop"/>' if tie_stop else "") + ('<tie type="start"/>' if tie_start else "")
        tied = ('<tied type="stop"/>' if tie_stop else "") + ('<tied type="start"/>' if tie_start else "")
        marks = own or (finger if i == 0 else "")
        technical = "".join(f"<fingering>{f}</fingering>" for f in (marks or "").split("|") if f)
        notations = (f"<notations>{tied}" + (f"<technical>{technical}</technical>" if technical else "") + "</notations>") if (tied or technical) else ""
        beam = "".join(f'<beam number="{n}">{state}</beam>' for n, state in (beams or {}).items()) if i == 0 else ""
        out += (f"<note>{'<chord/>' if i else ''}<pitch><step>{step}</step>{a}<octave>{octave}</octave></pitch>"
                f"<duration>{dur}</duration>{ties}<voice>{voice}</voice>{kind_of(dur)}{accidental}"
                f"<stem>{stem}</stem>{beam}{notations}</note>")
    return out


def hidden_rest(dur, voice):
    return f'<note print-object="no"><rest/><duration>{dur}</duration><voice>{voice}</voice><type>{TYPES.get(dur, "32nd")}</type></note>'


def split(n):
    parts = []
    for size in (32, 16, 8, 4, 2, 1):
        while n >= size:
            parts.append(size)
            n -= size
    return parts


def fill(events, length):
    """Eventos ordenados con silencios ocultos en los huecos."""
    out, cursor = [], 0
    for event in sorted(events):
        pos = event[0]
        if pos < cursor:
            raise ValueError(f"eventos solapados en la posicion {pos}")
        out += [("gap", g) for g in split(pos - cursor)] + [("note", event)]
        cursor = pos + event[1]
    if cursor > length:
        raise ValueError(f"el compas se pasa ({cursor} > {length})")
    return out + [("gap", g) for g in split(length - cursor)]


def beam_states(events, bounds):
    """Barras por grupo (`bounds` = limites de pulso): solo se unen notas contiguas con corchetes; por cada nivel, tramos
    con ese numero de corchetes; un tramo de una sola nota queda sin barra salvo en los niveles 2 y 3, donde lleva un gancho."""
    flagged = [(e, FLAGS.get(TYPES[e[1]], 0)) for e in sorted(events) if e[2] != "R"]
    beamed = {}
    for start, end in zip(bounds, bounds[1:]):
        group = [(e, f) for e, f in flagged if start <= e[0] < end]
        # un hueco entre dos notas (silencio o nota larga) corta el grupo en tramos contiguos
        segments, current = [], []
        for item in group:
            if current and current[-1][0][0] + current[-1][0][1] != item[0][0]:
                segments.append(current)
                current = []
            current.append(item)
        segments.append(current)
        for segment in (seg for seg in segments if len(seg) > 1 and all(f for _, f in seg)):
            for level in (1, 2, 3):
                i = 0
                while i < len(segment):
                    if segment[i][1] < level:
                        i += 1
                        continue
                    j = i
                    while j + 1 < len(segment) and segment[j + 1][1] >= level:
                        j += 1
                    run = segment[i:j + 1]
                    for k, (e, _) in enumerate(run):
                        if len(run) > 1:
                            state = "begin" if k == 0 else "end" if k == len(run) - 1 else "continue"
                        elif level == 1:
                            continue
                        else:
                            state = "forward hook" if i == 0 else "backward hook"
                        beamed.setdefault(e[0], {})[level] = state
                    i = j + 1
    return beamed


def measure_xml(number, fifths, time, voices, first=False, bounds=None, repeat=None, words=None, bar=None):
    beats, beat_type = time
    length = beats * 32 // beat_type
    acc = Accidentals(fifths)
    attrs = ""
    if first:
        attrs = (f"<attributes><divisions>{DIVISIONS}</divisions><key><fifths>{fifths}</fifths></key>"
                 f"<time><beats>{beats}</beats><beat-type>{beat_type}</beat-type></time>"
                 "<clef><sign>G</sign><line>2</line></clef></attributes>")
    if bounds is None:  # un pulso: negra en 2/4, 3/4 y 4/4; la corchea con puntillo (tres corcheas) en 3/8, 6/8
        step = 8 if beat_type == 4 else 12 if beats % 3 == 0 and beat_type == 8 and beats > 3 else length
        bounds = list(range(0, length + 1, step))
    left = ('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>'
            if repeat in ("forward", "both") else "")
    right = ('<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
             if repeat in ("backward", "both") else
             '<barline location="right"><bar-style>light-heavy</bar-style></barline>' if bar == "double" else "")
    direction = (f'<direction placement="above"><direction-type><words font-weight="bold">{escape(words)}</words></direction-type></direction>'
                 if words else "")
    voices = {1: [], **voices}  # la voz 1 siempre existe (si solo hay voz grave, la aguda queda en silencio oculto)
    rendered = {}
    order = sorted((e[0], voice, e) for voice, events in voices.items() for e in events)
    beams = {voice: beam_states(events, bounds) for voice, events in voices.items()}
    for pos, voice, event in order:
        rendered[(voice, event[0])] = note_xml(event, voice, "up" if voice == 1 else "down", acc, beams[voice].get(event[0]))
    body = ""
    for n, (voice, events) in enumerate(sorted(voices.items())):
        if n:
            body += f"<backup><duration>{length}</duration></backup>"
        for kind, item in fill(events, length):
            body += hidden_rest(item, voice) if kind == "gap" else rendered[(voice, item[0])]
    return f'<measure number="{number}">{left}{attrs}{direction}{body}{right}</measure>'


def measure(voices=None, up=None, down=None, **options):
    """Compas: `up`/`down` son atajos de las voces 1 y 2; `options`: repeat, words, bounds, bar ("double": doble barra fina-gruesa)."""
    voices = dict(voices or {})
    if up is not None:
        voices[1] = up
    if down is not None:
        voices[2] = down
    return {"voices": voices, **options}


def write(number, title, fifths, time, measures, composer="Dionisio Aguado"):
    body = "".join(measure_xml(i + 1, fifths, time, m["voices"], first=i == 0, bounds=m.get("bounds"),
                               repeat=m.get("repeat"), words=m.get("words"), bar=m.get("bar")) for i, m in enumerate(measures))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           f'<score-partwise version="3.1"><work><work-title>{escape(title)}</work-title></work>'
           f'<identification><creator type="composer">{escape(composer)}</creator></identification>'
           '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>'
           f'<part id="P1">{body}</part></score-partwise>\n')
    os.makedirs(SOURCES, exist_ok=True)
    path = os.path.join(SOURCES, f"{number:02d}.musicxml")
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    print("escrito", path, f"({len(measures)} compases)")
    return path
