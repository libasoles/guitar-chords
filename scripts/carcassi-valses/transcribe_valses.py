"""Valses del Op. 59 de Carcassi: PDF vectorial de MuseScore -> MusicXML con notacion (sin TAB).

    python scripts/carcassi-valses/transcribe_valses.py 2        # escribe corrected/waltz-02.musicxml

Las notas se leen de la geometria del PDF (ver pdf_notes.py); no se copia nada del PDF a la salida: el
MusicXML lleva solo alturas y duraciones, y la TAB la propone el motor (ver build.py). Alturas escritas
(clave de sol), como en los preludios. Un tiempo = una semicorchea.
"""
import os
import sys
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-preludios'))

import pdf_notes as P  # noqa: E402
from transcribe_lib import DIVISIONS, Accidentals, fill, hidden_rest, note_xml, key_alters  # noqa: E402

SOURCES = ROOT / 'resources' / 'carcassi-op59-youtube'
STEPS = 'CDEFGAB'


def pitch_name(position, alter):
    index = 2 + position  # posicion 0 = mi4 (linea inferior)
    step, octave = STEPS[index % 7], 4 + index // 7
    return f"{step}{'#' if alter == 1 else 'b' if alter == -1 else ''}{octave}"


def convert_measure(m, fifths, full):
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
    voices = {'up': [], 'down': []}
    for g in groups:
        voice = g['dir'] if len(directions) == 2 else 'up'
        pitch = '+'.join(names[id(h)] for h in reversed(g['heads']))  # de grave a agudo
        voices[voice].append((g['x'], g['dur'], pitch))
    for r in m['rests']:
        voice = ('up' if r['y'] < mid else 'down') if len(directions) == 2 else 'up'
        voices[voice].append((r['x'], r['dur'], 'R'))
    out = {}
    for name, items in (('up', voices['up']), ('bass', voices['down'])):
        pos, events = 0, []
        for _, dur, pitch in sorted(items):
            events.append((pos, int(dur), pitch, None))
            pos += int(dur)
        out[name] = events
    out['length'] = max([e[0] + e[1] for e in out['up'] + out['bass']] + [0])
    return out


def beams_for(events, bounds):
    states = {}
    for dur, bars in ((1, (1, 2)), (2, (1,))):
        for start, end in zip(bounds, bounds[1:]):
            group = [e for e in events if e[1] == dur and e[2] != 'R' and start <= e[0] < end]
            for i, e in enumerate(group):
                if len(group) > 1:
                    state = 'begin' if i == 0 else 'end' if i == len(group) - 1 else 'continue'
                    states[e[0]] = {n: state for n in bars}
    return states


def measure_xml(number, fifths, time, data, first, implicit, key_change=False):
    acc = Accidentals(fifths)
    length = data['length']
    full = time[0] * 16 // time[1]
    attrs = ''
    if key_change:
        attrs = f"<attributes><key><fifths>{fifths}</fifths></key></attributes>"
    if first:
        attrs = (f"<attributes><divisions>{DIVISIONS}</divisions><key><fifths>{fifths}</fifths></key>"
                 f"<time><beats>{time[0]}</beats><beat-type>{time[1]}</beat-type></time>"
                 "<clef><sign>G</sign><line>2</line></clef></attributes>")
    bounds = list(range(0, full + 1, 6 if time[1] == 8 else 4))
    both = bool(data['up']) and bool(data['bass'])
    rendered, order = {}, sorted([(e[0], 0, e) for e in data['up']] + [(e[0], 1, e) for e in data['bass']])
    up_beams, bass_beams = beams_for(data['up'], bounds), beams_for(data['bass'], bounds)
    for _, voice_index, event in order:
        voice, stem = (1, 'up') if voice_index == 0 else (2, 'down')
        rendered[(voice, event[0])] = note_xml(event, voice, stem, acc, (up_beams if voice == 1 else bass_beams).get(event[0]))
    v1 = ''.join(hidden_rest(i, 1) if k == 'gap' else rendered[(1, i[0])] for k, i in fill(data['up'], 1, length))
    v2 = ''
    if data['bass']:
        v2 = (f"<backup><duration>{length}</duration></backup>" +
              ''.join(hidden_rest(i, 2) if k == 'gap' else rendered[(2, i[0])] for k, i in fill(data['bass'], 2, length)))
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
    return f'<measure number="{number}"{implicit_attr}>{attrs}{left}{v1}{v2}{words}{right}</measure>'


def convert(number):
    meta = P.read(str(SOURCES / f'op59-{number:02d}.pdf'))
    time = meta['time']
    full = time[0] * 16 // time[1]
    measures = []
    for m in meta['measures']:
        data = convert_measure(m, m['fifths'], full)
        data.update(fifths=m['fifths'], repeat_start=m['repeat_start'], repeat_end=m['repeat_end'], fine=m.get('fine'), dc=m.get('dc'))
        measures.append(data)
    measures[-1]['final'] = True
    return meta, measures


def write(number, title, path):
    meta, measures = convert(number)
    time, fifths = meta['time'], meta['fifths']
    full = time[0] * 16 // time[1]
    body = ''
    index = 0
    previous = measures[0]['fifths']
    for i, data in enumerate(measures):
        pickup = i == 0 and data['length'] < full
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
