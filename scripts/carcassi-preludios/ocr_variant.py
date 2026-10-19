"""Dentro del contenedor `guitar-chords-ocr`: fuerza un motor de OMR sobre una imagen o PDF.

    python3 /opt/eval/ocr_variant.py homr|audiveris /work/in.png|pdf /work/out

Escribe omr-01.mxl, ... en el directorio de salida. Lo usa `ocr_eval.py` para comparar motores y preprocesados
(no es el camino de produccion: ese elige el motor en `backend/ocr/run.py`).
"""
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, "/opt/ocr")
from PIL import Image  # noqa: E402

from deskew import deskew_pdf  # noqa: E402
from homr_engine import run_homr  # noqa: E402
from run import run_audiveris  # noqa: E402

HEAP_MB = int(os.environ.get("OMR_MAX_HEAP_MB", "3072"))
TIMEOUT = int(os.environ.get("OMR_TIMEOUT_SECONDS", "600"))


def main(engine, source, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        pdf = os.path.join(work, "score.pdf")
        if source.lower().endswith(".pdf"):
            shutil.copy(source, pdf)
        else:
            Image.open(source).convert("L").save(pdf, resolution=400)
        deadline = time.monotonic() + TIMEOUT
        if engine == "homr":
            files = run_homr(pdf, os.path.join(work, "homr"), deadline, print)
        else:
            straight = os.path.join(work, "deskew")
            os.makedirs(straight, exist_ok=True)
            files = run_audiveris(deskew_pdf(pdf, straight, print), os.path.join(work, "audiveris"), HEAP_MB, TIMEOUT)
        for i, path in enumerate(files, 1):
            shutil.copy(path, os.path.join(out_dir, f"omr-{i:02d}.mxl"))
        print(f"{engine}: {len(files)} file(s)")
    return 0 if files else 2


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
