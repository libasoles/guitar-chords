"""Comprueba que una nueva altura no corte otra voz aún sostenida en la misma cuerda."""
from pathlib import Path
from fractions import Fraction as F
import xml.etree.ElementTree as E
import json
import unittest

def check(file):
    root = E.parse(file)
    part = root.find('part')
    base = F(0)
    division = 1
    notation = []
    tab = {}
    for bar, m in enumerate(part.findall('measure'), 1):
        if m.findtext('attributes/divisions'):
            division = int(m.findtext('attributes/divisions'))
        t = F(0)
        last = F(0)
        end = F(0)
        for tag in m:
            dur = F(int(tag.findtext('duration', '0')), division)
            if tag.tag == 'backup':
                t -= dur
                continue
            if tag.tag == 'forward':
                t += dur
                end = max(end, t)
                continue
            if tag.tag != 'note':
                continue
            at = last if tag.find('chord') is not None else t
            if tag.find('chord') is None:
                last = at
                t += dur
            end = max(end, t)
            if tag.find('pitch') is None or not dur:
                continue
            p = tag.find('pitch')
            mid = 12 * (int(p.findtext('octave')) + 1) + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[p.findtext('step')] + int(p.findtext('alter', '0'))
            if tag.findtext('staff') == '1':
                notation.append([base + at, base + at + dur, mid, tag.findtext('voice'), [x.get('type') for x in tag.findall('tie')], bar])
            elif tag.findtext('staff') == '2' and tag.findtext('notations/technical/string'):
                tab[base + at, mid] = (int(tag.findtext('notations/technical/string')), int(tag.findtext('notations/technical/fret')))
        base += end
    active = {}
    notes = []
    for a, b, mid, v, ties, bar in notation:
        k = (mid, v)
        if 'stop' in ties and k in active:
            active[k][1] = b
            if 'start' not in ties:
                del active[k]
        else:
            rec = [a, b, mid, bar]
            notes.append(rec)
            if 'start' in ties:
                active[k] = rec
    combined = {}
    for a, b, mid, bar in notes:
        if (a, mid) not in tab:
            continue
        string, fret = tab[a, mid]
        k = (a, mid, string)
        if k not in combined or b > combined[k][1]:
            combined[k] = [a, b, mid, bar, string, fret]
    held = {}
    bad = []
    for a, b, mid, bar, string, fret in sorted(combined.values()):
        old = held.get(string)
        if old and a < old[1] and (mid != old[2]):
            bad.append((old[3], bar, string, old[5], fret, str(old[1] - a)))
        if not old or b >= old[1] or mid != old[2]:
            held[string] = [a, b, mid, bar, string, fret]
    return bad

class SustainedStrings(unittest.TestCase):

    def test_independent_voices_do_not_cut_sustained_notes(self):
        root = Path(__file__).resolve().parents[2]
        catalog = json.loads((root / 'scripts/sor/pieces.json').read_text())
        for n in range(16, 26):
            key = catalog[str(n)]['form']
            file = root / 'downloads/sor' / f'Lesson {n} - {key} - Fernando Sor.musicxml'
            with self.subTest(lesson=n):
                self.assertEqual(check(file), [])
if __name__ == '__main__':
    unittest.main()
