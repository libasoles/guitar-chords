"""Borra los dedos de la mano izquierda y las letras p-i-m-a antes del OCR.

Los motores de OMR leen esas anotaciones como notas (dedos como cabezas con octavas absurdas, letras como
alteraciones). Son manchas pequenas y compactas, separadas de las cabezas, plicas y barras: se quitan del
raster, dejando intactos pentagrama, lineas adicionales, alteraciones, puntillos y cifras de compas.

Pensado para escaneos o imagenes de partituras de una o varias lineas; no toca nada mayor que una cifra.

Copia de `scripts/carcassi-preludios/annotations.py` (la imagen del OCR es independiente). Lo usa `homr_engine`
antes de leer cada pagina: sube el recall de homr unos 12 puntos (`docs/ocr-evaluacion.md`); Audiveris ignora estas
anotaciones por si mismo. Los dedos pegados a plicas o barras no se borran.
"""

import numpy as np
from PIL import Image

DARK = 140
MIN_STAFF_RUN = 0.45  # fraccion del ancho que ha de oscurecer una fila para ser linea de pentagrama


def staff_spacing(mask):
    """Espaciado entre lineas del pentagrama en px, o None si no se encuentran lineas."""
    rows = np.where(mask.mean(1) > MIN_STAFF_RUN)[0]
    if len(rows) < 5:
        return None
    runs, current = [], [rows[0]]
    for r in rows[1:]:
        if r - current[-1] <= 2:
            current.append(r)
        else:
            runs.append(current)
            current = [r]
    runs.append(current)
    centers = [np.mean(run) for run in runs if len(run) <= 8]  # las barras horizontales son mas gruesas
    gaps = np.diff(centers)
    gaps = gaps[(gaps > 8) & (gaps < 80)]
    return float(np.median(gaps)) if len(gaps) else None


def long_runs(mask, min_run):
    """Pixeles de `mask` que pertenecen a un tramo horizontal de al menos `min_run` px."""
    out = np.zeros_like(mask)
    for y in range(mask.shape[0]):
        row = mask[y]
        if row.sum() < min_run:
            continue
        edges = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
        for a, b in zip(np.nonzero(edges == 1)[0], np.nonzero(edges == -1)[0]):
            if b - a >= min_run:
                out[y, a:b] = True
    return out


def shifted(mask, dy):
    out = np.zeros_like(mask)
    if dy > 0:
        out[dy:] = mask[:-dy]
    else:
        out[:dy] = mask[-dy:]
    return out


def components(mask):
    """[(pixels, ymin, ymax, xmin, xmax)] por componente conexa 4-vecinos."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    found = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack, pixels = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            pixels.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        ys, xs = zip(*pixels)
        found.append((pixels, min(ys), max(ys), min(xs), max(xs)))
    return found


def is_annotation(pixels, ymin, ymax, xmin, xmax, spacing):
    """Cifra o letra: compacta, mas pequena que una cabeza con plica y mas grande que un puntillo."""
    height, width, area = ymax - ymin + 1, xmax - xmin + 1, len(pixels)
    return (.3 * spacing <= height <= 1.05 * spacing and .12 * spacing <= width <= 1.0 * spacing
            and .09 * spacing ** 2 <= area <= .7 * spacing ** 2)


def erase_annotations(image):
    """Copia de `image` (PIL) sin dedos ni letras; la misma imagen si no hay pentagrama reconocible."""
    gray = np.array(image.convert("L"))
    mask = gray < DARK
    spacing = staff_spacing(mask)
    if not spacing:
        return image
    runs = long_runs(mask, int(1.2 * spacing))  # lineas del pentagrama y lineas adicionales
    cleaned = mask & ~runs
    # las cifras que cruzan o se apoyan en una linea quedan partidas: se vuelven a unir con una dilatacion vertical
    joined = cleaned.copy()
    for dy in range(1, max(3, int(.2 * spacing)) + 1):
        joined |= shifted(cleaned, dy) | shifted(cleaned, -dy)
    out = gray.copy()
    for pixels, *_ in components(joined):
        own = [(y, x) for y, x in pixels if cleaned[y, x]]
        if not own:
            continue
        ys, xs = zip(*own)
        if not is_annotation(own, min(ys), max(ys), min(xs), max(xs), spacing):
            continue
        for y, x in pixels:
            out[max(0, y - 1):y + 2, max(0, x - 1):x + 2] = 255
    out[runs & mask] = gray[runs & mask]  # las lineas vuelven enteras
    return Image.fromarray(out)
