"""Per-voice rhythm repair (rhythm.py). Measures are 2/4 with divisions 12, like the OMR output they come from."""

import json
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

import rhythm
import tabify

WHOLE = 24


def n(step, octave, duration, kind, voice=1, stem="up", dots=0, tuplet=False, chord=False):
    return ("<note>" + ("<chord/>" if chord else "") + f"<pitch><step>{step}</step><octave>{octave}</octave></pitch>"
            f"<duration>{duration}</duration><voice>{voice}</voice><type>{kind}</type>" + "<dot/>" * dots
            + ("<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>" if tuplet else "")
            + f"<stem>{stem}</stem></note>")


def rest(duration, kind, voice=1):
    return f"<note><rest/><duration>{duration}</duration><voice>{voice}</voice><type>{kind}</type></note>"


def back(d):
    return f"<backup><duration>{d}</duration></backup>"


def fwd(d, voice=2):
    return f"<forward><duration>{d}</duration><voice>{voice}</voice></forward>"


def measure(body):
    return ET.fromstring('<score-partwise><part id="P1"><measure number="1"><attributes><divisions>12</divisions>'
                         f'<time><beats>2</beats><beat-type>4</beat-type></time></attributes>{body}</measure></part></score-partwise>')


def onsets(root):
    """{voice: [(start, duration, midi-ish pitches)]} of the measure, as the clock reads it."""
    events = rhythm._events(root.find("part/measure"))
    return {v: [(float(e.start), float(e.duration), [rhythm._pitch(m) for m in e.members]) for e in es]
            for v, es in rhythm._by_voice(events).items()}


class OverrunTests(unittest.TestCase):
    def test_stacked_chord_and_unfinished_tuplet_both_undone_when_that_is_the_only_fit(self):
        """Milonga 18: four 16ths then a chord whose second head was read as the next quarter."""
        root = measure(n("A", 2, 3, "16th") + n("C", 4, 2, "16th", tuplet=True) + n("A", 3, 2, "16th", tuplet=True)
                       + n("E", 3, 2, "16th", tuplet=True) + n("C", 4, 12, "quarter") + n("A", 3, 12, "quarter")
                       + back(33) + n("A", 2, 9, "eighth", 2, "down", dots=1))
        self.assertEqual(rhythm.overruns(root), ["1"])
        self.assertEqual(rhythm.repair_voices(root), ["1"])
        self.assertEqual(rhythm.overruns(root), [])
        top = onsets(root)["1"]
        self.assertEqual([s for s, _, _ in top], [0, 3, 6, 9, 12])
        self.assertEqual(len(top[-1][2]), 2)  # the second quarter is a head of the first
        self.assertIsNone(root.find(".//time-modification"))

    def test_two_ways_to_fit_leave_the_measure_as_it_was(self):
        """Three equal quarters on a 2/4 bar: any of two could be the stacked one."""
        root = measure(n("C", 4, 12, "quarter") + n("D", 4, 12, "quarter") + n("E", 4, 12, "quarter"))
        before = ET.tostring(root)
        self.assertEqual(rhythm.repair_voices(root), [])
        self.assertEqual(ET.tostring(root), before)

    def test_a_voice_that_fits_is_not_touched(self):
        root = measure(n("C", 4, 12, "quarter") + n("D", 4, 12, "quarter"))
        before = ET.tostring(root)
        self.assertEqual(rhythm.repair_voices(root), [])
        self.assertEqual(ET.tostring(root), before)

    def test_glued_bass_and_arpeggio_become_two_voices(self):
        """The sustained bass, then the arpeggio that sounds over it, all in one voice."""
        arpeggio = "".join(n("E", 4, 6, "eighth", dots=0) for _ in range(4))
        root = measure(n("A", 2, 24, "half", stem="down") + arpeggio)
        self.assertEqual(rhythm.repair_voices(root), ["1"])
        voices = onsets(root)
        self.assertEqual(len(voices), 2)
        self.assertTrue(all(sum(d for _, d, _ in v) == WHOLE and v[0][0] == 0 for v in voices.values()))

    def test_glued_voice_is_left_when_the_remainder_does_not_fill_a_measure(self):
        root = measure(n("A", 2, 24, "half", stem="down") + n("E", 4, 6, "eighth") + n("E", 4, 6, "eighth"))
        self.assertEqual(rhythm.repair_voices(root), [])


