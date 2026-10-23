"""Primeras lecciones de Sagreras (libro 1): PDF de Marieh -> MusicXML con notacion (sin TAB).

    python scripts/sagreras/transcribe.py 3 [4 5 ...]     # escribe sources/NN.musicxml y compara con la TAB impresa
    python scripts/sagreras/transcribe.py check [N ...]   # solo compara (sin escribir)

Las notas se leen de la geometria del PDF (marieh_notes.py + carcassi-valses/pdf_notes.py); no se copia nada del PDF
a la salida: el MusicXML lleva solo alturas y duraciones, y la TAB la propone el motor (ver build.py). Alturas escritas
(clave de sol), 12 divisiones por negra o 24 si hay fusas (admite tresillos). Los numeros de la TAB impresa dan un control independiente:
las alturas leidas de la notacion deben coincidir con las del pentagrama de tablatura.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-valses'))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-preludios'))

import marieh_notes as M  # noqa: E402
import pdf_notes as P  # noqa: E402
import transcribe_lib as T  # noqa: E402
import transcribe_valses as V  # noqa: E402

SOURCES = HERE / 'sources'
SCALE = 3  # unidades por semicorchea; la negra son 12
BASE_TYPES = {1: '32nd', 2: '16th', 3: '16th', 4: 'eighth', 6: 'eighth', 8: 'quarter', 9: 'eighth', 12: 'quarter', 18: 'quarter',
           24: 'half', 36: 'half', 48: 'whole', 72: 'whole'}
BASE_DOTTED = {9, 18, 36, 72}
TRIPLET = {2, 4, 8}  # semicorchea, corchea y negra de tresillo (en unidades)
STEPS = 'CDEFGAB'

_state = {'full': 16}
_original_groups = P.stem_groups


def configure_rhythm(scale):
    """Conservar la rejilla habitual; fusas y doble puntillo necesitan 24 divisiones por negra."""
    global SCALE, TRIPLET
    SCALE = scale
    factor = scale // 3
    T.TYPES = {d * factor: kind for d, kind in BASE_TYPES.items()}
    T.DOTTED = {d * factor for d in BASE_DOTTED}
    if scale == 6:
        T.TYPES.update({3: '32nd', 21: 'eighth'})
        T.DOTTED.add(21)
    elif scale == 3:  # negra y blanca con doble puntillo
        T.TYPES.update({21: 'quarter', 42: 'half'})
        T.DOTTED.update({21, 42})
    TRIPLET = {d * factor for d in (2, 4, 8)}


configure_rhythm(3)


# Cifras de compas que el lector no reconoce (solo distingue C y la C cortada): se leen a ojo de la edicion.
TIME_OVERRIDES = {65: (12, 8)}


def read_lessons():
    lessons = M.read_pdf()
    for n, time in TIME_OVERRIDES.items():
        lessons[n]['time'] = time
    for lesson in lessons.values():
        if lesson['time'] is None:
            lesson['time'] = (4, 4)  # las primeras lecciones no llevan cifra de compas
    return lessons


def fixed_groups(m):
    """`stem_groups` con las reglas propias de esta edicion: tresillos, redonda sin plica y voz unica."""
    groups = _original_groups(m)
    full = _state['full']
    # El lector compartido solo aplica un puntillo. Contar los glifos propios de esta edicion para
    # recuperar el segundo sin modificar las reglas de las otras colecciones.
    for g in groups:
        if not any(h['dot'] for h in g['heads']):
            continue
        dots = max(sum(0 < d[1] - h['x'] < 14 and abs(d[2] - h['y']) < m['space'] / 2 + 0.3
                       for d in m['dots']) for h in g['heads'])
        if dots == 2:
            g['dur'] *= 7 / 6  # de 3/2 a 7/4 de la figura base
    # Una cabeza hueca compartida puede representar una blanca con puntillo abajo
    # y solo una negra arriba (No.58). La cabeza no fija ambas duraciones: si la
    # voz corta desborda el compas, su tramo inicial es lo que falta hasta llenarlo.
    for g in groups:
        if not g['shared'] or g['beams'] or len(g['shared']) != len(g['heads']):
            continue
        sustained = any(o is not g and o['dir'] != g['dir'] and o['dur'] == full
                        and all(any(h is x for x in o['heads']) for h in g['heads'])
                        for o in groups)
        remaining = full - sum(o['dur'] for o in groups if o is not g and o['dir'] == g['dir'])
        if sustained and 0 < remaining < g['dur']:
            g['dur'] = remaining
    space = m['space']
    # tresillos: la cifra «3» marca las tres notas (o silencios) mas cercanos de su voz: sobre el pentagrama la
    # voz de plicas arriba, bajo el la de plicas abajo
    mid = (m['top'] + m['bottom']) / 2
    two_voices = {g['dir'] for g in groups if g['stem'] is not None} == {'up', 'down'}
    for x, y in m.get('tuplets', []):
        side = 'up' if y < mid else 'down'
        pool = [g for g in groups if g['dur'] and not g['grace'] and (g['beams'] or g['dur'] <= 4) and (not two_voices or g['dir'] == side)]
        pool += [r for r in m['rests'] if r['dur'] <= 4 and (not two_voices or ('up' if r['y'] < mid + 0.3 * space else 'down') == side)]
        for g in sorted(pool, key=lambda g: abs(g['x'] - x))[:3]:
            g['dur'] = g['dur'] * 2 / 3
            g['triplet'] = True
    polyphonic = any(g['dir'] != other['dir'] and abs(g['heads'][0]['x'] - other['heads'][0]['x']) < 2
                     for g in groups for other in groups if g is not other) or any(g['shared'] for g in groups)
    stemmed_dirs = {g['dir'] for g in groups if g['stem'] is not None}
    for g in groups:
        if g['stem'] is None and g['dur'] >= 16 and 'up' in stemmed_dirs:
            g['dir'] = 'down'  # redonda: sin plica, va en la voz grave si hay otra voz
            polyphonic = True
    if not polyphonic and len({g['dir'] for g in groups}) > 1:
        total = sum(g['dur'] for g in groups) + sum(full if r['dur'] == 16 else r['dur'] for r in m['rests'])
        if abs(total - full) < 0.01:
            for g in groups:
                g['dir'] = 'up'  # una sola voz con plicas segun la altura
            m['single_voice'] = True
    return groups


P.stem_groups = fixed_groups


ENHARMONIC = {'E#': ('F', 0), 'B#': ('C', 1), 'Fb': ('E', 0), 'Cb': ('B', -1)}


def enharmonic(pitch):
    """Mi# -> fa, si# -> do, fa♭ -> mi, do♭ -> si: el motor no digita esas grafias."""
    out = []
    for p in pitch.split('+'):
        if p[:2] in ENHARMONIC:
            step, shift = ENHARMONIC[p[:2]]
            p = f'{step}{int(p[2:]) + shift}'
        out.append(p)
    return '+'.join(out)


