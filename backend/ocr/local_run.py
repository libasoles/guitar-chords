"""Local entry point (no S3): image or PDF in a mounted directory -> MusicXML files.

    docker run --rm -v <dir>:/work --entrypoint python3 guitar-chords-ocr /opt/ocr/local_run.py /work/in.png /work/out

Same engine choice as the Fargate task (`run.recognize`); writes omr-01.mxl, ... into the output directory.
"""

import os
import shutil
import sys
import tempfile
import time

from PIL import Image

from run import recognize

HEAP_MB = int(os.environ.get("OMR_MAX_HEAP_MB", "3072"))
TIMEOUT = int(os.environ.get("OMR_TIMEOUT_SECONDS", "900"))


def main(source, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        pdf = os.path.join(work, "score.pdf")
        if source.lower().endswith(".pdf"):
            shutil.copy(source, pdf)
        else:
            Image.open(source).convert("L").save(pdf, resolution=400)
        files = recognize(pdf, work, time.monotonic() + TIMEOUT, HEAP_MB)
        if not files:
            return 2
        for i, path in enumerate(files, 1):
            shutil.copy(path, os.path.join(out_dir, f"omr-{i:02d}.mxl"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
