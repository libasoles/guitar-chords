"""Partituras de Abel Fleury con TAB: del LilyPond transcrito a mano (sources/*.ly) a MusicXML y PDF con tablatura.

    python scripts/fleury/build.py convert la-cimarrona     # sources/<pieza>.ly -> sources/<pieza>.musicxml
    python scripts/fleury/build.py la-cimarrona             # sources/<pieza>.musicxml -> PDF y MusicXML en la salida

Los PDF quedan en `resources/fleury/tab/` del checkout principal (carpeta no versionada), o en `$FLEURY_OUT`.
Usa el motor (backend/engine/tabify.py) y las rutinas de grabado de los preludios de Carcassi.
"""
import json
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'carcassi-preludios'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'sor'))
sys.path.insert(0, os.path.join(ROOT, 'backend', 'engine'))

import extract  # noqa: E402  (rutinas de grabado compartidas)
import ly_to_musicxml  # noqa: E402
import pdf_footer  # noqa: E402

AUTHOR = 'Abel Fleury'
SOURCES = os.path.join(HERE, 'sources')

# La clave es el nombre de archivo de la salida.
PIECES = {
    'la-cimarrona': {
        'title': 'La Cimarrona', 'subtitle': 'Ranchera', 'source': 'la_cimarrona.ly',
        'edition': 'Antigua Casa Nunez (Buenos Aires, 1942)',
    },
    'milongueo-del-ayer': {
        'title': 'Milongueo del Ayer', 'subtitle': 'Milonga', 'source': 'milongueo_del_ayer.ly',
        'edition': 'Antigua Casa Nunez (Buenos Aires, 22.a edicion)',
    },
}
PER_ROW = {}
ARPEGGIO = set()
SCALES = [45, 41, 38, 35]  # la escala de Verovio es entera; 45 es la del motor; con menos de 35 lo impreso es ilegible


def out_dir():
    if os.environ.get('FLEURY_OUT'):
        return os.environ['FLEURY_OUT']
    main = os.path.abspath(os.path.join(ROOT, '..', '..', '..')) if os.sep + '.claude' + os.sep + 'worktrees' + os.sep in ROOT + os.sep else ROOT
    return os.path.join(main, 'resources', 'fleury', 'tab')


def zoom_options(scale):
    return {'scale': scale, 'pageWidth': round(2100 * 45 / scale), 'pageHeight': round(2970 * 45 / scale)}


def convert(slug):
    piece = PIECES[slug]
    xml = ly_to_musicxml.convert(os.path.join(SOURCES, piece['source']), piece['title'], AUTHOR)
    target = os.path.join(SOURCES, slug + '.musicxml')
    with open(target, 'w', encoding='utf-8') as f:
        f.write(xml)
    print('fuente:', target)


def footer_lines(piece):
    return [[('Transcripcion a mano del escaneo de la edicion de ' + piece['edition'], None)],
            [('Abel Fleury (1903-1958). Solo para estudio personal: la obra sigue protegida por derechos de autor.', None)]]


def build(slug):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject
    import tabify

    piece = PIECES[slug]
    source = os.path.join(SOURCES, slug + '.musicxml')
    if not os.path.exists(source):
        raise SystemExit(f'falta la fuente: {source}')
    base_options = dict(tabify.PDF_OPTIONS)
    tabify.KEEP_TEXT = True  # tempo, marcas y textos se imprimen
    tabify.MERGE_UNISONS = True  # la misma altura en dos voces a la vez es una sola nota en la TAB
    target_dir = out_dir()
    os.makedirs(target_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        extract.patch_engine(tabify)
        prepared = os.path.join(tmp, 'prepared')
        result = tabify.prepare(source, 'musicxml', 'standard', prepared, per_row=PER_ROW.get(slug, 4),
                                arpeggio='auto' if slug in ARPEGGIO else False)
        if result['dropped']:
            raise RuntimeError(f"Notas descartadas en {slug}: {result['dropped']}")
        with open(os.path.join(prepared, tabify.SUGGESTION_NAME), encoding='utf-8') as f:
            tabs = json.load(f)['tabs']
        best = None
        for level in [zoom_options(sc) for sc in SCALES[:1]]:
            tabify.PDF_OPTIONS = {**base_options, **level}
            exported = os.path.join(tmp, f"export-{level['scale']}")
            tabify.export(os.path.join(prepared, tabify.NORMALIZED_NAME), os.path.join(prepared, tabify.SUGGESTION_NAME),
                          tabs, 'standard', exported, title=piece['title'], subtitle=f"{piece['subtitle']} · {AUTHOR}")
            pages = len(PdfReader(os.path.join(exported, 'score.pdf')).pages)
            best = (pages, exported)
        _, exported = best
        base = os.path.join(target_dir, f"{piece['title']} - {AUTHOR}")
        with open(os.path.join(exported, 'score.musicxml'), encoding='utf-8') as f:
            xml = f.read()
        xml = re.sub(r'\s*<encoding>.*?</encoding>', '', xml, flags=re.S)
        with open(base + '.musicxml', 'w', encoding='utf-8') as f:
            f.write(xml)
        writer = PdfWriter(clone_from=PdfReader(os.path.join(exported, 'score.pdf')))
        pdf_footer.stamp_footer(writer, footer_lines(piece))
        writer.add_metadata({'/Title': piece['title'], '/Author': AUTHOR})
        for key in ('/Producer', '/Creator', '/CreationDate', '/ModDate'):
            writer._info.get_object().pop(NameObject(key), None)
        with open(base + '.pdf', 'wb') as f:
            writer.write(f)
    print('salida:', base + '.pdf', f'({best[0]} paginas)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == 'convert':
        for slug in args[1:]:
            convert(slug)
    else:
        for slug in args:
            build(slug)