def simplify(data):
    for voice in data['voices']:
        voice['events'] = [(o, d, enharmonic(p), f, g, {enharmonic(k): v for k, v in t.items()}) for o, d, p, f, g, t in voice['events']]


def take_bass(m, full):
    """Tres voces: la redonda sin plica (bajo) pasa a una tercera voz; el resto se lee como siempre."""
    groups = _original_groups(m)
    whole = [g for g in groups if g['stem'] is None and g['dur'] >= full > 0 and not g['grace'] and g['dur'] >= 16]
    stemmed = {g['dir'] for g in groups if g['stem'] is not None}
    if not whole or stemmed != {'up', 'down'}:
        return None
    key = V.key_alters(m['fifths'])
    names = []
    m['bass_fingers'] = {}
    for g in whole:
        for h in sorted(g['heads'], key=lambda h: -h['y']):  # de grave a agudo
            step = V.STEPS[(2 + h['pos']) % 7]
            names.append(V.pitch_name(h['pos'], h['acc'] if h['acc'] is not None else key.get(step, 0)))
            if h.get('finger') or h.get('pluck'):
                m['bass_fingers'][names[-1]] = '|'.join(x for x in (h.get('finger'), h.get('pluck')) if x)
    m['items'] = [h for h in m['items'] if not any(h is x for g in whole for x in g['heads'])]
    return '+'.join(names)


