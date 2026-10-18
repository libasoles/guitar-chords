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
