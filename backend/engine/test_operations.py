"""prepare/export on persisted artifacts. Run with: python -m pytest backend/engine"""

import json
import os
import re
import tempfile
import unittest
from xml.etree import ElementTree as ET

import tabify


def pitch(step, octave, alter=0):
    a = f"<alter>{alter}</alter>" if alter else ""
    return f"<pitch><step>{step}</step>{a}<octave>{octave}</octave></pitch>"


def note(step, octave, duration=4, chord=False, kind="quarter"):
    return (f"<note>{'<chord/>' if chord else ''}{pitch(step, octave)}"
            f"<duration>{duration}</duration><type>{kind}</type></note>")


# Original, public-domain-free fixture: two 4/4 measures with a chord and a
# melody on top of a bass line. Divisions 4 = quarter 4.
SCORE = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar'
    '</part-name></score-part></part-list><part id="P1">'
    '<measure number="1"><attributes><divisions>4</divisions>'
    '<time><beats>4</beats><beat-type>4</beat-type></time>'
    '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>'
    '</attributes>'
    + note("E", 3) + note("B", 3, chord=True) + note("G", 4) + note("A", 3) + note("C", 4)
    + '</measure><measure number="2">'
    + note("D", 3) + note("F", 4) + note("E", 4) + note("G", 3, kind="quarter")
    + '</measure></part></score-partwise>')

DOUBLE_DIGIT = (
    '<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>G'
    '</part-name></score-part></part-list><part id="P1">'
    '<measure number="1"><attributes><divisions>4</divisions>'
    '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>'
    '</attributes>' + note("E", 3) + '</measure></part></score-partwise>')


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.input = os.path.join(self.tmp.name, "in.musicxml")
        with open(self.input, "w", encoding="utf-8") as f:
            f.write(SCORE)

    def path(self, *parts):
        return os.path.join(self.tmp.name, *parts)

    def prepare(self, tuning="auto", sub="prep"):
        return tabify.prepare(self.input, "musicxml", tuning, self.path(sub))

    def load(self, p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)


