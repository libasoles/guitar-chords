"""Tercera Parte del Metodo de Carcassi (Op. 59): piezas progresivas, del MusicXML a PDF y vistas del sitio.

    python scripts/carcassi-progresivas/build.py N [N ...]          # un MusicXML de sources/ -> downloads/ + vistas
    python scripts/carcassi-progresivas/build.py convert N file.mscz  # MuseScore -> sources/NN.musicxml

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
import mscx_to_musicxml  # noqa: E402

AUTHOR = 'Matteo Carcassi'
SOURCES = os.path.join(HERE, 'sources')
OUT_DIR = os.path.join(ROOT, 'downloads', 'carcassi-progresivas')
PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', 'carcassi-progresivas')
PREFIX = 'progressive-'

with open(os.path.join(HERE, 'pieces.json'), encoding='utf-8') as f:
    PIECES = {int(k): v for k, v in json.load(f).items()}

# Compases por sistema de la vista previa (por defecto 4) y ajustes de pagina del PDF para las piezas largas.
PER_ROW = {}
PDF_OVERRIDES = {}
# Piezas de arpegios a las que se aplican las reglas de cuerdas de los preludios (ver extract.avoid_repeated_strings).
ARPEGGIO = set()


def select():
    extract.EDITION = 'progresivas'
    extract.OUT_DIR = OUT_DIR
    extract.PREVIEW_DIR = PREVIEW_DIR
    extract.PAGES_DIR = os.path.join(PREVIEW_DIR, 'full')
    extract.SCORE_PREFIX = PREFIX
    extract.PDF_OVERRIDES = PDF_OVERRIDES


def title_of(number):
    return f"Progressive Piece {number}: {PIECES[number]['form']}"


def file_base(number):
    return f"Progressive Piece {number} - {PIECES[number]['form']} - {AUTHOR}"


def convert(number, mscz):
    os.makedirs(SOURCES, exist_ok=True)
    target = os.path.join(SOURCES, f'{number:02d}.musicxml')
    piece = PIECES[number]
    xml = mscx_to_musicxml.Converter(mscx_to_musicxml.read_mscx(mscz), title_of(number),
                                     words=[tuple(w) for w in piece.get('words', [])], tempo=piece.get('tempo')).convert()
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
    tabify.PDF_OPTIONS = {**tabify.PDF_OPTIONS, **PDF_OVERRIDES.get(number, {})}
    tabify.KEEP_TEXT = True  # tempo, Fine y D.C. se imprimen
    with tempfile.TemporaryDirectory() as tmp:
        extract.patch_engine(tabify)
        prepared = os.path.join(tmp, 'prepared')
        result = tabify.prepare(source, 'musicxml', 'standard', prepared, per_row=PER_ROW.get(number, 4))
        if result['dropped']:
            raise RuntimeError(f"Notas descartadas en la pieza {number}: {result['dropped']}")
        with open(os.path.join(prepared, tabify.SUGGESTION_NAME), encoding='utf-8') as f:
            suggestion = json.load(f)
        tabs = suggestion['tabs']
        if number in ARPEGGIO:
            tabs = extract.avoid_repeated_strings(tabs, tabify.open_midis(tabify.STANDARD_TUNING))
        exported = os.path.join(tmp, 'export')
        tabify.export(os.path.join(prepared, tabify.NORMALIZED_NAME), os.path.join(prepared, tabify.SUGGESTION_NAME),
                      tabs, 'standard', exported, title=title_of(number), subtitle=AUTHOR)
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
    if args and args[0] == 'convert':
        convert(int(args[1]), args[2])
    else:
        for n in args:
            build(int(n))
