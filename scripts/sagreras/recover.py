"""Fuentes curadas tras cotejar los casos pendientes con el PDF de Marieh.

    python scripts/sagreras/recover.py N

No cambia el lector ni regenera las fuentes ya publicadas. Una cabeza compartida
es un solo ataque en la TAB, incluso cuando ambas plicas tienen igual duración.
"""
import sys
from collections import Counter
from copy import deepcopy
import xml.etree.ElementTree as ET

import transcribe as T


def voice(stem, events):
    return {'stem': stem, 'events': [(o, d, p, None, [], {}) for o, d, p in events]}


def sequential(*pairs):
    onset = 0
    events = []
    for duration, pitch in pairs:
        events.append((onset, duration, pitch))
        onset += duration
    return events


def lesson56():
    """16 compases cotejados en pagina PDF 29, dos sistemas de ocho.

    El lector omitía el compas 8 junto a la doble barra y desplazaba los
    siguientes. Los bajos compartidos mantienen sus dos plicas.
    """
    line = sequential
    short = lambda a, b, c, d: line((6, a), (6, b), (12, c), (12, d))
    pulse = lambda p: line((12, 'R'), (12, p), (12, 'R'))
    held = lambda p: [(0, 36, p)]
    pairs = [
        [short('G4', 'E4', 'C4', 'E4'), pulse('C4')],
        [short('G4', 'F4', 'B3', 'F4'), pulse('B3')],
        [short('B4', 'G4', 'F4', 'G4'), pulse('F4')],
        [line((12, 'E5'), (24, 'G4+C5')), held('E4')],
        [short('G4', 'E4', 'C4', 'E4'), pulse('C4')],
        [short('B4', 'G4', 'D4', 'G4'), pulse('D4')],
        [short('C5', 'A4', 'D4', 'A4'), pulse('D4')],
        [held('G4'), held('G3')],
        [short('F5', 'G4', 'B4', 'G5'), held('D4')],
        [held('E5'), [(12, 12, 'G4+C5'), (24, 12, 'G4+C5')], held('E4')],
        [short('D5', 'G4', 'D5', 'E5'), held('F4')],
        [line((12, 'C5'), (12, 'G4'), (12, 'E4')), line((24, 'E4'), (12, 'E4'))],
        [short('C4', 'E4', 'G4', 'C5'), held('C4')],
        [short('A3', 'F4', 'A4', 'C5'), held('A3')],
        [short('G3', 'G4', 'E5', 'D5'), line((24, 'G3'), (12, 'B3'))],
        [line((24, 'C5'), (12, 'R')), [(0, 24, 'C4')]],
    ]
    measures = []
    for parts in pairs:
        measures.append({'length': 36, 'voices': [voice('up' if i == 0 else 'down', e)
                                                for i, e in enumerate(parts)],
                         'fingers': {}, 'fifths': 0, 'single': False})
    # Indicaciones del pentagrama, no cifras tomadas de la TAB.
    fingers = {
        1: {(0, 0): {'G4': 'm'}, (0, 6): {'E4': 'i'}, (1, 12): {'C4': 'p'}},
        2: {(0, 6): {'F4': '3'}, (0, 12): {'B3': '2'}},
        4: {(0, 0): {'E5': 'a'}},
        11: {(0, 0): {'D5': '4'}, (1, 0): {'F4': '3'}},
        15: {(0, 12): {'E5': 'a'}, (0, 24): {'D5': '4|m'}, (1, 24): {'B3': '2'}},
        16: {(0, 0): {'C5': 'i'}},
    }
    for number, marks in fingers.items():
        measures[number - 1]['fingers'] = marks
    measures[-1]['final'] = True
    return measures


