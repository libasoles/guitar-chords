import time

import pytest

import run

GOOD = {"measures": 10, "consistent": 9, "notes": 100}
POOR = {"measures": 10, "consistent": 3, "notes": 40}
BETTER = {"measures": 10, "consistent": 7, "notes": 80}


@pytest.fixture
def engines(monkeypatch):
    """Fake engines; each test sets what they return and whether the PDF is a scan."""
    calls = []
    state = {"scan": True, "homr": (["h.mxl"], GOOD), "audiveris": (["a.mxl"], GOOD)}
    quality_of = {}

    def fake_homr(pdf, out_dir, deadline, log, erase=False):
        calls.append("homr-clean" if erase else "homr")
        files, q = state.get("homr_clean", ([], None)) if erase else state["homr"]
        quality_of.update({f: q for f in files})
        return files

    def fake_audiveris(pdf, out_dir, heap_mb, timeout):
        calls.append("audiveris")
        files, q = state["audiveris"]
        quality_of.update({f: q for f in files})
        return files

    monkeypatch.setattr(run, "run_homr", fake_homr)
    monkeypatch.setattr(run, "run_audiveris", fake_audiveris)
    monkeypatch.setattr(run, "is_scan", lambda pdf: state["scan"])
    monkeypatch.setattr(run, "deskew_pdf", lambda pdf, work, log: pdf)
    monkeypatch.setattr(run, "measure_quality", lambda files: quality_of[files[0]])
    monkeypatch.setattr(run, "out_of_key_ratio", lambda files: quality_of[files[0]].get("out_of_key", 0.0))
    return calls, state


def recognize(tmp_path, seconds=600, info=None):
    return run.recognize("score.pdf", str(tmp_path), time.monotonic() + seconds, 1024, lambda m: None, info)


def test_a_good_homr_reading_of_a_scan_is_not_second_guessed(engines, tmp_path):
    calls, _ = engines
    assert recognize(tmp_path) == ["h.mxl"]
    assert calls == ["homr"]


def test_a_vector_pdf_goes_to_audiveris_first(engines, tmp_path):
    calls, state = engines
    state["scan"] = False
    assert recognize(tmp_path) == ["a.mxl"]
    assert calls == ["audiveris"]


def test_a_poor_first_reading_gets_a_second_opinion_that_wins_when_better(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], POOR)
    state["audiveris"] = (["a.mxl"], BETTER)
    assert recognize(tmp_path) == ["a.mxl"]
    assert calls == ["homr", "audiveris"]


def test_the_first_reading_is_kept_when_the_second_is_not_better(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], BETTER)
    state["audiveris"] = (["a.mxl"], BETTER)  # tie
    assert recognize(tmp_path) == ["h.mxl"]
    state["homr"] = (["h.mxl"], POOR)
    state["audiveris"] = (["a.mxl"], {"measures": 10, "consistent": 1, "notes": 20})
    assert recognize(tmp_path) == ["h.mxl"]


def test_a_failed_first_engine_falls_back_to_the_other(engines, tmp_path):
    calls, state = engines
    state["scan"] = False
    state["audiveris"] = ([], None)
    assert recognize(tmp_path) == ["h.mxl"]
    assert calls == ["audiveris", "homr"]


def test_both_engines_failing_gives_nothing(engines, tmp_path):
    calls, state = engines
    state["homr"] = ([], None)
    state["audiveris"] = ([], None)
    assert recognize(tmp_path) == []
    assert calls == ["homr", "audiveris", "homr-clean"]


def test_no_second_opinion_when_time_is_nearly_up(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], POOR)
    state["audiveris"] = (["a.mxl"], BETTER)
    assert recognize(tmp_path, seconds=run.MIN_FALLBACK_SECONDS - 1) == ["h.mxl"]
    assert calls == ["homr"]


