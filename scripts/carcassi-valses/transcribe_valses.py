"""Valses del Op. 59 de Carcassi: PDF vectorial de MuseScore -> MusicXML con notacion (sin TAB).

    python scripts/carcassi-valses/transcribe_valses.py 2        # escribe corrected/waltz-02.musicxml

Las notas se leen de la geometria del PDF (ver pdf_notes.py); no se copia nada del PDF a la salida: el
MusicXML lleva solo alturas y duraciones, y la TAB la propone el motor (ver build.py). Alturas escritas
(clave de sol), como en los preludios. Un tiempo = una semicorchea.
"""
import os
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-preludios'))

import pdf_notes as P  # noqa: E402
from transcribe_lib import DIVISIONS, Accidentals, fill, hidden_rest, note_xml, key_alters, parse, pitch_xml  # noqa: E402

SOURCES = ROOT / 'resources' / 'carcassi-op59-youtube'
STEPS = 'CDEFGAB'


def pitch_name(position, alter):
    index = 2 + position  # posicion 0 = mi4 (linea inferior)
    step, octave = STEPS[index % 7], 4 + index // 7
    return f"{step}{'#' if alter == 1 else 'b' if alter == -1 else ''}{octave}"


def convert_measure(m, fifths, full, scale=1):
    """-> {'up': [...], 'bass': [...], 'length'}; eventos (pos, dur, pitch, None) como en transcribe_lib."""
    key = key_alters(fifths)
    groups = P.stem_groups(m)
    mid = (m['top'] + m['bottom']) / 2
    # alteraciones de compas: se recorren las cabezas por posicion horizontal
    state = {}
    names = {}
    for head in sorted((h for g in groups for h in g['heads']), key=lambda h: h['x']):
        index = 2 + head['pos']
        step = STEPS[index % 7]
        if head['acc'] is not None:
            state[index] = head['acc']
        names[id(head)] = pitch_name(head['pos'], state.get(index, key.get(step, 0)))
    directions = {g['dir'] for g in groups}
    items = []
    for g in groups:
        # una cabeza con dos plicas suena una vez: la voz mas corta no la repite
        shorter = [h for h in g['shared'] if any(o is not g and o['dur'] > g['dur'] and any(h is x for x in o['heads']) for o in groups)]
        kept = [h for h in reversed(g['heads']) if not any(h is x for x in shorter)]  # de grave a agudo
        pitch = '+'.join(names[id(h)] for h in kept)
        ties = {names[id(h)]: (bool(h.get('tie_prev')), bool(h.get('tie_next'))) for h in kept if h.get('tie_prev') or h.get('tie_next')}
        items.append({'x': g['x'], 'dur': round(g['dur'] * scale), 'pitch': pitch, 'dir': g['dir'] if len(directions) == 2 else 'up',
                      'grace': g['grace'], 'grace_type': g['grace_type'], 'beams': g['beams'], 'ties': ties,
                      'fingers': {names[id(h)]: h['finger'] for h in kept if h.get('finger')}})
    graces = [i for i in items if i['grace']]
    items = [i for i in items if not i['grace']]
    for r in m['rests']:
        items.append({'x': r['x'], 'dur': full if r['dur'] == 16 else round(r['dur'] * scale), 'pitch': 'R',  # el silencio de redonda llena el compas
                      'dir': ('up' if r['y'] < mid else 'down') if len(directions) == 2 else 'up'})
    # una nota compartida con otra voz deja un hueco (no suena dos veces); su duracion cuenta para el tiempo de su
    # direccion solo si con ella el compas queda completo
    for name in ('up', 'down'):
        with_ghost = sum(i['dur'] for i in items if i['dir'] == name)
        without = sum(i['dur'] for i in items if i['dir'] == name and i['pitch'])
        if without == full or with_ghost != full:
            items = [i for i in items if not (i['dir'] == name and not i['pitch'])]
    for name in ('up', 'down'):
        mine = sorted((i for i in items if i['dir'] == name), key=lambda i: i['x'])
        pos = 0
        for i in mine:
            i['onset'] = pos
            pos += i['dur']
    totals = {name: sum(i['dur'] for i in items if i['dir'] == name) for name in ('up', 'down')}
    over = [name for name in ('up', 'down') if totals[name] > full]
    if over:
        # dos voces con la misma direccion de plica: los inicios salen de la posicion horizontal, tomando como
        # eje del tiempo la direccion que llena el compas exactamente
        ref = next((name for name in ('up', 'down') if totals[name] == full), None)
        if ref:
            axis = sorted((i['x'], i['onset']) for i in items if i['dir'] == ref)
            for i in items:
                if i['dir'] != ref:
                    i['onset'] = max(0, min(full - 1, round(interpolate(axis, i['x']))))
    items = [i for i in items if i['pitch']]
    lanes = {'up': [], 'down': []}
    for name in ('up', 'down'):
        for i in sorted((i for i in items if i['dir'] == name), key=lambda i: (i['onset'], i['x'])):
            for lane in lanes[name]:
                if lane[-1]['onset'] + lane[-1]['dur'] <= i['onset']:
                    lane.append(i)
                    break
            else:
                lanes[name].append([i])
    # cada nota de gracia pasa a la nota real siguiente (a su derecha) de su misma direccion de plica
    for grace in sorted(graces, key=lambda g: g['x']):
        target = min((i for i in items if i['dir'] == grace['dir'] and i['pitch'] != 'R' and i['x'] > grace['x']),
                     key=lambda i: i['x'], default=None)
        if target is not None:
            target.setdefault('graces', []).append(grace)
    voices = []
    fingers = {}  # (voz, inicio) -> {altura: dedo de la mano izquierda}
    for name in ('up', 'down'):
        for lane in lanes[name]:
            for i in lane:
                if i.get('fingers'):
                    fingers[(len(voices), i['onset'])] = i['fingers']
            voices.append({'stem': name, 'events': [(i['onset'], i['dur'], i['pitch'], None, i.get('graces', []), i.get('ties', {})) for i in lane]})
    out = {'voices': voices, 'fingers': fingers}
    out['length'] = max([e[0] + e[1] for v in voices for e in v['events']] + [0])
    return out


