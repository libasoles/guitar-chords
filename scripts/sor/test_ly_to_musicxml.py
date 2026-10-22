"""Regresiones del conversor de LilyPond a MusicXML, con fragmentos propios (no dependen de Mutopia).

    .venv-carcassi/bin/python -m unittest discover -s scripts/sor -p 'test_*.py'
"""
import os
import tempfile
import unittest
from xml.etree import ElementTree as ET

import ly_to_musicxml as L


def convert(body, score='\\time 4/4 \\key c \\major \\clef violin', variable='music'):
    text = '\\version "2.6.5"\n\\header { title = "x" }\n%s = %s\n\\score { \\context Staff << %s \\%s >> }\n' % (
        variable, body, score, variable)
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'p.ly')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        return ET.fromstring(L.convert(path, 'x', 'y').split('?>', 1)[1])


def pitches(root):
    return [(n.findtext('pitch/step'), int(n.findtext('pitch/octave')), int(n.findtext('pitch/alter') or 0))
            for n in root.iter('note') if n.find('pitch') is not None]


class PitchTests(unittest.TestCase):
    def test_relative_picks_the_nearest_octave(self):
        # Do' relativo: g' sube a sol4, `c,` baja a do4 (la mas cercana, una cuarta arriba, menos una octava) y g queda
        # en sol3. Con clave de sol normal el motor recibe la altura que suena, una octava menos que la escrita.
        root = convert("\\relative c' { c4 g' c, g }")
        self.assertEqual([(s, o) for s, o, _ in pitches(root)], [('C', 3), ('G', 3), ('C', 3), ('G', 2)])

    def test_treble_8_keeps_the_given_octave(self):
        root = convert("\\relative c' { c4 d e f }", '\\time 4/4 \\clef "treble_8"')
        self.assertEqual(pitches(root)[0][:2], ('C', 4))

    def test_chord_fingering_and_accidentals(self):
        root = convert("\\relative c' { <c-1 e-2 gis>4 r2. }")
        notes = [n for n in root.iter('note') if n.find('pitch') is not None]
        self.assertEqual(len(notes), 3)
        self.assertEqual([n.find('chord') is not None for n in notes], [False, True, True])
        self.assertEqual(['1', '2', None], [n.findtext('notations/technical/fingering') for n in notes])
        self.assertEqual(notes[2].findtext('accidental'), 'sharp')


class StructureTests(unittest.TestCase):
    def test_partial_in_the_middle_gives_short_measures_and_pickups_do_not_count(self):
        body = ("\\relative c' { \\repeat volta 2 { \\partial 4 g4 | c d e | f g a | \\partial 4*2 b4 r | } "
                "\\repeat volta 2 { \\partial 4 g4 | c d e | c2. | } }")
        measures = convert(body, '\\time 3/4 \\key c \\major \\clef violin').findall('.//measure')
        self.assertEqual([m.get('number') for m in measures], ['0', '1', '2', '3', '3', '4', '5'])
        self.assertEqual([m.get('implicit') for m in measures], ['yes', None, None, None, 'yes', None, None])

    def test_repeats_become_barlines(self):
        root = convert("\\relative c' { \\repeat volta 2 { c4 d e f | g1 } }")
        directions = [r.get('direction') for r in root.iter('repeat')]
        self.assertEqual(directions, ['forward', 'backward'])

    def test_ties_and_slurs(self):
        root = convert("\\relative c' { c2 ~ c4 ( d e1 ) }")
        notes = list(root.iter('note'))
        self.assertEqual([[t.get('type') for t in n.findall('tie')] for n in notes[:2]], [['start'], ['stop']])
        self.assertEqual([s.get('type') for s in root.iter('slur')], ['start', 'stop'])

    def test_two_voices_from_simultaneous_music(self):
        root = convert("<< \\relative c'' { c1 } \\\\ \\relative c { c2 g' } >>")
        voices = sorted({n.findtext('voice') for n in root.iter('note')})
        self.assertEqual(voices, ['1', '2'])
        self.assertEqual([s.text for s in root.iter('stem')], ['up', 'down', 'down'])

    def test_tie_between_different_pitches_is_ignored(self):
        # Mutopia tiene `d, ~ d'` en la leccion 11: LilyPond no liga alturas distintas y el MusicXML tampoco debe.
        root = convert("\\relative c' { d4 ~ d' c2 }")
        self.assertEqual(list(root.iter('tie')), [])
        root = convert("\\relative c' { d4 ~ d c2 }")
        self.assertEqual([t.get('type') for t in root.iter('tie')], ['start', 'stop'])

    def test_voice_that_opens_in_the_middle_becomes_its_own_voice(self):
        root = convert("\\relative c' { c1 | << { d1 } \\context Voice = \"x\" { b,2 g } >> }")
        measures = root.findall('.//measure')
        self.assertEqual([sorted({n.findtext('voice') for n in m.iter('note')}) for m in measures], [['1'], ['1', '2']])
        # La voz 2 no escribe nada en el primer compas y solo hay plicas donde suenan dos voces.
        self.assertEqual([len(m.findall('.//stem')) for m in measures], [0, 3])

    def test_acciaccatura_takes_no_time(self):
        root = convert("\\relative c' { \\acciaccatura d8 c2 d4 }", '\\time 3/4 \\key c \\major \\clef violin')
        notes = list(root.iter('note'))
        self.assertIsNotNone(notes[0].find('grace'))
        self.assertIsNone(notes[0].find('duration'))
        self.assertEqual(notes[0].findtext('type'), 'eighth')
        self.assertEqual(len(root.findall('.//measure')), 1)

    def test_alternative_endings_are_separate_measures_with_their_own_barlines(self):
        body = "\\relative c' { \\repeat volta 2 { c4 d e f | } \\alternative { { g4 g g g | } { a1 | } } }"
        measures = convert(body).findall('.//measure')
        self.assertEqual(len(measures), 3)
        endings = [(e.get('number'), e.get('type')) for m in measures for e in m.iter('ending')]
        self.assertEqual(endings, [('1', 'start'), ('1', 'stop'), ('2', 'start'), ('2', 'discontinue')])
        self.assertEqual([r.get('direction') for r in measures[1].iter('repeat')], ['backward'])

    def test_segno_is_a_direction_before_its_note(self):
        root = convert("\\relative c' { c4\\segno d e f }")
        first = root.find('.//measure')[1] if root.find('.//measure')[0].tag == 'attributes' else root.find('.//measure')[0]
        self.assertIsNotNone(first.find('direction-type/segno'))

    def test_note_crossing_another_voices_barline_is_rejected(self):
        with self.assertRaises(L.LyError):
            convert("<< \\relative c'' { c1 | c1 } \\\\ \\relative c { c2 | c2 c2 } >>")

    def test_unknown_command_is_rejected(self):
        with self.assertRaises(L.LyError):
            convert("\\relative c' { c4 \\nonsense d }")


if __name__ == '__main__':
    unittest.main()
