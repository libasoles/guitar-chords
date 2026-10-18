"""Straighten scanned PDF scores before Audiveris.

A scan that is a fraction of a degree off makes staff lines slope across the page,
and Audiveris then misses clefs, key and time signatures and loses notes. Only
PDFs that are one raster image per page are touched; vector PDFs (exported from
notation software) and anything that fails go to Audiveris unchanged.
"""

import os
import subprocess

import numpy as np
from PIL import Image

MAX_SKEW_DEGREES = 3.0
MIN_SKEW_DEGREES = 0.1  # below this the rotation resampling costs more than it fixes
MIN_SHARPNESS_GAIN = 1.05  # staff lines must line up clearly better than unrotated
SEARCH_WIDTH = 1000  # px; the angle search runs on a downscaled copy


def _sharpness(ink, angle):
    """Variance of the row profile: highest when staff lines are horizontal."""
    rotated = np.asarray(ink.rotate(angle, resample=Image.BILINEAR, fillcolor=0), dtype=np.float32)
    return float(np.var(rotated.sum(axis=1)))


def estimate_skew(gray):
    """Degrees to rotate counterclockwise to level the staff lines, or 0.0 if unsure."""
    ink = Image.eval(gray.convert("L"), lambda v: 255 - v)
    if ink.width > SEARCH_WIDTH:
        ink = ink.resize((SEARCH_WIDTH, round(ink.height * SEARCH_WIDTH / ink.width)), Image.BILINEAR)
    coarse = np.arange(-MAX_SKEW_DEGREES, MAX_SKEW_DEGREES + 1e-9, 0.25)
    center = max(coarse, key=lambda a: _sharpness(ink, a))
    fine = np.arange(center - 0.25, center + 0.25 + 1e-9, 0.05)
    best = max(fine, key=lambda a: _sharpness(ink, a))
    if not MIN_SKEW_DEGREES <= abs(best) <= MAX_SKEW_DEGREES:
        return 0.0
    if _sharpness(ink, best) <= MIN_SHARPNESS_GAIN * _sharpness(ink, 0.0):  # also true on a blank page
        return 0.0
    return float(best)


def _binary(gray):
    """1-bit by threshold (plain convert("1") would dither)."""
    return gray.convert("L").point(lambda v: 255 if v >= 128 else 0).convert("1")


def straighten(image):
    """(1-bit image, degrees applied); the page keeps its size, exposed corners are white."""
    angle = estimate_skew(image)
    if angle == 0.0:
        return _binary(image), 0.0
    return _binary(image.convert("L").rotate(angle, resample=Image.BICUBIC, fillcolor=255)), angle


def _run(*args):
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def _page_count(pdf_path):
    for line in _run("pdfinfo", pdf_path).splitlines():
        if line.startswith("Pages:"):
            return int(line.split()[1])
    raise ValueError("pdfinfo reported no page count")


def is_scan(pdf_path):
    """True when every page is exactly one raster image: a scan, not a vector export."""
    try:
        rows = _run("pdfimages", "-list", pdf_path).splitlines()[2:]
        return bool(rows) and len(rows) == _page_count(pdf_path)
    except Exception:  # noqa: BLE001 - unreadable PDFs are not scans
        return False


def deskew_pdf(pdf_path, work_dir, log=print):
    """Path of a straightened copy of the PDF, or `pdf_path` itself if there is nothing to do.

    Never raises: any problem falls back to the original file.
    """
    try:
        rows = _run("pdfimages", "-list", pdf_path).splitlines()[2:]
        if not rows or len(rows) != _page_count(pdf_path):
            log("deskew skipped: not one image per page")
            return pdf_path
        ppis = [round(float(r.split()[12])) for r in rows]  # x-ppi column
        prefix = os.path.join(work_dir, "page")
        _run("pdfimages", "-png", pdf_path, prefix)
        pages, angles = [], []
        for i in range(len(rows)):
            image, angle = straighten(Image.open(f"{prefix}-{i:03d}.png"))
            pages.append(image)
            angles.append(angle)
        if not any(angles):
            log("deskew skipped: pages already straight")
            return pdf_path
        out = os.path.join(work_dir, "deskewed.pdf")
        pages[0].save(out, "PDF", save_all=True, append_images=pages[1:], resolution=ppis[0])
        log("deskewed by " + ", ".join(f"{a:+.2f}°" for a in angles))
        return out
    except Exception as exc:  # noqa: BLE001 - preprocessing is best effort
        log(f"deskew skipped: {exc}")
        return pdf_path
