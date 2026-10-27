"""120 ejercicios de arpegio de Giuliani (Op. 1, parte 1): PDF de Marieh -> MusicXML con notacion (sin TAB).

    python scripts/giuliani-arpegios/transcribe.py 2 [3 4 ...]     # escribe sources/NNN.musicxml y compara con la TAB impresa
    python scripts/giuliani-arpegios/transcribe.py check [N ...]   # solo compara (sin escribir)

Las notas se leen de la geometria del PDF con las rutinas de scripts/sagreras (misma transcriptora, mismo programa:
MuseScore 3, fuente MScore): no se copia nada del PDF a la salida, solo alturas y duraciones, mas los dedos de la mano
izquierda y las letras p-i-m-a de la derecha. La TAB la propone el motor (ver build.py). Los numeros de la TAB impresa
dan un control independiente de las alturas leidas.

La edicion no imprime el «3» de los tresillos: en 4/4, un compas con mas corcheas de las que caben (12 en vez de 8) se
lee como tresillos de corchea, igual que en la edicion original de Artaria.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'sagreras'))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-valses'))
sys.path.insert(0, str(ROOT / 'scripts' / 'carcassi-preludios'))

import marieh_notes as M  # noqa: E402
import pdf_notes as P  # noqa: E402

# El modulo de Sagreras se llama igual que este: cargarlo con otro nombre.
_spec = importlib.util.spec_from_file_location('sagreras_transcribe', ROOT / 'scripts' / 'sagreras' / 'transcribe.py')
S = importlib.util.module_from_spec(_spec)
sys.modules['sagreras_transcribe'] = S
_spec.loader.exec_module(S)

# El build.py de esta coleccion se llama igual que el de Sagreras, que esta antes en sys.path: cargarlo por ruta.
_spec = importlib.util.spec_from_file_location('giuliani_arpegios_build', HERE / 'build.py')
B = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(B)

import os  # noqa: E402

SOURCES = HERE / 'sources'
SOURCE = Path(os.environ.get('RESOURCES_DIR', ROOT / 'resources')) / 'giuliani-arpegios' / 'IMSLP660049-giuliani-op1-parte1-tab.pdf'
COUNT = 120
pymupdf = P.pymupdf


def read_pdf(path=SOURCE):
    """-> {ejercicio: {'fifths', 'time', 'measures', 'tab', 'cells'}} para los ejercicios 1-120."""
    doc = pymupdf.open(str(path))
    exercises = {}
    current = None
    for page in doc:
        proxy = M.PageProxy(page)
        drawings = proxy.get_drawings()
        widths = M.stroke_widths(drawings)
        groups = P.staff_groups(drawings, widths['staff'])
        if not groups:  # paginas con muchas barras dobles: la frecuencia no da el grosor del pentagrama (0,5)
            widths['staff'] = 0.5
            groups = P.staff_groups(drawings, widths['staff'])
        notation = [g for g in groups if len(g) == 5]
        tabs = [g for g in groups if len(g) == 6]
        words = page.get_text('words')
        labels = sorted((w[1], int(m[1])) for w in words if (m := re.fullmatch(r'No\.?(\d+)', w[4])))  # «No28» sin punto: errata de la edicion
        glyph = M.mscore_glyphs(page)
        stems = [d['rect'] for d in drawings if d['type'] == 's' and abs((d['width'] or 0) - widths['stem']) < 0.02 and d['rect'].width < 0.01]
        bars = M.bar_strokes(drawings)
        thick = [d['rect'] for d in drawings if d['type'] == 's' and (d['width'] or 0) > 2 and d['rect'].width < 0.01]
        beams = [[(i[1].x, i[1].y) for i in d['items']] + [(d['items'][-1][2].x, d['items'][-1][2].y)] for d in drawings
                 if d['type'] == 'f' and d['fill'] == (0.0, 0.0, 0.0) and len(d['items']) == 4]
        fingers = M.finger_marks(page)
        plucks = M.finger_marks(page, 'PIMA')  # esta edicion las imprime en mayusculas
        for index, lines in enumerate(notation):
            for y, number in labels:
                if y < lines[0]:
                    current = number
            if current is None or not 1 <= current <= COUNT:
                continue
            clip = lambda rs: [pymupdf.Rect(r.x0, r.y0, r.x1, lines[-1]) if abs(r.y0 - lines[0]) < 0.6 and r.y1 > lines[-1] + 3 * (lines[-1] - lines[0]) / 4 else r for r in rs]  # noqa: E731
            system = P.read_system(lines, glyph, stems, clip(bars), clip(thick), beams)
            M.mark_ties(system, drawings, lines)
            for marks, key in ((fingers, 'finger'), (plucks, 'pluck')):
                lost = (attach_plucks_by_onset(system, marks, lines) if key == 'pluck' and current in ONSET_PLUCKS
                        else M.attach_fingers(system, marks, lines, key))
                if lost:
                    print(f'  ejercicio {current}: {key} sin nota: {[(round(x), round(y), c) for x, y, c in lost]}', file=sys.stderr)
            for m in system['measures']:
                for h in m['items']:
                    if h.get('pluck'):
                        h['pluck'] = h['pluck'].lower()  # p i m a, como en el resto del sitio
            P.mark_texts(system, words, lines)
            space = (lines[-1] - lines[0]) / 4
            for m in system['measures']:
                m['tuplets'] = []
            exercise = exercises.setdefault(current, {'fifths': 0, 'time': None, 'measures': [], 'tab': [], 'cells': [], 'barres': []})
            symbol = [g for g in glyph if g[0] in (0xE08A, 0xE08B) and lines[0] - 1 <= g[2] <= lines[-1] + 6 * space]
            if symbol and not exercise['time']:
                exercise['time'] = (4, 4) if symbol[0][0] == 0xE08A else (2, 2)
            for m in system['measures']:
                m['fifths'] = 0
            exercise['measures'].extend(system['measures'])
            if index < len(tabs):
                cells = M.tab_cells(tabs[index], words, system['measures'])
                for m in system['measures']:
                    m['tab'] = [(x, P.OPEN_MIDI[string] + fret) for x, string, fret in cells if m['left'] <= x < m['right']]
                exercise['cells'].extend(cells)
                exercise['tab'].extend((x, P.OPEN_MIDI[string] + fret) for x, string, fret in cells)
    for exercise in exercises.values():
        fix_final_chord_fingers(exercise)
    return exercises


ONSET_PLUCKS = {32, 34}  # bajo y arpegio en voces distintas: la letra mas cercana cae en la voz equivocada


def attach_plucks_by_onset(system, marks, lines):
    """Las letras impresas, de izquierda a derecha, van a los ataques sucesivos (columnas de cabezas con la misma x); las
    letra va a una sola cabeza de la columna (si no, saldria repetida). -> las letras que sobran (para avisar)."""
    space = (lines[-1] - lines[0]) / 4
    measures = system['measures']
    left = min(m['left'] for m in measures)
    right = max(m['right'] for m in measures)
    mine = sorted(m for m in marks if lines[0] - 9 * space <= m[1] <= lines[-1] + 5 * space and left <= m[0] <= right)
    heads = sorted((h for m in measures for h in m['items'] if not h['grace']), key=lambda h: h['x'])
    columns = []
    for h in heads:
        if columns and h['x'] - columns[-1][0]['x'] < 0.5 * space:
            columns[-1].append(h)
        else:
            columns.append([h])
    for (_, _, letter), column in zip(mine, columns):
        column[0]['pluck'] = letter
    return mine[len(columns):]


def fix_final_chord_fingers(exercise):
    """El acorde final (do, mi, sol, do, mi) trae «1 2 3» apilado encima, de arriba abajo; las cifras caen en las cabezas
    mas cercanas (mi, do, sol agudos) y salen invertidas. Son los dedos del acorde de do: 3 en el do grave, 2 en el mi
    grave y 1 en el do de la 2.a cuerda; el sol y el mi agudo suenan al aire."""
    heads = sorted((h for h in exercise['measures'][-1]['items'] if not h['grace']), key=lambda h: -h['y'])
    if len(heads) == 5 and sum(1 for h in heads if h.get('finger')) == 3:
        for h, finger in zip(heads, ('3', '2', None, '1', None)):
            h['finger'] = finger


PRINTED_TAB = B.PRINTED_TAB  # ejercicios cuya fuente lleva las casillas de la TAB impresa como <string>/<fret>


def attach_printed_cells(exercise):
    """Cada cabeza toma la casilla impresa mas cercana con su altura (`cell` = «@cuerda/traste»; cuerda 1 = la mas aguda)."""
    for m in exercise['measures']:
        cells = [c for c in exercise['cells'] if m['left'] <= c[0] < m['right']]
        used = set()
        for h in sorted((h for h in m['items'] if not h['grace']), key=lambda h: h['x']):
            step = P.STEPS[(2 + h['pos']) % 7]
            written = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[step] + (h['acc'] or 0) + 12 * (4 + (2 + h['pos']) // 7 + 1)
            options = sorted((abs(x - (h['x'] + 0.6 * m['space'])), i) for i, (x, string, fret) in enumerate(cells)
                             if i not in used and P.OPEN_MIDI[string] + fret + 12 == written and abs(x - (h['x'] + 0.6 * m['space'])) < 2 * m['space'])
            if options:
                used.add(options[0][1])
                h['cell'] = f'@{cells[options[0][1]][1] + 1}/{cells[options[0][1]][2]}'


def mark_triplets(exercise):
    """Sin «3» impreso: si los grupos de un compas de 4/4 suman mas de un compas, las corcheas de plica arriba son
    tresillos (se marcan de tres en tres, de izquierda a derecha)."""
    full = 16
    exercise['tuplet_size'] = 3
    for m in exercise['measures']:
        groups = [g for g in S._original_groups(m) if not g['grace']]
        mid = (m['top'] + m['bottom']) / 2
        polyphonic = any(a['dir'] != b['dir'] and abs(a['heads'][0]['x'] - b['heads'][0]['x']) < 2 for a in groups for b in groups)
        # una sola voz: todas las figuras cortas; con varias, cada voz (plicas arriba / abajo) por separado
        pools = [groups] if not polyphonic else [[g for g in groups if g['dir'] == side] for side in ('up', 'down')]
        m['tuplets'] = []
        for pool in pools:
            if sum(g['dur'] for g in pool) <= full + 0.01:
                continue
            short = sorted((g for g in pool if g['dur'] <= 2), key=lambda g: g['x'])
            if any(g['dur'] == 1 for g in short):
                exercise['tuplet_size'] = 6
            # la marca cae del lado de la plica del trio: arriba si las plicas suben, abajo si bajan (ver fixed_groups)
            m['tuplets'] += [(sum(g['x'] for g in trio) / len(trio), mid - 2 * m['space'] if trio[0]['dir'] == 'up' else mid + 2 * m['space'])
                             for trio in (short[i:i + 3] for i in range(0, len(short), 3))]


def read_exercises():
    exercises = read_pdf()
    for exercise in exercises.values():
        exercise['time'] = exercise['time'] or (4, 4)
        mark_triplets(exercise)
    for n in PRINTED_TAB:
        attach_printed_cells(exercises[n])
    return exercises


def run(numbers, write):
    exercises = read_exercises()
    for n in numbers:
        exercise = exercises[n]
        try:
            measures = S.lesson_measures(exercise)
        except Exception as error:  # noqa: BLE001
            print(f'{n:3d} ERROR de lectura: {type(error).__name__}: {error}')
            continue
        S.TUPLET_SIZE = exercise['tuplet_size']
        missing, extra = S.compare_tab(exercise, measures)
        full = exercise['time'][0] * 16 // exercise['time'][1] * S.SCALE
        odd = [i + 1 for i, d in enumerate(measures) if d['length'] != full]
        status = 'OK ' if not missing and not extra and not odd else 'REVISAR'
        print(f"{n:3d} {status} compases={len(measures)} cortos/largos={odd} notacion-de-mas={missing} tab-de-mas={extra}")
        if write and status == 'OK ':
            SOURCES.mkdir(exist_ok=True)
            xml = S.to_xml(n, exercise, measures).replace('Julio Salvador Sagreras', 'Mauro Giuliani').replace(f'Lesson {n}<', f'Exercise {n}<')
            (SOURCES / f'{n:03d}.musicxml').write_text(xml, encoding='utf-8')
            record_measures(n, len(measures))


def record_measures(n, count):
    """Compases de cada ejercicio (los lee test/giuliani-arpegios.unit.js)."""
    path = HERE / 'measures.json'
    table = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    table[str(n)] = count
    path.write_text(json.dumps(dict(sorted(table.items(), key=lambda kv: int(kv[0]))), indent=0) + '\n', encoding='utf-8')


if __name__ == '__main__':
    args = sys.argv[1:]
    write = args[:1] != ['check']
    if not write:
        args = args[1:]
    run([int(a) for a in args] or list(range(1, COUNT + 1)), write)