def lesson_measures(lesson):
    # No redondear las medias semicorcheas: una fusa ocupa tres unidades con escala 6.
    groups = [g for m in lesson['measures'] for g in _original_groups(m)]
    configure_rhythm(6 if any(g['beams'] >= 3 for g in groups) else 3)
    time = lesson['time']
    full = time[0] * 16 // time[1]
    _state['full'] = full
    out = []
    for m in lesson['measures']:
        mid = (m['top'] + m['bottom']) / 2
        for r in m['rests']:
            if abs(r['y'] - mid) < 0.3 * m['space']:
                r['y'] = mid - m['space']  # silencio de la voz superior (queda sobre la linea central)
        bass = take_bass(m, full)
        if m['rests'] and any(r['dur'] == 16 for r in m['rests']) and m['items']:
            m['rests'] = [r for r in m['rests'] if r['dur'] != 16]  # silencio de compas completo bajo otra voz
        data = V.convert_measure(m, m['fifths'], full * SCALE, SCALE)
        simplify(data)
        data['fingers'] = {(v, o): {enharmonic(n): d for n, d in names.items()} for (v, o), names in data['fingers'].items()}
        if bass:
            if m.get('bass_fingers'):
                data['fingers'][(len(data['voices']), 0)] = {enharmonic(n): d for n, d in m['bass_fingers'].items()}
            data['voices'].append({'stem': 'down', 'events': [(0, full * SCALE, bass, None, [], {})]})
        data.update(fifths=m['fifths'], repeat_start=m['repeat_start'], repeat_end=m['repeat_end'], fine=m.get('fine'),
                    dc=m.get('dc'), single=m.get('single_voice', False))
        out.append(data)
    out[-1]['final'] = True
    return out


