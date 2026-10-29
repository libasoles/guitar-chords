"""Ajustes de grabado sobre el SVG de Verovio: tresillos, silencios y cejillas.

Copia independiente de `scripts/sagreras/engraving.py` (el motor corre en su propia imagen). Se aplican a toda
vista previa y a cada pagina del PDF: solo mueven lo que choca, asi que son inocuos en el resto.
"""
import math
import re
import xml.etree.ElementTree as ET

NS = {'s': 'http://www.w3.org/2000/svg'}


def clear_triplets(svg):
    """Elevar cada corchete y su cifra por encima de todas las voces que abarca.

    Verovio coloca los tresillos de la voz de acompañamiento sin reservar espacio
    para las plicas ascendentes de la melodía. Las coordenadas son unidades de
    grabado de Verovio: 180 por interlínea, con 90 de separación adicional.
    """
    root = ET.fromstring(svg)
    shifts = {}
    tab_marks = {g.get('id', g.get('data-id'))
                 for measure in root.findall('.//s:g[@class="measure"]', NS)
                 for staff in measure.findall('s:g[@class="staff"]', NS)[1:]
                 for g in staff.findall('.//s:g', NS)
                 if g.get('class') in ('tupletBracket', 'tupletNum')}
    top = 0
    dir_shifts = {}
    for measure in root.findall('.//s:g[@class="measure"]', NS):
        staff = measure.find('s:g[@class="staff"]', NS)
        tuplet_top = None
        stems = [tuple(map(float, re.findall(r'-?[\d.]+', p.attrib['d'])))
                 for p in staff.findall('.//s:g[@class="stem"]/s:path', NS)]
        heads = [tuple(map(float, re.search(r'translate\(([^)]+)\)', u.attrib['transform'])[1].split(',')))
                 for u in staff.findall('.//s:g[@class="notehead"]/s:use', NS)]
        for tuplet in staff.findall('.//s:g[@class="tuplet"]', NS):
            bracket = tuplet.find('s:g[@class="tupletBracket"]', NS)
            number = tuplet.find('s:g[@class="tupletNum"]', NS)
            if bracket is None or number is None:
                continue
            points = [tuple(map(float, pair.split(','))) for line in bracket
                      for pair in line.attrib['points'].split()]
            left, right = min(x for x, _ in points), max(x for x, _ in points)
            obstacles = [min(y1, y2) for x1, y1, x2, y2 in stems if left <= x1 <= right]
            # Una cabeza que empieza justo antes del corchete también puede tocarlo.
            obstacles += [y - 100 for x, y in heads if left - 226 <= x <= right]
            if not obstacles:
                continue
            shift = min(0, math.floor(min(obstacles) - 90 - max(y for _, y in points)))
            baseline = float(re.search(r'translate\([^,]+,\s*(-?[\d.]+)', number[0].attrib['transform'])[1])
            tuplet_top = min(tuplet_top if tuplet_top is not None else math.inf, baseline + shift - 250,
                             min(y for _, y in points) + shift)
            if shift:
                shifts[bracket.get('id', bracket.get('data-id'))] = shift
                shifts[number.get('id', number.get('data-id'))] = shift
                top = min(top, baseline + shift - 250)
        # El indicador de cejilla («C 3» y su línea punteada) va por encima de los tresillos.
        span_group = measure.find('s:g[@class="bracketSpan"]', NS)
        span = span_group.find('s:path', NS) if span_group is not None else None
        label = measure.find('s:g[@class="dir"]', NS)
        if tuplet_top is not None and span is not None and label is not None:
            line_y = float(re.search(r'M[\d.]+ (-?[\d.]+)', span.attrib['d'])[1])
            lift = min(0, math.floor(tuplet_top - 90 - line_y))
            if lift:
                dir_shifts[label.get('id')] = dir_shifts[span_group.get('id')] = lift
                top = min(top, float(label.find('s:text', NS).get('y')) + lift - 405)

    shifts.update(dir_shifts)

    def move(match):
        tag = match[0]
        identifier = re.search(r'\bid="([^"]+)"', tag)
        shift = shifts.get(identifier[1]) if identifier else None
        return tag[:-1] + f' transform="translate(0, {shift})">' if shift else tag

    def drop_tab_marks(svg):
        """Quitar los tresillos de la TAB; un grupo puede traer otros dentro, así que se cuentan las llaves."""
        out, position = [], 0
        for match in re.finditer(r'<g\b[^>]*class="tuplet(?:Bracket|Num)"[^>]*>', svg):
            identifier = re.search(r'\bid="([^"]+)"', match[0])
            if match.start() < position or not identifier or identifier[1] not in tab_marks:
                continue
            end, depth = match.end(), 0 if match[0].endswith('/>') else 1
            for tag in re.finditer(r'<g\b[^>]*[^/]>|</g>', svg[match.end():]) if depth else ():
                depth += -1 if tag[0] == '</g>' else 1
                if depth == 0:
                    end = match.end() + tag.end()
                    break
            out.append(svg[position:match.start()])
            position = end
        return ''.join(out) + svg[position:]

    svg = drop_tab_marks(svg)
    svg = re.sub(r'<g\b[^>]*>', move, svg)
    # La vista previa empieza cerca de y=0: reservar aire para las cifras elevadas.
    if top < 0:
        margin = re.search(r'class="page-margin" transform="translate\(([^,]+),\s*(-?[\d.]+)\)"', svg)
        padding = max(0, math.ceil(90 - top - float(margin[2])))
        if padding:
            svg = svg.replace(margin[0], f'class="page-margin" transform="translate({margin[1]}, {float(margin[2]) + padding:g})"', 1)
            boxes = list(re.finditer(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg))[:2]
            outer, inner = boxes
            scale = float(outer[1]) / float(inner[1])
            for box, extra in reversed([(outer, math.ceil(padding * scale)), (inner, padding)]):
                svg = svg[:box.start()] + f'viewBox="0 0 {box[1]} {float(box[2]) + extra:g}"' + svg[box.end():]
    return svg


