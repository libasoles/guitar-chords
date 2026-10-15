# Backend: motor de partitura y tablatura

Spec: issue #16 (tickets #18, #19, #20). Dos imágenes de contenedor arm64:

| Directorio | Qué hace | Dónde corre |
|---|---|---|
| `engine/` | `prepare` y `export` (music21 + Verovio + rsvg-convert + Leipzig, sin Java) | Lambda (imagen de contenedor) |
| `ocr/` | Audiveris 5.11.0: PDF -> MusicXML intermedio | Tarea Fargate efímera |

El motor es una copia independiente del laboratorio (`music21/tools/score_tabs`).
No tiene sesiones: todo estado vive en artefactos en S3.

## Operaciones puras (`engine/tabify.py`)

```python
prepare(input_path | [paths], kind, tuning, out_dir, per_row=4) -> dict
export(musicxml_path, suggestion_path, tabs, tuning, out_dir) -> dict
```

`kind`: `musicxml` | `pdf-ocr-output`. `tuning` en prepare: `auto` | `standard` | `dropd`;
en export: `standard` | `dropd` | `None`/`auto` (conserva la de la sugerencia).

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
  "preview_columns": [[{"note_ids": ["tab-note-0"], "bass_strings": [5]}]]
}
```

- `tabs`: **la Digitación sugerida**, un Tab (`Column[]`) por compás; cada Column son 6
  `number|null`, cuerda 1 (aguda) primero. Es el valor inicial del editor y la forma exacta
  de `tabs` en export.
- `preview_columns[m][c].note_ids`: ids que aparecen como `data-id` de cada nota en los SVG
  (`tab-note-<n>`, deterministas por orden de documento del MusicXML normalizado).
  El frontend calcula `columnLayout` con ellos, nunca por orden del DOM.
  `bass_strings`: índices de cuerda (0 = aguda) a resaltar en negrita.

**export** escribe `score.pdf`, `score.musicxml` (notación + TAB) y `tabs.json` (los `tabs` recibidos).
Las celdas editadas se asocian a notas por altura; celdas sin nota que coincida
(notas extra del editor) solo afectan al pentagrama TAB, nunca a la notación.
Falla con `ValueError` si `tabs` no tiene un Tab por compás o si el MusicXML no coincide con la sugerencia.

## Lambda del motor (`engine/lambda_handler.py`)

Handler: `lambda_handler.handler`. Imagen: `backend/engine/Dockerfile`
(base `public.ecr.aws/lambda/python:3.12-arm64`). Memoria sugerida 2048 MB, timeout 120 s,
`/tmp` 1 GB. Permisos S3: `GetObject`, `PutObject`, `ListBucket` sobre el bucket.
Los tests corren en la imagen: `docker run --rm --entrypoint python <img> -m pytest -q /var/task`.

La respuesta nunca lanza por errores del Trabajo: devuelve `ok:false` para que Step Functions
bifurque con un `Choice` sobre `$.ok` y guarde `$.error` como código del Trabajo.

### Evento `prepare`

```json
{
  "action": "prepare",
  "bucket": "my-bucket",
  "input_key": "jobs/<id>/input.musicxml",
  "kind": "musicxml",
  "tuning": "auto",
  "out_prefix": "jobs/<id>/prepared/",
  "per_row": 4
}
```

- Entrada, una de: `input_key` (un archivo `.musicxml`/`.xml`/`.mxl`; sin extensión se detecta
  por contenido), `input_keys` (lista; varios movimientos), o `input_prefix` (todos los
  `.mxl/.musicxml/.xml` bajo el prefijo, ordenados; úsalo para la salida del OCR: `jobs/<id>/omr/`).
- `out_prefix` debe terminar en `/`. `kind` e `input_*` obligatorios salvo lo anterior; `tuning` default `auto`.

Respuesta ok:

```json
{"ok": true, "tuning": "standard", "title": "...", "measures": 24,
 "dropped": [{"measure": 3, "pitch": "D2"}],
 "keys": {"musicxml": "<out_prefix>normalized.musicxml",
          "suggestion": "<out_prefix>suggestion.json",
          "preview": "<out_prefix>preview.json",
          "preview_svgs": ["<out_prefix>preview-01.svg", "..."]}}
```

### Evento `export`

```json
{
  "action": "export",
  "bucket": "my-bucket",
  "musicxml_key": "jobs/<id>/prepared/normalized.musicxml",
  "suggestion_key": "jobs/<id>/prepared/suggestion.json",
  "tabs": [[[null, 0, null, 2, null, null]]],
  "tuning": "standard",
  "out_prefix": "jobs/<id>/export/<n>/"
}
```

`tabs` va inline, o `tabs_key` apunta a un JSON en S3 con el mismo contenido.
`tuning` opcional (`standard`|`dropd`; omitido = el de la sugerencia).

Respuesta ok:

```json
{"ok": true, "tuning": "standard",
 "keys": {"pdf": "<out_prefix>score.pdf", "musicxml": "<out_prefix>score.musicxml",
          "tabs": "<out_prefix>tabs.json"}}
