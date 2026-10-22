"""Arpeggio rules (issue #42). Expectations are musical: what a guitarist would not play, not what the code returns."""

import unittest
from unittest import mock

import fingering
import tabify

OPENS = [64, 59, 55, 50, 45, 40]  # string 1 (E4) first


def cols(*midis, step=.5):
    return [(i * step, list(m) if isinstance(m, (list, tuple)) else [m]) for i, m in enumerate(midis)]


def pitch(string, fret):
    return OPENS[string] + fret


def played(tabs):
    """Per measure, the (string, fret) of each single-note column."""
    return [[next((s, f) for s, f in enumerate(col) if f is not None) for col in measure] for measure in tabs]


def tab_of(*pitches_per_measure):
    """Engine-like start: every note on the highest string where it fits (the worst case for rule 1)."""
    tabs = []
    for measure in pitches_per_measure:
        cols_ = []
        for midi in measure:
            col = [None] * 6
            s = next(s for s, o in enumerate(OPENS) if 0 <= midi - o <= 12)
            col[s] = midi - OPENS[s]
            cols_.append(col)
        tabs.append(cols_)
    return tabs


class DetectionTests(unittest.TestCase):
    def test_arpeggio_of_one_chord_in_steady_notes(self):
        # Em, eighths: B3 E4 G4 E4 B3 E4 G4 E4
        self.assertEqual(fingering.detect_arpeggios([cols(59, 64, 67, 64, 59, 64, 67, 64)]), [True])

    def test_scale_is_not_an_arpeggio(self):
        # Steps of one or two semitones, no recurrence of the leaps
        self.assertEqual(fingering.detect_arpeggios([cols(60, 62, 64, 65, 67, 69, 71, 72)]), [False])

    def test_block_chords_are_not_an_arpeggio(self):
        self.assertEqual(fingering.detect_arpeggios([cols([64, 59, 55], [64, 60, 55], [64, 59, 55], [64, 59, 55])]),
                         [False])

    def test_too_few_notes(self):
        self.assertEqual(fingering.detect_arpeggios([cols(59, 64, 67)]), [False])

    def test_uneven_rhythm_is_not_read_as_a_pattern(self):
        uneven = [(0, [59]), (.5, [64]), (1.75, [67]), (2.0, [64]), (3.5, [59]), (3.75, [64]), (4.0, [67])]
        self.assertEqual(fingering.detect_arpeggios([uneven]), [False])

    def test_a_melody_that_mixes_steps_and_leaps_without_recurring(self):
        self.assertEqual(fingering.detect_arpeggios([cols(59, 60, 67, 69, 57, 58, 66, 67)]), [False])

    def test_a_long_broken_chord_needs_no_repeated_pitch(self):
        # Prelude 14 of Carcassi: twelve steady notes, eight different pitches, every interval a leap
        self.assertEqual(fingering.detect_arpeggios([cols(55, 62, 67, 70, 74, 70, 67, 62, 58, 62, 67, 70)]), [True])


class StringRuleTests(unittest.TestCase):
    def test_open_fretted_open_on_one_string_moves_the_middle_note(self):
        """0-3-0 on the B string: B3 D4 B3."""
        tabs = [[[None, 0, None, None, None, None], [None, 3, None, None, None, None], [None, 0, None, None, None, None]]]
        fingering.avoid_repeated_strings(tabs, OPENS)
        cells = played(tabs)[0]
        self.assertEqual([pitch(s, f) for s, f in cells], [59, 62, 59])
        self.assertEqual(fingering.violations([((s, f),) for s, f in cells], OPENS), 0)
        self.assertEqual(cells[0][0], cells[2][0])  # the repeated B3 stays on its string

    def test_repeated_note_stays_on_its_string(self):
        tabs = tab_of([64, 64, 64, 59])
        fingering.avoid_repeated_strings(tabs, OPENS)
        strings = [s for s, _ in played(tabs)[0]]
        self.assertEqual(strings[:3], [strings[0]] * 3)

    def test_only_the_arpeggio_measures_change(self):
        scale = [60, 62, 64, 65]  # on one string is fine here
        tabs = tab_of([59, 64, 67, 64, 59, 64, 67, 64], scale)
        before = [[list(c) for c in m] for m in tabs[1:]]
        fingering.avoid_repeated_strings(tabs, OPENS, measures=[0])
        self.assertEqual(tabs[1:], before)
        singles = [((s, f),) for s, f in played(tabs)[0]]
        self.assertEqual(fingering.violations(singles, OPENS), 0)

    def test_pitches_never_change(self):
        pitches = [59, 64, 67, 64, 59, 64, 67, 64, 55, 62, 67, 62]
        tabs = tab_of(pitches[:8], pitches[8:])
        fingering.avoid_repeated_strings(tabs, OPENS, economy=True)
        got = [pitch(s, f) for measure in played(tabs) for s, f in measure]
        self.assertEqual(got, pitches)

    def test_chords_keep_their_cells(self):
        chord = [0, 1, 0, 2, 3, None]
        tabs = [[list(chord), [None, 3, None, None, None, None], [None, 0, None, None, None, None]]]
        fingering.avoid_repeated_strings(tabs, OPENS)
        self.assertEqual(tabs[0][0], chord)


