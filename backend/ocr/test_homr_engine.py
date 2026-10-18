import subprocess
import time
import zipfile

import homr_engine
import quality

NOTES = ('<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">'
         '<attributes><divisions>2</divisions></attributes>'
         '<note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration></note>'
         '</measure></part></score-partwise>')
ONLY_RESTS = NOTES.replace("<pitch><step>E</step><octave>4</octave></pitch>", "<rest/>")


class FakeTools:
    """Stands in for pdftoppm and homr: page 1 a cover, 2 music, 3 only rests, 4 music."""

    def __init__(self, pages=4):
        self.pages = pages
        self.homr_calls = []

    def __call__(self, cmd, **kwargs):
        if cmd[0] == "pdftoppm":
            for n in range(1, self.pages + 1):
                open(f"{cmd[-1]}-{n}.png", "wb").close()
            return subprocess.CompletedProcess(cmd, 0, "", "")
        png = cmd[-1]
        self.homr_calls.append(png)
        n = int(png.rsplit("-", 1)[1][:-4])
        if n == 1:
            return subprocess.CompletedProcess(cmd, 1, "", "Traceback...\nNo staffs found\n")
        with open(png[:-4] + ".musicxml", "w") as f:
            f.write(ONLY_RESTS if n == 3 else NOTES)
        return subprocess.CompletedProcess(cmd, 0, "", "")


def run(monkeypatch, tmp_path, tools, deadline_in=600):
    monkeypatch.setattr(homr_engine.subprocess, "run", tools)
    messages = []
    files = homr_engine.run_homr("score.pdf", str(tmp_path), time.monotonic() + deadline_in, messages.append)
    return files, messages


def test_pages_without_music_are_dropped(monkeypatch, tmp_path):
    files, messages = run(monkeypatch, tmp_path, FakeTools())
    assert [f.rsplit("/", 1)[1] for f in files] == ["homr-01.mxl", "homr-02.mxl"]
    assert any("page 1 has no music" in m for m in messages)
    assert any("page 3 has staves but no notes" in m for m in messages)


def test_results_are_compressed_musicxml_the_engine_can_read(monkeypatch, tmp_path):
    files, _ = run(monkeypatch, tmp_path, FakeTools())
    with zipfile.ZipFile(files[0]) as z:
        assert z.namelist() == ["META-INF/container.xml", "score.xml"]
        assert b'full-path="score.xml"' in z.read("META-INF/container.xml")
    assert quality.measure_quality(files)["notes"] == 2


def test_no_time_left_processes_nothing(monkeypatch, tmp_path):
    tools = FakeTools()
    files, messages = run(monkeypatch, tmp_path, tools, deadline_in=1)
    assert files == [] and tools.homr_calls == []
    assert any("out of time" in m for m in messages)


def test_a_page_that_times_out_keeps_the_earlier_ones(monkeypatch, tmp_path):
    tools = FakeTools()

    def slow_on_page_four(cmd, **kwargs):
        if cmd[0] == "homr" and cmd[-1].endswith("page-4.png"):
            raise subprocess.TimeoutExpired(cmd, 1)
        return tools(cmd, **kwargs)

    files, messages = run(monkeypatch, tmp_path, slow_on_page_four)
    assert len(files) == 1
    assert any("page 4 timed out" in m for m in messages)


def test_unrenderable_pdf_gives_no_files(monkeypatch, tmp_path):
    def broken(cmd, **kwargs):
        raise subprocess.CalledProcessError(1, cmd)

    files, messages = run(monkeypatch, tmp_path, broken)
    assert files == [] and any("cannot render" in m for m in messages)


def test_missing_homr_binary_keeps_what_was_read(monkeypatch, tmp_path):
    files, messages = run(monkeypatch, tmp_path, lambda cmd, **kw: (_ for _ in ()).throw(FileNotFoundError("homr"))
                          if cmd[0] == "homr" else FakeTools()(cmd, **kw))
    assert files == [] and any("cannot run" in m for m in messages)
