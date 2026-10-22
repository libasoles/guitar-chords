"""Regresiones del lector, sin necesitar el PDF local de la edicion.

    .venv-carcassi/bin/python -m unittest discover -s scripts/sagreras -p 'test_*.py'
"""
import copy
import unittest
from unittest.mock import patch
from xml.etree import ElementTree as ET

import transcribe as T


def group(direction, x, position, duration, beams=0, dotted=False):
    head = {'x': x, 'y': 30 - position * 2.5, 'pos': position, 'acc': None, 'dot': dotted}
    return {'dir': direction, 'x': x, 'heads': [head], 'dur': duration, 'beams': beams,
            'stem': True, 'grace': False, 'grace_type': duration, 'shared': []}


class RhythmTests(unittest.TestCase):
    def tearDown(self):
        T.configure_rhythm(3)

    def test_thirty_second_double_dotted_eighth_over_quarter_bass(self):
        # El lector geometrico ya reconoce tres barras, pero solo aplica el primer puntillo.
        groups = [group('up', 20, -2, 0.5, 3), group('up', 30, 5, 3, 1, True),
                  group('down', 20, -2, 4)]
        measure = {'top': 10, 'bottom': 30, 'space': 5, 'items': [], 'fifths': 0,
                   'repeat_start': False, 'repeat_end': False,
                   'dots': [(T.P.DOT, x, 15, 20) for x in (37, 39)],
                   'rests': [{'x': 45, 'y': 15, 'dur': 4}, {'x': 60, 'y': 15, 'dur': 8}]}
        lesson = {'time': (4, 4), 'measures': [measure], 'tab': [(20, 48), (30, 60)]}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            measures = T.lesson_measures(lesson)
        self.assertEqual(T.SCALE, 6)
        self.assertEqual(measures[0]['length'], 96)
        self.assertEqual([e[:3] for e in measures[0]['voices'][0]['events']],
                         [(0, 3, 'C4'), (3, 21, 'C5'), (24, 24, 'R'), (48, 48, 'R')])
        self.assertEqual(measures[0]['voices'][1]['events'][0][:3], (0, 24, 'C4'))
        self.assertEqual(T.compare_tab(lesson, measures), ([], []))
        xml = ET.fromstring(T.to_xml(39, lesson, measures))
        upper = [n for n in xml.findall('.//note') if n.findtext('voice') == '1']
        self.assertEqual(upper[0].findtext('type'), '32nd')
        self.assertEqual(len(upper[1].findall('dot')), 2)
        self.assertIsNone(upper[0].find('time-modification'))
        self.assertEqual([b.text for b in upper[0].findall('beam')],
                         ['begin', 'forward hook', 'forward hook'])

    def test_last_sixteenth_group_keeps_three_successive_notes(self):
        # Geometria del primer compas del No.53: el grabado comprime el grupo final.
        # Dos voces de plica abajo (blancas y semicorcheas) comparten la direccion.
        groups = [group('up', x, 9, 4) for x in (163.790, 275.095)]
        groups += [group('down', x, -5, 8) for x in (102.123, 213.428)]
        xs = (116.217, 130.130, 144.043, 171.869, 185.783, 199.696,
              227.522, 241.435, 255.349, 283.175, 297.088, 311.001)
        groups += [group('down', x, (2, 4, 2)[i % 3], 1, 2) for i, x in enumerate(xs)]
        rests = [{'x': x, 'y': 215, 'dur': 1} for x in (101.928, 157.581, 213.234, 268.887)]
        rests += [{'x': x, 'y': 202.5, 'dur': 4} for x in (101.928, 213.234)]
        measure = {'left': 70.683, 'right': 325, 'top': 203, 'bottom': 223, 'space': 5,
                   'items': [], 'rests': rests, 'dots': [], 'fifths': 1,
                   'repeat_start': False, 'repeat_end': False}
        lesson = {'time': (4, 4), 'measures': [measure]}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            measures = T.lesson_measures(lesson)
        voices = measures[0]['voices']
        self.assertEqual([e[:3] for e in voices[1]['events'] if e[0] >= 36],
                         [(36, 3, 'R'), (39, 3, 'G4'), (42, 3, 'B4'), (45, 3, 'G4')])
        self.assertEqual(len(voices), 3, 'no crear una cuarta voz para una semicorchea desplazada')
        self.assertEqual(measures[0]['length'], 48)

    def test_single_reference_note_still_places_accompaniment_on_later_beats(self):
        # Una melodia que dura todo el compas solo aporta un ataque de referencia.
        groups = [group('up', 10, 6, 12), group('down', 10, -6, 12),
                  group('down', 40, 0, 4), group('down', 70, 0, 4)]
        measure = {'left': 0, 'right': 100, 'top': 10, 'bottom': 30, 'space': 5,
                   'items': [], 'rests': [{'x': 10, 'y': 25, 'dur': 4}], 'dots': [],
                   'fifths': 0, 'repeat_start': False, 'repeat_end': False}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            measures = T.lesson_measures({'time': (3, 4), 'measures': [measure]})
        notes = [e[:3] for v in measures[0]['voices'] for e in v['events'] if e[2] == 'E4']
        self.assertEqual(notes, [(12, 12, 'E4'), (24, 12, 'E4')])

    def test_equal_duration_unisons_are_not_deduplicated(self):
        event = (0, 12, 'C4', None, [], {})
        measures = [{'voices': [{'events': [event]}, {'events': [event]}]}]
        self.assertEqual(T.compare_tab({'tab': [(0, 48), (0, 48)]}, measures), ([], []))

    def test_switching_back_preserves_the_triplet_grid(self):
        T.configure_rhythm(6)
        T.configure_rhythm(3)
        self.assertEqual(T.T.TYPES[4], 'eighth')
        self.assertEqual(T.TRIPLET, {2, 4, 8})
        self.assertEqual(T.beam_bounds((4, 4), 48), [0, 12, 24, 36, 48])


if __name__ == '__main__':
    unittest.main()