```

### Códigos de error (`ok:false`)

| `error` | Cuándo | Código de API sugerido |
|---|---|---|
| `no_notes` | prepare: la partitura no tiene notas | `no_notes` |
| `invalid_score` | prepare: MusicXML ilegible, escala rítmica irreparable, etc. (`message` tiene el detalle) | `omr_failed` si el origen es PDF, si no `invalid_score` |
| `export_failed` | export: tabs no coinciden con los compases / MusicXML no coincide / Verovio falló | `export_failed` |
| `bad_request` | evento mal formado | `bad_request` |

Un timeout o falla de memoria de Lambda aparece como error de Step Functions
(`States.TaskFailed`/`States.Timeout`): capturarlo y mapear a `timeout`.

## Tarea OCR (`ocr/run.py`)

Imagen: `backend/ocr/Dockerfile` (Audiveris 5.11.0 compilado desde fuente sobre
`eclipse-temurin:25-jre`, arm64 nativo, ENTRYPOINT `python3 /opt/ocr/run.py`).
Tamaño inicial: 2 vCPU / 8 GB. Permisos del rol de la tarea: `s3:GetObject` sobre el PDF y
`s3:PutObject` bajo el prefijo de salida. Subred pública con IP pública, sin tráfico entrante.

Variables de entorno (container overrides de `ecs:RunTask`):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `BUCKET` | si | Bucket S3 |
| `INPUT_KEY` | si | Clave del PDF subido |
| `OUTPUT_PREFIX` | si | Prefijo terminado en `/`, p. ej. `jobs/<id>/omr/` |
| `OMR_MAX_HEAP_MB` | no | `-Xmx` de la JVM (default 5120; dejar ~2-3 GB para el resto del proceso en 8 GB) |
| `OMR_TIMEOUT_SECONDS` | no | Mata a Audiveris pasado este tiempo (default 780, bajo el corte de 15 min del Trabajo) |

Salida: `OUTPUT_PREFIX + omr-01.mxl` (más `omr-02.mxl`, ... si Audiveris separa movimientos).
`omr-01.mxl` es el **MusicXML intermedio** descargable. Después, `prepare` con
`input_prefix = OUTPUT_PREFIX` y `kind = "pdf-ocr-output"`.

Códigos de salida (distinto de 0 = tarea fallida, mapear a `omr_failed`):

| Código | Significado |
|---|---|
| 0 | ok |
| 2 | Audiveris falló, no exportó MusicXML o superó `OMR_TIMEOUT_SECONDS` |
| 3 | configuración inválida (variables) |
| 4 | error de S3 (descarga o subida) |

Con `-XX:+ExitOnOutOfMemoryError` un OOM de la JVM también termina con código distinto de 0.

## Tests locales

```bash
python3 -m venv .venv && .venv/bin/pip install -r backend/engine/requirements-dev.txt
cd backend/engine && ../../.venv/bin/python -m pytest -q   # requiere rsvg-convert en PATH
```

Los fixtures son MusicXML inline; no se versionan partituras con copyright.

## API publica (contrato con el sitio)

Implementada en `backend/api` (HTTP API + Lambda + Step Functions). Errores:
`{"error": {"code", "message"}}`. Codigos de Trabajo fallido (`error` en `GET /jobs/{id}`):
`omr_failed` (OCR fallo, o `invalid_score` con origen PDF), `no_notes`, `invalid_score`
(MusicXML ilegible), `export_failed`, `timeout`, `too_large`, `internal_error`.

Claves S3 por Trabajo: `jobs/<id>/input.<ext>`, `omr/omr-01.mxl`, `prepared/{normalized.musicxml,
suggestion.json,preview.json,preview-NN.svg}`, `edits.json` (el `tabs` recibido; es el `tabs_key`
del export), `export/<n>/{score.pdf,score.musicxml,tabs.json}` (n = numero de exportacion).

`GET /jobs/{id}`:

```json
{"id": "...", "status": "created|processing|ready|exporting|exported|failed",
 "stage": "ocr|preparing|exporting|null", "kind": "pdf|musicxml", "tuning": "standard|dropd|auto",
 "error": null, "elapsedSeconds": 12, "expiresAt": 0, "exports": 0,
 "discardedNotes": [{"measure": 3, "pitch": "D2"}], "measures": 24, "title": "...|null",
 "preview": {"json": "<signed url preview.json>",
             "suggestion": "<signed url suggestion.json: tabs, preview_columns, ...>",
             "svgs": ["<signed url preview-01.svg>", "<signed url preview-02.svg>"]}}
```

`preview` es `null` hasta `ready`. `svgs[i]` corresponde a `rows[i]` de `preview.json`
(mismo orden que `rows[].svg`). Las URL firmadas duran 15 min; volver a pedir el Trabajo las renueva.

`GET /jobs/{id}/downloads` (URL firmadas, `attachment`):

```json
{"id": "...", "status": "exported", "downloads":
  {"pdf": "<url>", "musicxml": "<url>", "tabs": "<url>", "intermediate": "<url, solo kind=pdf>"}}
```

`pdf`/`musicxml`/`tabs` aparecen cuando `status = exported` (ultima exportacion);
`intermediate` (`omr-01.mxl`) esta disponible desde `ready` para PDF.
