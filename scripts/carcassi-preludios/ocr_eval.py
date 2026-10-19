"""Compara motores de OMR y preprocesados contra las transcripciones revisadas de los preludios.

    python scripts/carcassi-preludios/ocr_eval.py 1 5 8 [--variants homr-png,homr-clean,...]

Variantes: <motor>-<entrada>, con motor homr|audiveris y entrada png (recorte a 400 dpi), clean (recorte sin dedos
ni letras, `annotations.py`) o vector (el PDF fuente recortado, sin rasterizar). Cada ejecucion usa el
contenedor local `guitar-chords-ocr`. La verdad de referencia es `corrected/prelude-NN.musicxml`.

Metrica por variante: compases leidos frente a los del libro, notas leidas frente a las del libro, y por compas
(en orden) los tonos acertados: precision (de lo leido, cuanto es correcto) y recall (de lo del libro, cuanto se
leyo), mas las notas absurdas (fuera del rango de la guitarra: MIDI 36..96).
"""
import collections
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
WORK = os.path.join(ROOT, ".work", "carcassi-preludios")
GUITAR_RANGE = (36, 96)
DEFAULT_VARIANTS = "homr-png,homr-clean,audiveris-png,audiveris-clean,audiveris-vector"


def inputs(number):
    """Rutas de entrada por tipo: png, clean, vector."""
    from PIL import Image
    from annotations import erase_annotations
    import extract

    png = extract.crop(number)
    clean = os.path.join(WORK, f"prelude-{number:02d}-clean.png")
    erase_annotations(Image.open(png)).save(clean)
    return {"png": png, "clean": clean, "vector": vector_pdf(number), "scan": scan_like(png, number)}


def scan_like(png, number):
    """Un escaneo simulado del recorte: 300 dpi, inclinado, desenfocado, con ruido, fondo de papel y JPEG."""
    import io

    import numpy as np
    from PIL import Image, ImageFilter

    rng = np.random.default_rng(number)
    img = Image.open(png).convert("L")
    img = img.resize((img.width * 3 // 4, img.height * 3 // 4), Image.LANCZOS)  # 400 -> 300 dpi
    img = img.rotate(0.8, resample=Image.BICUBIC, expand=True, fillcolor=255)
    img = img.filter(ImageFilter.GaussianBlur(0.9))
    arr = np.asarray(img).astype(np.float32)
    paper = 226 + 10 * np.sin(np.linspace(0, 3, arr.shape[1]))[None, :]  # fondo gris con una pequena sombra
    arr = np.minimum(arr, 255) * paper / 255 + rng.normal(0, 7, arr.shape)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=45)
    path = os.path.join(WORK, f"prelude-{number:02d}-scan.png")
    Image.open(io.BytesIO(buf.getvalue())).save(path)
    return path


def vector_pdf(number):
    """El PDF fuente recortado al preludio (una pagina por tramo), sin rasterizar."""
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import RectangleObject
    import extract

    source = extract.source_pdf()
    reader = PdfReader(source)
    writer = PdfWriter()
    for page_no, top, bottom in extract.segments(source, number):
        page = reader.pages[page_no - 1]
        height = float(page.mediabox.height)
        box = RectangleObject([0, height - bottom, float(page.mediabox.width), height - top])
        page.mediabox = box
        page.cropbox = box
        writer.add_page(page)
    path = os.path.join(WORK, f"prelude-{number:02d}-vector.pdf")
    with open(path, "wb") as f:
        writer.write(f)
    return path


def run_variant(number, engine, kind, path):
    out = os.path.join(WORK, f"eval-{number:02d}-{engine}-{kind}")
    subprocess.run(["rm", "-rf", out], check=True)
    os.makedirs(out)
    name = os.path.basename(path)
    result = subprocess.run(
        ["docker", "run", "--rm", "-v", f"{WORK}:/work", "-v", f"{ROOT}/backend/ocr:/opt/ocr:ro",
         "-v", f"{HERE}:/opt/eval:ro", "--entrypoint", "python3", "guitar-chords-ocr", "/opt/eval/ocr_variant.py",
         engine, f"/work/{name}", f"/work/{os.path.basename(out)}"], capture_output=True, text=True)
    files = sorted(f for f in os.listdir(out) if f.endswith(".mxl"))
    return [os.path.join(out, f) for f in files], result


def measures(paths):
    """[[midi, ...] por compas] de la primera parte de cada archivo, en orden (acordes incluidos)."""
    import music21 as m21

    out = []
    for path in paths:
        score = m21.converter.parse(path)
        part = score.parts[0]
        for measure in part.getElementsByClass("Measure"):
            pitches = []
            for el in measure.recurse().notes:
                pitches += [p.midi for p in (el.pitches if el.isChord else [el.pitch])]
            out.append(sorted(pitches))
    return out


def compare(truth, read):
    hit = read_total = truth_total = absurd = 0
    for i, expected in enumerate(truth):
        got = read[i] if i < len(read) else []
        remaining = collections.Counter(expected)
        for midi in got:
            if remaining[midi] > 0:
                remaining[midi] -= 1
                hit += 1
        truth_total += len(expected)
    for got in read:
        read_total += len(got)
        absurd += sum(1 for m in got if not GUITAR_RANGE[0] <= m <= GUITAR_RANGE[1])
    return {"measures": f"{len(read)}/{len(truth)}", "notes": f"{read_total}/{truth_total}",
            "precision": round(hit / read_total, 2) if read_total else 0,
            "recall": round(hit / truth_total, 2) if truth_total else 0, "absurd": absurd}


def main(argv):
    variants = DEFAULT_VARIANTS
    if "--variants" in argv:
        i = argv.index("--variants")
        variants = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    results = []
    for number in (int(a) for a in argv):
        truth = measures([os.path.join(HERE, "corrected", f"prelude-{number:02d}.musicxml")])
        ins = inputs(number)
        for variant in variants.split(","):
            engine, kind = variant.split("-")
            files, proc = run_variant(number, engine, kind, ins[kind])
            row = {"prelude": number, "variant": variant}
            try:
                row.update(compare(truth, measures(files)) if files else {"error": "sin MusicXML"})
            except Exception as exc:  # noqa: BLE001
                row["error"] = str(exc)[:80]
            results.append(row)
            print(json.dumps(row, ensure_ascii=False), flush=True)
    return results


if __name__ == "__main__":
    main(sys.argv[1:])