class PrepareTests(Base):
    def test_artifacts_and_deterministic_ids(self):
        a = self.prepare(sub="a")
        b = self.prepare(sub="b")
        for key in ("musicxml", "suggestion", "preview"):
            self.assertTrue(os.path.getsize(a[key]) > 0)
        self.assertTrue(a["preview_svgs"] and all(p.endswith(".svg") for p in a["preview_svgs"]))
        sa, sb = self.load(a["suggestion"]), self.load(b["suggestion"])
        self.assertEqual(sa, sb)
        ids = [i for m in sa["columns"] for c in m for i in c["note_ids"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(sa["tabs"]), 2)
        self.assertEqual(len(sa["tabs"][0]), 4)  # chord + melody + 2 more attacks
        self.assertEqual(sa["tuning"], "standard")
        for m in sa["tabs"]:
            for col in m:
                self.assertEqual(len(col), 6)
        svg = open(a["preview_svgs"][0], encoding="utf-8").read()
        for note_id in ids[:3]:
            self.assertIn(f'data-id="{note_id}"', svg)

    def test_a_measure_whose_rhythm_does_not_add_up_is_listed(self):
        self.assertEqual(self.load(self.prepare()["suggestion"])["uneven_measures"], [])
        broken = self.path("broken.musicxml")
        with open(broken, "w", encoding="utf-8") as f:
            f.write(SCORE.replace("</measure></part>", '<note><pitch><step>E</step><octave>4</octave></pitch>'
                                  '<duration>8</duration><type>half</type></note></measure></part>'))
        res = tabify.prepare(broken, "musicxml", "standard", self.path("broken"))
        self.assertEqual(self.load(res["suggestion"])["uneven_measures"], [1])

    def test_forced_dropd_and_dropped_notes(self):
        out = self.prepare("dropd")
        self.assertEqual(out["tuning"], "dropd")
        low = self.path("low.musicxml")
        with open(low, "w", encoding="utf-8") as f:
            f.write(SCORE.replace("<step>D</step><octave>3", "<step>D</step><octave>1"))
        res = tabify.prepare(low, "pdf-ocr-output", "standard", self.path("low"))
        self.assertEqual(res["dropped"], [{"measure": 2, "pitch": "D1"}])

    def test_no_notes(self):
        empty = self.path("empty.musicxml")
        with open(empty, "w", encoding="utf-8") as f:
            f.write(SCORE.split("<measure")[0] + '<measure number="1"><attributes><divisions>4'
                    '</divisions></attributes><note><rest/><duration>16</duration><type>whole'
                    '</type></note></measure></part></score-partwise>')
        with self.assertRaises(tabify.NoNotesError):
            tabify.prepare(empty, "musicxml", "auto", self.path("empty"))

    def test_bad_arguments(self):
        with self.assertRaises(ValueError):
            tabify.prepare(self.input, "docx", "auto", self.path("x"))
        with self.assertRaises(ValueError):
            tabify.prepare(self.input, "musicxml", "dg", self.path("x"))


def staves(xml):
    """Pitches of staff 1 and fret/string pairs of staff 2 from final MusicXML."""
    root = ET.fromstring(xml)
    notation, tab = [], []
    for n in root.iter("note"):
        staff = n.findtext("staff") or "1"
        if staff == "1":
            p = n.find("pitch")
            notation.append(None if p is None else
                            (p.findtext("step"), p.findtext("octave"), n.findtext("duration"),
                             n.find("chord") is not None))
        else:
            tab.append((n.findtext("notations/technical/string"), n.findtext("notations/technical/fret"),
                        n.find("chord") is not None))
    return notation, tab


class ExportTests(Base):
    def read(self, p):
        with open(p, encoding="utf-8") as f:
            return f.read()

    def test_export_from_artifacts_equals_in_session_flow(self):
        prep = self.prepare()
        suggestion = self.load(prep["suggestion"])
        tabs = suggestion["tabs"]
        edited = [[list(c) for c in m] for m in tabs]
        # Move the melody of measure 1's last attack one fret up on its string.
        col = edited[0][-1]
        string = next(i for i, v in enumerate(col) if v is not None)
        col[string] += 1

        out = tabify.export(prep["musicxml"], prep["suggestion"], edited, None, self.path("out"))
        self.assertTrue(os.path.getsize(out["pdf"]) > 1000)
        self.assertEqual(open(out["pdf"], "rb").read(4), b"%PDF")
        self.assertEqual(self.load(out["tabs"]), edited)

        # In-session flow, as the lab did it: load, columns, frets, edits, output.
        score, part = tabify.load_score([self.input])
        measures, _ = tabify.build_columns(part)
        tuning = tabify.guess_tuning(measures)
        tabify.assign_frets(measures, tuning)
        tabify.apply_edits(measures, edited, tuning)
        base = self.path("session", "score")
        os.makedirs(self.path("session"))
        xml_path, _ = tabify.build_output(score, part, measures, tuning, "Partitura", base)
        self.assertEqual(staves(self.read(xml_path)), staves(self.read(out["musicxml"])))
        self.assertEqual(self.read(xml_path).count("<fret>"), self.read(out["musicxml"]).count("<fret>"))

    def test_extra_notes_only_affect_tab_staff(self):
        prep = self.prepare()
        tabs = self.load(prep["suggestion"])["tabs"]
        base = tabify.export(prep["musicxml"], prep["suggestion"], tabs, None, self.path("base"))
        extra = [[list(c) for c in m] for m in tabs]
        # Add a note on the free 6th string (and a 3rd cell) to the first attack.
        first = extra[1][0]
        added = 0
        for s in range(6):
            if first[s] is None and added < 2:
                first[s] = 3 + added
                added += 1
        self.assertEqual(added, 2)
        out = tabify.export(prep["musicxml"], prep["suggestion"], extra, None, self.path("extra"))
        n0, t0 = staves(self.read(base["musicxml"]))
        n1, t1 = staves(self.read(out["musicxml"]))
        self.assertEqual(n0, n1)  # notation staff untouched
        self.assertEqual(len(t1), len(t0) + 2)  # the extra frets only in TAB

    def test_edited_cell_maps_by_pitch(self):
        prep = self.prepare()
        suggestion = self.load(prep["suggestion"])
        tabs = [[list(c) for c in m] for m in suggestion["tabs"]]
        # Re-finger the first chord's B3 (open string 2) as fret 4 on string 3...
        col = tabs[0][0]
        self.assertEqual(col[1], 0)
        col[1], col[2] = None, 4
        out = tabify.export(prep["musicxml"], prep["suggestion"], tabs, None, self.path("o"))
        _, tab = staves(self.read(out["musicxml"]))
        self.assertIn(("3", "4"), [(s, f) for s, f, _ in tab])
        notation, _ = staves(self.read(out["musicxml"]))
        self.assertIn(("B", "3", True), [(s, o, c) for s, o, _, c in notation if s])  # notation keeps B3

    def test_rejects_mismatched_tabs_and_changed_musicxml(self):
        prep = self.prepare()
        tabs = self.load(prep["suggestion"])["tabs"]
        with self.assertRaises(ValueError):
            tabify.export(prep["musicxml"], prep["suggestion"], tabs[:1], None, self.path("o"))
        other = self.path("other.musicxml")
        tree = ET.parse(prep["musicxml"])
        part = tree.getroot().find("part")
        last = part.findall("measure")[-1]
        last.remove(last.findall("note")[-1])
        tree.write(other, encoding="utf-8")
        with self.assertRaises(ValueError):
            tabify.export(other, prep["suggestion"], tabs, None, self.path("o2"))

    def test_tuning_override_dropd(self):
        prep = self.prepare("standard")
        tabs = self.load(prep["suggestion"])["tabs"]
        out = tabify.export(prep["musicxml"], prep["suggestion"], tabs, "dropd", self.path("o"))
        self.assertEqual(out["tuning"], "dropd")
        self.assertIn("<tuning-step>D</tuning-step><tuning-octave>2</tuning-octave>",
                      self.read(out["musicxml"]))


def harmonic_score(first_measure_extra="", second=""):
    """E3 G3 D4 B3 with the D marked: a diamond head, <harmonic>, or the first measure's «Hr. 12»."""
    return (
        '<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>'
        '<part id="P1"><measure number="1"><attributes><divisions>4</divisions>'
        '<time><beats>4</beats><beat-type>4</beat-type></time>'
        '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef></attributes>'
        + first_measure_extra + '</measure>' + second + '</part></score-partwise>')


class HarmonicsTests(Base):
    """The note of a harmonic mark is pinned to fret 12 of the string an octave below it and drawn <12>."""

    def setUp(self):
        super().setUp()
        diamond = note("E", 3) + note("G", 3) + note("D", 4).replace("</note>", "<notehead>diamond</notehead></note>") + note("B", 3)
        self.write(harmonic_score(diamond))

    def write(self, xml):
        with open(self.input, "w", encoding="utf-8") as f:
            f.write(xml)

    def read(self, path):
        with open(path, encoding="utf-8") as f:
            return f.read()

    def cells(self, prep):
        return self.load(prep["suggestion"])["tabs"][0]

    def test_diamond_head_goes_to_fret_12_of_the_string_an_octave_below(self):
        suggestion = self.load(self.prepare("standard")["suggestion"])
        self.assertEqual(suggestion["tabs"][0][2], [None, None, None, 12, None, None])  # D on the 4th string
        self.assertEqual(suggestion["harmonic_cells"][0], [[], [], [3], []])
        self.assertTrue(suggestion["harmonics"])

    def test_harmonic_element_and_text_mark_are_read_too(self):
        marked = ('<note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type>'
                  '<notations><technical><harmonic><natural/></harmonic></technical></notations></note>')
        self.write(harmonic_score(note("E", 3) + marked))
        self.assertEqual(self.cells(self.prepare("standard"))[1], [None, None, None, 12, None, None])
        mark = '<direction placement="above"><direction-type><words>Hr. 12</words></direction-type></direction>'
        self.write(harmonic_score(mark + note("E", 3) + note("D", 4)))
        prep = self.prepare("standard")
        self.assertEqual(self.cells(prep)[1], [None, None, None, 12, None, None])
        # The text is gone from the normalized MusicXML, the diamond head carries the mark.
        normalized = self.read(prep["musicxml"])
        self.assertNotIn("Hr. 12", normalized)
        self.assertIn("diamond", normalized)

    def test_a_note_no_open_string_can_sound_stays_an_ordinary_note(self):
        self.write(harmonic_score(note("E", 3) + note("C", 4).replace("</note>", "<notehead>diamond</notehead></note>")))
        self.assertNotIn(12, [f for f in self.cells(self.prepare("standard"))[1] if f is not None])

    def test_pdf_writes_the_harmonic_between_angle_brackets(self):
        prep = self.prepare("standard")
        tabs = self.load(prep["suggestion"])["tabs"]
        out = tabify.export(prep["musicxml"], prep["suggestion"], tabs, "standard", self.path("o"))
        self.assertTrue(os.path.getsize(out["pdf"]) > 0)
        self.assertEqual(len(re.findall(r'id="tab-harmonic-\d+"', self.read(out["musicxml"]))), 1)
        self.assertEqual(tabify.mark_harmonic_frets(
            '<g id="tab-harmonic-2" class="note"><text x="1"><tspan font-size="324px">12</tspan></text></g>'
            '<g id="x" class="note"><text x="1"><tspan font-size="324px">12</tspan></text></g>').count("&lt;12&gt;"), 1)

    def test_an_edited_cell_is_no_longer_a_harmonic(self):
        prep = self.prepare("standard")
        tabs = self.load(prep["suggestion"])["tabs"]
        tabs[0][2] = [None, 3, None, None, None, None]  # the same D, now fretted on the B string
        out = tabify.export(prep["musicxml"], prep["suggestion"], tabs, "standard", self.path("o"))
        self.assertNotIn("tab-harmonic", self.read(out["musicxml"]))

    def test_collections_do_not_read_harmonics_unless_asked(self):
        _, part = tabify.load_score([self.input])
        measures, _ = tabify.build_columns(part)
        tabify.assign_frets(measures)
        self.assertNotIn(12, [f for col in measures[0]["columns"] for f in col["cells"] if f is not None])
        self.assertFalse(tabify.HARMONICS)


if __name__ == "__main__":
    unittest.main()
