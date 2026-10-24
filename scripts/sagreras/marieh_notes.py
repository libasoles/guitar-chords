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
                        # Silencio de blanca con linea adicional (cierre del No.71).
                        # Su variante grafica tiene la misma duracion que E4E4.
                        code = {0xE4F5: 0xE4E4}.get(ord(ch['c']), ord(ch['c']))
                        out.append((code, ch['origin'][0], ch['origin'][1], span['size']))
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


def finger_marks(page, chars='01234'):
    """Indicaciones de dedo de 8 pt: cifras 0-4 de la mano izquierda (las de la TAB impresa son de 9 pt) o, con
    `chars='pima'`, letras de la mano derecha (texto de un solo caracter). -> (x, y) del centro y caracter."""
    out = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if span['font'] == 'FreeSerif' and abs(span['size'] - 8) < 0.1 and (chars.isdigit() or len(span['chars']) == 1):
                    for ch in span['chars']:
                        if ch['c'] in chars:
                            b = ch['bbox']
                            out.append(((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, ch['c']))
    return out


def attach_fingers(system, marks, lines, key='finger'):
    """Cada indicacion pasa a la cabeza mas cercana (campo `key` de la cabeza: `finger` o `pluck`); una cabeza toma una
    sola. En un acorde la cifra puede ir al lado de la cabeza. -> las indicaciones que no encontraron cabeza (para avisar)."""
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
            heads[j][key] = mine[i][2]
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


def mark_ties(system, drawings, lines):
    """Emparejar cada curva con su altura, incluso en ligaduras paralelas de un acorde."""
    top, bottom = lines[0], lines[-1]
    space = (bottom - top) / 4
    hw = space * 1.18
    heads = [h for m in system['measures'] for h in m['items']]
    for drawing in drawings:
        curves = [i for i in drawing['items'] if i[0] == 'c']
        r = drawing['rect']
        if drawing['fill'] != (0., 0., 0.) or not curves or r.width > 60 * space:
            continue
        if r.y0 < top - 10 * space or r.y1 > bottom + 10 * space:
            continue
        start, control, _, end = curves[0][1:]
        if abs(start.y - end.y) > space / 2:
            continue
        # El extremo de la curva esta a ~0.4 espacios de la cabeza; el centro
        # de su caja queda cerca de otra nota en un acorde y no identifica la altura.
        target_y = start.y + (0.4 * space if control.y < start.y else -0.4 * space)
        pairs = []
        for left in heads:
            if not (left['x'] - 1 <= r.x0 <= left['x'] + 2.2 * hw) or abs(left['y'] - target_y) > space:
                continue
            for right in heads:
                if (right['pos'] == left['pos'] and right['x'] > left['x'] + hw
                        and right['x'] - 1.2 * hw <= r.x1 <= right['x'] + 1.5 * hw):
                    cost = abs(right['x'] - left['x'] - r.width) + 4 * abs(left['y'] - target_y)
                    pairs.append((cost, left, right))
        if pairs:
            _, left, right = min(pairs, key=lambda pair: pair[0])
            left['tie_next'] = right['tie_prev'] = True


def bar_strokes(drawings):
    """Barras finas de MuseScore 2: 0,95 pt simples y 0,8 pt dobles.

    Las plicas son de 0,75 pt. read_system exige ademas que cada trazo
    cubra el pentagrama completo antes de usarlo como limite de compas.
    """
    return [d['rect'] for d in drawings if d['type'] == 's'
            and 0.78 < (d['width'] or 0) < 2 and d['rect'].width < 0.01]


def assign_measure_keys(system, glyphs, inherited):
    """Armadura por compas, incluidos los cambios tras una doble barra.

    read_system reconoce la del inicio de sistema. En Marieh tambien hay
    cambios de seccion dentro del sistema (66/83): las alteraciones preceden
    a la primera nota y siguen el orden y las alturas canonicas de la armadura.
    Una alteracion tras barra simple sigue siendo una alteracion de nota.
    """
    current = system['key'] if system['key'] is not None else inherited
    previous = None
    for measure in system['measures']:
        if previous is not None and previous['right_bar_style'] == 'light-light':
            first = min([h['x'] for h in measure['items']]
                        + [r['x'] for r in measure['rests']], default=measure['right'])
            accs = sorted((g for g in glyphs if g[0] in (0xE260, 0xE262)
                           and measure['left'] < g[1] < first
                           and measure['top'] - measure['space'] <= g[2] <= measure['bottom'] + measure['space']),
                          key=lambda g: g[1])
            signature = P.key_signature(accs, measure['top'], measure['space'])
            if signature:
                current = len(signature) * (1 if signature[0][0] == 0xE262 else -1)
        measure['fifths'] = current
        previous = measure


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
        bars = bar_strokes(drawings)
        thick = [d['rect'] for d in drawings if d['type'] == 's' and (d['width'] or 0) > 2 and d['rect'].width < 0.01]
        beams = [[(i[1].x, i[1].y) for i in d['items']] + [(d['items'][-1][2].x, d['items'][-1][2].y)] for d in drawings
                 if d['type'] == 'f' and d['fill'] == (0.0, 0.0, 0.0) and len(d['items']) == 4]
        threes = italic_threes(page)
        fingers = finger_marks(page)
        plucks = finger_marks(page, 'pima')
        barres = barre_marks(page, drawings, notation)
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
            mark_ties(system, drawings, lines)
            for marks, key in ((fingers, 'finger'), (plucks, 'pluck')):
                lost = attach_fingers(system, marks, lines, key)
                if lost:
                    print(f'  leccion {current}: {key} sin nota: {[(round(x), round(y), c) for x, y, c in lost]}', file=sys.stderr)
            P.mark_texts(system, words, lines)
            space = (lines[-1] - lines[0]) / 4
            for m in system['measures']:
                m['tuplets'] = [(x, y) for x, y in threes if m['left'] <= x <= m['right'] and lines[0] - 9 * space <= y <= lines[-1] + 7 * space]
            lesson = lessons.setdefault(current, {'fifths': None, 'time': None, 'measures': [], 'tab': [], 'cells': [], 'barres': []})
            lesson['barres'].extend({**b, 'first': len(lesson['measures']), 'count': len(system['measures'])} for b in barres.get(index, []))
            if system['key'] is not None and lesson['fifths'] is None:
                lesson['fifths'] = system['key']
            symbol = [g for g in glyph if g[0] in (0xE08A, 0xE08B) and lines[0] - 1 <= g[2] <= lines[-1] + 6 * (lines[-1] - lines[0]) / 4]
            if symbol and not system['time']:
                system['time'] = (4, 4) if symbol[0][0] == 0xE08A else (2, 2)
            if system['time'] and not lesson['time']:
                lesson['time'] = system['time']
            inherited = lesson['measures'][-1]['fifths'] if lesson['measures'] else lesson['fifths']
            assign_measure_keys(system, glyph, inherited)
            lesson['measures'].extend(system['measures'])
            if index < len(tabs):
                cells = tab_cells(tabs[index], words, system['measures'])
                for m in system['measures']:
                    m['tab'] = [(x, OPEN_MIDI[string] + fret) for x, string, fret in cells
                                if m['left'] <= x < m['right']]
                lesson['cells'].extend(cells)
                lesson['tab'].extend((x, OPEN_MIDI[string] + fret) for x, string, fret in cells)
    return lessons


def barre_marks(page, drawings, notation):
    """Cejillas impresas de la pagina: «₵N» (fuente FreeSerif) seguida de una linea punteada horizontal que dura lo que
    la cejilla. -> {indice del pentagrama de `notation`: [{'fret', 'x0', 'x1'}]}. Cada marca va al pentagrama que
    tiene debajo; sin linea, `x1` es None."""
    glyphs = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                text = ''.join(c['c'] for c in span['chars'])
                if text.startswith('₵') and text[1:].isdigit():
                    glyphs.append((int(text[1:]), span['bbox']))
    dashed = [d['rect'] for d in drawings if d['type'] == 's' and d.get('dashes') and d['rect'].height < 0.5 and d['rect'].width > 4]
    out = {}
    for fret, box in glyphs:
        below = [(lines[0] - box[3], index) for index, lines in enumerate(notation) if lines[0] - box[3] > -2]
        if not below:
            continue
        index = min(below)[1]
        line = min((r for r in dashed if abs(r.x0 - box[2]) < 8 and abs((r.y0 + r.y1) / 2 - (box[1] + box[3]) / 2) < 12),
                   key=lambda r: abs(r.x0 - box[2]), default=None)
        out.setdefault(index, []).append({'fret': fret, 'x0': box[0], 'x1': line.x1 if line is not None else None})
    return out


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
