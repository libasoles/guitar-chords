# Preludios de Carcassi: extracción local de un preludio

Issues #33 y #34. Deja, por preludio, en `downloads/carcassi-preludios/`:

- `Prelude N in <Key> - Matteo Carcassi.pdf`: pentagrama + pentagrama TAB, lo que descarga el visitante.
- `Prelude N in <Key> - Matteo Carcassi.musicxml`: MusicXML final (notación + TAB), solo para uso interno.

y en `src/site/articles/carcassi-preludios/prelude-NN.svg` la vista previa (dos sistemas, solo notación).
El MusicXML intermedio del OCR **no** se commitea (vive en `.work/`, ignorado); sí el corregido,
en `corrected/prelude-NN.musicxml`, para reprocesar sin repetir el OCR.

Todo corre en local: el motor (`backend/engine/tabify.py`: `prepare` + `export`) en un venv de Python y
el OCR en el contenedor Docker `guitar-chords-ocr` (Audiveris + homr; sin AWS ni S3).

## Requisitos (una vez)

```bash
docker build -t guitar-chords-ocr backend/ocr          # 15-25 min la primera vez (o reutiliza la imagen)
uv venv --python 3.13 .venv-carcassi
uv pip install --python .venv-carcassi/bin/python -r backend/engine/requirements.txt pillow pypdf
brew install poppler librsvg                           # pdftoppm, pdftotext, rsvg-convert
```

El PDF fuente no se versiona: `resources/CarcassiMethodPreludes-a4.pdf` o `$CARCASSI_SOURCE_PDF`.

## Uso (por número de preludio)

```bash
PY=.venv-carcassi/bin/python
$PY scripts/carcassi-preludios/extract.py crop N    # recorta el preludio por posición (400 dpi)
$PY scripts/carcassi-preludios/extract.py ocr  N    # + OCR en contenedor -> .work/carcassi-preludios/omr-NN/
# corregir el MusicXML intermedio -> scripts/carcassi-preludios/corrected/prelude-NN.musicxml
$PY scripts/carcassi-preludios/extract.py build N   # PDF + MusicXML + vista previa
npm test
```

- **Recorte por posición**: `pdftotext` devuelve los preludios desordenados; `extract.py` busca los
  títulos por coordenadas (`pdftotext -bbox`) y recorta de un título al siguiente (o al pie), uniendo
  los tramos que cruzan de página.
- **Corrección**: dedos y letras p-i-m-a confunden al OCR (los dedos salen como notas). Si la
  corrección es inviable, se transcribe a mano desde la imagen con un script como `transcribe_01.py`.
- **Independencia de la fuente**: el PDF se genera desde cero con el motor, no recortando el original;
  el `build` fija los metadatos (título «Prelude N in <Key>», autor Matteo Carcassi, sin productor ni
  fechas) y quita el bloque `<encoding>` del MusicXML. `test/carcassi-preludios.unit.js` lo comprueba.
- **Digitación**: la sugerida por el motor con afinación Estándar.
- **Fuente de los dígitos del TAB**: sans (como el conversor web). `build` cambia la fuente por defecto de la página (`Times, serif`) por una sans; los preludios 1 a 3 se publicaron antes con serif y se regeneraron después con sans.

Informes de calidad: `reports/prelude-NN.md`.
