"""Nuevo metodo para guitarra de Aguado (1843): lecciones, ejercicios y estudios, del MusicXML a PDF y vistas del sitio.

    python scripts/aguado/build.py N [N ...]            # un MusicXML de sources/ -> downloads/ + vistas
    python scripts/aguado/build.py convert N [file.mscz]  # MuseScore -> sources/NN.musicxml

Usa el motor, el conversor de MuseScore y las rutinas de grabado de las piezas progresivas de Carcassi
(scripts/carcassi-progresivas/build.py y scripts/carcassi-preludios/extract.py).
"""
import json
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'carcassi-preludios'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'carcassi-progresivas'))
sys.path.insert(0, os.path.join(ROOT, 'backend', 'engine'))

import extract  # noqa: E402  (rutinas de grabado compartidas con los preludios)
import mscx_to_musicxml  # noqa: E402

AUTHOR = 'Dionisio Aguado'
SOURCES = os.path.join(HERE, 'sources')
OUT_DIR = os.path.join(ROOT, 'downloads', 'aguado')
PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', 'aguado')
PREFIX = 'aguado-'
# MuseScore de TabGuitar (no versionados): se copian a resources/ con su procedencia.
SOURCE_DIR = os.path.join(os.environ.get('RESOURCES_DIR', os.path.join(ROOT, 'resources')), 'aguado', 'nuevo-metodo', 'editables-tabguitar')
# Marcas de posicion, ceja y cifrado de la edicion de TabGuitar: no son texto de la pieza.
DROP_TEXTS = [r'Barr[ée]', r'C\.[IVX]+', r'Ceja', r'[IVX]+\s+[A-G][#b]?\d*']

with open(os.path.join(HERE, 'pieces.json'), encoding='utf-8') as f:
    PIECES = {int(k): v for k, v in json.load(f).items()}

# Compases por sistema de la vista previa (por defecto 4) y ajustes de pagina del PDF para las piezas largas.
PER_ROW = {}
PDF_OVERRIDES = {}
# Pagina virtual mas grande con escala menor (el PDF sigue midiendo lo mismo, como en los preludios
# largos): el grabado se achica y caben mas compases por sistema y mas sistemas por pagina. Se prueba de menos a mas
# reduccion y se queda con el primer nivel que ocupa menos paginas.
SCALES = [45, 41, 38, 35, 32, 30]  # la escala de Verovio es entera; 45 es la del motor

def zoom_options(scale):
    return {'scale': scale, 'pageWidth': round(2100 * 45 / scale), 'pageHeight': round(2970 * 45 / scale)}


def select():
    extract.EDITION = 'aguado'
    extract.OUT_DIR = OUT_DIR
    extract.PREVIEW_DIR = PREVIEW_DIR
    extract.PAGES_DIR = os.path.join(PREVIEW_DIR, 'full')
    extract.SCORE_PREFIX = PREFIX
    extract.PDF_OVERRIDES = PDF_OVERRIDES


def name_of(number):
    """(en, es) del titulo: «Lesson 14: Waltz in G» / «Lección 14: Vals en Sol»."""
    piece = PIECES[number]
    label = {'lesson': ('Lesson', 'Lección'), 'righthand': ('Right Hand Exercises', 'Ejercicios de mano derecha'),
             'study': ('Study', 'Estudio')}[piece['kind']]
    en, es = f"{label[0]} {piece['n']}", f"{label[1]} {piece['n']}"
    if piece.get('form'):
        en, es = f"{en}: {piece['form']}", f"{es}: {piece['es']}"
    return en, es


def title_of(number):
    return name_of(number)[0]


def file_base(number):
    return f"{title_of(number).replace(': ', ' - ')} - {AUTHOR}"


def convert(number, mscz=None):
    os.makedirs(SOURCES, exist_ok=True)
    target = os.path.join(SOURCES, f'{number:02d}.musicxml')
    piece = PIECES[number]
    mscz = mscz or os.path.join(SOURCE_DIR, piece['source'])
    xml = mscx_to_musicxml.Converter(mscx_to_musicxml.read_mscx(mscz), title_of(number), composer=AUTHOR,
                                     words=[tuple(w) for w in piece.get('words', [])], tempo=piece.get('tempo'),
                                     ignore_marks=piece.get('ignore_marks', False), texts=piece.get('texts'),
                                     drop_texts=DROP_TEXTS, halve=piece.get('halve', False)).convert()
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
        result = tabify.prepare(source, 'musicxml', 'standard', prepared, per_row=PER_ROW.get(number, 4))
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
    if args and args[0] == 'convert':
        convert(int(args[1]), args[2] if len(args) > 2 else None)
    else:
        for n in args:
            build(int(n))
