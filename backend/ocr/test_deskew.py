import shutil

import pytest
from PIL import Image, ImageDraw

import deskew


def staff_page(skew=0.0, width=1200, height=1600):
    """White page with five-line staves; `skew` degrees counterclockwise."""
    page = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(page)
    for top in range(200, height - 200, 300):
        for line in range(5):
            y = top + line * 20
            draw.line([(100, y), (width - 100, y)], fill=0, width=3)
    for x in range(150, width - 150, 90):  # stems, so rows are not the only signal
        draw.line([(x, 260), (x, 330)], fill=0, width=4)
    return page.rotate(skew, resample=Image.BICUBIC, fillcolor=255) if skew else page


@pytest.mark.parametrize("skew", [-1.4, -0.6, 0.5, 1.2])
def test_estimate_skew_undoes_the_scan_rotation(skew):
    assert deskew.estimate_skew(staff_page(skew)) == pytest.approx(-skew, abs=0.15)


def test_straight_page_is_left_alone():
    assert deskew.estimate_skew(staff_page(0.0)) == 0.0


def test_blank_page_is_left_alone():
    assert deskew.estimate_skew(Image.new("L", (800, 1000), 255)) == 0.0


def test_straighten_keeps_page_size_and_is_one_bit():
    image, angle = deskew.straighten(staff_page(1.0))
    assert angle == pytest.approx(-1.0, abs=0.15)
    assert image.size == (1200, 1600)
    assert image.mode == "1"


needs_poppler = pytest.mark.skipif(shutil.which("pdfimages") is None, reason="poppler-utils not installed")


@needs_poppler
def test_deskew_pdf_writes_a_straightened_copy(tmp_path):
    source = tmp_path / "scan.pdf"
    staff_page(1.0).convert("1").save(source, "PDF", resolution=200)
    messages = []
    out = deskew.deskew_pdf(str(source), str(tmp_path), messages.append)
    assert out == str(tmp_path / "deskewed.pdf")
    assert messages[-1].startswith("deskewed by -")


@needs_poppler
def test_deskew_pdf_returns_straight_scans_unchanged(tmp_path):
    source = tmp_path / "scan.pdf"
    staff_page(0.0).convert("1").save(source, "PDF", resolution=200)
    assert deskew.deskew_pdf(str(source), str(tmp_path), lambda m: None) == str(source)


def test_deskew_pdf_falls_back_when_the_file_is_not_a_pdf(tmp_path):
    source = tmp_path / "broken.pdf"
    source.write_bytes(b"not a pdf")
    messages = []
    assert deskew.deskew_pdf(str(source), str(tmp_path), messages.append) == str(source)
    assert messages[-1].startswith("deskew skipped")
