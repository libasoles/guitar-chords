"""Partituras de Sor (lecciones del Op. 60, estudios de los Op. 6 y Op. 35): del LilyPond de Mutopia a MusicXML, PDF y
vistas del sitio.

    python scripts/sor/build.py [coleccion] N [N ...]    # sources/NN.musicxml -> downloads/ + vistas
    python scripts/sor/build.py [coleccion] convert N    # el .ly de sources/ -> sources/NN.musicxml

La coleccion es `lecciones` (por defecto; N = numero de la leccion) o `estudios` (N = opus * 100 + numero: 601 es el
Op. 6 n.º 1, 3524 el Op. 35 n.º 24).

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
    credit = [('Con modificaciones a partir de la edicion de ' + piece['editor'] + ' en Mutopia', MUTOPIA)]
    if 'credit' in piece:  # transcrita a mano de un escaneo de dominio publico (IMSLP)
        credit = [(piece['credit'], piece['credit_url'])]
    if piece['license'] == 'public-domain':
        return [credit, [('Dominio publico', None)]]
    return [credit, [('CC BY-SA ' + piece['license'], 'https://creativecommons.org/licenses/by-sa/%s/' % piece['license'])]]


COLLECTIONS = {
    'lecciones': {'catalog': 'pieces.json', 'sources': 'sources', 'out': 'sor', 'prefix': 'sor-'},
    'estudios': {'catalog': 'estudios.json', 'sources': os.path.join('sources', 'estudios'), 'out': 'sor-estudios',
                 'prefix': 'sor-est-'},
}
COLLECTION = 'lecciones'
SOURCES = OUT_DIR = PREVIEW_DIR = PREFIX = PIECES = None


def use(name):
    """Elige la coleccion con la que trabajan las demas funciones."""
    global COLLECTION, SOURCES, OUT_DIR, PREVIEW_DIR, PREFIX, PIECES
    config = COLLECTIONS[name]
    COLLECTION = name
    SOURCES = os.path.join(HERE, config['sources'])
    OUT_DIR = os.path.join(ROOT, 'downloads', config['out'])
    PREVIEW_DIR = os.path.join(ROOT, 'src', 'site', 'articles', config['out'])
    PREFIX = config['prefix']
    with open(os.path.join(HERE, config['catalog']), encoding='utf-8') as f:
        PIECES = {int(k): v for k, v in json.load(f).items()}


use('lecciones')

PER_ROW = {}
ARPEGGIO = set()
PDF_OVERRIDES = {}
SCALES = [45, 41, 38, 35]  # la escala de Verovio es entera; 45 es la del motor; con menos de 35 lo impreso es ilegible
# Escala minima de los estudios: por debajo el PDF mete demasiados compases por renglon y la TAB queda apretada, asi que
# se prefieren mas paginas. `min_scale` en el catalogo la baja o la sube para una pieza.
MIN_SCALE = {'lecciones': 0, 'estudios': 45}


def zoom_options(scale):
    return {'scale': scale, 'pageWidth': round(2100 * 45 / scale), 'pageHeight': round(2970 * 45 / scale)}


def select():
    extract.EDITION = os.path.basename(OUT_DIR)
    extract.OUT_DIR = OUT_DIR
    extract.PREVIEW_DIR = PREVIEW_DIR
    extract.PAGES_DIR = os.path.join(PREVIEW_DIR, 'full')
    extract.SCORE_PREFIX = PREFIX
    extract.PDF_OVERRIDES = PDF_OVERRIDES


def name_of(number):
    """(en, es) del titulo: «Lesson 4: E-flat Major» / «Lección 4: Mi bemol mayor» o «Op. 35 No. 4: G Major»."""
    piece = PIECES[number]
    if COLLECTION == 'estudios':
        return (f"Op. {piece['opus']} No. {piece['n']}: {piece['form']}",
                f"Op. {piece['opus']} n.º {piece['n']}: {piece['es']}")
    return f"Lesson {piece['n']}: {piece['form']}", f"Lección {piece['n']}: {piece['es']}"


def title_of(number):
    # Las lecciones se graban en español, tanto en el visor como en el PDF.
    return name_of(number)[1 if COLLECTION == 'lecciones' else 0]


def file_base(number):
    return f"{name_of(number)[0].replace(': ', ' - ')} - {AUTHOR}"


def convert(number):
    piece = PIECES[number]
    source = os.path.join(SOURCES, piece['source'])
    xml = ly_to_musicxml.convert(source, title_of(number), AUTHOR, words=piece.get('words'), patches=piece.get('patches', ()), tie_dirs=piece.get('tie_dirs', False), string_hints=piece.get('string_hints', False))
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
    tabify.MERGE_UNISONS = True  # la misma altura en dos voces a la vez es una sola nota en la TAB
    with tempfile.TemporaryDirectory() as tmp:
        extract.patch_engine(tabify)
        prepared = os.path.join(tmp, 'prepared')
        result = tabify.prepare(source, 'musicxml', PIECES[number].get('tuning', 'standard'), prepared, per_row=PER_ROW.get(number, 4), arpeggio='auto' if number in ARPEGGIO else False)
        if result['dropped']:
            raise RuntimeError(f"Notas descartadas en la pieza {number}: {result['dropped']}")
        with open(os.path.join(prepared, tabify.SUGGESTION_NAME), encoding='utf-8') as f:
            suggestion = json.load(f)
        tabs = suggestion['tabs']
        # `tab_fixes` del catalogo: compas (desde 1) -> columnas de la TAB que se conservan en vez de las del motor.
        for bar, columns in PIECES[number].get('tab_fixes', {}).items():
            tabs[int(bar) - 1] = columns
        # El primer nivel (el menos compacto) con el que el PDF ocupa menos paginas.
        # `min_scale` del catalogo corta la busqueda: antes que encoger el grabado hasta que sea ilegible, mas paginas.
        best = None
        for level in ([PDF_OVERRIDES[number]] if number in PDF_OVERRIDES else [zoom_options(sc) for sc in SCALES if sc >= PIECES[number].get('min_scale', MIN_SCALE[COLLECTION])]):
            tabify.PDF_OPTIONS = {**base_options, **level}
            exported = os.path.join(tmp, f"export-{level['scale']}")
            tabify.export(os.path.join(prepared, tabify.NORMALIZED_NAME), os.path.join(prepared, tabify.SUGGESTION_NAME),
                          tabs, PIECES[number].get('tuning', 'standard'), exported, title=title_of(number), subtitle=AUTHOR)
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
    if args and args[0] in COLLECTIONS:
        use(args.pop(0))
    if args and args[0] == 'convert':
        convert(int(args[1]))
    else:
        for n in args:
            build(int(n))
