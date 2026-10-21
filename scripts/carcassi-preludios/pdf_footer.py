"""Pie de atribucion de los PDF: lineas grises en sans, a la izquierda de cada pagina, con enlaces.

Cada linea es una lista de (texto, url o None). Lo usan las colecciones cuya fuente pide o merece credito
(Aguado: TabGuitar; Sagreras: Marieh, CC BY-NC 4.0).
"""
SIZE = 7
GRAY = 0.45  # se ve al imprimir sin competir con la partitura
LEFT = 54  # margen izquierdo de los sistemas
BASELINE = 36  # linea de abajo; las de arriba van una interlinea mas arriba


def text_width(text):
    try:
        from pypdf._codecs.core_font_metrics import CORE_FONT_METRICS
        widths = CORE_FONT_METRICS['Helvetica'].character_widths
        return sum(widths.get(c, 500) for c in text) * SIZE / 1000
    except (ImportError, KeyError):
        return len(text) * 0.5 * SIZE


def stamp_footer(writer, lines):
    """Estampa `lines` en Helvetica (fuente estandar, sin incrustar) con enlaces en cada pagina de `writer`."""
    from pypdf.generic import (ArrayObject, DecodedStreamObject, DictionaryObject, FloatObject, NameObject,
                               NumberObject, TextStringObject)
    font = writer._add_object(DictionaryObject({
        NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
        NameObject('/BaseFont'): NameObject('/Helvetica'), NameObject('/Encoding'): NameObject('/WinAnsiEncoding')}))
    leading = SIZE * 1.3
    ops, links = [f'{GRAY} g', 'BT', f'/FtAttr {SIZE} Tf'], []
    for row, line in enumerate(lines):
        y = BASELINE + (len(lines) - 1 - row) * leading
        x = LEFT
        for text, uri in line:
            escaped = text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
            ops.append(f'1 0 0 1 {x:.2f} {y:.2f} Tm ({escaped}) Tj')
            width = text_width(text)
            if uri:
                links.append((x, y - 2, x + width, y + SIZE, uri))
            x += width
    ops.append('ET')
    content = '\n'.join(ops).encode('latin-1')
    for page in writer.pages:
        stream = DecodedStreamObject()
        stream.set_data(b'q\n' + content + b'\nQ')
        page_contents = page.get_contents()
        data = page_contents.get_data() if page_contents is not None else b''
        before = DecodedStreamObject()
        before.set_data(b'q\n' + data + b'\nQ')  # lo que deje abierto la pagina no afecta al pie
        page[NameObject('/Contents')] = ArrayObject([writer._add_object(before), writer._add_object(stream)])
        resources = page['/Resources']
        fonts = resources.setdefault(NameObject('/Font'), DictionaryObject())
        fonts[NameObject('/FtAttr')] = font
        annots = page.setdefault(NameObject('/Annots'), ArrayObject())
        for x0, y0, x1, y1, uri in links:
            annots.append(writer._add_object(DictionaryObject({
                NameObject('/Type'): NameObject('/Annot'), NameObject('/Subtype'): NameObject('/Link'),
                NameObject('/Rect'): ArrayObject([FloatObject(v) for v in (x0, y0, x1, y1)]),
                NameObject('/Border'): ArrayObject([NumberObject(0), NumberObject(0), NumberObject(0)]),
                NameObject('/A'): DictionaryObject({
                    NameObject('/S'): NameObject('/URI'), NameObject('/URI'): TextStringObject(uri)})})))