def interpolate(axis, x):
    """Tiempo (en semicorcheas) de la posicion horizontal `x`, interpolando entre los ataques conocidos."""
    if len(axis) == 1:
        return axis[0][1]
    if x <= axis[0][0]:
        (x0, t0), (x1, t1) = axis[0], axis[1]
    elif x >= axis[-1][0]:
        (x0, t0), (x1, t1) = axis[-2], axis[-1]
    else:
        for (x0, t0), (x1, t1) in zip(axis, axis[1:]):
            if x0 <= x <= x1:
                break
    return t0 + (t1 - t0) * (x - x0) / ((x1 - x0) or 1)


def beams_for(events, bounds, scale=1):
    states = {}
    for dur, bars in ((scale, (1, 2)), (2 * scale, (1,))) + (((1, (1, 2, 3)),) if scale == 2 else ()):
        for start, end in zip(bounds, bounds[1:]):
            group = [e for e in events if e[1] == dur and e[2] != 'R' and start <= e[0] < end]
            for i, e in enumerate(group):
                if len(group) > 1:
                    state = 'begin' if i == 0 else 'end' if i == len(group) - 1 else 'continue'
                    states[e[0]] = {n: state for n in bars}
    return states


def add_ties(xml, ties):
    """Marca de ligadura (<tie> y <tied>) en cada nota del evento cuya altura va ligada."""
    if not ties:
        return xml
    out = []
    for note in re.findall(r'<note>.*?</note>', xml):
        step = re.search(r'<step>(.)</step>', note)
        if step:
            alter = int(re.search(r'<alter>(-?\d)</alter>', note).group(1)) if '<alter>' in note else 0
            name = f"{step.group(1)}{'#' if alter == 1 else 'b' if alter == -1 else ''}{re.search(r'<octave>(\d)</octave>', note).group(1)}"
            if name in ties:
                stop, start = ties[name]
                marks = ('<tie type="stop"/>' if stop else '') + ('<tie type="start"/>' if start else '')
                tied = ('<tied type="stop"/>' if stop else '') + ('<tied type="start"/>' if start else '')
                note = note.replace('</duration>', '</duration>' + marks, 1)
                note = (note.replace('<notations>', '<notations>' + tied, 1) if '<notations>' in note
                        else note.replace('</note>', f'<notations>{tied}</notations></note>'))
        out.append(note)
    return ''.join(out)


def grace_xml(grace, index, count, voice, stem, acc):
    """Nota de gracia (sin duracion) antes de su nota real; las que van juntas comparten barra."""
    kind = '16th' if grace['grace_type'] <= 1 else 'eighth'
    bars = 2 if kind == '16th' else 1
    notes = []
    for n, pitch in enumerate(grace['pitch'].split('+')):
        step, alter, octave = parse(pitch)
        accidental = acc.xml(step, alter, octave)
        accidental = f"<accidental>{accidental}</accidental>" if accidental else ''
        state = 'begin' if index == 0 else 'end' if index == count - 1 else 'continue'
        beam = ''.join(f'<beam number="{b}">{state}</beam>' for b in range(1, bars + 1)) if count > 1 else ''
        chord = '<chord/>' if n else ''
        slash = ' slash="yes"' if count == 1 and kind == 'eighth' else ''
        notes.append(f"<note><grace{slash}/>{chord}{pitch_xml(step, alter, octave)}<voice>{voice}</voice><type>{kind}</type>"
                     f"{accidental}<stem>{stem}</stem>{beam}</note>")
    return ''.join(notes)