def test_a_result_that_cannot_be_assessed_is_still_used(engines, tmp_path, monkeypatch):
    calls, state = engines

    def broken(files):
        raise ValueError("bad xml")

    monkeypatch.setattr(run, "measure_quality", broken)
    state["audiveris"] = ([], None)
    assert recognize(tmp_path) == ["h.mxl"]


def test_audiveris_gets_what_is_left_of_the_budget(engines, tmp_path, monkeypatch):
    seen = {}
    monkeypatch.setattr(run, "run_audiveris", lambda pdf, out, heap, timeout: seen.update(timeout=timeout) or [])
    _, state = engines
    state["scan"] = False
    recognize(tmp_path, seconds=300)
    assert 290 <= seen["timeout"] <= 300


# A reading whose rhythm adds up can still be wrong: fingerings and letters misread as notes.
# They show as notes outside the key (quality.out_of_key_ratio).
IMPLAUSIBLE = {"measures": 10, "consistent": 9, "notes": 100, "out_of_key": 0.25}
PLAUSIBLE = {"measures": 10, "consistent": 9, "notes": 100, "out_of_key": 0.03}


def test_a_reading_with_notes_out_of_key_gets_a_second_opinion_that_wins_when_more_plausible(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], IMPLAUSIBLE)
    state["audiveris"] = (["a.mxl"], PLAUSIBLE)
    assert recognize(tmp_path) == ["a.mxl"]
    assert calls == ["homr", "audiveris"]


def test_the_second_opinion_must_be_clearly_better_to_replace_the_first(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], IMPLAUSIBLE)
    state["audiveris"] = (["a.mxl"], dict(IMPLAUSIBLE, out_of_key=0.24))
    assert recognize(tmp_path) == ["h.mxl"]


def test_a_tiny_but_plausible_reading_does_not_replace_a_full_one(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], IMPLAUSIBLE)
    state["audiveris"] = (["a.mxl"], dict(PLAUSIBLE, notes=20))  # one page of five
    assert recognize(tmp_path) == ["h.mxl"]


def test_a_plausible_reading_is_not_second_guessed(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], PLAUSIBLE)
    assert recognize(tmp_path) == ["h.mxl"]
    assert calls == ["homr"]


def test_the_result_tells_whether_the_reading_is_a_scan_and_still_suspect(engines, tmp_path):
    _, state = engines
    state["homr"] = (["h.mxl"], IMPLAUSIBLE)
    state["audiveris"] = (["a.mxl"], IMPLAUSIBLE)
    info = {}
    recognize(tmp_path, info=info)
    assert info == {"engine": "homr", "scan": True, "suspect": True, "measures": 10, "consistent": 9, "out_of_key": 0.25}


def test_a_good_reading_is_not_suspect_and_a_vector_pdf_is_not_a_scan(engines, tmp_path):
    _, state = engines
    state["scan"] = False
    state["audiveris"] = (["a.mxl"], PLAUSIBLE)
    info = {}
    recognize(tmp_path, info=info)
    assert info["engine"] == "audiveris" and info["scan"] is False and info["suspect"] is False


def test_a_reading_whose_rhythm_does_not_add_up_is_suspect(engines, tmp_path):
    _, state = engines
    state["homr"] = (["h.mxl"], POOR)
    state["audiveris"] = (["a.mxl"], POOR)
    info = {}
    recognize(tmp_path, info=info)
    assert info["suspect"] is True


def test_homr_without_annotations_is_the_last_resort_and_wins_when_clearly_better(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], POOR)
    state["audiveris"] = (["a.mxl"], POOR)
    state["homr_clean"] = (["c.mxl"], GOOD)
    assert recognize(tmp_path) == ["c.mxl"]
    assert calls == ["homr", "audiveris", "homr-clean"]


def test_homr_without_annotations_is_not_tried_when_a_reading_is_trusted(engines, tmp_path):
    calls, state = engines
    state["homr"] = (["h.mxl"], POOR)
    state["audiveris"] = (["a.mxl"], GOOD)
    assert recognize(tmp_path) == ["a.mxl"]
    assert calls == ["homr", "audiveris"]
