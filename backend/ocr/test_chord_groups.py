"""Synthetic staves: the geometry of issue #43 without a scan or an OMR engine.

The staff is drawn at several scales and with noise; every expectation is a musical reading of the drawing
(which heads share a stem, how many beams), not whatever the code happens to return.
"""

import numpy as np
import pytest
from PIL import Image, ImageDraw

import chord_groups as cg

TOP = 5  # staff line positions in staff spaces from the top line
BOTTOM_LINE = 4


class Staff:
    """One five-line staff; `step` 0 is the bottom line, one step is half a staff space."""

    def __init__(self, spacing=20, width=40, rng=None):
        self.sp = spacing
        self.pad = 6 * spacing
        self.img = Image.new("L", (int(width * spacing), self.pad * 2 + 4 * spacing), 255)
        self.draw = ImageDraw.Draw(self.img)
        self.line_w = max(1, round(spacing * .1))
        self.rng = rng
        for i in range(5):
            y = self.pad + i * spacing
            self.draw.rectangle([0, y, self.img.width, y + self.line_w - 1], fill=0)

    def y(self, step):
        return self.pad + 4 * self.sp - step * self.sp / 2

    def head(self, x, step):
        w, h = 1.25 * self.sp, .95 * self.sp
        y = self.y(step)
        self.draw.ellipse([x - w / 2, y - h / 2, x + w / 2, y + h / 2], fill=0)
        return w

    def stem(self, x, steps, up, length=3.4, tip=None):
        """A stem through `x` over the heads at `steps`; `tip` fixes where it ends (a beamed group shares one line)."""
        ys = [self.y(s) for s in steps]
        t = max(1, round(self.sp * .12))
        if up:
            y0, y1 = (tip if tip is not None else min(ys) - length * self.sp), max(ys)
        else:
            y0, y1 = min(ys), (tip if tip is not None else max(ys) + length * self.sp)
        self.draw.rectangle([x - t / 2, y0, x + t / 2, y1], fill=0)
        return y0 if up else y1

    def beam(self, x0, x1, tip, up, index=0):
        thick = self.sp * .5
        gap = self.sp * .25
        shift = index * (thick + gap)
        y = tip + shift if up else tip - shift
        a, b = (y, y + thick) if up else (y - thick, y)
        self.draw.rectangle([x0, a, x1, b], fill=0)

    def chord(self, x, steps, up=True, displaced=(), length=3.4, tip=None):
        """Heads at `steps` on a shared stem at `x`; steps in `displaced` sit on the far side of the stem."""
        w = 1.25 * self.sp
        for s in steps:
            side = (1 if up else -1) * (1 if s in displaced else -1)
            self.head(x + side * w / 2, s)
        return self.stem(x, steps, up, length, tip)

    def mask(self):
        a = np.array(self.img)
        if self.rng is not None:
            a = a.astype(int) + self.rng.integers(-35, 35, a.shape)
        return a < 140


def read(staff):
    mask = staff.mask()
    top, bottom = staff.pad - 4 * staff.sp, staff.pad + 8 * staff.sp
    heads = cg.find_heads(mask, staff.sp)
    return cg.read_chords(mask, heads, top, bottom, staff.sp)


def names(chord, staff):
    return [round((staff.y(0) - h["cy"]) / (staff.sp / 2)) for h in chord["heads"]]


SCALES = [14, 20, 30]


@pytest.mark.parametrize("sp", SCALES)
def test_displaced_second_shares_one_chord(sp):
    """Carcassi's Prelude 9, m. 3: B4 - D5 - E5 on one stem (down): D and E a step apart, D displaced to the left."""
    s = Staff(sp)
    # B4 = step 4 (above the bottom line E4: F=1 G=2 A=3 B=4), D5 = 6, E5 = 7
    xs = [8 * sp, 13 * sp, 18 * sp]
    tip = s.y(4) + 3.4 * sp
    for x in xs:
        s.chord(x, [4, 6, 7], up=False, displaced=(6,), tip=tip)
    s.beam(xs[0], xs[-1], tip, up=False)
    chords = read(s)
    assert len(chords) == 3
    assert [names(c, s) for c in chords] == [[7, 6, 4]] * 3
    assert all(c["issues"] == [] for c in chords)
    assert all(c["beams"] == 1 for c in chords)


