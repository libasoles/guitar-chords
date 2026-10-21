"""Lee las lecciones del libro 1 de Sagreras (edicion Marieh 2020, PDF vectorial de MuseScore 2/3, fuente MScore).

Reutiliza la lectura de geometria de carcassi-valses/pdf_notes.py. Diferencias con los PDF de MuseScore 4: el
pentagrama es un solo trazo de 5 (o 6) lineas, y varias lecciones comparten pagina; cada sistema se asigna a la
leccion cuya etiqueta «No.N» aparece antes que el (por pagina y altura). Los numeros de la TAB impresa dan un
control independiente de las alturas (`tab_cells`).
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-valses'))

import pdf_notes as P  # noqa: E402

pymupdf = P.pymupdf
OPEN_MIDI = P.OPEN_MIDI
SOURCE = Path('/Users/guillermoperez/Projects/playground/musica/guitar-chords/resources/sagreras/primeras-lecciones/fuentes/primeras-lecciones-marieh.pdf')


def mscore_glyphs(page):
    out = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['font'] == 'MScore':
                    for ch in span['chars']:
                        out.append((ord(ch['c']), ch['origin'][0], ch['origin'][1], span['size']))
    return out


def italic_threes(page):
    """Cifras «3» en cursiva (tresillos): (x, y) del centro."""
    out = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if 'Italic' in span['font']:
                    for ch in span['chars']:
                        if ch['c'] == '3':
                            b = ch['bbox']
                            out.append(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2))
    return out


def finger_marks(page):
    """Dedos de la mano izquierda: cifras 0-4 de 8 pt (las de la TAB impresa son de 9 pt): (x, y) del centro y cifra."""
    out = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['font'] == 'FreeSerif' and abs(span['size'] - 8) < 0.1:
                    for ch in span['chars']:
                        if ch['c'] in '01234':
                            b = ch['bbox']
                            out.append(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, ch['c']))
    return out


def attach_fingers(system, marks, lines):
    """Cada cifra pasa a la cabeza mas cercana (`finger` de la cabeza); una cabeza toma una sola cifra. En un acorde la
    cifra puede ir al lado de la cabeza. -> las cifras que no encontraron cabeza (para avisar)."""
    top, bottom = lines[0], lines[-1]
    space = (bottom - top) / 4
    mine = [m for m in marks if top - 9 * space <= m[1] <= bottom + 5 * space and system['measures']
            and min(ms['left'] for ms in system['measures']) <= m[0] <= max(ms['right'] for ms in system['measures'])]
    heads = [h for m in system['measures'] for h in m['items'] if not h['grace']]
    pairs = sorted(((((h['x'] + 0.6 * space - x) / space) ** 2 + ((h['y'] - y) / space) ** 2, i, j)
                    for i, (x, y, _) in enumerate(mine) for j, h in enumerate(heads) if abs(h['x'] + 0.6 * space - x) <= 3 * space))
    used_mark, used_head = set(), set()
    for _, i, j in pairs:
        if i not in used_mark and j not in used_head:
            used_mark.add(i)
            used_head.add(j)
            heads[j]['finger'] = mine[i][2]
    return [mine[i] for i in range(len(mine)) if i not in used_mark]


def stroke_widths(drawings):
    """Grosores de MuseScore 2: plica ~0,75 y barra de compas ~0,95; otros trazos verticales finos (0,5) no son plicas."""
    base = P.stroke_widths(drawings)
    vertical = [round(d['width'] or 0, 2) for d in drawings if d['type'] == 's' and d['rect'].width < 0.01 and d['rect'].height > 1]
    stems = [w for w in vertical if 0.6 < w < 0.9]
    bars = [w for w in vertical if 0.9 <= w < 2]
    if stems:
        base['stem'] = max(set(stems), key=stems.count)
    if bars:
        base['bar'] = max(set(bars), key=bars.count)
    return base


class PageProxy:
    """Pagina cuyos trazos de varias lineas se separan en una linea por trazo (como los PDF de MuseScore 4)."""

    def __init__(self, page):
        self.page = page

    def get_text(self, *args, **kwargs):
        return self.page.get_text(*args, **kwargs)

    def get_drawings(self):
        out = []
        for d in self.page.get_drawings():
            if d['type'] == 's' and len(d['items']) > 1 and all(i[0] == 'l' for i in d['items']):
                for item in d['items']:
                    a, b = item[1], item[2]
                    out.append({**d, 'items': [item], 'rect': pymupdf.Rect(min(a.x, b.x), min(a.y, b.y), max(a.x, b.x), max(a.y, b.y))})
            else:
                out.append(d)
        return out


def read_pdf(path=SOURCE):
    """-> {leccion: {'fifths', 'time', 'measures', 'tab'}} para las lecciones 1-86."""
    doc = pymupdf.open(str(path))
    lessons = {}
    current = None
    for page in doc:
        proxy = PageProxy(page)
        drawings = proxy.get_drawings()
        widths = stroke_widths(drawings)
        groups = P.staff_groups(drawings, widths['staff'])
        notation = [g for g in groups if len(g) == 5]
        tabs = [g for g in groups if len(g) == 6]
        words = page.get_text('words')
        labels = sorted((w[1], int(m[1])) for w in words if (m := re.fullmatch(r'No\.(\d+)', w[4])))
        glyph = mscore_glyphs(page)
        stems = [d['rect'] for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - widths['stem']) < 0.02 and d['rect'].width < 0.01]
        bars = [d['rect'] for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - (widths['bar'] or 0)) < 0.02 and d['rect'].width < 0.01]
        thick = [d['rect'] for d in drawings if d['type'] == 's' and (d['width'] or 0) > 2 and d['rect'].width < 0.01]
        beams = [[(i[1].x, i[1].y) for i in d['items']] + [(d['items'][-1][2].x, d['items'][-1][2].y)] for d in drawings
                 if d['type'] == 'f' and d['fill'] == (0.0, 0.0, 0.0) and len(d['items']) == 4]
        curves = [d['rect'] for d in drawings if d['fill'] == (0.0, 0.0, 0.0) and any(i[0] == 'c' for i in d['items'])]
        threes = italic_threes(page)
        fingers = finger_marks(page)
        for index, lines in enumerate(notation):
            for y, number in labels:
                if y < lines[0]:
                    current = number
            if current is None or not 1 <= current <= 86:
                continue
            space = (lines[-1] - lines[0]) / 4
            # una barra que cruza notacion y TAB cuenta como barra de este pentagrama
            clip = lambda rs: [pymupdf.Rect(r.x0, r.y0, r.x1, lines[-1]) if abs(r.y0 - lines[0]) < 0.6 and r.y1 > lines[-1] + 3 * space else r for r in rs]  # noqa: E731
            system = P.read_system(lines, glyph, stems, clip(bars), clip(thick), beams)
            P.mark_ties(system, curves, lines)
            lost = attach_fingers(system, fingers, lines)
            if lost:
                print(f'  leccion {current}: cifras de dedo sin nota: {[(round(x), round(y), c) for x, y, c in lost]}', file=sys.stderr)
            P.mark_texts(system, words, lines)
            space = (lines[-1] - lines[0]) / 4
            for m in system['measures']:
                m['tuplets'] = [(x, y) for x, y in threes if m['left'] <= x <= m['right'] and lines[0] - 9 * space <= y <= lines[-1] + 7 * space]
            lesson = lessons.setdefault(current, {'fifths': None, 'time': None, 'measures': [], 'tab': [], 'cells': []})
            if system['key'] is not None and lesson['fifths'] is None:
                lesson['fifths'] = system['key']
            symbol = [g for g in glyph if g[0] in (0xE08A, 0xE08B) and lines[0] - 1 <= g[2] <= lines[-1] + 6 * (lines[-1] - lines[0]) / 4]
            if symbol and not system['time']:
                system['time'] = (4, 4) if symbol[0][0] == 0xE08A else (2, 2)
            if system['time'] and not lesson['time']:
                lesson['time'] = system['time']
            for m in system['measures']:
                m['fifths'] = system['key'] if system['key'] is not None else lesson['fifths']
            lesson['measures'].extend(system['measures'])
            if index < len(tabs):
                cells = tab_cells(tabs[index], words, system['measures'])
                lesson['cells'].extend(cells)
                lesson['tab'].extend((x, OPEN_MIDI[string] + fret) for x, string, fret in cells)
    return lessons


def tab_cells(lines, words, measures):
    """Casillas (x, cuerda, traste) de los numeros de la TAB impresa que caen en este sistema; cuerda 0 = la 1."""
    top, bottom = lines[0], lines[-1]
    gap = (bottom - top) / 5
    left = min(m['left'] for m in measures) - 2 if measures else 0
    out = []
    for w in words:
        if not re.fullmatch(r'\d{1,2}', w[4]):
            continue
        cy, cx = (w[1] + w[3]) / 2, (w[0] + w[2]) / 2
        if top - gap / 2 <= cy <= bottom + gap / 2 and cx > left:
            out.append((cx, round((cy - top) / gap), int(w[4])))
    return out
