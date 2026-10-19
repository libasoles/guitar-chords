import zipfile

import pytest

import quality


def musicxml(measures, divisions=2):
    """measures: list of lists of (voice, duration, flags) with flags in {'', 'chord', 'rest', 'grace'}."""
    body = ""
    for i, notes in enumerate(measures, 1):
        attrs = f"<attributes><divisions>{divisions}</divisions></attributes>" if i == 1 else ""
        items = ""
        for voice, duration, flag in notes:
            pitch = "" if flag == "rest" else "<pitch><step>C</step><octave>4</octave></pitch>"
            marks = {"rest": "<rest/>", "chord": "<chord/>", "grace": "<grace/>"}.get(flag, "")
            items += f"<note>{marks}{pitch}<duration>{duration}</duration><voice>{voice}</voice></note>"
        body += f'<measure number="{i}">{attrs}{items}</measure>'
    return f'<?xml version="1.0"?><score-partwise><part id="P1">{body}</part></score-partwise>'


def write(tmp_path, name, xml, zipped=False):
    path = tmp_path / name
    if zipped:
        with zipfile.ZipFile(path, "w") as z:
            z.writestr("META-INF/container.xml", "<container/>")
            z.writestr("score.xml", xml)
    else:
        path.write_text(xml)
    return str(path)


BAR = [("1", 6, "")]  # 3 quarter notes at divisions=2


def test_all_bars_of_one_length_are_consistent(tmp_path):
    path = write(tmp_path, "a.musicxml", musicxml([BAR, BAR, BAR]))
    assert quality.measure_quality([path]) == {"measures": 3, "consistent": 3, "notes": 3}


def test_a_bar_of_another_length_is_not_consistent(tmp_path):
    short = [("1", 4, "")]
    path = write(tmp_path, "a.musicxml", musicxml([BAR, BAR, short]))
    assert quality.measure_quality([path])["consistent"] == 2


def test_a_voice_longer_than_the_bar_is_not_consistent(tmp_path):
    overfull = [("1", 6, ""), ("2", 8, "")]
    path = write(tmp_path, "a.musicxml", musicxml([BAR, BAR, overfull]))
    assert quality.measure_quality([path])["consistent"] == 2


def test_chord_members_and_grace_notes_take_no_time(tmp_path):
    bar = [("1", 6, ""), ("1", 6, "chord"), ("1", 1, "grace")]
    path = write(tmp_path, "a.musicxml", musicxml([bar, bar]))
    assert quality.measure_quality([path]) == {"measures": 2, "consistent": 2, "notes": 6}


def test_rests_do_not_count_as_notes_but_fill_the_bar(tmp_path):
    bar = [("1", 2, "rest"), ("1", 4, "")]
    path = write(tmp_path, "a.musicxml", musicxml([bar, bar]))
    assert quality.measure_quality([path]) == {"measures": 2, "consistent": 2, "notes": 2}


def test_empty_measures_are_never_consistent(tmp_path):
    path = write(tmp_path, "a.musicxml", musicxml([BAR, BAR, []]))
    assert quality.measure_quality([path]) == {"measures": 3, "consistent": 2, "notes": 2}


def test_compressed_mxl_and_several_files_are_summed(tmp_path):
    one = write(tmp_path, "a.mxl", musicxml([BAR, BAR]), zipped=True)
    two = write(tmp_path, "b.mxl", musicxml([BAR]), zipped=True)
    assert quality.measure_quality([one, two]) == {"measures": 3, "consistent": 3, "notes": 3}


def test_a_score_without_a_part_has_no_measures(tmp_path):
    path = write(tmp_path, "a.musicxml", '<?xml version="1.0"?><score-partwise/>')
    assert quality.measure_quality([path]) == {"measures": 0, "consistent": 0, "notes": 0}


def test_unreadable_file_raises(tmp_path):
    path = tmp_path / "broken.musicxml"
    path.write_text("not xml")
    with pytest.raises(Exception):
        quality.measure_quality([str(path)])


def pitched(notes, divisions=2):
    """One 4-note measure per 4 notes; notes: (step, alter) or "rest"."""
    body, items = "", ""
    for i, note in enumerate(notes):
        if note == "rest":
            items += "<note><rest/><duration>2</duration><voice>1</voice></note>"
        else:
            step, alter = note
            tag = f"<alter>{alter}</alter>" if alter else ""
            items += (f"<note><pitch><step>{step}</step>{tag}<octave>4</octave></pitch>"
                      "<duration>2</duration><voice>1</voice></note>")
        if i % 4 == 3 or i == len(notes) - 1:
            body += f'<measure number="{i // 4 + 1}">{items}</measure>'
            items = ""
    return f'<?xml version="1.0"?><score-partwise><part id="P1">{body}</part></score-partwise>'


C_MAJOR = [(s, 0) for s in "CDEFGAB"] * 4  # 28 notes
D_MAJOR = [("D", 0), ("E", 0), ("F", 1), ("G", 0), ("A", 0), ("B", 0), ("C", 1)] * 4


def test_a_diatonic_reading_is_plausible(tmp_path):
    path = write(tmp_path, "a.musicxml", pitched(C_MAJOR))
    assert quality.out_of_key_ratio([path]) == 0.0


def test_the_key_signature_accidentals_are_part_of_the_key(tmp_path):
    path = write(tmp_path, "a.musicxml", pitched(D_MAJOR))
    assert quality.out_of_key_ratio([path]) == 0.0


def test_notes_foreign_to_the_best_fitting_key_are_counted(tmp_path):
    foreign = [("D", -1), ("A", -1), ("G", 1)]  # fingers read as accidentals, say
    path = write(tmp_path, "a.musicxml", pitched(C_MAJOR + foreign))
    assert quality.out_of_key_ratio([path]) == pytest.approx(3 / 31, abs=0.001)


def test_rests_carry_no_pitch(tmp_path):
    path = write(tmp_path, "a.musicxml", pitched(C_MAJOR + ["rest", "rest"]))
    assert quality.out_of_key_ratio([path]) == 0.0


def test_too_few_notes_say_nothing_about_the_key(tmp_path):
    path = write(tmp_path, "a.musicxml", pitched([("C", 1), ("D", 1), ("F", 1), ("G", -1)]))
    assert quality.out_of_key_ratio([path]) == 0.0


def test_out_of_key_is_summed_over_files_and_reads_mxl(tmp_path):
    one = write(tmp_path, "a.mxl", pitched(C_MAJOR), zipped=True)
    two = write(tmp_path, "b.mxl", pitched(C_MAJOR + [("D", -1)] * 2), zipped=True)
    assert quality.out_of_key_ratio([one, two]) == pytest.approx(2 / 58, abs=0.001)
