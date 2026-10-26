"""Lee las piezas de Barrios de la edicion de Stefan Apke (IMSLP, CC BY-SA 4.0): PDF vectorial de MuseScore 2 (fuente MScore).

Reutiliza `sagreras/marieh_notes.py` (misma fuente y mismos trazos) con tres diferencias: una pieza por PDF y sin TAB
impresa, los dedos de la izquierda son cifras `MScoreBC` de 6 pt (las rodeadas con un circulo son cuerdas, no dedos) y
las letras p i m a de la derecha van en FreeSerif de 8 pt.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'sagreras'))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-valses'))

import marieh_notes as M  # noqa: E402
import pdf_notes as P  # noqa: E402

pymupdf = P.pymupdf


# Codigos de la fuente MScore de MuseScore 2.1 (distintos de los de Marieh y de SMuFL) -> los SMuFL que lee pdf_notes.
# Identificados mirando cada glifo del PDF. Las cifras del compas son ASCII; las cabezas en rombo (armonicos) se leen
# como cabezas normales.
LEGACY = {
    0xE12D: 0xE0A4, 0xE12C: 0xE0A3, 0xE12B: 0xE0A2, 0xE149: 0xE0A4, 0xE148: 0xE0A3,  # negra, blanca, redonda
    0xE10E: 0xE262, 0xE113: 0xE261, 0xE114: 0xE260,  # sostenido, becuadro, bemol
    0xE127: 0xE1E7,  # puntillo
    0xE100: 0xE4E3, 0xE103: 0xE4E4, 0xE107: 0xE4E5, 0xE109: 0xE4E6, 0xE10A: 0xE4E7,  # silencios
    0xE190: 0xE240, 0xE194: 0xE241, 0xE197: 0xE242,  # corchetes
    0xE1D7: 0xE052, 0xE09A: 0xE08A, 0xE043: 0xE044,  # clave de sol 8vb, C, puntos de repeticion
}
LEGACY.update({0x30 + d: 0xE080 + d for d in range(10)})


def mscore_glyphs(page):
    """Glifos MScore de la pagina con los codigos de MuseScore 2.1 traducidos a SMuFL; los que no se conocen
    (articulaciones, adornos, corchetes de sistema, espacio) se descartan."""
    out = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['font'] == 'MScore':
                    for ch in span['chars']:
                        code = LEGACY.get(ord(ch['c']))
                        if code is not None:
                            out.append((code, ch['origin'][0], ch['origin'][1], span['size']))
    return out


def staff_width(drawings):
    """Grosor de las lineas del pentagrama: el mas comun entre los trazos horizontales largos (0,4 pt en esta edicion)."""
    widths = [round(d['width'] or 0, 2) for d in drawings if d['type'] == 's' and d['rect'].height < 0.01 and d['rect'].width > 30]
    return max(set(widths), key=widths.count)


def fix_barlines(system, thick, dots):
    """Dos correcciones a `read_system` para esta edicion: los extremos de las lineas de posicion (I, IV, VII...) junto a la
    barra se tomaban por una barra doble, y la repeticion de inicio de sistema (barra gruesa y puntos a la izquierda de la
    primera nota) no se reconocia. Las barras dobles se dejan como barras simples."""
    for m in system['measures']:
        if m['right_bar_style'] == 'light-light':
            m['right_bar_style'] = 'regular'
    first = system['measures'][0] if system['measures'] else None
    if first and not first['repeat_start']:
        left = first['left']
        if any(left - 20 <= t.x0 <= left + 2 for t in thick) and any(left - 12 <= d[1] <= left + 4 for d in dots):
            first['repeat_start'] = True


def circles(drawings):
    """Centros de los circulos que rodean una cifra de cuerda: trazos de solo curvas de unos 8 pt."""
    out = []
    for d in drawings:
        r = d['rect']
        if d['items'] and all(i[0] == 'c' for i in d['items']) and 5 < r.width < 12 and 5 < r.height < 12:
            out.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
    return out


def digit_marks(page, drawings):
    """Cifras `MScoreBC`: (dedos, cuerdas). Una cifra con un circulo alrededor es cuerda."""
    ring = circles(drawings)
    fingers, strings = [], []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['font'] != 'MScoreBC':
                    continue
                for ch in span['chars']:
                    if not ch['c'].isdigit():
                        continue
                    b = ch['bbox']
                    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
                    if any(abs(cx - x) < 3 and abs(cy - y) < 3 for x, y in ring):
                        strings.append((cx, cy, ch['c']))
                    elif ch['c'] in '01234':
                        fingers.append((cx, cy, ch['c']))
    return fingers, strings


def read_pdf(path):
    """-> {'fifths', 'time', 'measures'} de la pieza del PDF (todas las paginas)."""
    doc = pymupdf.open(str(path))
    piece = {'fifths': None, 'time': None, 'measures': []}
    for page in doc:
        proxy = M.PageProxy(page)
        drawings = proxy.get_drawings()
        widths = M.stroke_widths(drawings)
        widths['staff'] = staff_width(drawings)
        groups = P.staff_groups(drawings, widths['staff'])
        notation = [g for g in groups if len(g) == 5]
        words = page.get_text('words')
        glyph = mscore_glyphs(page)
        stems = [d['rect'] for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - widths['stem']) < 0.02 and d['rect'].width < 0.01]
        bars = M.bar_strokes(drawings)
        thick = [d['rect'] for d in drawings if d['type'] == 's' and (d['width'] or 0) > 2 and d['rect'].width < 0.01]
        beams = [[(i[1].x, i[1].y) for i in d['items']] + [(d['items'][-1][2].x, d['items'][-1][2].y)] for d in drawings
                 if d['type'] == 'f' and d['fill'] == (0.0, 0.0, 0.0) and len(d['items']) == 4]
        threes = M.italic_threes(page)
        fingers, strings = digit_marks(page, drawings)
        plucks = M.finger_marks(page, 'pima')
        for k, lines in enumerate(notation):
            space = (lines[-1] - lines[0]) / 4
            clip = lambda rs: [pymupdf.Rect(r.x0, r.y0, r.x1, lines[-1]) if abs(r.y0 - lines[0]) < 0.6 and r.y1 > lines[-1] + 3 * space else r for r in rs]  # noqa: E731
            # Los sistemas estan mas juntos que en Sagreras: cada uno solo ve lo que cae hasta el punto medio con sus vecinos.
            lo = (notation[k - 1][-1] + lines[0]) / 2 if k else -1e9
            hi = (lines[-1] + notation[k + 1][0]) / 2 if k + 1 < len(notation) else 1e9
            mid = lambda r: lo <= (r.y0 + r.y1) / 2 <= hi  # noqa: E731
            # Una barra de compas mide lo que el pentagrama; la vertical de un corchete de posicion («[ IV ---┐») lo cruza
            # pero sobresale, y partia el compas en dos.
            exact = lambda r: abs(r.y0 - lines[0]) < 1 and abs(r.y1 - lines[-1]) < 1  # noqa: E731
            system = P.read_system(lines, [g for g in glyph if lo <= g[2] <= hi], [s for s in stems if mid(s)],
                                   [b for b in clip(bars) if mid(b) and exact(b)], [t for t in clip(thick) if mid(t) and exact(t)],
                                   [p for p in beams if lo <= sum(q[1] for q in p) / len(p) <= hi])
            M.mark_ties(system, drawings, lines)
            for marks, key in ((fingers, 'finger'), (plucks, 'pluck')):
                lost = M.attach_fingers(system, marks, lines, key)
                if lost:
                    print(f'  {key} sin nota: {[(round(x), round(y), c) for x, y, c in lost]}', file=sys.stderr)
            P.mark_texts(system, words, lines)
            for m in system['measures']:
                m['tuplets'] = [(x, y) for x, y in threes if m['left'] <= x <= m['right'] and lines[0] - 9 * space <= y <= lines[-1] + 7 * space]
            if system['key'] is not None and piece['fifths'] is None:
                piece['fifths'] = system['key']
            symbol = [g for g in glyph if g[0] in (0xE08A, 0xE08B) and lines[0] - 1 <= g[2] <= lines[-1] + 6 * space]
            if symbol and not system['time']:
                system['time'] = (4, 4) if symbol[0][0] == 0xE08A else (2, 2)
            if system['time'] and not piece['time']:
                piece['time'] = system['time']
            inherited = piece['measures'][-1]['fifths'] if piece['measures'] else piece['fifths']
            M.assign_measure_keys(system, glyph, inherited)  # usa las barras dobles: normalizarlas despues
            fix_barlines(system, [t for t in clip(thick) if mid(t)], [g for g in glyph if lo <= g[2] <= hi and g[0] == 0xE044])
            piece['measures'].extend(system['measures'])
    return piece
