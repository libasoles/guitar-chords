"""Regresiones del grabado compartido usadas por los arpegios."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'carcassi-preludios'))
import extract


class TabTupletsTests(unittest.TestCase):
    def test_only_notation_keeps_tuplet_numbers_for_both_svg_attribute_styles(self):
        for attr in ['id="s1"', 'data-id="s1" data-class="staff"']:
            with self.subTest(attributes=attr):
                def staff(number):
                    return (f'<g {attr} class="staff"><g {attr} class="tupletNum">{number}</g>'
                            f'<g {attr} class="tupletBracket">line</g></g>')
                svg = staff('notation') + staff('tab')
                clean = extract.drop_tab_tuplets(svg)
                self.assertIn('notation', clean)
                self.assertNotIn('>tab<', clean)
                self.assertEqual(clean.count('class="tupletNum"'), 1)
                self.assertEqual(clean.count('class="tupletBracket"'), 1)


if __name__ == '__main__':
    unittest.main()
