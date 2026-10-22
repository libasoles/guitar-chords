"""Comprueba el grabado publicado, incluidas las otras voces del tresillo."""
import pathlib
import re
import unittest
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
NS = {'s': 'http://www.w3.org/2000/svg'}


class TripletLayoutTest(unittest.TestCase):
    def test_lesson_55_brackets_clear_every_voice(self):
        paths = [ROOT / 'src/site/articles/sagreras-lecciones/lesson-55.svg',
                 ROOT / 'src/site/articles/sagreras-lecciones/full/lesson-55-p1.svg']
        for path in paths:
            root = ET.parse(path).getroot()
            count = 0
            for measure in root.findall('.//s:g[@class="measure"]', NS):
                for tab in measure.findall('s:g[@class="staff"]', NS)[1:]:
                    self.assertEqual(tab.findall('.//s:g[@class="tupletNum"]', NS), [],
                                     f'{path.name}: la TAB no repite los tresillos')
            for measure in root.findall('.//s:g[@class="measure"]', NS):
                staff = measure.find('s:g[@class="staff"]', NS)
                for bracket in staff.findall('.//s:g[@class="tupletBracket"]', NS):
                    tuplet = next(g for g in staff.findall('.//s:g[@class="tuplet"]', NS)
                                  if bracket in list(g))
                    number = tuplet.find('s:g[@class="tupletNum"]', NS)
                    self.assertEqual(bracket.get('transform'), number.get('transform'),
                                     'cifra y corchete se desplazan juntos')
                    points = [tuple(map(float, pair.split(','))) for line in bracket
                              for pair in line.attrib['points'].split()]
                    left, right = min(x for x, _ in points), max(x for x, _ in points)
                    shift = re.search(r'translate\(0,\s*(-?[\d.]+)\)', bracket.get('transform', ''))
                    bottom = max(y for _, y in points) + (float(shift[1]) if shift else 0)
                    for stem in staff.findall('.//s:g[@class="stem"]/s:path', NS):
                        x1, y1, x2, y2 = map(float, re.findall(r'-?[\d.]+', stem.attrib['d']))
                        if left <= x1 <= right:
                            self.assertLessEqual(bottom + 90, min(y1, y2),
                                                 f'{path.name}: tresillo sobre plica en x={x1}')
                    count += 1
            self.assertGreater(count, 0)


if __name__ == '__main__':
    unittest.main()
