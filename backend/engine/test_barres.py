"""barres.inject writes a barre into MusicXML the way tabify reads it back."""

import tempfile
import unittest
from pathlib import Path

import barres
import tabify


def note(step, octave, duration=1, extra=""):
    return (f'<note><pitch><step>{step}</step><octave>{octave}</octave></pitch><duration>{duration}</duration>'
            f'<voice>1</voice><type>quarter</type>{extra}</note>')


XML = ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1"><part-list><score-part id="P1">'
       '<part-name>g</part-name></score-part></part-list><part id="P1">'
       '<measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time>'
       '<clef><sign>G</sign><line>2</line></clef></attributes>'
       + note("E", 4) + note("B", 4) + note("E", 5) + note("B", 4) + '</measure>'
       '<measure number="2">' + note("E", 4) + note("B", 4) + note("E", 5) + note("B", 4) + '</measure>'
       '<measure number="3">' + note("E", 4) + note("B", 4) + note("E", 5) + note("B", 4) + '</measure></part></score-partwise>')


def read(xml):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "s.musicxml"
        path.write_text(xml)
        _, part = tabify.load_score([str(path)])
    measures, _ = tabify.build_columns(part)
    tabify.assign_frets(measures)
    return measures


class InjectTests(unittest.TestCase):
    def test_a_span_covers_the_notes_from_its_start_to_its_end(self):
        xml = barres.inject(XML, [{"bar": 1, "at": 1, "fret": 7, "strings": 6, "end_bar": 2, "end_at": 2}])
        barre = [[c["barre"] for c in m["columns"]] for m in read(xml)]
        self.assertEqual(barre, [[None] + [(7, 6)] * 3, [(7, 6), (7, 6), None, None], [None] * 4])

    def test_without_an_end_it_lasts_the_rest_of_its_bar(self):
        xml = barres.inject(XML, [{"bar": 2, "at": 0, "fret": 5, "strings": 3}])
        barre = [[c["barre"] for c in m["columns"]] for m in read(xml)]
        self.assertEqual(barre, [[None] * 4, [(5, 3)] * 4, [None] * 4])

    def test_two_spans_in_a_row_and_the_tab_keeps_to_each_fret(self):
        xml = barres.inject(XML, [{"bar": 1, "at": 0, "fret": 7, "end_bar": 2, "end_at": 0},
                                  {"bar": 2, "at": 0, "fret": 5, "end_bar": 3, "end_at": 0}])
        measures = read(xml)
        for m, fret in zip(measures[:2], (7, 5)):
            for col in m["columns"]:
                self.assertTrue(all(f >= fret for f in col["cells"] if f is not None), (fret, col["cells"]))
        self.assertTrue(any(f == 0 for col in measures[2]["columns"] for f in col["cells"] if f is not None))

    def test_a_span_over_no_notes_is_an_error(self):
        with self.assertRaises(ValueError):
            barres.inject(XML, [{"bar": 9, "at": 0, "fret": 5}])


if __name__ == "__main__":
    unittest.main()