# Media altura de cada silencio más el aire necesario hasta la cabeza vecina (unidades de Verovio).
REST_HALF = {'E4E5': 240, 'E4E6': 165, 'E4E7': 190}
HEAD_GAP = 120
SIDE_PENALTY = 1200  # las voces extremas no cruzan a la otra: la superior sube y la inferior baja


def clear_rests(svg):
    """Mover cada silencio de corchea o negra fuera de las cabezas y silencios de otras voces.

    Verovio coloca el silencio de una voz interior a una altura fija y lo encima con la cabeza
    de la voz de arriba (o con el silencio de otra voz). Cada silencio busca la posición libre
    más cercana: de arriba abajo por voces, la superior prefiere subir y la inferior bajar.
    """
    root = ET.fromstring(svg)
    shifts = {}
    xlink = '{http://www.w3.org/1999/xlink}href'

    def point(g):
        use = g.find('.//s:use', NS)
        return use.attrib.get(xlink, '')[1:5], *map(float, re.search(r'translate\(([^)]+)\)', use.attrib['transform'])[1].split(','))

    for measure in root.findall('.//s:g[@class="measure"]', NS):
        staff = measure.find('s:g[@class="staff"]', NS)
        layers = staff.findall('s:g[@class="layer"]', NS)
        heads = [(i, *point(g)[1:]) for i, layer in enumerate(layers) for g in layer.findall('.//s:g[@class="notehead"]', NS)]
        stems = [(i, *map(float, re.findall(r'-?[\d.]+', p.attrib['d']))) for i, layer in enumerate(layers)
                 for p in layer.findall('.//s:g[@class="stem"]/s:path', NS)]
        rests = [(i, g.get('id'), *point(g)) for i, layer in enumerate(layers) for g in layer.findall('s:g[@class="rest"]', NS)]
        placed = []  # (capa, y, media altura) de los silencios ya colocados, de la voz inferior a la superior
        for i, identifier, glyph, x, y in sorted(rests, key=lambda r: -r[0]):
            half = REST_HALF.get(glyph)
            if half is None:
                continue
            # Cada obstáculo es un tramo vertical (arriba, abajo) y el aire que el silencio necesita a cada lado.
            obstacles = [(hy, hy, 90 + half + 30) for j, hx, hy in heads if j != i and abs(hx - x) < 150]
            obstacles += [(min(y1, y2), max(y1, y2), half + 30) for j, sx, y1, sx2, y2 in stems if j != i and -60 < sx - x < 130]
            obstacles += [(py, py, ph + half + 40) for j, px, py, ph in placed if j != i and abs(px - x) < 50]
            candidates = [y] + [edge for lo, hi, gap in obstacles for edge in (lo - gap, hi + gap)]
            free = [c for c in candidates if all(c <= lo - gap + 1 or c >= hi + gap - 1 for lo, hi, gap in obstacles)]
            if not free:
                continue

            def cost(c):
                bias = SIDE_PENALTY if abs(c - y) > 150 and ((c > y and i == 0) or (c < y and i == len(layers) - 1 and len(layers) > 1)) else 0
                return abs(c - y) + bias
            target = min(free, key=cost)
            if target != y:  # entre dos obstáculos queda centrado, no pegado al más cercano
                above = [hi + gap for lo, hi, gap in obstacles if hi + gap <= target + 1]
                below = [lo - gap for lo, hi, gap in obstacles if lo - gap >= target - 1]
                if above and below:
                    target = (max(above) + min(below)) / 2
            placed.append((i, x, target, half))
            if target != y:
                shifts[identifier] = round(target - y)

    def move(match):
        identifier = re.search(r'\bid="([^"]+)"', match[0])
        shift = shifts.get(identifier[1]) if identifier else None
        return match[0][:-1] + f' transform="translate(0, {shift})">' if shift else match[0]

    return re.sub(r'<g\b[^>]*class="rest"[^>]*>', move, svg)


def barre_above_line(svg):
    """Poner el texto de la cejilla («C 2») encima de su línea punteada.

    Verovio lo deja debajo de la línea cuando hay tresillos en el compás. El texto queda
    a la misma distancia sobre la línea que en las piezas donde Verovio ya lo coloca arriba.
    """
    root = ET.fromstring(svg)
    moves = {}
    for measure in root.findall('.//s:g[@class="measure"]', NS):
        path = measure.find('s:g[@class="bracketSpan"]/s:path', NS)
        label = measure.find('s:g[@class="dir"]', NS)
        if path is None or label is None:
            continue
        line_y = float(re.search(r'M[\d.]+ (-?[\d.]+)', path.attrib['d'])[1])
        text = label.find('s:text', NS)
        if float(text.get('y')) > line_y - 100:
            moves[label.get('id')] = (text.get('y'), f'{line_y - 137:g}')

    def move(match):
        identifier = re.search(r'\bid="([^"]+)"', match[0])
        if not identifier or identifier[1] not in moves:
            return match[0]
        old, new = moves[identifier[1]]
        return match[0].replace(f'y="{old}"', f'y="{new}"', 1)

    return re.sub(r'<g\b[^>]*class="dir"[^>]*>\s*<text\b[^>]*>', move, svg)


def engrave(svg):
    """Todos los ajustes, en el orden que no se estorban: silencios, tresillos y cejillas."""
    return barre_above_line(clear_triplets(clear_rests(svg)))
