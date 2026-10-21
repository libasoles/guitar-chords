"""Lee las notas de un PDF vectorial de MuseScore 4 (fuente Leland) y las devuelve por compás.

Cabezas, silencios, alteraciones y puntillos son texto Leland (puntos de codigo SMuFL); plicas, barras de
compas y barras de corchea son trazos y poligonos. Con esa geometria se recupera la partitura sin OCR: altura
por la posicion en el pentagrama, duracion por plica + barras/corchetes + puntillos, voz por direccion de la
plica. Los numeros de la TAB impresa dan un control independiente (`tab_pitches`).
Los PDF fuente son de solo lectura: este modulo nunca los modifica.
"""
import warnings

warnings.filterwarnings("ignore")
import pymupdf  # noqa: E402

HEAD = {0xE0A4: 4, 0xE0A3: 8, 0xE0A2: 16}
RESTS = {0xE4E3: 16, 0xE4E4: 8, 0xE4E5: 4, 0xE4E6: 2, 0xE4E7: 1}
FLAGS = {0xE240: 2, 0xE241: 2, 0xE242: 1, 0xE243: 1}  # corchea / semicorchea (valor en semicorcheas)
ACCIDENTAL = {0xE260: -1, 0xE261: 0, 0xE262: 1}
DOT = 0xE1E7
STEPS = 'CDEFGAB'
OPEN_MIDI = [64, 59, 55, 50, 45, 40]  # cuerdas 1..6


def glyphs(page):
    out = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                if 'Leland' in span['font']:
                    for ch in span['chars']:
                        out.append((ord(ch['c']), ch['origin'][0], ch['origin'][1], span['size']))
    return out


def stroke_widths(drawings):
    """Grosores de cada clase de trazo; cambian de un PDF a otro, asi que se deducen: la linea de pentagrama es
    el grosor horizontal mas comun, la plica el vertical fino y la barra de compas el vertical siguiente."""
    horizontal = [round(d['width'] or 0, 2) for d in drawings if d['type'] == 's' and d['rect'].height < 0.01 and d['rect'].width > 1]
    vertical = [round(d['width'] or 0, 2) for d in drawings if d['type'] == 's' and d['rect'].width < 0.01 and d['rect'].height > 1]
    staff = max(set(horizontal), key=horizontal.count)
    common = sorted(w for w in set(vertical) if w < 2 and vertical.count(w) >= 8)  # descarta trazos sueltos (ligaduras, etc.)
    return {'staff': staff, 'stem': common[0], 'bar': common[-1] if len(common) > 1 else None}


def staff_groups(drawings, width):
    ys = sorted({round(d['rect'].y0, 2) for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - width) < 0.02
                 and d['rect'].height < 0.01 and d['rect'].width > 30})  # las lineas adicionales son cortas
    if not ys:
        return []
    groups, cur = [], [ys[0]]
    for y in ys[1:]:
        if y - cur[-1] < 8.5:
            cur.append(y)
        else:
            groups.append(cur)
            cur = [y]
    groups.append(cur)
    return groups


def read(path):
    """-> {'fifths', 'time', 'measures': [...]}; cada compas lleva sus cabezas, silencios y trazos."""
    doc = pymupdf.open(path)
    meta = {'fifths': 0, 'time': None, 'measures': [], 'tab': []}
    for page in doc:
        drawings = page.get_drawings()
        widths = stroke_widths(drawings)
        groups = staff_groups(drawings, widths['staff'])
        notation = [g for g in groups if len(g) == 5]
        tabs = [g for g in groups if len(g) == 6]
        if not tabs:
            continue  # paginas extra del PDF: copia sin TAB
        glyph = glyphs(page)
        stems = [d['rect'] for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - widths['stem']) < 0.02 and d['rect'].width < 0.01]
        bars = [d['rect'] for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - (widths['bar'] or 0)) < 0.02 and d['rect'].width < 0.01]
        thick = [d['rect'] for d in drawings if d['type'] == 's' and (d['width'] or 0) > 2 and d['rect'].width < 0.01]
        beams = [[(i[1].x, i[1].y) for i in d['items']] + [(d['items'][-1][2].x, d['items'][-1][2].y)] for d in drawings
                 if d['type'] == 'f' and d['fill'] == (0.0, 0.0, 0.0) and len(d['items']) == 4]
        curves = [d['rect'] for d in drawings if d['fill'] == (0.0, 0.0, 0.0) and any(i[0] == 'c' for i in d['items'])]
        for index, lines in enumerate(notation):
            system = read_system(lines, glyph, stems, bars, thick, beams)
            mark_ties(system, curves, lines)
            mark_texts(system, page.get_text('words'), lines)
            if system['key'] is not None and not meta['measures']:
                meta['fifths'] = system['key']
            if system['time'] and not meta['time']:
                meta['time'] = system['time']
            for m in system['measures']:
                m['fifths'] = system['key'] if system['key'] is not None else meta['fifths']
            meta['fifths'] = system['key'] if system['key'] is not None and not meta['measures'] else meta['fifths']
            meta['measures'].extend(system['measures'])
            if index < len(tabs):
                meta['tab'].append((tabs[index], [g for g in glyph if False]))
    return meta


