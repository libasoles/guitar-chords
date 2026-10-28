"""Digitaciones curadas: ejecutar con unittest discover en scripts/sagreras."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend' / 'engine'))
import tabify


def fingered(number):
    _, part = tabify.load_score([str(ROOT / 'scripts' / 'sagreras' / 'sources' / f'{number:02d}.musicxml')])
    measures, _ = tabify.build_columns(part)
    tabify.assign_frets(measures)
    return {measure['number']: measure['columns'] for measure in measures}


class CuratedFingeringTests(unittest.TestCase):
    def test_partial_barres_leave_the_a_bass_open(self):
        for number, bars in [(76, [3, 7]), (79, [12]), (80, [3]), (83, [3, 10, 14]), (86, [1, 5, 8])]:
            measures = fingered(number)
            for bar in bars:
                with self.subTest(lesson=number, bar=bar):
                    bass = [c for c in measures[bar] if c['barre'] and c['cells'][5] == 5]
                    self.assertEqual(bass, [], 'el La bajo una media cejilla debe quedar en quinta al aire')
                    self.assertTrue(any(c['barre'] and c['cells'][4] == 0 for c in measures[bar]))

    def test_79_bar_15_uses_first_and_fifth_strings_at_fret_two(self):
        self.assertEqual(fingered(79)[15][0]['cells'], [2, None, None, None, 2, None])


if __name__ == '__main__':
    unittest.main()