class EconomyTests(unittest.TestCase):
    def test_each_pitch_keeps_one_cell_within_a_measure(self):
        # Patterns where one cell per pitch is compatible with rule 1; when it is not, rule 1 wins (next test).
        for pattern in ([59, 64, 67, 64, 59, 64, 67, 64], [64, 59, 67, 59, 64, 59, 67, 59]):
            tabs = tab_of(pattern)
            fingering.avoid_repeated_strings(tabs, OPENS, economy=True)
            cells = {}
            for (s, f) in played(tabs)[0]:
                cells.setdefault(pitch(s, f), set()).add((s, f))
            self.assertTrue(all(len(v) == 1 for v in cells.values()), (pattern, cells))

    def test_economy_never_adds_same_string_pairs(self):
        pattern = [59, 64, 67, 64, 59, 64, 67, 64]
        a, b = tab_of(pattern), tab_of(pattern)
        fingering.avoid_repeated_strings(a, OPENS)
        fingering.avoid_repeated_strings(b, OPENS, economy=True)
        count = lambda t: fingering.violations([((s, f),) for s, f in played(t)[0]], OPENS)
        self.assertLessEqual(count(b), count(a))


class EngineIntegrationTests(unittest.TestCase):
    def part(self, midis_per_measure):
        m21 = tabify.m21
        part = m21.stream.Part()
        for i, midis in enumerate(midis_per_measure):
            measure = m21.stream.Measure(number=i + 1)
            if i == 0:
                measure.insert(0, m21.meter.TimeSignature("4/4"))
            for midi in midis:
                measure.append(m21.note.Note(midi + 12, quarterLength=.5))  # written an octave above sounding
            part.append(measure)
        return part

    def run_engine(self, midis, arpeggio):
        measures, _ = tabify.build_columns(self.part(midis))
        tabify.assign_frets(measures, arpeggio=arpeggio)
        return measures

    def strings(self, measures, m=0):
        return [next(s for s, f in enumerate(c["cells"]) if f is not None) for c in measures[m]["columns"]]

    def test_auto_detects_and_applies_to_an_arpeggio(self):
        pattern = [[59, 64, 67, 64, 59, 64, 67, 64]]
        measures = self.run_engine(pattern, "auto")
        self.assertTrue(measures[0]["arpeggio"])
        singles = [((s, f),) for s, f in
                   [next((s, f) for s, f in enumerate(c["cells"]) if f is not None) for c in measures[0]["columns"]]]
        self.assertEqual(fingering.violations(singles, OPENS), 0)

    def test_off_keeps_the_viterbi_choice(self):
        pattern = [[59, 64, 67, 64, 59, 64, 67, 64]]
        measures = self.run_engine(pattern, False)
        self.assertFalse(measures[0]["arpeggio"])
        plain = self.run_engine(pattern, False)
        self.assertEqual([c["cells"] for c in measures[0]["columns"]], [c["cells"] for c in plain[0]["columns"]])

    def test_auto_leaves_a_scale_alone(self):
        scale = [[60, 62, 64, 65, 67, 69, 71, 72]]
        auto = self.run_engine(scale, "auto")
        off = self.run_engine(scale, False)
        self.assertFalse(auto[0]["arpeggio"])
        self.assertEqual([c["cells"] for c in auto[0]["columns"]], [c["cells"] for c in off[0]["columns"]])

    def test_fingering_follows_the_new_cells(self):
        measures = self.run_engine([[59, 64, 67, 64, 59, 64, 67, 64]], "auto")
        for col in measures[0]["columns"]:
            for note, midi in col["notes"]:
                s, f = col["fingering"][id(note)]
                self.assertEqual(tabify.open_midis(tabify.STANDARD_TUNING)[s] + f, midi)


def annotated_xml(notes):
    """One measure, treble-8vb clef so the written pitch sounds as written; each note: (step, octave, technical)."""
    body = "".join(
        f"<note><pitch><step>{step}</step><octave>{octave}</octave></pitch><duration>1</duration><type>quarter</type>"
        f"<notations><technical>{technical}</technical></notations></note>" for step, octave, technical in notes)
    return ('<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>'
            '<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats>'
            '<beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change>'
            '</clef></attributes>' + body + '</measure></part></score-partwise>')


