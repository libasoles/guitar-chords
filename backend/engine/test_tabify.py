"""Regression tests: run inside music21-score-tabs with unittest discover."""

import tempfile
import re
import unittest
from pathlib import Path
from zipfile import ZipFile

import tabify


def score_xml(body):
    return ('<score-partwise version="4.0"><part-list><score-part id="P1">'
            '<part-name>Guitar</part-name></score-part></part-list><part id="P1">'
            + body + '</part></score-partwise>')


def note(duration, kind="half", extra=""):
    return ('<note><pitch><step>D</step><octave>4</octave></pitch>'
            f'<duration>{duration}</duration><type>{kind}</type>{extra}</note>')


class ScoreImportTests(unittest.TestCase):
    def test_footer_text_filed_as_lyrics_is_dropped(self):
        lyric = '<lyric><text>EJEMPLAR</text></lyric>'
        xml = score_xml('<measure number="1"><attributes><divisions>1</divisions></attributes>'
                        + note(2, extra=lyric) + '</measure>')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "s.musicxml"
            path.write_text(xml)
            _, part = tabify.load_score([str(path)])
        self.assertTrue(all(not n.lyrics for n in part.recurse().notes))

    def test_lyrics_on_rests_and_chords_are_dropped(self):
        xml = score_xml('<measure number="1"><attributes><divisions>1</divisions></attributes>'
                        + note(2).replace('</note>', '<lyric><text>EJEMPLAR</text></lyric></note>')
                        + '<note><rest/><duration>1</duration><type>quarter</type>'
                          '<lyric><text>PUBLICIDAD</text></lyric></note></measure>')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "s.musicxml"
            path.write_text(xml)
            score, _ = tabify.load_score([str(path)])
        out = tabify.to_musicxml(score)
        self.assertNotIn("EJEMPLAR", out)
        self.assertNotIn("PUBLICIDAD", out)

    def test_footer_text_filed_as_words_is_dropped(self):
        words = '<direction placement="below"><direction-type><words>EJEMPLAR</words></direction-type></direction>'
        xml = score_xml('<measure number="1"><attributes><divisions>1</divisions></attributes>'
                        + words + note(2) + '</measure>')
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "s.musicxml"
            path.write_text(xml)
            score, part = tabify.load_score([str(path)])
        self.assertNotIn("EJEMPLAR", tabify.to_musicxml(score))

    def test_header_excludes_footer_and_publisher(self):
        m21 = tabify.m21
        score = m21.stream.Score()
        for text, y, size in [('COMO EL AIRE', 1723, 26),
                              ('Juan Falu', 1844, 21),
                              ('A. Quintero', 1802, 12),
                              ('ZAMBA', 1296, 17),
                              ('Editorial', 525, 18)]:
            box = m21.text.TextBox(text, y=y, page=1)
            box.style.fontSize = size
            score.insert(0, box)
        self.assertEqual(tabify.extract_header(score),
                         ('COMO EL AIRE', ['Juan Falu', 'A. Quintero']))

    def test_header_keeps_musicxml_author_and_transcriber(self):
        m21 = tabify.m21
        score = m21.stream.Score()
        score.metadata = m21.metadata.Metadata()
        score.metadata.title = 'Titulo'
        score.metadata.composer = 'Autor'
        score.metadata.add('transcriber', 'Transcriptor')
        score.metadata.copyright = 'Pie de pagina'
        self.assertEqual(tabify.extract_header(score),
                         ('Titulo', ['Autor', 'Transcriptor']))

    def test_header_ignores_declared_credits_when_text_is_positioned(self):
        m21 = tabify.m21
        score = m21.stream.Score()
        score.metadata = m21.metadata.Metadata()
        score.metadata.composer = 'Editorial Pie de pagina'
        for text, y, size in [('COMO EL AIRE', 1723, 26), ('Juan Falu', 1844, 21),
                              ('Editorial Pie de pagina', 120, 12)]:
            box = m21.text.TextBox(text, y=y, page=1)
            box.style.fontSize = size
            score.insert(0, box)
        self.assertEqual(tabify.extract_header(score), ('COMO EL AIRE', ['Juan Falu']))

    def test_pdf_xml_has_no_label_and_header_credits(self):
        xml = ('<score-partwise><part-list><score-part id="P1"><part-name>Guitarra</part-name>'
               '<part-abbreviation>Guit.</part-abbreviation></score-part></part-list>'
               '<part id="P1"><measure number="1"><note><time-modification><actual-notes>3'
               '</actual-notes></time-modification></note></measure></part></score-partwise>')
        out = tabify.add_credits(tabify.clean_labels(xml), 'Titulo', ['Autor', 'Transcriptor'])
        self.assertNotIn('Guitarra', out)
        self.assertNotIn('part-abbreviation', out)
        self.assertIn('<time-modification>', out)  # untouched: it once broke the whole PDF
        self.assertIn('>Titulo</credit-words>', out)
        self.assertIn('>Autor · Transcriptor</credit-words>', out)

    def test_pdf_keeps_every_measure_with_tuplets_and_meter_changes(self):
        m21 = tabify.m21
        part = m21.stream.Part()
        for i in range(60):
            measure = m21.stream.Measure(number=i + 1)
            if i in (0, 30):
                measure.insert(0, m21.meter.TimeSignature('6/8' if i == 0 else '3/4'))
            for _ in range(3):
                measure.append(m21.note.Note('E4', quarterLength=1 if i % 2 else 2 / 3))
            part.append(measure)
        measures, _ = tabify.build_columns(part)
        tabify.assign_frets(measures)
        with tempfile.TemporaryDirectory() as tmp:
            xml_path, _ = tabify.build_output(None, part, measures, tabify.STANDARD_TUNING,
                                              'T', str(Path(tmp) / 'out'), header=('T', ['A']))
            xml = Path(xml_path).read_text(encoding='utf-8')
        toolkit = tabify.new_toolkit(tabify.PDF_OPTIONS)
        self.assertTrue(toolkit.loadData(xml))
        drawn = sum(len(re.findall(r'class="measure"', toolkit.renderToSVG(p)))
                    for p in range(1, toolkit.getPageCount() + 1))
        self.assertEqual(drawn, 60)

    def test_tab_clef_is_solid_black_letters(self):
        lines = ''.join(f'<path d="M0 {y} L900 {y}" />' for y in range(100, 700, 100))
        svg = ('<g class="staff">' + lines + '<g id="b" class="clef">\n'
               '<use xlink:href="#E06D-x" transform="translate(50, 400) scale(0.7, 0.7)" /></g></g>')
        out = tabify.draw_tab_clef(svg)
        self.assertNotIn('E06D', out)
        self.assertEqual(out.count('fill="#000000"'), 3)

    def test_tab_clef_ignores_an_ending_bracket_in_the_staff(self):
        lines = ''.join(f'<path d="M0 {y} L900 {y}" />' for y in range(100, 700, 100))
        bracket = '<path d="M0 -3000 L900 -3000" />'
        svg = ('<g class="staff">' + bracket + lines + '<g id="b" class="clef">\n'
               '<use xlink:href="#E06D-x" transform="translate(50, 400) scale(0.7, 0.7)" /></g></g>')
        out = tabify.draw_tab_clef(svg)
        self.assertEqual(out.count('font-size="120px"'), 3)

    def test_tab_staves_lose_meter_and_page_loses_brace(self):
        svg = ('<g class="staff"><g class="meterSig"><use /></g></g>'
               '<g class="staff"><g class="meterSig"><use /></g></g>'
               '<g class="staff"><g class="meterSig"><use /></g></g>'
               '<g class="staff"><g class="meterSig"><use /></g></g>'
               '<g class="grpSym"><path d="M0 0" /></g>')
        out = tabify.drop_brace(tabify.drop_tab_meter(svg))
        self.assertEqual(out.count('meterSig'), 2)
        self.assertNotIn('grpSym', out)

    def test_header_is_serif_with_smaller_authors(self):
        svg = ('<g class="pgHead"><text><tspan font-size="405px">Titulo</tspan></text>'
               '<text><tspan font-size="405px">Autor</tspan></text>'
               '<text><tspan font-size="405px"> </tspan></text></g>')
        out = tabify.style_header(svg)
        self.assertIn('font-family="Playfair Display', out)
        self.assertIn('470px">Titulo', out)
        self.assertIn('300px">Autor', out)

    def test_preview_justifies_rows_and_keeps_short_last_row(self):
        m21 = tabify.m21
        part = m21.stream.Part()
        for i in range(9):
            measure = m21.stream.Measure(number=i + 1)
            if i == 2:
                measure.insert(0, m21.layout.SystemLayout(isNew=True))
            duration = 4 if i < 4 or i == 8 else 1
            for _ in range(4 // duration):
                measure.append(m21.note.Note('D4', quarterLength=duration))
            part.append(measure)
        rows = tabify.preview_rows(part, 4)
        self.assertEqual([(r['first'], r['last']) for r in rows], [(0, 3), (4, 7), (8, 8)])
        self.assertEqual(tabify.svg_width(rows[0]['svg']), tabify.svg_width(rows[1]['svg']))
        self.assertLess(tabify.svg_width(rows[2]['svg']), tabify.svg_width(rows[0]['svg']))
        # Verify actual staff geometry, not merely an equal SVG canvas.
        def staff_end(svg):
            return max(float(x) for x in re.findall(
                r'<path d="M[\d.]+ [\d.]+ L([\d.]+) [\d.]+" stroke-width="13"', svg))
        self.assertEqual(staff_end(rows[0]['svg']), staff_end(rows[1]['svg']))
        self.assertLess(staff_end(rows[2]['svg']), staff_end(rows[0]['svg']))

    def test_preview_moves_measures_to_keep_two_digit_frets_apart(self):
        m21 = tabify.m21
        part = m21.stream.Part()
        for i in range(8):
            measure = m21.stream.Measure(number=i + 1)
            # The short notes fit as notation, but their fret 12 labels need
            # more room. E6 is written E5 after guitar octave transposition.
            for duration in [3, .125, .125, .125, .125]:
                measure.append(m21.note.Note('E6', quarterLength=duration))
            part.append(measure)
        measures, _ = tabify.build_columns(part)
        tabify.assign_frets(measures)
        old_rows = tabify.preview_rows(part, 4)
        rows = tabify.preview_rows(part, 4, measures)
        self.assertTrue(any(tabify.preview_tab_spacing(
            row['svg'], measures[row['first']:row['last'] + 1]) > 1 for row in old_rows))
        self.assertGreater(len(rows), len(old_rows))
        self.assertEqual([i for row in rows for i in range(row['first'], row['last'] + 1)],
                         list(range(8)))
        for row in rows:
            self.assertLessEqual(tabify.preview_tab_spacing(
                row['svg'], measures[row['first']:row['last'] + 1]), 1)

    def read(self, xml, compressed=False):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / ('score.mxl' if compressed else 'score.musicxml')
            if compressed:
                with ZipFile(path, 'w') as archive:
                    archive.writestr('META-INF/container.xml',
                                     '<container><rootfiles><rootfile full-path="score.xml"'
                                     '/></rootfiles></container>')
                    archive.writestr('score.xml', xml)
            else:
                path.write_text(xml)
            original = path.read_bytes()
            score = tabify.read_score(path)
            self.assertEqual(path.read_bytes(), original)
            return score

    def test_zero_divisions_half_note_xml_and_mxl(self):
        xml = score_xml('<measure number="1"><attributes><divisions>0</divisions>'
                        '</attributes>' + note(1) + '</measure>')
        for compressed in (False, True):
            with self.subTest(compressed=compressed):
                score = self.read(xml, compressed)
                self.assertEqual(score.parts[0].recurse().notes.first().quarterLength, 2)

    def test_repair_stops_at_next_divisions_and_rescales_backup(self):
        score = self.read(score_xml(
            '<measure number="1"><attributes><divisions>0</divisions></attributes>'
            + note(1) + '<backup><duration>1</duration></backup>' + note(1)
            + '</measure><measure number="2">' + note(1)
            + '</measure><measure number="3"><attributes><divisions>4</divisions>'
            '</attributes>' + note(8) + '</measure>'))
        measures = list(score.parts[0].getElementsByClass('Measure'))
        self.assertEqual([n.quarterLength for n in score.parts[0].recurse().notes], [2] * 4)
        self.assertEqual([n.offset for n in measures[0].recurse().notes], [0, 0])

    def test_dots_and_tuplets(self):
        examples = [('quarter', '<dot/>', 1.5),
                    ('eighth', '<time-modification><actual-notes>3</actual-notes>'
                     '<normal-notes>2</normal-notes></time-modification>', 1 / 3)]
        for kind, extra, expected in examples:
            score = self.read(score_xml(
                '<measure number="1"><attributes><divisions>0</divisions></attributes>'
                + note(1, kind, extra) + '</measure>'))
            self.assertAlmostEqual(float(score.parts[0].recurse().notes.first().quarterLength), expected)

    def test_ambiguous_scale_reports_actionable_error(self):
        with self.assertRaisesRegex(ValueError, 'Corregí el OMR'):
            self.read(score_xml(
                '<measure number="1"><attributes><divisions>0</divisions></attributes>'
                + note(1, 'half') + note(1, 'quarter') + '</measure>'))

    def test_valid_score_keeps_duration(self):
        score = self.read(score_xml(
            '<measure number="1"><attributes><divisions>12</divisions></attributes>'
            + note(24) + '</measure>'))
        self.assertEqual(score.parts[0].recurse().notes.first().quarterLength, 2)

    def test_export_preserves_overfull_measures_and_changing_voices(self):
        m21 = tabify.m21
        part = m21.stream.Part()
        for number, voice_id, length in ((1, '3', 6), (2, '1', 4)):
            measure = m21.stream.Measure(number=number)
            measure.insert(0, m21.meter.TimeSignature('4/4'))
            voice = m21.stream.Voice(id=voice_id)
            voice.append(m21.note.Note('D4', quarterLength=length))
            measure.insert(0, voice)
            part.append(measure)
        xml = tabify.to_musicxml(m21.stream.Score([part]))
        restored = m21.converter.parseData(xml, format='musicxml')
        self.assertEqual([n.quarterLength for n in restored.recurse().notes], [6, 4])
        self.assertEqual(len(restored.parts[0].getElementsByClass('Measure')), 2)

    def test_merge_unisons_gives_one_column_note_for_the_same_pitch_in_two_voices(self):
        m21 = tabify.m21

        def columns(merge):
            part = m21.stream.Part()
            measure = m21.stream.Measure(number=1)
            for voice_id, length in (('1', 0.5), ('2', 3)):
                voice = m21.stream.Voice(id=voice_id)
                voice.append(m21.note.Note('A3', quarterLength=length))
                measure.insert(0, voice)
            part.append(measure)
            tabify.MERGE_UNISONS = merge
            try:
                return tabify.build_columns(part)[0][0]['columns']
            finally:
                tabify.MERGE_UNISONS = False

        self.assertEqual([len(c['notes']) for c in columns(False)], [2])
        merged = columns(True)
        self.assertEqual([len(c['notes']) for c in merged], [1])
        self.assertEqual(merged[0]['notes'][0][0].quarterLength, 0.5)  # la primera voz conserva su nota

    def test_preview_anchors_and_bass_survive_export(self):
        m21 = tabify.m21
        part = m21.stream.Part()
        measure = m21.stream.Measure(number=1)
        melody = m21.note.Note('E4')
        melody.stemDirection = 'up'
        bass = m21.chord.Chord(['E3', 'B3'])
        bass.stemDirection = 'down'
        continuation = m21.note.Note('E4')
        continuation.tie = m21.tie.Tie('stop')
        grace = m21.note.Note('F4').getGrace()
        measure.insert(0, melody)
        measure.insert(0, bass)
        measure.insert(1, continuation)
        measure.insert(2, grace)
        part.append(measure)
        measures, _ = tabify.build_columns(part)
        tabify.assign_frets(measures)
        columns = tabify.preview_columns(measures[0])
        self.assertEqual(len(columns), 1)  # tie and grace are not attacks
        self.assertEqual(len(columns[0]['note_ids']), 3)
        self.assertEqual(len(set(columns[0]['note_ids'])), 3)
        self.assertEqual(len(columns[0]['bass_strings']), 2)
        xml = tabify.to_musicxml(part)
        svg = tabify.preview_rows(part, 4)[0]['svg']
        for note_id in columns[0]['note_ids']:
            self.assertIn(f'id="{note_id}"', xml)
            self.assertIn(f'data-id="{note_id}"', svg)
        col = measures[0]['columns'][0]
        self.assertNotIn(col['fingering'][id(melody)][0], columns[0]['bass_strings'])


if __name__ == '__main__':
    unittest.main()


class TuningTests(unittest.TestCase):
    def part(self, pitches, clef):
        m21 = tabify.m21
        part = m21.stream.Part()
        measure = m21.stream.Measure(number=1)
        measure.insert(0, clef)
        for p in pitches:
            measure.append(m21.note.Note(p, quarterLength=1))
        part.append(measure)
        return part

    def tab(self, pitches, clef=None):
        measures, shift = tabify.build_columns(self.part(pitches, clef or tabify.m21.clef.Treble8vbClef()))
        tuning = tabify.guess_tuning(measures)
        tabify.assign_frets(measures, tuning)
        return measures, shift, tuning

    def test_low_d_picks_drop_d_and_keeps_every_note(self):
        # Falú, "Como el aire": the bass D below the staff was dropped in standard tuning.
        measures, _, tuning = self.tab(['D2', 'A2', 'D3', 'F#3'])
        self.assertEqual(tuning, tabify.DROP_D_TUNING)
        self.assertEqual(tabify.dropped_notes(measures), [])
        self.assertEqual(measures[0]['columns'][0]['cells'], [None] * 5 + [0])

    def test_a_misread_note_below_the_guitar_does_not_hide_drop_d(self):
        measures, _, tuning = self.tab(['D2', 'A2', 'D3', 'C2'])
        self.assertEqual(tuning, tabify.DROP_D_TUNING)
        self.assertEqual([p for _, p in tabify.dropped_notes(measures)], ['C2'])

    def test_standard_when_nothing_is_below_e(self):
        measures, _, tuning = self.tab(['E2', 'A2'])
        self.assertEqual(tuning, tabify.STANDARD_TUNING)

    def test_plain_treble_written_d_is_still_shifted_down(self):
        _, shift, tuning = self.tab(['D3', 'A3'], tabify.m21.clef.TrebleClef())
        self.assertEqual((shift, tuning), (-12, tabify.DROP_D_TUNING))

    def test_one_misread_low_note_does_not_flip_the_piece_to_sounding_pitch(self):
        # Lamento, read by homr: a single stray C3 among 323 notes put every note an octave up.
        pitches = ['E3', 'G3', 'B3', 'E4'] * 10 + ['C3']
        measures, shift = tabify.build_columns(self.part(pitches, tabify.m21.clef.TrebleClef()))
        self.assertEqual(shift, -12)
        self.assertEqual(measures[0]['columns'][0]['notes'][0][1], 40)  # E3 written = E2 sounding

    def test_a_score_with_many_low_notes_is_already_in_sound(self):
        pitches = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
        _, shift, _ = self.tab(pitches, tabify.m21.clef.TrebleClef())
        self.assertEqual(shift, 0)

    def test_clefless_pickup_movement_is_written_pitch(self):
        # Falú, "Como el aire": Audiveris put the pickup D (below the staff) in
        # its own movement without the treble-8vb clef; it was tabbed as D4.
        m21 = tabify.m21
        pickup = self.part(['D4'], m21.clef.TrebleClef())
        pickup.getElementsByClass(m21.stream.Measure).first().removeByClass(m21.clef.Clef)
        body = self.part(['D2', 'A2'], m21.clef.Treble8vbClef())
        for i, part in enumerate((pickup, body)):
            measure = part.getElementsByClass(m21.stream.Measure).first()
            measure.number = i + 1
            measure.editorial.movementStart = True
            if i:
                pickup.append(measure)
        measures, _ = tabify.build_columns(pickup)
        tabify.assign_frets(measures, tabify.guess_tuning(measures))
        self.assertEqual(measures[0]['columns'][0]['notes'][0][1], 50)  # D3
        self.assertEqual(measures[0]['columns'][0]['cells'], [None, None, None, 0, None, None])
        self.assertEqual(measures[1]['columns'][0]['notes'][0][1], 38)  # D2

    def test_dropped_notes_are_reported(self):
        measures, shift = tabify.build_columns(self.part(['D2'], tabify.m21.clef.Treble8vbClef()))
        tabify.assign_frets(measures, tabify.STANDARD_TUNING)
        self.assertEqual(tabify.dropped_notes(measures), [(1, 'D2')])


class PdfTabStaffTests(unittest.TestCase):
    def test_tab_staff_gets_six_lines_and_tuning(self):
        xml = ('<attributes><staves>2</staves><clef number="1"><sign>G</sign></clef>'
               '<clef number="2"><sign>TAB</sign><line>5</line></clef></attributes>')
        out = tabify.add_staff_tuning(xml, tabify.DROP_D_TUNING)
        self.assertIn('<line>5</line></clef><staff-details number="2"><staff-lines>6</staff-lines>'
                      '<staff-tuning line="1"><tuning-step>D</tuning-step><tuning-octave>2</tuning-octave>', out)
        self.assertEqual(out.count('<staff-tuning '), 6)

    def test_string_names_follow_the_tab_lines_of_the_first_system(self):
        def staff(ys):
            return '<g id="s" class="staff">' + ''.join(
                f'<path d="M1920 {y} L9125 {y}" stroke-width="13" />' for y in ys) + '<g class="clef" /></g>'
        svg = ('<svg><g id="a" class="system">' + staff([1443, 1623, 1803, 1983, 2163]) + staff([3856 + 315 * i for i in range(6)])
               + '</g><g id="b" class="system">' + staff([9000]) + '</g></svg>')
        out = tabify.add_string_names(svg, tabify.string_names(tabify.DROP_D_TUNING))
        names = re.findall(r'<text x="(\d+)" y="(\d+)"[^>]*>(\w)</text>', out)
        self.assertEqual([n for _, _, n in names], list('EBGDAD'))
        self.assertTrue(all(int(x) < 1920 for x, _, _ in names))  # left of the staff
        self.assertEqual(out.count('class="stringNames"'), 1)
