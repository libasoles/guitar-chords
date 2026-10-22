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

    def test_empty_positions_do_not_add_dots_or_ledger_lines(self):
        collection = json.loads((self.lab / 'folklore-arpegios/coleccion.json').read_text())
        exercise = Exercise(self.library.generator, collection, collection['ejercicios'][0], {})
        root = ET.fromstring(exercise.svg)
        dots = root.findall('.//s:g[@data-id="ngroup-0-bajo-0"]/s:g[@class="dots"]/s:ellipse', SVG)
        self.assertEqual(len(dots), 1, 'a dotted half remains a single dot')
        chord = root.find('.//s:g[@data-id="ngroup-0-bajo-0"]', SVG)
        heads = chord.findall('.//s:g[@class="notehead"]/s:use', SVG)
        xs = [re.search(r'translate\(([-\d.]+)', head.get('transform')).group(1) for head in heads]
        self.assertEqual(len(set(xs)), 1, 'added notes share the attack X coordinate')
        final = root.findall('.//s:g[@class="measure"]', SVG)[-1]
        line_y = float(re.search(r'M[-\d.]+[ ,]+([-\d.]+)', final.find('./s:g[@class="staff"]/s:path', SVG).get('d')).group(1))
        fermata = final.find('.//s:g[@class="fermata"]/s:use', SVG)
        fermata_y = float(re.search(r'translate\([-\d.]+[ ,]+([-\d.]+)', fermata.get('transform')).group(1))
        self.assertTrue(-1500 < fermata_y - line_y < 0, 'the closing fermata stays near the actual staff')
        for note in exercise.notes.values():
            if note['bar'] == 1 and note['at'] == 0:
                note['active'] = False
        exercise.refresh()
        root = ET.fromstring(exercise.svg)
        self.assertEqual(len(root.findall('.//s:g[@data-id="ngroup-0-bajo-0"]/s:g[@class="dots"]/s:ellipse', SVG)), 0)
        staff = root.find('.//s:g[@class="staff"]', SVG)
        self.assertEqual(len(staff.findall('.//s:g[@class="ledgerLines below"]/s:path', SVG)), 0)

    def test_add_remove_and_reload_notes_without_moving_existing_notes(self):
        self.library.load('arpegios')
        exercise = self.library.exercises['1']
        original = copy.deepcopy(exercise.notes)
        before = anchors(exercise.svg)
        key = next(key for key, note in exercise.notes.items() if not note['active'])
        slot = exercise.notes[key]
        anchor = next(note for note in original.values() if note['active'] and note['group'] == slot['group'])
        self.library.edit(dict(set='arpegios', exercise=1,
                               changes=[dict(key=key, string=1, fret=0)]))
        after = anchors(exercise.svg)
        self.assertEqual({key: after[key] for key in before}, before)
        self.assertIn('n' + key, after)
        xml = ET.fromstring(exercise.musicxml())
        for prefix in ('n', 't'):
            added = xml.find(f'.//note[@id="{prefix}{key}"]')
            self.assertEqual(added.findtext('duration'), str(anchor['duration']))
            self.assertIsNotNone(added.find('chord'))
            self.assertEqual(added.findtext('pitch/step'), 'E')
        # Every pre-existing note retains its rhythmic fields, pitch and position.
        for note_key, note in original.items():
            if note['active']:
                self.assertEqual(exercise.notes[note_key], note)
        reloaded = Library(self.lab)
        reloaded.load('arpegios')
        self.assertTrue(reloaded.exercises['1'].notes[key]['active'])
        self.library.edit(dict(set='arpegios', exercise=1, changes=[dict(key=key, active=False)]))
        hidden = exercise.toolkit.getElementAttr('n' + key)
        reference = exercise.toolkit.getElementAttr('n' + anchor['key'])
        self.assertEqual((hidden['pname'], hidden['oct']), (reference['pname'], reference['oct']))
        # Removing every note of this column keeps its duration as a hidden rest.
        changes = [dict(key=note_key, active=False) for note_key, note in exercise.notes.items()
                   if note['bar'] == slot['bar'] and note['at'] == slot['at']]
        self.library.edit(dict(set='arpegios', exercise=1, changes=changes))
        for change in changes:
            self.assertFalse(exercise.notes[change['key']]['active'])
        root = ET.fromstring(exercise.musicxml())
        rests = root.findall('./part/measure[@number="1"]/note[@print-object="no"]')
        self.assertTrue(any(node.find('rest') is not None and node.findtext('duration') == str(anchor['duration']) for node in rests))
        reloaded = Library(self.lab)
        reloaded.load('arpegios')
        self.assertFalse(reloaded.exercises['1'].notes[key]['active'])
        # Restore so the other tests keep using the unmodified source fixture.
        self.library.edit(dict(set='arpegios', exercise=1, changes=[
            dict(key=k, active=n['active'], string=n['string'], fret=n['fret'])
            for k, n in original.items()]))

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