# Altura (en espacios bajo la linea superior, clave de sol) de cada alteracion de la armadura, en orden.
SHARP_ORDER = [0, 1.5, -0.5, 1, 2.5, 0.5, 2]
FLAT_ORDER = [2, 0.5, 2.5, 1, 3, 1.5, 3.5]


def key_signature(accs, top, space):
    """Las alteraciones iniciales que forman una armadura: cada una en su altura canonica. Una alteracion de la
    primera nota (un do# antes del acorde) queda fuera aunque se imprima entre la clave y la cabeza."""
    if not accs:
        return []
    order = SHARP_ORDER if accs[0][0] == 0xE262 else FLAT_ORDER
    out = []
    for g, y in zip(accs, order):
        if g[0] != accs[0][0] or abs((g[2] - top) / space - y) > 0.3:
            break
        out.append(g)
    return out


def read_system(lines, glyph, stems, bars, thick, beams):
    top, bottom = lines[0], lines[-1]
    space = (bottom - top) / 4
    lo, hi = top - 10 * space, bottom + 10 * space
    inside = [g for g in glyph if lo <= g[2] <= hi]
    on_staff = [g for g in inside if top - space <= g[2] <= bottom + space]
    clef = [g for g in on_staff if g[0] in (0xE050, 0xE052)]
    clef_x = clef[0][1] if clef else min(g[1] for g in inside)
    times = [g for g in on_staff if 0xE080 <= g[0] <= 0xE089]
    first_note = min((g[1] for g in inside if g[0] in HEAD or g[0] in RESTS), default=1e9)
    time_x = min((t[1] for t in times), default=1e9)
    key_accs = [g for g in on_staff if g[0] in ACCIDENTAL and clef_x < g[1] < min(first_note, time_x)]
    key = None
    if clef:
        key_accs = key_signature(sorted(key_accs, key=lambda g: g[1]), top, space)
        n = len(key_accs)
        key = n if not n or key_accs[0][0] == 0xE262 else -n
    time = None
    if times:
        col = sorted([t for t in times if abs(t[1] - time_x) < 3], key=lambda t: t[2])
        time = (col[0][0] - 0xE080, col[-1][0] - 0xE080)
    start = max([g[1] for g in key_accs] + [t[1] + 8 for t in times] + [clef_x + 12])
    inside_bars = sorted({round(r.x0, 1) for r in bars if r.y0 <= top + 0.5 and r.y1 >= bottom - 0.5 and r.y1 < bottom + 3 * space})
    thick_x = sorted(round(r.x0, 1) for r in thick if r.y0 <= top + 0.5 and r.y1 >= bottom - 0.5 and r.y1 < bottom + 3 * space)
    edges = []
    for x in sorted(set([start] + [x for x in inside_bars + thick_x if x > start + 1])):
        if not edges or x - edges[-1] > 8:
            edges.append(x)
    repeat_dots = [g for g in inside if g[0] == 0xE044]
    measures = []
    for a, b in zip(edges, edges[1:]):
        m = measure(a, b, inside, stems, beams, top, bottom, space)
        m['repeat_start'] = any(a - 3 <= d[1] <= a + 14 for d in repeat_dots) and any(abs(a - t) < 8 for t in thick_x)
        m['repeat_end'] = any(b - 14 <= d[1] <= b + 3 for d in repeat_dots) and any(abs(b - t) < 12 for t in thick_x)
        m['end_x'] = b
        if m['items'] or m['rests'] or b - a > 25:
            measures.append(m)  # un tramo vacio y estrecho es la barra de repeticion junto a la armadura
    return {'key': key, 'time': time, 'measures': measures}


