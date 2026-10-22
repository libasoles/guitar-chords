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
    if number not in {54, 62}:
        raise ValueError(f'Leccion sin cotejo curado: {number}')
    lesson = lessons[number]
    measures = T.lesson_measures(lesson)
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
    (T.SOURCES / f'{number:02d}.musicxml').write_text(xml, encoding='utf-8')
    T.record_measures(number, len(measures))
    print(f'{number}: {len(measures)} compases; alturas y duraciones verificadas')


if __name__ == '__main__':
    lessons = T.read_lessons()
    for arg in sys.argv[1:]:
        recover(int(arg), lessons)
