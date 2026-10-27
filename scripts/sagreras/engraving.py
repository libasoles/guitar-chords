"""Ajustes de grabado para los tresillos de acompañamiento de Sagreras."""
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

    def drop_tab_mark(match):
        identifier = re.search(r'\bid="([^"]+)"', match[0])
        return '' if identifier and identifier[1] in tab_marks else match[0]

    svg = re.sub(r'<g\b[^>]*class="tuplet(?:Bracket|Num)"[^>]*>.*?</g>',
                 drop_tab_mark, svg, flags=re.S)
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


def separate_rests(svg):
    """Subir el silencio de la voz superior cuando coincide con el de la voz inferior.

    Verovio dibuja los silencios de ambas voces en el mismo punto cuando una cabeza
    comparte el ataque. El de la voz superior sube dos interlíneas (180 unidades cada una).
    """
    root = ET.fromstring(svg)
    shifts = {}
    for measure in root.findall('.//s:g[@class="measure"]', NS):
        staff = measure.find('s:g[@class="staff"]', NS)
        layers = [[(g.get('id'), tuple(map(float, re.search(r'translate\(([^)]+)\)', g.find('s:use', NS).attrib['transform'])[1].split(','))))
                   for g in layer.findall('s:g[@class="rest"]', NS)]
                  for layer in staff.findall('s:g[@class="layer"]', NS)]
        for rest in layers[:1]:
            others = [point for layer in layers[1:] for _, point in layer]
            for identifier, (x, y) in rest:
                if any(abs(x - ox) < 50 and abs(y - oy) < 360 for ox, oy in others):
                    shifts[identifier] = -360

    def move(match):
        identifier = re.search(r'\bid="([^"]+)"', match[0])
        shift = shifts.get(identifier[1]) if identifier else None
        return match[0][:-1] + f' transform="translate(0, {shift})">' if shift else match[0]

    return re.sub(r'<g\b[^>]*class="rest"[^>]*>', move, svg)
