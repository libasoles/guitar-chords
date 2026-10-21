"""Primeras lecciones de guitarra de Sagreras: del MusicXML a PDF y vistas del sitio.

    python scripts/sagreras/build.py N [N ...]    # un MusicXML de sources/ (ver transcribe.py) -> downloads/ + vistas

Usa el mismo motor y las mismas rutinas de grabado que los preludios (scripts/carcassi-preludios/extract.py):
notacion y TAB del motor, PDF de A4, vista previa del primer sistema y paginas SVG para el modal.
"""
import json
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'carcassi-preludios'))
sys.path.insert(0, os.path.join(ROOT, 'backend', 'engine'))

import extract  # noqa: E402  (rutinas de grabado compartidas con los preludios)

AUTHOR = 'Julio Salvador Sagreras'
SOURCES = os.path.join(HERE, 'sources')
OUT_DIR = os.path.join(ROOT, 'downloads', 'sagreras-lecciones')
PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', 'sagreras-lecciones')
PREFIX = 'lesson-'

# Compases por sistema de la vista previa (por defecto 4) y ajustes de pagina del PDF para las piezas largas.
PER_ROW = {}
PDF_OVERRIDES = {}
# Piezas a las que se aplican las reglas de arpegio del motor (backend/engine/fingering.py): el motor detecta los
# compases de arpegio de cada una, y los demas quedan como los digita el Viterbi. Vacio: ninguna.
ARPEGGIO = set()
# Pagina virtual mas grande con escala menor (el PDF sigue midiendo lo mismo, como en los preludios
# largos): el grabado se achica y caben mas compases por sistema y mas sistemas por pagina. Se prueba de menos a mas
# reduccion y se queda con el primer nivel que ocupa menos paginas.
SCALES = [45, 41, 38, 35, 32, 30]  # la escala de Verovio es entera; 45 es la del motor

def zoom_options(scale):
    return {'scale': scale, 'pageWidth': round(2100 * 45 / scale), 'pageHeight': round(2970 * 45 / scale)}


def select():
    extract.EDITION = 'sagreras'
    extract.OUT_DIR = OUT_DIR
    extract.PREVIEW_DIR = PREVIEW_DIR
    extract.PAGES_DIR = os.path.join(PREVIEW_DIR, 'full')
    extract.SCORE_PREFIX = PREFIX
    extract.PDF_OVERRIDES = PDF_OVERRIDES


def title_of(number):
    return f'Lesson {number}'


def file_base(number):
    return f'Lesson {number:02d} - {AUTHOR}'


def build(number):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject
    import tabify

    select()
    source = os.path.join(SOURCES, f'{number:02d}.musicxml')
    if not os.path.exists(source):
        raise SystemExit(f'falta la fuente: {source}')
    base_options = dict(tabify.PDF_OPTIONS)
    tabify.KEEP_TEXT = True  # tempo, Fine y D.C. se imprimen
    with tempfile.TemporaryDirectory() as tmp:
        extract.patch_engine(tabify)
        prepared = os.path.join(tmp, 'prepared')
        result = tabify.prepare(source, 'musicxml', 'standard', prepared, per_row=PER_ROW.get(number, 4), arpeggio='auto' if number in ARPEGGIO else False)
        if result['dropped']:
            raise RuntimeError(f"Notas descartadas en la pieza {number}: {result['dropped']}")
        with open(os.path.join(prepared, tabify.SUGGESTION_NAME), encoding='utf-8') as f:
            suggestion = json.load(f)
        tabs = suggestion['tabs']
        # El primer nivel (el menos compacto) con el que el PDF ocupa menos paginas.
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
        writer.add_metadata({'/Title': title_of(number), '/Author': AUTHOR})
        for key in ('/Producer', '/Creator', '/CreationDate', '/ModDate'):
            writer._info.get_object().pop(NameObject(key), None)
        with open(base + '.pdf', 'wb') as f:
            writer.write(f)
    print('salida:', base + '.pdf')


if __name__ == '__main__':
    args = sys.argv[1:]
    for n in args:
        build(int(n))
