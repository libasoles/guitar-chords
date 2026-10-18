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

    def fake_homr(pdf, out_dir, deadline, log):
        calls.append("homr")
        files, q = state["homr"]
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
    return calls, state


def recognize(tmp_path, seconds=600):
    return run.recognize("score.pdf", str(tmp_path), time.monotonic() + seconds, 1024, lambda m: None)


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
    assert calls == ["homr", "audiveris"]


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