class LaneTests(unittest.TestCase):
    def test_bass_note_with_a_lost_dot_is_dotted(self):
        """Milonga 43: the bass eighth should be dotted, the next bass notes come 3 units later."""
        root = measure(n("G", 3, 24, "half", 1) + back(24) + n("G", 2, 9, "eighth", 2, "down", dots=1)
                       + n("B", 2, 6, "eighth", 2, "down") + back(15) + fwd(18, 3)
                       + n("E", 2, 3, "16th", 3, "down") + n("F", 2, 3, "16th", 3, "down"))
        self.assertEqual(rhythm.repair_voices(root), ["1"])
        bass = onsets(root)["2"]
        self.assertEqual(bass[1][:2], (9.0, 9.0))
        self.assertEqual(len(root.findall(".//note/dot")), 2)

    def test_a_gap_that_is_not_half_the_note_is_not_a_lost_dot(self):
        root = measure(n("G", 3, 24, "half", 1) + back(24) + n("G", 2, 6, "eighth", 2, "down")
                       + fwd(12, 2) + n("E", 2, 6, "eighth", 2, "down"))
        self.assertEqual(rhythm.repair_voices(root), [])

    def test_voice_that_opens_inside_the_previous_note_of_its_lane_moves_to_its_end(self):
        """Milonga 18: the bass E should come after the dotted-eighth bass A, not inside it."""
        root = measure(n("C", 4, 24, "half", 1) + back(24) + n("A", 2, 9, "eighth", 2, "down", dots=1)
                       + back(9) + fwd(7, 3) + n("E", 3, 9, "eighth", 3, "down", dots=1))
        self.assertEqual(rhythm.repair_voices(root), ["1"])
        self.assertEqual(onsets(root)["3"][0][:2], (9.0, 9.0))

    def test_voices_starting_together_in_one_lane_only_move_when_they_then_fill_the_measure(self):
        """Milonga 28: the second beat's melody opens at 9, inside the first beat's last 16th."""
        first = n("A", 3, 3, "16th") + n("F", 4, 6, "eighth") + n("A", 3, 3, "16th")
        second = "".join(n(s, 4, 3, "16th", 3) for s in "GEFD")
        root = measure(first + back(12) + n("A", 3, 24, "half", 2, "down") + back(24) + fwd(9, 3) + second)
        rhythm.repair_voices(root)
        self.assertEqual(onsets(root)["3"][0][0], 12.0)
        # Same shape, but the voice would then run past the barline: the two stay as read.
        longer = second + n("C", 4, 3, "16th", 3)
        root = measure(first + back(12) + n("A", 3, 24, "half", 2, "down") + back(24) + fwd(9, 3) + longer)
        rhythm.repair_voices(root)
        self.assertEqual(onsets(root)["3"][0][0], 9.0)


class UploadTests(unittest.TestCase):
    def source(self, tmp):
        body = ('<measure number="1"><attributes><divisions>12</divisions><time><beats>2</beats><beat-type>4</beat-type>'
                '</time><clef><sign>G</sign><line>2</line></clef></attributes>'
                + n("A", 3, 3, "16th") + n("C", 5, 3, "16th") + n("A", 4, 3, "16th") + n("E", 4, 3, "16th")
                + n("C", 5, 12, "quarter") + n("A", 4, 12, "quarter") + '</measure>')
        path = Path(tmp) / "s.musicxml"
        path.write_text('<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>G</part-name></score-part>'
                        f'</part-list><part id="P1">{body}</part></score-partwise>', encoding="utf-8")
        return path

    def test_uploads_repair_voices_and_collections_do_not(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.source(tmp)
            _, curated = tabify.load_score([str(path)])
            self.assertEqual(len(list(curated.recurse().notes)), 6)  # as written
            _, repaired = tabify.load_score([str(path)], repair_voices=True)
            self.assertEqual(len(list(repaired.recurse().notes)), 5)  # the second quarter became a chord head

    def test_prepare_and_export_agree_on_the_repaired_measure(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = self.source(tmp)
            result = tabify.prepare(str(path), "musicxml", "standard", str(Path(tmp) / "out"))
            with open(result["suggestion"], encoding="utf-8") as f:
                tabs = json.load(f)["tabs"]
            tabify.export(result["musicxml"], result["suggestion"], tabs, "standard", str(Path(tmp) / "final"))
            self.assertTrue((Path(tmp) / "final" / "score.pdf").exists())


if __name__ == "__main__":
    unittest.main()