@pytest.mark.parametrize("sp", SCALES)
def test_six_successive_sixteenths_stay_separate(sp):
    """Counterexample: the same heads as successive notes, each with its own stem and two beams."""
    s = Staff(sp)
    xs = [(6 + 3 * i) * sp for i in range(6)]
    steps = [[4], [7], [6], [4], [7], [6]]
    tip = s.y(4) + 3.4 * sp
    for x, st in zip(xs, steps):
        s.chord(x, st, up=False, tip=tip)
    s.beam(xs[0], xs[-1], tip, up=False, index=0)
    s.beam(xs[0], xs[-1], tip, up=False, index=1)
    chords = read(s)
    assert len(chords) == 6
    assert [len(c["heads"]) for c in chords] == [1] * 6
    assert all(c["beams"] == 2 for c in chords)


@pytest.mark.parametrize("up", [True, False])
def test_chord_without_seconds_and_either_stem_direction(up):
    s = Staff(20)
    s.chord(10 * 20, [0, 2, 4], up=up)
    s.chord(15 * 20, [1, 3], up=up)
    chords = read(s)
    assert [names(c, s) for c in chords] == [[4, 2, 0], [3, 1]]
    assert chords[0]["up"] is up


@pytest.mark.parametrize("up", [True, False])
def test_displaced_heads_with_stem_either_direction(up):
    s = Staff(20)
    s.chord(10 * 20, [3, 4], up=up, displaced=(4,) if up else (3,))
    chords = read(s)
    assert len(chords) == 1
    assert sorted(names(chords[0], s)) == [3, 4]


def test_overlapping_voices_with_different_durations_are_not_merged():
    """Upper voice stem up (quarter), lower voice stem down: same x, different stems, so two chords flagged."""
    s = Staff(20)
    s.chord(10 * 20, [6], up=True)
    s.chord(10 * 20 - 25, [2], up=False)
    chords = read(s)
    assert len(chords) == 2
    assert [len(c["heads"]) for c in chords] == [1, 1]


def test_neighbour_heads_with_different_stems_are_flagged_for_review():
    s = Staff(20)
    s.chord(10 * 20, [6], up=True)
    s.chord(10 * 20 + 28, [5], up=True)
    chords = read(s)
    assert len(chords) == 2
    assert all("cabezas_proximas" in c["issues"] for c in chords)


def test_second_with_higher_head_on_the_left_is_flagged():
    """Two voices drawn back to back look like one stem; a chord would have its higher head on the right."""
    s = Staff(20)
    w = 25
    s.head(10 * 20 - w / 2, 6)
    s.head(10 * 20 + w / 2, 5)
    s.stem(10 * 20, [5, 6], up=True)
    chords = read(s)
    assert len(chords) == 1
    assert "segunda_invertida" in chords[0]["issues"]


def test_head_without_stem_is_flagged_not_guessed():
    s = Staff(20)
    s.head(10 * 20, 3)
    chords = read(s)
    assert len(chords) == 1
    assert chords[0]["issues"] == ["sin_plica"]
    assert chords[0]["beams"] is None


def test_staff_lines_and_unbeamed_stem_do_not_count_as_beams():
    s = Staff(20)
    s.chord(10 * 20, [1, 3], up=True)  # a quarter-note chord: stem, no beam
    chords = read(s)
    assert chords[0]["beams"] is None


def test_noise_does_not_split_or_merge_chords():
    s = Staff(20, rng=np.random.default_rng(1))
    xs = [8 * 20, 13 * 20, 18 * 20]
    tip = s.y(4) + 3.4 * 20
    for x in xs:
        s.chord(x, [4, 6, 7], up=False, displaced=(6,), tip=tip)
    s.beam(xs[0], xs[-1], tip, up=False)
    chords = read(s)
    assert [len(c["heads"]) for c in chords] == [3, 3, 3]


def test_slight_skew_keeps_chords_together():
    s = Staff(20)
    xs = [8 * 20, 13 * 20, 18 * 20]
    tip = s.y(4) + 3.4 * 20
    for x in xs:
        s.chord(x, [4, 6, 7], up=False, displaced=(6,), tip=tip)
    s.beam(xs[0], xs[-1], tip, up=False)
    s.img = s.img.rotate(.6, resample=Image.BICUBIC, fillcolor=255)
    chords = read(s)
    assert [len(c["heads"]) for c in chords] == [3, 3, 3]