def measure_xml(number, fifths, time, data, first, implicit, key_change=False):
    acc = Accidentals(fifths)
    scale = data['scale']
    length = data['length']
    full = time[0] * 16 // time[1] * scale
    attrs = ''
    if key_change:
        attrs = f"<attributes><key><fifths>{fifths}</fifths></key></attributes>"
    if first:
        attrs = (f"<attributes><divisions>{DIVISIONS * scale}</divisions><key><fifths>{fifths}</fifths></key>"
                 f"<time><beats>{time[0]}</beats><beat-type>{time[1]}</beat-type></time>"
                 "<clef><sign>G</sign><line>2</line></clef></attributes>")
    bounds = list(range(0, full + 1, (6 if time[1] == 8 else 4) * scale))
    voices = data['voices'] or [{'stem': 'up', 'events': []}]
    rendered = {}
    # las alteraciones se deciden en orden de lectura: se recorren todas las voces por posicion
    order = sorted((e[0], v, e) for v, voice in enumerate(voices) for e in voice['events'])
    for _, v, event in order:
        graces = ''.join(grace_xml(g, i, len(event[4]), v + 1, voices[v]['stem'], acc) for i, g in enumerate(event[4]))
        rendered[(v, event[0])] = graces + add_ties(note_xml(event[:4], v + 1, voices[v]['stem'], acc, beams_for(voices[v]['events'], bounds, scale).get(event[0])), event[5])
    body = ''
    for v, voice in enumerate(voices):
        if v:
            body += f"<backup><duration>{length}</duration></backup>"
        body += ''.join(hidden_rest(i, v + 1) if k == 'gap' else rendered[(v, i[0])] for k, i in fill(voice['events'], v + 1, length))
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


def convert(number):
    meta = P.read(str(SOURCES / f'op59-{number:02d}.pdf'))
    time = meta['time']
    full = time[0] * 16 // time[1]
    # una fusa dura media semicorchea: la pieza entera pasa a doble resolucion
    scale = 2 if any(g['dur'] != int(g['dur']) for m in meta['measures'] for g in P.stem_groups(m)) else 1
    set_scale(scale)
    measures = []
    for m in meta['measures']:
        data = convert_measure(m, m['fifths'], full * scale, scale)
        data.update(scale=scale, fifths=m['fifths'], repeat_start=m['repeat_start'], repeat_end=m['repeat_end'], fine=m.get('fine'), dc=m.get('dc'))
        measures.append(data)
    measures[-1]['final'] = True
    return meta, measures


def set_scale(scale):
    import transcribe_lib
    if scale == 2:
        transcribe_lib.TYPES = {1: '32nd', 2: '16th', 3: '16th', 4: 'eighth', 6: 'eighth', 8: 'quarter', 12: 'quarter',
                                16: 'half', 24: 'half', 32: 'whole'}
        transcribe_lib.DOTTED = {3, 6, 12, 24}


def write(number, title, path):
    meta, measures = convert(number)
    time, fifths = meta['time'], meta['fifths']
    full = time[0] * 16 // time[1]
    body = ''
    index = 0
    previous = measures[0]['fifths']
    for i, data in enumerate(measures):
        pickup = i == 0 and data['length'] < full * data['scale']
        if pickup:
            number_attr = 0
        else:
            index += 1
            number_attr = index
        # el ultimo compas, si completa la anacrusa, tambien es corto; se deja sin relleno
        current = data['fifths']
        body += measure_xml(number_attr, current, time, data, i == 0, pickup, key_change=i > 0 and current != previous)
        previous = current
    xml = ('<?xml version="1.0" encoding="UTF-8"?>'
           f'<score-partwise version="3.1"><work><work-title>{escape(title)}</work-title></work>'
           '<identification><creator type="composer">Matteo Carcassi</creator></identification>'
           '<part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>'
           f'<part id="P1">{body}</part></score-partwise>\n')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(xml)
    return meta, measures


if __name__ == '__main__':
    n = int(sys.argv[1])
    out = HERE / 'corrected' / f'waltz-{n:02d}.musicxml'
    meta, measures = write(n, f'Waltz {n}', str(out))
    print('escrito', out, len(measures), 'compases', meta['fifths'], meta['time'])