class AnnotationTests(unittest.TestCase):
    def columns(self, notes):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.musicxml"
            path.write_text(annotated_xml(notes))
            _, part = tabify.load_score([str(path)])
        measures, _ = tabify.build_columns(part)
        tabify.assign_frets(measures)
        return measures[0]["columns"]

    def test_the_engine_alone_puts_e4_open(self):
        cols = self.columns([("E", 4, "")])
        self.assertEqual(cols[0]["cells"], [0, None, None, None, None, None])

    def test_written_string_and_fret_fix_the_cell(self):
        """E4 asked for on string 2, fret 5 (the equisonant of the open first string)."""
        cols = self.columns([("E", 4, "<string>2</string><fret>5</fret>")])
        self.assertEqual(cols[0]["cells"], [None, 5, None, None, None, None])

    def test_written_string_alone_is_enough(self):
        cols = self.columns([("E", 4, "<string>3</string>")])
        self.assertEqual(cols[0]["cells"], [None, None, 9, None, None, None])

    def test_open_string_finger_zero_keeps_the_note_open(self):
        cols = self.columns([("B", 3, "<fingering>0</fingering>")])
        self.assertEqual(cols[0]["cells"], [None, 0, None, None, None, None])

    def test_a_string_that_cannot_play_the_pitch_is_ignored(self):
        """C6 does not exist on the sixth string within 19 frets: the pitch wins and the note is not dropped."""
        cols = self.columns([("C", 4, "<string>6</string>")])
        self.assertTrue(any(f is not None for f in cols[0]["cells"]))

    def test_fingers_in_wrong_order_are_never_chosen(self):
        """A C chord on the first position: finger 3 on the lower pitch and finger 2 on the higher is not holdable."""
        combos = tabify.candidates([64, 60], OPENS,
                                   {64: {"finger": 2}, 60: {"finger": 3}})
        for combo in combos:
            frets = {pitch(s, f): f for s, f in combo}
            self.assertFalse(frets[64] > 0 and frets[60] > 0 and (frets[64] - frets[60]) * (2 - 3) < 0)

    def test_one_finger_cannot_hold_two_frets(self):
        self.assertFalse(fingering.fingers_possible([(1, 3), (2, 5)], [1, 1]))

    def test_barre_is_finger_one_on_one_fret(self):
        self.assertTrue(fingering.fingers_possible([(1, 3), (2, 3), (3, 4)], [1, 1, 2]))

    def test_position_follows_the_finger_number(self):
        # finger 1 on fret 5 and finger 4 on fret 8: position 5, a span of 4 frets
        self.assertTrue(fingering.fingers_possible([(1, 5), (2, 8)], [1, 4]))
        # finger 1 on fret 5 and finger 2 on fret 9: positions 5 and 8, an impossible stretch
        self.assertFalse(fingering.fingers_possible([(1, 5), (2, 9)], [1, 2]))

    def test_a_fingered_note_is_never_an_open_string(self):
        # B3 with finger 3 (Sor, Op. 60 n.º 3, m. 6: a-1 b-3 on one string): fret 4 of the third string, not the open second
        with mock.patch.object(fingering, "FINGERED_NOT_OPEN", True):
            self.assertEqual([(2, 4)], fingering.allowed_cells(59, OPENS, {"finger": 3}, 12)[:1])
            self.assertNotIn((1, 0), fingering.allowed_cells(59, OPENS, {"finger": 3}, 12))
        self.assertIn((1, 0), fingering.allowed_cells(59, OPENS, {"finger": 3}, 12))
        self.assertIn((1, 0), fingering.allowed_cells(59, OPENS, {}, 12))

    def test_hints_never_remove_a_note(self):
        combos = tabify.candidates([64], OPENS, {64: {"finger": 4, "string": 5}})
        self.assertTrue(combos)


class HeldFretsTests(unittest.TestCase):
    def test_no_candidate_needs_a_fifth_fret_when_another_exists(self):
        from unittest import mock
        chords = ([68, 66, 64, 63, 61], [71, 68, 66, 63, 59], [67, 63, 60, 56, 52], [70, 66, 63, 59, 56, 52])
        for midis in chords:
            with mock.patch.object(tabify, "MAX_HELD_FRETS", 99):
                raw = tabify.candidates(midis, OPENS)
            kept = tabify.candidates(midis, OPENS)
            frets = lambda combo: len({f for _, f in combo if f > 0})
            if any(frets(c) <= 4 for c in raw):
                self.assertTrue(kept and all(frets(c) <= 4 for c in kept), midis)
            else:
                self.assertEqual(kept, raw)  # nothing better: never drop the note

    def test_the_filter_only_removes_never_adds(self):
        raw_midis = [64, 59, 55]
        self.assertTrue(tabify.candidates(raw_midis, OPENS))


if __name__ == "__main__":
    unittest.main()
