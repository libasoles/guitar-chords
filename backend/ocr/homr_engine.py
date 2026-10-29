"""homr (open-source transformer OMR): PDF -> one MusicXML per page that has music.

Better than Audiveris on old or blurred scans, where Audiveris loses clefs, time
signatures and whole voices. Pages are processed one at a time: a cover, a blank
or a text-only page makes homr fail with "No staffs found", and that must only
drop that page, not the score. Titles are not read (`--no-title`): the engine
ignores them and it saves downloading a second set of models.
"""

import glob
import os
import subprocess
import time
import zipfile
from xml.etree import ElementTree as ET

RENDER_DPI = 200  # what homr was measured with; Audiveris's own rendering is not used here
CONTAINER = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'
)


def _has_notes(xml_path):
    try:
        root = ET.parse(xml_path).getroot()
    except ET.ParseError:
        return False
    return any(note.find("rest") is None for note in root.iter("note"))


def _to_mxl(xml_path, mxl_path):
    with zipfile.ZipFile(mxl_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("META-INF/container.xml", CONTAINER)
        z.write(xml_path, "score.xml")


def _erase_annotations(png, log):
    """Wipe fingerings and p-i-m-a letters from the page image: homr reads them as notes and accidentals.

    Best effort: a page the eraser cannot handle goes to homr untouched."""
    try:
        from PIL import Image

        from annotations import erase_annotations
        with Image.open(png) as image:
            image.load()
            cleaned = erase_annotations(image)
        if cleaned is not image:
            cleaned.save(png)
    except Exception as exc:  # noqa: BLE001
        log(f"homr: annotations not erased on {os.path.basename(png)}: {exc}")


def run_homr(pdf_path, out_dir, deadline, log, erase=False):
    """Paths of `homr-NN.mxl`, one per page with notes, in page order.

    Stops at `deadline` (time.monotonic()); pages already read are kept, a page cut
    off midway is dropped. Never raises: failures are logged and give fewer files.
    `erase` wipes fingerings and p-i-m-a letters from each page first: it lifts recall on
    scores full of them but costs rhythm on others, so it is a second opinion, not the default.
    """
    os.makedirs(out_dir, exist_ok=True)
    try:
        subprocess.run(["pdftoppm", "-r", str(RENDER_DPI), "-gray", "-png", pdf_path, os.path.join(out_dir, "page")],
                       capture_output=True, check=True, timeout=max(1, deadline - time.monotonic()))
    except (subprocess.SubprocessError, OSError) as exc:
        log(f"homr: cannot render pages: {exc}")
        return []
    files = []
    for png in sorted(glob.glob(os.path.join(out_dir, "page-*.png"))):
        page = os.path.basename(png)[len("page-"):-len(".png")]
        remaining = deadline - time.monotonic()
        if remaining < 5:
            log(f"homr: out of time, page {page} and later skipped")
            break
        if erase:
            _erase_annotations(png, log)
        try:
            proc = subprocess.run(["homr", "--no-title", png], capture_output=True, text=True, timeout=remaining)
        except subprocess.TimeoutExpired:
            log(f"homr: page {page} timed out")
            break
        except OSError as exc:
            log(f"homr: cannot run: {exc}")
            return files
        xml = png[:-len(".png")] + ".musicxml"
        if proc.returncode != 0 or not os.path.exists(xml):
            last = (proc.stderr.strip().splitlines() or [""])[-1]
            log(f"homr: page {page} has no music ({last[:120]})")
            continue
        if not _has_notes(xml):
            log(f"homr: page {page} has staves but no notes, skipped")
            continue
        mxl = os.path.join(out_dir, f"homr-{len(files) + 1:02d}.mxl")
        _to_mxl(xml, mxl)
        files.append(mxl)
        log(f"homr: page {page} read")
    return files
