"""120 ejercicios de arpegio de Giuliani (Op. 1, parte 1): del MusicXML a PDF y vistas del sitio.

    python scripts/giuliani-arpegios/build.py N [N ...]    # un MusicXML de sources/ (ver transcribe.py) -> downloads/ + vistas
    python scripts/giuliani-arpegios/build.py all          # los 120

Usa el mismo motor y las mismas rutinas de grabado que los preludios (scripts/carcassi-preludios/extract.py):
notacion y TAB del motor, PDF de A4, vista previa del primer sistema y paginas SVG para el modal.
"""
import json
from contextlib import contextmanager
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'carcassi-preludios'))
sys.path.insert(0, os.path.join(ROOT, 'backend', 'engine'))

import extract  # noqa: E402  (rutinas de grabado compartidas con los preludios)
import pdf_footer  # noqa: E402

AUTHOR = 'Mauro Giuliani'
COUNT = 120
# La edicion de origen es de dominio publico (CC0 1.0): el credito es cortesia, no obligacion.
FOOTER_LINES = [[('Con modificaciones a partir de', None)],
                [('Marieh (2020)', 'https://imslp.org/wiki/Studio_per_la_chitarra,_Op.1_(Giuliani,_Mauro)'), (' · ', None),
                 ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/')]]
SOURCES = os.path.join(HERE, 'sources')
OUT_DIR = os.path.join(ROOT, 'downloads', 'giuliani-arpegios')
PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', 'giuliani-arpegios')
PREFIX = 'arpeggio-'

PER_ROW = {}
PDF_OVERRIDES = {}
# Ejercicios en que las reglas de arpegio del motor contradicen la TAB impresa de la edicion (cambian el mi5 repetido a la
# 2.a cuerda, traste 5): su fuente lleva las casillas impresas como <string>/<fret> (ver transcribe.py) y no se aplican
# las reglas, para que el motor las respete.
PRINTED_TAB = {96, 100, 110}
# Todos los demas son arpegios: el motor aplica las reglas de cuerdas de backend/engine/fingering.py.
ARPEGGIO = set(range(1, COUNT + 1)) - PRINTED_TAB
# Pagina virtual mas grande con escala menor, como en las demas colecciones: se prueba de menos a mas reduccion y se
# queda con el primer nivel que ocupa menos paginas.
SCALES = [45, 41, 38, 35]


def zoom_options(scale):
    return {'scale': scale, 'pageWidth': round(2100 * 45 / scale), 'pageHeight': round(2970 * 45 / scale)}


def select():
    extract.EDITION = 'giuliani-arpegios'
    extract.OUT_DIR = OUT_DIR
    extract.PREVIEW_DIR = PREVIEW_DIR
    extract.PAGES_DIR = os.path.join(PREVIEW_DIR, 'full')
    extract.SCORE_PREFIX = PREFIX
    extract.PDF_OVERRIDES = PDF_OVERRIDES


def title_of(number):
    return f'Arpeggio Exercise {number}'


def file_base(number):
    return f'Arpeggio Exercise {number:03d} - {AUTHOR}'


@contextmanager
def reviewed_tuplets(tabify, number):
    """El 34 tiene grupos completos de valores mixtos que el reparador de OMR deshace.

    Cuenta cabezas, no duraciones: ocho notas no son un multiplo de seis.
    Conservar la fuente revisada tanto al preparar como al releer para exportar.
    """
    original = tabify.repair_orphan_tuplets
    try:
        if number == 34:
            tabify.repair_orphan_tuplets = lambda root: False
        yield
    finally:
        tabify.repair_orphan_tuplets = original


def build(number):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject
    import tabify

    select()
    source = os.path.join(SOURCES, f'{number:03d}.musicxml')
    if not os.path.exists(source):
        raise SystemExit(f'falta la fuente: {source}')
    base_options = dict(tabify.PDF_OPTIONS)
    tabify.KEEP_TEXT = True
    with reviewed_tuplets(tabify, number), tempfile.TemporaryDirectory() as tmp:
        extract.patch_engine(tabify)
        prepared = os.path.join(tmp, 'prepared')
        result = tabify.prepare(source, 'musicxml', 'standard', prepared, per_row=PER_ROW.get(number, 4), arpeggio='auto' if number in ARPEGGIO else False)
        if result['dropped']:
            raise RuntimeError(f"Notas descartadas en el ejercicio {number}: {result['dropped']}")
        with open(os.path.join(prepared, tabify.SUGGESTION_NAME), encoding='utf-8') as f:
            suggestion = json.load(f)
        tabs = suggestion['tabs']
        best = None
        for level in ([PDF_OVERRIDES[number]] if number in PDF_OVERRIDES else [zoom_options(sc) for sc in SCALES]):
            tabify.PDF_OPTIONS = {**base_options, **level}
            exported = os.path.join(tmp, f"export-{level['scale']}")
            tabify.export(os.path.join(prepared, tabify.NORMALIZED_NAME), os.path.join(prepared, tabify.SUGGESTION_NAME),
                          tabs, 'standard', exported, title=title_of(number), subtitle=AUTHOR)
            pages = len(PdfReader(os.path.join(exported, 'score.pdf')).pages)
            if best is None or pages < best[0]:
                best = (pages, level, exported)
            if pages == 1:
                break
        _, level, exported = best
        PDF_OVERRIDES[number] = level
        extract.write_preview(number, prepared, exported)
        with open(os.path.join(exported, 'score.musicxml'), encoding='utf-8') as f:
            xml = f.read()
        extract.write_pages(number, xml)
        os.makedirs(OUT_DIR, exist_ok=True)
        base = os.path.join(OUT_DIR, file_base(number))
        # Sin bloque de codificacion: ni programa, ni fechas, ni notas del procesado intermedio.
        xml = re.sub(r'\s*<encoding>.*?</encoding>', '', xml, flags=re.S)
        with open(base + '.musicxml', 'w', encoding='utf-8') as f:
            f.write(xml)
        writer = PdfWriter(clone_from=PdfReader(os.path.join(exported, 'score.pdf')))
        pdf_footer.stamp_footer(writer, FOOTER_LINES)
        writer.add_metadata({'/Title': title_of(number), '/Author': AUTHOR})
        for key in ('/Producer', '/Creator', '/CreationDate', '/ModDate'):
            writer._info.get_object().pop(NameObject(key), None)
        with open(base + '.pdf', 'wb') as f:
            writer.write(f)
    print('salida:', base + '.pdf')


if __name__ == '__main__':
    args = sys.argv[1:]
    numbers = range(1, COUNT + 1) if args == ['all'] else [int(a) for a in args]
    for n in numbers:
        build(n)
