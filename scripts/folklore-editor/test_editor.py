"""Integration checks against local lab fixtures; all writes use a temp copy."""
import copy
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET

from server import Exercise, Library, SETS

LAB = Path(os.environ.get('FOLKLORE_LAB', Path(__file__).resolve().parents[2] / 'lab'))
SVG = {'s': 'http://www.w3.org/2000/svg'}


def anchors(svg):
    root = ET.fromstring(svg)
    result = {}
    for group in root.findall('.//s:g', SVG):
        ident = group.get('data-id', '')
        if ident.startswith(('n', 't')) and re.match(r'^[nt]\d+-', ident):
            uses = group.findall('./s:g[@class="notehead"]/s:use', SVG)
            # Notation noteheads and TAB glyphs keep their horizontal anchors.
            if ident.startswith('t'):
                result[ident] = [float(text.get('x')) for text in group.findall('.//s:text', SVG)]
            if uses:
                result[ident] = [float(re.search(r'translate\(([-\d.]+)', u.get('transform', '')).group(1)) for u in uses
                                 if 'translate(' in u.get('transform', '')]
    if not result:
        raise AssertionError('No notation anchors found')
    return result


def rhythm(xml):
    root = ET.fromstring(xml)
    for note in root.findall('.//note'):
        technical = note.find('./notations/technical')
        if technical is not None:
            note.find('notations').remove(technical)
        for tag in ('pitch', 'accidental'):
            child = note.find(tag)
            if child is not None:
                note.remove(child)
    return ET.tostring(root)


@unittest.skipUnless((LAB / 'folklore-arpegios/build.py').exists(), 'Requires local folklore lab')
class EditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='folklore-editor-')
        cls.lab = Path(cls.temp.name)
        for folder in ('folklore-arpegios', 'folklore-por-ritmo'):
            shutil.copytree(LAB / folder, cls.lab / folder, ignore=shutil.ignore_patterns('__pycache__'))
        cls.library = Library(cls.lab)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_accidentals_update_without_moving_attacks(self):
        collection = json.loads((self.lab / 'folklore-arpegios/coleccion.json').read_text())
        exercise = Exercise(self.library.generator, collection, collection['ejercicios'][0], {})
        positions = anchors(exercise.svg)
        key = next(iter(exercise.notes))
        exercise.notes[key]['fret'] = 1  # G -> G sharp, on string 3.
        exercise.refresh()
        self.assertEqual(exercise.toolkit.getElementAttr('a' + key).get('accid'), 's')
        self.assertEqual(positions, anchors(exercise.svg))
        exercise.notes[key]['fret'] = 2  # A natural clears the sharp glyph.
        exercise.refresh()
        self.assertEqual(exercise.toolkit.getElementAttr('a' + key).get('accid', ''), '')
        self.assertEqual(positions, anchors(exercise.svg))

    def test_batch_string_moves_are_atomic_and_keep_note_identities(self):
        self.library.load('arpegios')
        exercise = self.library.exercises['3']
        by_attack = {}
        for note in exercise.notes.values():
            by_attack.setdefault((note['bar'], note['at']), []).append(note)
        pair = next(notes[:2] for notes in by_attack.values() if len(notes) >= 2)
        before = copy.deepcopy(exercise.notes)
        before_rhythm = rhythm(exercise.musicxml())
        before_positions = anchors(exercise.svg)
        changes = [dict(key=pair[0]['key'], string=pair[1]['string'], fret=pair[0]['fret']),
                   dict(key=pair[1]['key'], string=pair[0]['string'], fret=pair[1]['fret'])]
        self.library.edit(dict(set='arpegios', exercise=3, changes=changes))
        self.assertEqual(anchors(exercise.svg), before_positions)
        self.assertEqual(rhythm(exercise.musicxml()), before_rhythm)
        self.assertEqual(exercise.notes[pair[0]['key']]['string'], before[pair[1]['key']]['string'])
        committed = copy.deepcopy(exercise.notes)
        saved = self.library.save_path.read_bytes()
        changes[0]['string'] = changes[1]['string']
        with self.assertRaises(ValueError):
            self.library.edit(dict(set='arpegios', exercise=3, changes=changes))
        self.assertEqual(exercise.notes, committed)
        self.assertEqual(self.library.save_path.read_bytes(), saved)

    def test_all_sets_and_edits_preserve_rhythm_and_horizontal_positions(self):
        for collection, _, _ in SETS:
            with self.subTest(collection=collection):
                self.library.load(collection)
                self.assertEqual(len(self.library.exercises), 10)
                # Cover every exercise, including chords, dotted figures,
                # semiquavers, hidden rests and written final cadences.
                for number, exercise in self.library.exercises.items():
                    before = exercise.svg
                    before_rhythm = rhythm(exercise.musicxml())
                    key = next(iter(exercise.notes))
                    original = copy.deepcopy(exercise.notes[key])
                    exercise.notes[key].update(fret=12)
                    exercise.refresh()
                    self.assertEqual(anchors(before), anchors(exercise.svg))
                    self.assertNotEqual(before, exercise.svg)
                    self.assertEqual(before_rhythm, rhythm(exercise.musicxml()))
                    self.assertEqual(exercise.toolkit.getElementAttr('n' + key)['oct'],
                                     str(( [64, 59, 55, 50, 45, 40][original['string'] - 1] + 12) // 12 - 1))
                    exercise.notes[key] = original
                    exercise.refresh()
                # Save one change, switch sets, and reload from disk.
                exercise = self.library.exercises['1']
                key = next(iter(exercise.notes))
                self.library.edit(dict(set=collection, exercise=1, key=key, string=2, fret=7))
                reloaded = Library(self.lab)
                reloaded.load(collection)
                self.assertEqual(reloaded.exercises['1'].notes[key]['fret'], 7)
                self.assertEqual(reloaded.exercises['1'].notes[key]['string'], 2)
                xml = ET.fromstring(reloaded.exercises['1'].musicxml())
                for prefix in ('n', 't'):
                    pitch = xml.find(f'.//note[@id="{prefix}{key}"]/pitch')
                    self.assertEqual(pitch.findtext('step'), 'F')
                    self.assertEqual(pitch.findtext('alter'), '1')
                    self.assertEqual(pitch.findtext('octave'), '4')
                with self.assertRaises(ValueError):
                    self.library.edit(dict(set=collection, exercise=1, key=key, string=7, fret=0))
                self.assertEqual(self.library.exercises['1'].notes[key]['string'], 2)


if __name__ == '__main__':
    unittest.main()