def correct57(measures):
    # Pagina PDF 29: la voz intermedia se solapa con las notas largas
    # de arriba y abajo. El espaciado no representa duraciones sucesivas.
    replacements = {
        2: [[(0, 24, 'E5'), (24, 12, 'D5')],
            sequential((12, 'R'), (12, 'G4'), (12, 'R')), [(0, 36, 'F4')]],
        4: [[(0, 24, 'F5'), (24, 12, 'E5')],
            sequential((12, 'R'), (12, 'G4'), (12, 'R')), [(0, 24, 'D4'), (24, 12, 'C4')]],
        10: [[(0, 36, 'G5')],
             sequential((12, 'R'), (12, 'G4+C5'), (12, 'G4+C5')), [(0, 36, 'E4')]],
    }
    for number, parts in replacements.items():
        data = measures[number - 1]
        data['length'] = 36
        data['voices'] = [voice('up' if i == 0 else 'down', e) for i, e in enumerate(parts)]
        data['voices'][1]['stem'] = 'up' if number in {2, 4} else 'down'
        data['fingers'] = {(0, 0): {2: {'E5': 'a'}, 4: {'F5': 'a'}, 10: {'G5': 'a'}}[number]}
        if number == 4:
            data['fingers'][(0, 24)] = {'E5': 'm'}


def validate(lesson, measures):
    full = lesson['time'][0] * 16 // lesson['time'][1] * T.SCALE
    read = Counter()
    for data in measures:
        assert data['length'] == full
        attacks = set()
        for voice in data['voices']:
            end = 0
            for onset, duration, pitch, *_ in voice['events']:
                assert end <= onset and 0 < duration and onset + duration <= full
                end = onset + duration
                attacks.update((onset, p) for p in pitch.split('+') if p != 'R')
        read.update(T.written_midi(p) for _, p in attacks)
    printed = Counter(p + 12 for _, p in lesson['tab'])
    assert read == printed, (read - printed, printed - read)


def recover(number, lessons):
    if number not in {54, 56, 57, 62}:
        raise ValueError(f'Leccion sin cotejo curado: {number}')
    lesson = lessons[number]
    measures = T.lesson_measures(lesson)
    if number == 56:
        measures = lesson56()
    if number == 57:
        correct57(measures)
    if number == 54:
        # Compas 7: el mi4 de blanca tiene plica propia hacia abajo;
        # no forma parte de la cadena de semicorcheas de la voz intermedia.
        measures[6] = deepcopy(measures[2])
        measures[6]['voices'][2]['events'] = [
            (0, 24, 'E4', None, [], {}), (24, 24, 'E4', None, [], {})]
        measures[6]['fingers'] = {(2, 0): {'E4': '2'}}
    validate(lesson, measures)
    xml = T.to_xml(number, lesson, measures)
    if number == 54:
        # El objetivo expreso de la leccion es tocar el si en la tercera
        # cuerda (traste 4), aunque el motor prefiera la segunda al aire.
        root = ET.fromstring(xml)
        for note in root.findall('./part/measure[@number="2"]/note'):
            if note.findtext('pitch/step') == 'B' and note.findtext('pitch/octave') == '4':
                notations = note.find('notations')
                if notations is None:
                    notations = ET.SubElement(note, 'notations')
                technical = notations.find('technical')
                if technical is None:
                    technical = ET.SubElement(notations, 'technical')
                ET.SubElement(technical, 'string').text = '3'
                ET.SubElement(technical, 'fret').text = '4'
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding='unicode') + '\n'
    if number in {56, 57}:
        root = ET.fromstring(xml)
        bar = ET.SubElement(root.find('./part/measure[@number="8"]'), 'barline', location='right')
        ET.SubElement(bar, 'bar-style').text = 'light-light'
        if number == 57:
            # El cierre de la primera seccion sigue en primera posicion:
            # do5 en segunda cuerda, no el traste 5 de la tercera.
            for note in root.findall('./part/measure[@number="8"]/note'):
                if note.findtext('pitch/step') == 'C' and note.findtext('pitch/octave') == '5':
                    notations = note.find('notations')
                    if notations is None:
                        notations = ET.SubElement(note, 'notations')
                    technical = notations.find('technical')
                    if technical is None:
                        technical = ET.SubElement(notations, 'technical')
                    ET.SubElement(technical, 'string').text = '2'
                    ET.SubElement(technical, 'fret').text = '1'
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding='unicode') + '\n'
    (T.SOURCES / f'{number:02d}.musicxml').write_text(xml, encoding='utf-8')
    T.record_measures(number, len(measures))
    print(f'{number}: {len(measures)} compases; alturas y duraciones verificadas')


if __name__ == '__main__':
    lessons = T.read_lessons()
    for arg in sys.argv[1:]:
        recover(int(arg), lessons)
