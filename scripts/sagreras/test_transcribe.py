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

    def test_double_bar_separates_measures_and_survives_musicxml(self):
        # MuseScore 2: barra normal de 0,95 pt, doble barra de dos trazos de 0,8.
        rect = T.M.pymupdf.Rect
        drawings = [{'type': 's', 'width': width, 'rect': rect(x, 9.75, x, 30.25)}
                    for x, width in ((50, .95), (65, .75), (80, .8), (82.3, .8), (110, .95))]
        glyphs = [(0xE050, 0, 25, 20)] + [(0xE4E3, x, 15, 20) for x in (20, 60, 95)]
        system = T.P.read_system([10, 15, 20, 25, 30], glyphs, [],
                                 T.M.bar_strokes(drawings), [], [])
        self.assertEqual(len(system['measures']), 3)
        self.assertEqual(system['measures'][1]['right_bar_style'], 'light-light')
        for m in system['measures']:
            m['fifths'] = 0
        lesson = {'time': (4, 4), 'measures': system['measures']}
        measures = T.lesson_measures(lesson)
        xml = ET.fromstring(T.to_xml(66, lesson, measures))
        self.assertEqual(xml.findtext('./part/measure[@number="2"]/barline/bar-style'), 'light-light')
        self.assertIsNone(xml.find('./part/measure[@number="2"]/barline/repeat'))
        self.assertIsNone(xml.find('./part/measure[@number="1"]/barline'))
        self.assertIsNone(xml.find('./part/measure[@number="3"]/barline'),
                          'no convertir una barra simple explicita en final')

    def test_final_and_repeat_bars_keep_their_styles(self):
        rect = T.M.pymupdf.Rect
        glyphs = [(0xE050, 0, 25, 20), (0xE4E3, 30, 15, 20)]
        for repeat in (False, True):
            with self.subTest(repeat=repeat):
                dots = [(0xE044, 44, 17.5, 20)] if repeat else []
                system = T.P.read_system([10, 15, 20, 25, 30], glyphs + dots, [],
                                         [rect(50, 10, 50, 30)], [rect(53, 10, 53, 30)], [])
                self.assertEqual(system['measures'][0]['right_bar_style'], 'light-heavy')
                self.assertEqual(system['measures'][0]['repeat_end'], repeat)
                system['measures'][0]['fifths'] = 0
                lesson = {'time': (4, 4), 'measures': system['measures']}
                xml = ET.fromstring(T.to_xml(1, lesson, T.lesson_measures(lesson)))
                self.assertEqual(xml.findtext('.//barline/bar-style'), 'light-heavy')
                mark = xml.find('.//barline/repeat')
                self.assertEqual(mark is not None, repeat)
                if repeat:
                    self.assertEqual(mark.get('direction'), 'backward')

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

    def test_shared_dotted_half_keeps_the_melodys_initial_quarter(self):
        bass = group('down', 20, 0, 12, dotted=True)
        upper = group('up', 26, 0, 8, dotted=True)
        upper['heads'] = bass['heads']
        bass['shared'] = upper['shared'] = bass['heads']
        groups = [bass, upper, group('up', 40, 2, 2),
                  group('up', 55, 5, 4), group('up', 80, 7, 2)]
        measure = {'top': 10, 'bottom': 30, 'space': 5, 'items': [], 'fifths': 0,
                   'repeat_start': False, 'repeat_end': False, 'dots': [], 'rests': []}
        lesson = {'time': (6, 8), 'measures': [measure],
                  'tab': [(20, 52), (40, 55), (55, 60), (80, 64)]}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            measures = T.lesson_measures(lesson)
        self.assertEqual([e[:3] for e in measures[0]['voices'][0]['events']],
                         [(12, 6, 'G4'), (18, 12, 'C5'), (30, 6, 'E5')])
        self.assertEqual(measures[0]['voices'][1]['events'][0][:3], (0, 36, 'E4'))
        self.assertEqual(T.compare_tab(lesson, measures), ([], []))
        xml = ET.fromstring(T.to_xml(58, lesson, measures))
        first = xml.find('.//note')
        self.assertEqual(first.get('print-object'), 'no')
        self.assertEqual(first.findtext('duration'), '12')

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

    def test_dotted_rest_delays_the_melody_in_three_voices(self):
        # No.65: cada voz suma doce corcheas, incluidos sus propios silencios.
        bass = group('down', 10, -2, 24, dotted=True)
        bass['stem'] = None
        groups = [bass] + [group('up', x, 5, 6, dotted=True) for x in (40, 70, 100)]
        groups += [group('down', x, pos, 2, 1) for x, pos in
                   ((20, 0), (30, 2), (50, 0), (60, 2), (80, 0), (90, 2), (110, 0), (120, 2))]
        measure = {'left': 0, 'right': 130, 'top': 10, 'bottom': 30, 'space': 5,
                   'items': [h for g in groups for h in g['heads']],
                   'rests': [{'x': x, 'y': 30, 'dur': 2} for x in (10, 40, 70, 100)]
                            + [{'x': 10, 'y': 10, 'dur': 4}],
                   'dots': [(T.P.DOT, 17, 7.5, 20)], 'fifths': 0,
                   'repeat_start': False, 'repeat_end': False}
        def read_groups(m):
            return [g for g in groups if any(h is item for h in g['heads'] for item in m['items'])]
        with patch.object(T, '_original_groups', side_effect=read_groups):
            result = T.lesson_measures({'time': (12, 8), 'measures': [measure]})[0]
        self.assertEqual(len(result['voices']), 3)
        upper, middle, lower = [v['events'] for v in result['voices']]
        self.assertEqual([e[:3] for e in upper],
                         [(0, 18, 'R'), (18, 18, 'C5'), (36, 18, 'C5'), (54, 18, 'C5')])
        self.assertEqual([(e[0], e[1]) for e in middle], [(i * 6, 6) for i in range(12)])
        self.assertEqual(lower[0][:3], (0, 72, 'C4'))

    def test_same_direction_voices_use_heads_to_align_rests_and_notes(self):
        # Geometria del compas 15 del No.65: las plicas arriba estan ~5.6 pt
        # a la derecha de las cabezas; ese desplazamiento no es tiempo musical.
        groups = [group('down', x, -5, 12, dotted=True) for x in (342.31, 398.31)]
        for x, pos in ((376.42, 5), (432.42, 4)):
            g = group('up', x, pos, 6, dotted=True)
            g['heads'][0]['x'] = x - 5.56
            groups.append(g)
        groups += [group('down', x, pos, 2, 1) for x, pos in
                   ((354.02, 0), (362.30, 2), (381.93, 0), (390.21, 2),
                    (410.02, 1), (418.30, 2), (437.93, 1), (446.21, 2))]
        rests = [{'x': x, 'y': 25, 'dur': 2} for x in (342.12, 370.21, 398.12, 426.21)]
        rests += [{'x': x, 'y': 10, 'dur': 4} for x in (342.12, 398.12)]
        measure = {'left': 332.6, 'right': 458.4, 'top': 10, 'bottom': 30, 'space': 5,
                   'items': [], 'rests': rests,
                   'dots': [(T.P.DOT, x, 7.5, 20) for x in (349.20, 405.20)],
                   'fifths': 0, 'repeat_start': False, 'repeat_end': False}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            result = T.lesson_measures({'time': (12, 8), 'measures': [measure]})[0]
        self.assertEqual(len(result['voices']), 3)
        middle = next(v['events'] for v in result['voices'] if len(v['events']) == 12)
        self.assertEqual([(e[0], e[1]) for e in middle], [(i * 6, 6) for i in range(12)])
        bass = next(v['events'] for v in result['voices'] if v['events'][0][2] == 'G3')
        self.assertEqual([e[:3] for e in bass], [(0, 36, 'G3'), (36, 36, 'G3')])

    def test_equal_duration_unisons_are_not_deduplicated(self):
        event = (0, 12, 'C4', None, [], {})
        measures = [{'voices': [{'events': [event]}, {'events': [event]}]}]
        self.assertEqual(T.compare_tab({'tab': [(0, 48), (0, 48)]}, measures), ([], []))

    def test_shared_head_can_have_one_printed_tab_number_in_two_equal_voices(self):
        event = (0, 6, 'G3', None, [], {})
        measures = [{'voices': [{'events': [event]}, {'events': [event]}]}]
        self.assertEqual(T.compare_tab({'tab': [(0, 43)]}, measures), ([], []))

    def test_centered_rest_belongs_to_accompaniment_when_melody_is_full(self):
        # No.67: negra de silencio + tres negras arriba; cuatro grupos de
        # silencio + tres semicorcheas abajo. El bajo es una redonda.
        bass = group('up', 10, -2, 16)
        bass['stem'] = None
        groups = [bass] + [group('up', x, 5, 4) for x in (50, 90, 130)]
        groups += [group('down', x, 0, 1, 2) for x in
                   (20, 30, 40, 60, 70, 80, 100, 110, 120, 140, 150, 160)]
        m = {'top': 10, 'bottom': 30, 'space': 5, 'left': 0, 'right': 170,
             'items': [h for g in groups for h in g['heads']], 'dots': [],
             'rests': [{'x': 10, 'y': 20, 'dur': 1}, {'x': 10, 'y': 10, 'dur': 4}]
                      + [{'x': x, 'y': 25, 'dur': 1} for x in (50, 90, 130)],
             'fifths': 0, 'repeat_start': False, 'repeat_end': False}
        def read_groups(measure):
            return [g for g in groups if any(h is item for h in g['heads'] for item in measure['items'])]
        with patch.object(T, '_original_groups', side_effect=read_groups):
            result = T.lesson_measures({'time': (4, 4), 'measures': [m]})[0]
        self.assertEqual(result['length'], 48)
        upper, middle, lower = [v['events'] for v in result['voices']]
        self.assertEqual([(e[0], e[1]) for e in upper], [(i * 12, 12) for i in range(4)])
        self.assertEqual([(e[0], e[1]) for e in middle], [(i * 3, 3) for i in range(16)])
        self.assertEqual(lower[0][:3], (0, 48, 'C4'))

    def test_rest_only_voice_is_not_concatenated_with_chords(self):
        groups = [group('up', x, 6, 4) for x in (10, 40)]
        m = {'top': 10, 'bottom': 30, 'space': 5, 'items': [], 'dots': [],
             'rests': [{'x': x, 'y': 40, 'dur': 4} for x in (10, 40)],
             'fifths': 0, 'repeat_start': False, 'repeat_end': False}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            result = T.lesson_measures({'time': (2, 4), 'measures': [m]})[0]
        self.assertEqual(result['length'], 24)
        self.assertEqual(len(result['voices']), 2)
        self.assertEqual([e[:3] for e in result['voices'][1]['events']], [(0, 12, 'R'), (12, 12, 'R')])

    def test_vertical_chord_dots_are_not_double_dots_and_wide_bass_dot_is_kept(self):
        upper = group('up', 20, 3, 12, dotted=True)
        upper['heads'] += group('up', 20, 4, 12)['heads']
        bass = group('down', 20, -3, 8)
        m = {'top': 10, 'bottom': 30, 'space': 5,
             'dots': [(T.P.DOT, 34.5, y, 20) for y in (20, 25, 37.5)], 'rests': []}
        with patch.object(T, '_original_groups', return_value=[upper, bass]):
            result = T.fixed_groups(m)
        self.assertEqual([g['dur'] for g in result], [12, 12])

    def test_parallel_chord_ties_are_matched_by_their_endpoints(self):
        P = T.M.pymupdf
        heads = [{'x': x, 'y': y, 'pos': pos} for x in (20, 50) for y, pos in ((20, 4), (25, 2))]
        drawings = [{'fill': (0., 0., 0.), 'rect': P.Rect(27, y - 5, 49, y - 2),
                     'items': [('c', P.Point(27, y - 2), P.Point(32, y - 5),
                                P.Point(44, y - 5), P.Point(49, y - 2))]} for y in (20, 25)]
        T.M.mark_ties({'measures': [{'items': heads}]}, drawings, [10, 15, 20, 25, 30])
        self.assertTrue(all(h.get('tie_next') for h in heads[:2]))
        self.assertTrue(all(h.get('tie_prev') for h in heads[2:]))

    def test_centered_triplet_rest_uses_tuplet_duration_before_choosing_voice(self):
        groups = [group('up', x, 5, 2, 1) for x in (25, 40)] + [group('down', 10, -2, 4)]
        m = {'top': 10, 'bottom': 30, 'space': 5, 'left': 0, 'right': 55,
             'items': [], 'dots': [], 'rests': [{'x': 10, 'y': 20, 'dur': 2}],
             'tuplets': [(25, 0)], 'fifths': 0, 'repeat_start': False, 'repeat_end': False}
        with patch.object(T, '_original_groups', side_effect=lambda _: copy.deepcopy(groups)):
            result = T.lesson_measures({'time': (1, 4), 'measures': [m]})[0]
        self.assertEqual(result['length'], 12)
        self.assertEqual([e[:3] for e in result['voices'][0]['events']],
                         [(0, 4, 'R'), (4, 4, 'C5'), (8, 4, 'C5')])

    def test_switching_back_preserves_the_triplet_grid(self):
        T.configure_rhythm(6)
        T.configure_rhythm(3)
        self.assertEqual(T.T.TYPES[4], 'eighth')
        self.assertEqual(T.TRIPLET, {2, 4, 8})
        self.assertEqual(T.beam_bounds((4, 4), 48), [0, 12, 24, 36, 48])


if __name__ == '__main__':
    unittest.main()
