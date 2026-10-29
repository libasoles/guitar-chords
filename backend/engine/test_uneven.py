"""Run with `python -m unittest test_uneven` (no music21 needed)."""

import tempfile
import unittest
from pathlib import Path

import uneven


def score(measures):
    """measures: list of lists of (voice, duration) at divisions=2; a (voice, duration, 'chord') member takes no time."""
    body = ""
    for i, notes in enumerate(measures, 1):
        attrs = "<attributes><divisions>2</divisions></attributes>" if i == 1 else ""
        items = "".join(
            f"<note>{'<chord/>' if len(n) > 2 else ''}<pitch><step>C</step><octave>4</octave></pitch>"
            f"<duration>{n[1]}</duration><voice>{n[0]}</voice></note>" for n in notes)
        body += f'<measure number="{i}">{attrs}{items}</measure>'
    return f'<?xml version="1.0"?><score-partwise><part id="P1">{body}</part></score-partwise>'


BAR = [("1", 6)]


class UnevenMeasuresTests(unittest.TestCase):
    def indices(self, measures):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "s.musicxml"
            path.write_text(score(measures))
            return uneven.uneven_measures(path)

    def test_a_clean_score_has_none(self):
        self.assertEqual(self.indices([BAR, BAR, BAR]), [])

    def test_an_overfull_voice_is_flagged(self):
        self.assertEqual(self.indices([BAR, BAR, [("1", 6), ("2", 8)], BAR]), [2])

    def test_a_short_measure_in_the_middle_is_flagged(self):
        self.assertEqual(self.indices([BAR, [("1", 4)], BAR, BAR]), [1])

    def test_a_pickup_and_a_short_closing_measure_are_fine(self):
        self.assertEqual(self.indices([[("1", 2)], BAR, BAR, [("1", 4)]]), [])

    def test_chord_members_take_no_time(self):
        self.assertEqual(self.indices([BAR + [("1", 6, "chord")], BAR]), [])

    def test_empty_measures_are_not_flagged(self):
        self.assertEqual(self.indices([BAR, [], BAR]), [])


if __name__ == "__main__":
    unittest.main()
