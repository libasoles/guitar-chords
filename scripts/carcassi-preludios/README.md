# Preludios de Carcassi: dos ediciones

El sitio publica los mismos 16 números en dos colecciones independientes:

- **Carcassi**: `/articulos/preludios-de-carcassi`, transcrito del ejemplar anterior
  a Santisteban que aportó el usuario. Entradas: `corrected/prelude-NN.musicxml`.
- **Santisteban**: `/articulos/preludios-de-carcassi-santisteban`, revisión de 1906
  según Mutopia. Entradas: `santisteban/prelude-NN.musicxml`.

[Fuentes, páginas y convenciones de transcripción](sources/README.md).

## Reproducir

Se usa el motor local `backend/engine/tabify.py`, con Music21 y Verovio:

```sh
uv venv --python 3.13 .venv-carcassi
uv pip install --python .venv-carcassi/bin/python -r backend/engine/requirements.txt pillow pypdf
brew install poppler librsvg
```

Rehacer las entradas originales o una entrada de Santisteban:

```sh
.venv-carcassi/bin/python scripts/carcassi-preludios/transcribe_originals.py
.venv-carcassi/bin/python scripts/carcassi-preludios/transcribe_05.py
```

Grabar un preludio de cada edición (no requiere los PDF fuente):

```sh
.venv-carcassi/bin/python scripts/carcassi-preludios/extract.py build 5
.venv-carcassi/bin/python scripts/carcassi-preludios/extract.py build 5 --edition santisteban
```

O transcribir, grabar y generar PNG de revisión, siempre fuera del control de versiones:

```sh
scripts/carcassi-preludios/build_one.sh 5 carcassi
scripts/carcassi-preludios/build_one.sh 5 santisteban
```

Cada grabado produce PDF y MusicXML con notación y TAB en
`downloads/carcassi-preludios/` o `downloads/santisteban-preludios/`, una vista
previa de un sistema en `src/site/articles/<colección>/` y todas las páginas SVG
para la modal en `full/`. Los PDF de Santisteban llevan su nombre en el archivo
y en el subtítulo para distinguirlos una vez descargados. El build falla
si el motor descarta notas.

El PDF se genera desde el MusicXML: no es un recorte del libro. Se fijan autor y
título y se eliminan productor, fechas y bloque `encoding`. El motor propone la
digitación de la TAB con afinación estándar; `avoid_repeated_strings` evita saltos
innecesarios a la misma cuerda. El visor y la descarga usan la misma digitación.

## Herramientas anteriores de OCR

`extract.py crop N` y `ocr N`, `detect_notes.py`, `bass_strips.py` y los informes
históricos de `reports/` trabajan sobre la fuente de **Santisteban**
`resources/CarcassiMethodPreludes-a4.pdf` (o `$CARCASSI_SOURCE_PDF`). Los informes
no son una certificación de las nuevas entradas originales. Los scripts
`transcribe_01.py` a `transcribe_16.py` reproducen la colección Santisteban;
`transcribe_lib.py` y `transcribe_triplets.py` son sus utilidades de notación.

Verificación: `npm test`. Las imágenes para revisar manualmente se guardan en
`.work/` o en un directorio temporal, nunca como fixtures sin aserciones.
