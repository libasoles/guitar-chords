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

    def test_bar_end_repeat_alone_is_a_backward_repeat_without_a_forward_one(self):
        root = convert("\\relative c' { c4 d e f | \\bar \":|.\" g1 | a1 }")
        self.assertEqual([r.get('direction') for r in root.iter('repeat')], ['backward'])
        measures = root.findall('.//measure')
        self.assertIsNotNone(measures[0].find('barline[@location="right"]/repeat'))
        self.assertIsNone(measures[1].find('barline'))

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


def convert_file(text, patches=()):
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'p.ly')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        return ET.fromstring(L.convert(path, 'x', 'y', patches=patches).split('?>', 1)[1])


class ModernSyntaxTests(unittest.TestCase):
    def test_fixed_uses_the_octave_of_its_reference(self):
        root = convert("\\fixed c' { c4 d, e'' f }", '\\time 4/4 \\clef "treble_8"')
        self.assertEqual([(s, o) for s, o, _ in pitches(root)], [('C', 4), ('D', 3), ('E', 6), ('F', 4)])

    def test_tuplet_scales_durations_and_marks_the_group(self):
        root = convert("\\relative c' { \\tuplet 3/2 { c8 d e } f4 g2 }")
        notes = list(root.iter('note'))
        self.assertEqual([n.findtext('duration') for n in notes[:4]], ['160', '160', '160', '480'])
        self.assertEqual([n.findtext('time-modification/actual-notes') for n in notes[:4]], ['3', '3', '3', None])
        self.assertEqual([t.get('type') for t in root.iter('tuplet')], ['start', 'stop'])

    def test_unfold_repeats_the_block_with_the_same_pitches(self):
        # En modo relativo LilyPond resuelve el bloque una vez: las copias no suben de octava.
        root = convert("\\relative c' { \\repeat unfold 3 { e2 e' } }", '\\time 2/4 \\key c \\major \\clef violin')
        self.assertEqual([o for _, o, _ in pitches(root)], [3, 4, 3, 4, 3, 4])

    def test_branches_of_simultaneous_music_chain_their_relative_pitch(self):
        root = convert("\\relative c' { << { c1 } \\\\ { g'1 } >> }")
        self.assertEqual([(s, o) for s, o, _ in pitches(root)], [('C', 3), ('G', 3)])

    def test_q_repeats_the_previous_chord(self):
        root = convert("\\relative c' { <c e>4 q q q }")
        self.assertEqual(len(pitches(root)), 8)

    def test_key_change_writes_new_attributes_and_accidentals_follow_it(self):
        root = convert("\\relative c' { c1 | \\key g \\major fis1 }")
        measures = root.findall('.//measure')
        self.assertEqual(measures[1].findtext('attributes/key/fifths'), '1')
        self.assertIsNone(measures[1].find('.//accidental'))  # fa sostenido ya esta en la armadura

    def test_clef_inside_a_variable_decides_the_octave(self):
        text = ('\\version "2.18.0"\nglobal = { \\time 4/4 \\clef "treble_8" }\n'
                "music = \\relative c' { \\global c1 }\n\\score { << \\music >> }\n")
        self.assertEqual(pitches(convert_file(text))[0][:2], ('C', 4))

    def test_german_note_names_with_the_include(self):
        text = ('\\version "2.16.0"\n\\include "deutsch.ly"\n'
                "music = \\relative c'' { h4 b a as }\n\\score { << \\music >> }\n")
        root = convert_file(text)
        self.assertEqual([(s, a) for s, _, a in pitches(root)], [('B', 0), ('B', -1), ('A', 0), ('A', -1)])

    def test_patch_must_match_exactly_once(self):
        text = "\\version \"2.18.0\"\nmusic = \\relative c' { c1 }\n\\score { << \\music >> }\n"
        self.assertEqual(pitches(convert_file(text, patches=[("c1", "d1")]))[0][0], 'D')
        with self.assertRaises(L.LyError):
            convert_file(text, patches=[("zzz", "d1")])

    def test_tie_applies_only_to_marked_chord_notes(self):
        root = convert("\\relative c' { <c~ e>2 <c f> }")
        starts = [n.findtext('pitch/step') for n in root.iter('note')
                  if n.find('tie') is not None and n.find('tie').get('type') == 'start']
        self.assertEqual(starts, ['C'])

    def test_music_function_returns_its_music_arguments_in_order(self):
        text = ('\\version "2.18.2"\n'
                'pair = #(define-music-function (parser location dim a b) (number-pair? ly:music? ly:music?) #{ #a #b #})\n'
                "music = \\relative c' { \\pair #'(1 . 2) c4 d e2 }\n\\score { << \\music >> }\n")
        self.assertEqual([s for s, _, _ in pitches(convert_file(text))], ['C', 'D', 'E'])


class PublishedSourcesAreFresh(unittest.TestCase):
    """Cada `NN.musicxml` versionado es lo que genera el conversor actual desde su `.ly`: si se cambia el conversor,
    hay que reconstruir (`build.py [coleccion] convert N` y `build.py [coleccion] N`) y volver a revisar las piezas."""

    def test_sources_match_the_converter(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('sor_build', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build.py'))
        build = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(build)
        checked = 0
        for collection in build.COLLECTIONS:
            build.use(collection)
            for number, piece in build.PIECES.items():
                lilypond = os.path.join(build.SOURCES, piece['source'])
                committed = os.path.join(build.SOURCES, f'{number:02d}.musicxml')
                if not (os.path.exists(lilypond) and os.path.exists(committed)):
                    continue
                expected = L.convert(lilypond, build.title_of(number), build.AUTHOR, words=piece.get('words'),
                                     patches=piece.get('patches', ()), tie_dirs=piece.get('tie_dirs', False))
                with open(committed, encoding='utf-8') as f:
                    self.assertEqual(f.read(), expected, '%s %s: reconstruir con build.py' % (collection, number))
                checked += 1
        self.assertGreater(checked, 0)


if __name__ == '__main__':
    unittest.main()
