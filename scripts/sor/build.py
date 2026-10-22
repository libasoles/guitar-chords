"""Lecciones progresivas de Sor (Op. 60): del LilyPond de Mutopia a MusicXML, PDF y vistas del sitio.

    python scripts/sor/build.py N [N ...]    # sources/NN.musicxml -> downloads/ + vistas
    python scripts/sor/build.py convert N    # sources/sor_op60-NN.ly -> sources/NN.musicxml

Usa el motor y las rutinas de grabado de los preludios de Carcassi (scripts/carcassi-preludios/extract.py).
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
import ly_to_musicxml  # noqa: E402
import pdf_footer  # noqa: E402

AUTHOR = 'Fernando Sor'
MUTOPIA = 'https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF'


def footer_lines(number):
    """Credito a la edicion LilyPond de origen (Mutopia) y su licencia, en un pie gris a la izquierda de cada pagina."""
    piece = PIECES[number]
    return [[('Con modificaciones a partir de la edicion de ' + piece['editor'] + ' en Mutopia', MUTOPIA)],
            [('CC BY-SA ' + piece['license'], 'https://creativecommons.org/licenses/by-sa/%s/' % piece['license'])]]
SOURCES = os.path.join(HERE, 'sources')
OUT_DIR = os.path.join(ROOT, 'downloads', 'sor')
PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', 'sor')
PREFIX = 'sor-'

with open(os.path.join(HERE, 'pieces.json'), encoding='utf-8') as f:
    PIECES = {int(k): v for k, v in json.load(f).items()}

PER_ROW = {}
ARPEGGIO = set()
PDF_OVERRIDES = {}
SCALES = [45, 41, 38, 35, 32, 30]  # la escala de Verovio es entera; 45 es la del motor


def zoom_options(scale):
    return {'scale': scale, 'pageWidth': round(2100 * 45 / scale), 'pageHeight': round(2970 * 45 / scale)}


def select():
    extract.EDITION = 'sor'
    extract.OUT_DIR = OUT_DIR
    extract.PREVIEW_DIR = PREVIEW_DIR
    extract.PAGES_DIR = os.path.join(PREVIEW_DIR, 'full')
    extract.SCORE_PREFIX = PREFIX
    extract.PDF_OVERRIDES = PDF_OVERRIDES


def name_of(number):
    """(en, es) del titulo: «Lesson 1 in C Major» / «Lección 1 en Do mayor»."""
    piece = PIECES[number]
    return f"Lesson {piece['n']}: {piece['form']}", f"Lección {piece['n']}: {piece['es']}"


def title_of(number):
    return name_of(number)[0]


def file_base(number):
    return f"{title_of(number).replace(': ', ' - ')} - {AUTHOR}"


def convert(number):
    piece = PIECES[number]
    source = os.path.join(SOURCES, piece['source'])
    xml = ly_to_musicxml.convert(source, title_of(number), AUTHOR, words=piece.get('words'))
    target = os.path.join(SOURCES, f'{number:02d}.musicxml')
    with open(target, 'w', encoding='utf-8') as f:
        f.write(xml)
    print('fuente:', target)


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
        pdf_footer.stamp_footer(writer, footer_lines(number))
        writer.add_metadata({'/Title': title_of(number), '/Author': AUTHOR})
        for key in ('/Producer', '/Creator', '/CreationDate', '/ModDate'):
            writer._info.get_object().pop(NameObject(key), None)
        with open(base + '.pdf', 'wb') as f:
            writer.write(f)
    print('salida:', base + '.pdf')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == 'convert':
        convert(int(args[1]))
    else:
        for n in args:
            build(int(n))
