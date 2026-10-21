# Primeras lecciones de Sagreras (libro 1 de *Las lecciones de guitarra*)

Página: `/articulos/primeras-lecciones-de-sagreras`. Una tarjeta por lección (1–86), con vista previa, partitura completa
con TAB en un modal y descarga en PDF.

## De dónde salen las notas

La edición de **Marieh (2020)**, IMSLP610099, licencia CC BY-NC 4.0, es un PDF vectorial de MuseScore 2/3 (fuente `MScore`, no
Leland). El original queda en `resources/sagreras/primeras-lecciones/fuentes/` (no se versiona; ver su `README.md`).

1. `marieh_notes.py` lee la geometría del PDF con `carcassi-valses/pdf_notes.py` y un adaptador: trazos de varias líneas
   separados, anchos de plica/barra por rango, glifos `MScore`, cifra de compás «C», tresillos (cifra «3» en cursiva) y
   asignación de cada sistema a su lección por la etiqueta «No.N».
2. `transcribe.py N …` convierte cada lección en `sources/NN.musicxml` (12 divisiones por negra, tresillos, hasta tres
   voces: la redonda sin plica del bajo va como tercera voz). **Solo escribe la fuente si pasa el control**: las alturas
   leídas de la notación deben coincidir con los números de la TAB impresa de la edición, y cada compás debe sumar su
   duración. `transcribe.py check` solo compara. Lecciones con TAB impresa vacía: `NO_PRINTED_TAB`.
3. `build.py N …` pasa la fuente por el motor (`backend/engine/tabify.py`) y deja el PDF y el MusicXML con notación y TAB en
   `downloads/sagreras-lecciones/`, la vista previa en `src/site/articles/sagreras-lecciones/lesson-NN.svg` y las páginas del
   modal en `full/`. `measures.json` guarda los compases por lección (lo lee `test/sagreras.unit.js`).

La TAB publicada es la digitación sugerida por el motor, no la de Marieh. No se publican los PDF de la edición ni sus
indicaciones de dedos o textos.

## Reproducir

```sh
.venv-carcassi/bin/python scripts/sagreras/transcribe.py 44
.venv-carcassi/bin/python scripts/sagreras/build.py 44
```

Verificación: `node --test test/sagreras.unit.js`, `node scripts/build-site.js` y `node test/articles.e2e.js`.
