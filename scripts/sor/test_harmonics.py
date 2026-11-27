"""Los contactos del Op. 60 n.º 25 deben producir las alturas transcritas."""
import json
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

import harmonics

HERE = Path(__file__).resolve().parent


class HarmonicContacts(unittest.TestCase):
    def test_contacts_sound_the_transcribed_notes_in_drop_d(self):
        piece = json.loads((HERE / 'pieces.json').read_text())['25']
        root = ET.parse(HERE / 'sources' / '25.musicxml').getroot()
        divisions = int(root.findtext('.//divisions'))
        opens = [64, 59, 55, 50, 45, 38]
        # The special 3 is Sor's node just beyond fret 3 (sixth partial),
        # not an ordinary stopped third fret or the seventh partial at 2.67.
        intervals = {3: 31, 4: 28, 5: 24, 9: 28, 12: 12}
        count = 0
        for index, measure in enumerate(root.findall('./part/measure'), 1):
            attrs = measure.find('attributes')
            if attrs is None:
                attrs = ET.SubElement(measure, 'attributes')
            if attrs.find('divisions') is None:
                ET.SubElement(attrs, 'divisions').text = str(divisions)
            notes = list(harmonics.notes_at(measure))
            for onset, contacts in piece['harmonics'].get(str(index), []):
                actual = []
                for time, note in notes:
                    pitch = note.find('pitch')
                    if time != onset or pitch is None:
                        continue
                    actual.append(12 * (int(pitch.findtext('octave')) + 1)
                                  + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[pitch.findtext('step')]
                                  + int(pitch.findtext('alter', '0')))
                    self.assertEqual(note.findtext('notehead'), 'diamond')
                    self.assertIsNotNone(note.find('notations/technical/harmonic/natural'))
                expected = [opens[string - 1] + intervals[fret] for string, fret in contacts]
                self.assertEqual(sorted(actual), sorted(expected), (index, onset))
                count += len(actual)
        self.assertEqual(count, 54)


if __name__ == '__main__':
    unittest.main()