def measure(a, b, inside, stems, beams, top, bottom, space):
    half, hw = space / 2, space * 1.18
    mine = lambda g: a < g[1] < b  # noqa: E731
    sys_stems = [s for s in stems if s.y1 >= top - 12 * space and s.y0 <= bottom + 12 * space and a - 1 < s.x0 < b + 1]
    sys_beams = [p for p in beams if a - 2 < min(q[0] for q in p) and max(q[0] for q in p) < b + 2
                 and top - 12 * space <= min(q[1] for q in p) and max(q[1] for q in p) <= bottom + 12 * space]
    sys_stems = merge_stems(sys_stems)
    accs = [g for g in inside if g[0] in ACCIDENTAL and mine(g)]
    dots = [g for g in inside if g[0] == DOT and mine(g)]
    flags = [g for g in inside if g[0] in FLAGS and mine(g)]
    items = []
    for code, x, y, size in (g for g in inside if g[0] in HEAD and mine(g)):
        pos = round((bottom - y) / half)
        twins = sum(1 for g in inside if g[0] in HEAD and abs(g[1] - x) < 2 and abs(g[2] - y) < 0.5)
        taken = {id(o['stem']) for o in items if o['stem'] is not None and o['pos'] == pos and abs(o['x'] - x) < 2}
        best_side = {}
        for s in sys_stems:
            if not (s.y0 - 1.8 <= y <= s.y1 + 1.8):
                continue
            # plica a la derecha (hacia arriba) o a la izquierda (hacia abajo) de la cabeza; una por lado
            for side, edge in (('R', x + hw - 0.45), ('L', x + 0.45)):
                distance = abs(s.x0 - edge)
                if distance < 1.2 and distance < best_side.get(side, (9, None))[0]:
                    best_side[side] = (distance, s)
        matches = sorted(best_side.values(), key=lambda t: t[0])
        if twins > 1:  # dos cabezas iguales (unionísono): cada una toma una plica distinta
            matches = [t for t in matches if id(t[1]) not in taken][:1]
        stems_found = [t[1] for t in matches][:2]
        stem = stems_found[0] if stems_found else None
        cand = [g for g in accs if abs(g[2] - y) < 0.3 and 0 < x - g[1] < 14]
        acc = ACCIDENTAL[max(cand, key=lambda g: g[1])[0]] if cand else None
        dot = any(0 < d[1] - x < 14 and abs(d[2] - y) < half + 0.3 for d in dots)
        items.append({'code': code, 'x': x, 'y': y, 'pos': pos, 'stem': stem, 'stems': stems_found, 'acc': acc, 'dot': dot, 'grace': size < 17})
    rests = [{'dur': RESTS[c], 'x': x, 'y': y} for c, x, y, _ in inside if c in RESTS and mine((c, x, y))]
    return {'items': items, 'rests': rests, 'flags': flags, 'beams': sys_beams, 'stems': sys_stems, 'space': space,
            'top': top, 'bottom': bottom, 'left': a, 'right': b, 'dots': dots}


def merge_stems(stems):
    """MuseScore dibuja la plica de un acorde en tramos (uno por cabeza): se unen los que se tocan."""
    merged = []
    for s in sorted(stems, key=lambda r: (round(r.x0, 1), r.y0)):
        last = merged[-1] if merged else None
        if last is not None and abs(last.x0 - s.x0) < 0.3 and s.y0 <= last.y1 + 1.0:
            merged[-1] = pymupdf.Rect(last.x0, last.y0, last.x1, max(last.y1, s.y1))
        else:
            merged.append(pymupdf.Rect(s))
    return merged