def written_midi(pitch):
    step, alter, octave = T.parse(pitch)
    return {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[step] + alter + 12 * (octave + 1)


def compare_tab(lesson, measures):
    """Alturas de la notacion contra la TAB impresa (ambas como MIDI escrito). -> (faltan_en_tab, sobran_en_tab)."""
    read = Counter()
    tied = Counter()
    for data in measures:
        attacks = {}
        for voice in data['voices']:
            for onset, duration, pitch, _, _, ties in voice['events']:
                for p in pitch.split('+'):
                    if p == 'R':
                        continue
                    # Dos cabezas coincidentes en voces distintas son un solo ataque (bajo sostenido
                    # con negra y fusa en la voz superior); la TAB impresa lo cuenta una sola vez.
                    if (onset, p) in attacks and attacks[(onset, p)] != duration:
                        continue
                    attacks[(onset, p)] = duration
                    read[written_midi(p)] += 1
                    if ties.get(p, (False, False))[0]:
                        tied[written_midi(p)] += 1
    tab = Counter(pitch + 12 for _, pitch in lesson['tab'])
    options = [read, read - tied]
    best = min(options, key=lambda r: sum(((r - tab) + (tab - r)).values()))
    return sorted((best - tab).elements()), sorted((tab - best).elements())


def beam_bounds(time, full):
    unit = (6 if time[1] == 8 else 4 if time[1] == 4 else 8) * SCALE
    return list(range(0, full + 1, unit))


def stem_for(pitch):
    positions = []
    for p in pitch.split('+'):
        if p == 'R':
            return 'up'
        step, _, octave = T.parse(p)
        positions.append(STEPS.index(step) + 7 * octave - (2 + 28))  # 0 = mi4, linea inferior
    return 'down' if sum(positions) / len(positions) >= 4 else 'up'


def beams_for(events, bounds):
    states = {}
    factor = SCALE // 3
    for dur, bars in ((2, (1, 2)), (3, (1, 2)), (4, (1,)), (6, (1,))):
        for start, end in zip(bounds, bounds[1:]):
            group = [e for e in events if e[1] == dur * factor and e[2] != 'R' and start <= e[0] < end]
            for i, e in enumerate(group):
                if len(group) > 1:
                    state = 'begin' if i == 0 else 'end' if i == len(group) - 1 else 'continue'
                    states.setdefault(e[0], {}).update({n: state for n in bars})
    # Fusa + corchea de doble puntillo: una barra comun y dos ganchos hacia la corchea.
    if SCALE == 6:
        for first, second in zip(events, events[1:]):
            if first[1] == 3 and second[1] == 21 and first[0] + 3 == second[0] and first[2] != 'R' and second[2] != 'R':
                states[first[0]] = {1: 'begin', 2: 'forward hook', 3: 'forward hook'}
                states[second[0]] = {1: 'end'}
    return states


def rests_xml(length, voice):
    out = ''
    sizes = (96, 48, 24, 16, 12, 8, 6, 4, 3, 2) if SCALE == 6 else (48, 24, 12, 8, 6, 4, 3, 2, 1)
    for size in sizes:
        while length >= size:
            out += T.hidden_rest(size, voice)
            length -= size
    if length:
        raise ValueError(f'hueco de {length} unidades sin silencio posible')
    return out


MODIFICATION = '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'


def tuplet_marks(xml, role):
    """Tresillo: <time-modification> en toda nota o silencio del grupo y <tuplet> en la primera y la ultima."""
    marks = '<stem>' if '<stem>' in xml else '</note>'
    xml = xml.replace(marks, MODIFICATION + marks, 1)
    if not role:
        return xml
    tag = f'<tuplet type="{role}" placement="above"/>'  # debajo chocaria con la redonda del bajo
    if '<notations>' in xml:
        return xml.replace('<notations>', '<notations>' + tag, 1)
    return xml.replace('</note>', f'<notations>{tag}</notations></note>', 1)


def measure_xml(number, time, data, first, implicit, key_change, prev_fifths):
    fifths = data['fifths']
    acc = T.Accidentals(fifths)
    full = time[0] * 16 // time[1] * SCALE
    length = data['length']
    attrs = ''
    if key_change:
        attrs = f'<attributes><key><fifths>{fifths}</fifths></key></attributes>'
    if first:
        symbol = ' symbol="common"' if time == (4, 4) else ' symbol="cut"' if time == (2, 2) else ''
        attrs = (f'<attributes><divisions>{T.DIVISIONS * SCALE}</divisions><key><fifths>{fifths}</fifths></key>'
                 f'<time{symbol}><beats>{time[0]}</beats><beat-type>{time[1]}</beat-type></time>'
                 '<clef><sign>G</sign><line>2</line></clef></attributes>')
    bounds = beam_bounds(time, full)
    voices = data['voices'] or [{'stem': 'up', 'events': []}]
    rendered = {}
    order = sorted((e[0], v, e) for v, voice in enumerate(voices) for e in voice['events'])
    for _, v, event in order:
        stem = stem_for(event[2]) if data['single'] else voices[v]['stem']
        graces = ''.join(V.grace_xml(g, i, len(event[4]), v + 1, stem, acc) for i, g in enumerate(event[4]))
        fingers = data['fingers'].get((v, event[0]), {})
        if '+' in event[2]:  # acorde: «altura:dedo» por nota
            event = (*event[:2], '+'.join(f'{p}:{fingers[p]}' if p in fingers else p for p in event[2].split('+')), *event[3:])
        else:
            event = (*event[:3], fingers.get(event[2]), *event[4:])
        xml = T.note_xml(event[:4], v + 1, stem, acc, beams_for(voices[v]['events'], bounds).get(event[0]))
        if event[1] == 21 or (SCALE == 3 and event[1] == 42):
            xml = xml.replace('<dot/>', '<dot/><dot/>')
        rendered[(v, event[0])] = graces + V.add_ties(xml, event[5])
    body = ''
    for v, voice in enumerate(voices):
        if v:
            body += f'<backup><duration>{length}</duration></backup>'
        events = sorted(voice['events'])
        cursor = 0
        # un tresillo ocupa tres lugares seguidos de su duracion; la nota compartida con otra voz puede faltar
        slots = {}
        for event in events:
            if event[1] in TRIPLET:
                slots.setdefault(event[0] // (event[1] * 3), []).append(event[0])
        for event in events:
            if event[0] > cursor:
                body += rests_xml(event[0] - cursor, v + 1)
            xml = rendered[(v, event[0])]
            if event[1] in TRIPLET:
                group = slots[event[0] // (event[1] * 3)]
                role = 'start' if event[0] == group[0] else 'stop' if event[0] == group[-1] else None
                xml = tuplet_marks(xml, role)
            body += xml
            cursor = event[0] + event[1]
        if cursor < length:
            body += rests_xml(length - cursor, v + 1)
    left = '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>' if data.get('repeat_start') else ''
    right = ''
    if data.get('repeat_end'):
        right = '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
    elif data.get('final'):
        right = '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
    words = ''
    if data.get('fine'):
        words = '<direction placement="above"><direction-type><words font-weight="bold">Fine</words></direction-type></direction>'
    if data.get('dc'):
        words = '<direction placement="above"><direction-type><words font-weight="bold">D.C. al Fine</words></direction-type></direction>'
    implicit_attr = ' implicit="yes"' if implicit else ''
    return f'<measure number="{number}"{implicit_attr}>{attrs}{left}{body}{words}{right}</measure>'


def to_xml(number, lesson, measures):
    time = lesson['time']
    full = time[0] * 16 // time[1] * SCALE
    body, index, previous = '', 0, measures[0]['fifths']
    for i, data in enumerate(measures):
        pickup = i == 0 and data['length'] < full and len(measures) > 1
        if pickup:
            n = 0
        else:
            index += 1
            n = index
        body += measure_xml(n, time, data, i == 0, pickup, i > 0 and data['fifths'] != previous, previous)
        previous = data['fifths']
    return ('<?xml version="1.0" encoding="UTF-8"?>'
            f'<score-partwise version="3.1"><work><work-title>Lesson {number}</work-title></work>'
            '<identification><creator type="composer">Julio Salvador Sagreras</creator></identification>'
            '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>'
            f'<part id="P1">{body}</part></score-partwise>\n')


# Lecciones cuya TAB impresa viene vacia: no hay control contra la TAB, se revisan a ojo contra el pentagrama.
NO_PRINTED_TAB = {33}
# Lecciones que pasan el control pero el motor no puede digitar (notas descartadas): quedan fuera hasta resolverlo.
ENGINE_FAILS = set()
# Lecciones publicadas aunque no pasen el control: llevan la marca «Revision pendiente» (scripts/lib/editor-marks.js)
# hasta que se curen a mano contra la edicion.
PENDING_REVIEW = {65, 66, 67, 68, 69, 70, 71, 72, 74, 76, 78, 81, 82, 83, 84, 85, 86}


def record_measures(n, count):
    """Compases de cada leccion (los lee test/sagreras.unit.js)."""
    path = HERE / 'measures.json'
    table = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    table[str(n)] = count
    path.write_text(json.dumps(dict(sorted(table.items(), key=lambda kv: int(kv[0]))), indent=0) + '\n', encoding='utf-8')


def run(numbers, write):
    lessons = read_lessons()
    for n in numbers:
        lesson = lessons[n]
        try:
            measures = lesson_measures(lesson)
        except Exception as error:  # noqa: BLE001
            print(f'{n:2d} ERROR de lectura: {type(error).__name__}: {error}')
            continue
        missing, extra = ([], []) if n in NO_PRINTED_TAB and not lesson['tab'] else compare_tab(lesson, measures)
        full = lesson['time'][0] * 16 // lesson['time'][1] * SCALE
        odd = [i + 1 for i, d in enumerate(measures) if d['length'] != full]
        if odd and set(odd) <= {1, len(measures)} and measures[0]['length'] + measures[-1]['length'] == full:
            odd = []  # anacrusa y compas final complementarios
        if odd == [1] and measures[0]['length'] < full:
            odd = []  # anacrusa sin compas complementario al final
        status = 'OK ' if not missing and not extra and not odd else 'REVISAR'
        print(f"{n:2d} {status} {lesson['time']} fifths={lesson['fifths']} compases={len(measures)} "
              f"cortos/largos={odd} notacion-de-mas={missing} tab-de-mas={extra}")
        if write and (n in PENDING_REVIEW or (status == 'OK ' and n not in ENGINE_FAILS)):
            SOURCES.mkdir(exist_ok=True)
            (SOURCES / f'{n:02d}.musicxml').write_text(to_xml(n, lesson, measures), encoding='utf-8')
            record_measures(n, len(measures))


if __name__ == '__main__':
    args = sys.argv[1:]
    write = args[:1] != ['check']
    if not write:
        args = args[1:]
    run([int(a) for a in args] or list(range(1, 87)), write)
