# Backend: motor de partitura y tablatura

Ya no hay servicio ni subida de partituras: el motor lo usan solo los scripts de las colecciones (`scripts/*/build.py`).

| Directorio | Qué hace |
|---|---|
| `engine/` | `prepare` y `export` (music21 + Verovio) |
| `ocr/` | Utilidades de lectura (homr/Audiveris) que usan los scripts de Carcassi |

El motor es una copia independiente del laboratorio (`music21/tools/score_tabs`).

## Operaciones puras (`engine/tabify.py`)

```python
prepare(input_path | [paths], kind, tuning, out_dir, per_row=4, arpeggio="auto") -> dict
export(musicxml_path, suggestion_path, tabs, tuning, out_dir) -> dict
```

`kind`: `musicxml` | `pdf-ocr-output`. `tuning` en prepare: `auto` | `standard` | `dropd`;
en export: `standard` | `dropd` | `None`/`auto` (conserva la de la sugerencia).
`arpeggio`: `"auto"` (detecta los compases de arpegio y les aplica las reglas de `engine/fingering.py`: sin dos
notas distintas seguidas en una cuerda, nota repetida en su cuerda, una casilla por altura en el compás) | `True`
(todos los compases) | `False` (solo el Viterbi). Los compases detectados salen en `suggestion.json` como
`arpeggio_measures`. Además, un MusicXML con `<fingering>` (dedo izquierdo 0-4), `<string>` o `<fret>` en las notas
limita las casillas de esa nota y descarta las combinaciones de dedos imposibles de sostener. Criterios y fuentes:
`docs/criterios-de-digitacion.md`.

`prepare` también repara el ritmo por voces (`engine/rhythm.py`, solo en subidas: `tabify.REPAIR_VOICES` está apagado
para las colecciones): una voz que pasa del compás por un acorde leído como dos notas o un tresillo falso, dos voces
pegadas (bajo + arpegio), un puntillo perdido en el bajo, una voz que arranca dentro de la nota anterior de su carril y dos notas de una
misma voz dibujadas en la misma x (`default-x` de Audiveris: un acorde, ver `docs/heuristicas-plaques.md`).
También marca los armónicos naturales (rombo, `<harmonic>` o «Hr. 12»: traste 12 de la cuerda una octava más grave, `<12>` en el PDF)
y, con `tabify.SUSTAIN`, el Viterbi cuenta las notas que siguen sonando (`fingering.ringing_cost`).
Cada regla actúa solo si el resultado es claramente mejor; si hay varias formas de cuadrar el compás, lo deja tal cual.
El resultado queda en `normalized.musicxml`, por eso `export` no necesita la regla.

**prepare** escribe en `out_dir`:

| Archivo | Contenido |
|---|---|
| `normalized.musicxml` | Primera parte, con `divisions=0` reparado, en un solo archivo |
| `suggestion.json` | Ver abajo |
| `preview.json` | `{staff_space, rows: [{svg, first, last}]}` (`first`/`last`: índices de compás, base 0) |
| `preview-01.svg`, ... | Un SVG de Verovio por renglón (solo notación) |

`suggestion.json`:

```json
{
  "version": 1,
  "tuning": "standard|dropd", "tuning_notes": "E2,A2,...", "string_names": ["E","B","G","D","A","E"],
  "title": "...|null", "subtitles": ["..."],
  "octave_shifts": [0, ...], "octave_shift": 0, "measure_numbers": [1, 2],
  "columns": [[{"offset": 0.0, "note_ids": ["tab-note-0"], "midis": [52]}]],
  "tabs": [[[null, 0, null, 2, null, null]]],
  "dropped": [{"measure": 3, "pitch": "D2"}],
  "uneven_measures": [2],
  "preview_columns": [[{"note_ids": ["tab-note-0"], "bass_strings": [5]}]]
}
```

- `tabs`: **la Digitación sugerida**, un Tab (`Column[]`) por compás; cada Column son 6
  `number|null`, cuerda 1 (aguda) primero. Es el valor inicial del editor y la forma exacta
  de `tabs` en export.
- `uneven_measures`: índices base 0 (en `tabs`) de los compases cuyo ritmo no suma: alguna voz dura más que el
  compás habitual (la duración más común, sin mirar el compás escrito) o ninguna llega a ella. La anacrusa (primer compás)
  y el compás final pueden ser cortos. La vista previa los marca con un aviso; es `[]` si todo suma (`uneven.py`).
- `preview_columns[m][c].note_ids`: ids que aparecen como `data-id` de cada nota en los SVG
  (`tab-note-<n>`, deterministas por orden de documento del MusicXML normalizado).
  El frontend calcula `columnLayout` con ellos, nunca por orden del DOM.
  `bass_strings`: índices de cuerda (0 = aguda) a resaltar en negrita.

**export** escribe `score.pdf`, `score.musicxml` (notación + TAB) y `tabs.json` (los `tabs` recibidos).
Las celdas editadas se asocian a notas por altura; celdas sin nota que coincida
(notas extra del editor) solo afectan al pentagrama TAB, nunca a la notación.
Falla con `ValueError` si `tabs` no tiene un Tab por compás o si el MusicXML no coincide con la sugerencia.

## Tests locales

```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/engine/requirements-dev.txt
cd backend/engine && ../../.venv/bin/python -m pytest -q   # requiere rsvg-convert en PATH
```

Los fixtures son MusicXML inline; no se versionan partituras con copyright.