def stem_groups(m):
    """Agrupa las cabezas por plica -> [{'dir','x','heads','dur'}] (duracion en semicorcheas)."""
    half = m['space'] / 2
    groups = {}
    for it in m['items']:
        for st in it['stems'] or [None]:
            key = id(st) if st is not None else ('free', round(it['x']))
            groups.setdefault(key, []).append((it, st))
    out = []
    for pairs in groups.values():
        heads = [h for h, _ in pairs]
        stem = pairs[0][1]
        base = HEAD[heads[0]['code']]
        if stem is None:
            # sin plica dibujada: dentro de un grupo con barras toma la duracion de las barras que lo cubren
            hx, hy = heads[0]['x'] + 3, heads[0]['y']
            covering = [q for q in m['beams'] if min(p[0] for p in q) - 1 <= hx <= max(p[0] for p in q) + 1
                        and abs(sum(p[1] for p in q[:4]) / 4 - hy) < 25]
            dur = {0: base, 1: 2, 2: 1}.get(len(covering), 1)
            grace = all(h['grace'] for h in heads)
            if grace:  # nota de adorno sin plica (solo corchete): una corchea pequena
                dur = 2
            out.append({'dir': 'up', 'x': heads[0]['x'], 'heads': heads, 'dur': 0 if grace else dur, 'stem': None,
                        'beams': len(covering), 'grace': grace, 'grace_type': dur})
            continue
        ys = [h['y'] for h in heads]
        up = min(abs(stem.y1 - y) for y in ys) < min(abs(stem.y0 - y) for y in ys)
        far = stem.y0 if up else stem.y1
        sx = stem.x0
        count = 0
        for poly in m['beams']:
            xs = [q[0] for q in poly[:4]]
            if not (min(xs) - 1.0 <= sx <= max(xs) + 1.0):
                continue
            # la barra es un paralelogramo: borde superior de (x0, ya) a (x1, yb), grosor constante
            left = min(poly[:4], key=lambda q: q[0])
            right = max(poly[:4], key=lambda q: q[0])
            tops = sorted(poly[:4], key=lambda q: q[1])
            span = right[0] - left[0] or 1.0
            ys_left = sorted(q[1] for q in poly[:4] if abs(q[0] - left[0]) < 0.1)
            ys_right = sorted(q[1] for q in poly[:4] if abs(q[0] - right[0]) < 0.1)
            t = (sx - left[0]) / span
            t = min(1.0, max(0.0, t))
            top = ys_left[0] + (ys_right[0] - ys_left[0]) * t
            bottom = ys_left[-1] + (ys_right[-1] - ys_left[-1]) * t
            if abs((top + bottom) / 2 - far) < 14:
                count += 1
        flag = [f for f in m['flags'] if abs(f[1] - sx) < 2.5 and abs(f[2] - far) < 8]
        if count:
            dur = {1: 2, 2: 1, 3: 0.5}[min(count, 3)]
        elif flag:
            dur = FLAGS[flag[0][0]]
        else:
            dur = base
        grace = all(h['grace'] for h in heads)
        out.append({'dir': 'up' if up else 'down', 'x': sx, 'heads': sorted(heads, key=lambda h: h['y']), 'dur': 0 if grace else dur,
                    'stem': stem, 'beams': count, 'grace': grace, 'grace_type': dur})
    # una cabeza con dos plicas es una sola nota: el puntillo y la duracion completa son de la voz mas larga
    for group in out:
        dotted = any(h['dot'] for h in group['heads'])
        longest = all(group['dur'] >= other['dur'] for other in out if any(h is g for h in group['heads'] for g in other['heads']))
        group['shared'] = [h for h in group['heads'] if any(h is g for other in out if other is not group for g in other['heads'])]
        group['dur'] = group['dur'] * (1.5 if dotted and longest else 1)
    return sorted(out, key=lambda g: g['x'])


def length_of(m):
    """Duracion total por direccion de plica y de los silencios."""
    sums = {'up': 0, 'down': 0}
    for g in stem_groups(m):
        sums[g['dir']] += g['dur']
    return sums


def mark_texts(system, words, lines):
    """«Fine» y «D.C.» del PDF -> marca del compas cuyo borde derecho queda mas cerca (o que los contiene)."""
    top, bottom = lines[0], lines[-1]
    space = (bottom - top) / 4
    for w in words:
        text = w[4].strip()
        if text not in ('Fine', 'D.C.', 'D.C') or not (top - 9 * space <= (w[1] + w[3]) / 2 <= bottom + 2 * space):
            continue
        if text == 'Fine' and any(o[4].strip() in ('D.C.', 'D.C') and abs(o[1] - w[1]) < 3 and 0 < w[0] - o[2] < 20 for o in words):
            continue  # «D.C. al Fine»: la palabra Fine acompana a D.C.
        cx = (w[0] + w[2]) / 2
        best = min(system['measures'], key=lambda m: min(abs(cx - m['left']), abs(cx - m['right']), 0 if m['left'] <= cx <= m['right'] else 1e9))
        best['fine' if text == 'Fine' else 'dc'] = True


def mark_ties(system, curves, lines):
    """Una ligadura de prolongacion es una curva corta entre dos cabezas de la misma altura: marca
    `tie_next` en la primera y `tie_prev` en la segunda. Las curvas largas son ligaduras de expresion."""
    top, bottom = lines[0], lines[-1]
    space = (bottom - top) / 4
    hw = space * 1.18
    heads = [h for m in system['measures'] for h in m['items']]
    for r in curves:
        if r.width > 60 * space or r.y0 < top - 10 * space or r.y1 > bottom + 10 * space:
            continue
        best = None
        for left in heads:
            if not (left['x'] - 1 <= r.x0 <= left['x'] + 2.2 * hw) or abs(left['y'] - (r.y0 + r.y1) / 2) > 2.5 * space:
                continue
            for right in heads:
                if right['pos'] != left['pos'] or right['x'] <= left['x'] + hw or not (right['x'] - 1.2 * hw <= r.x1 <= right['x'] + 1.5 * hw):
                    continue
                gap = abs(right['x'] - left['x'] - r.width)
                if best is None or gap < best[0]:
                    best = (gap, left, right)
        if best:
            best[1]['tie_next'] = True
            best[2]['tie_prev'] = True
