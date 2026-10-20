# Piezas progresivas de Carcassi (Tercera Parte del Método, Op. 59)

Página: `/articulos/piezas-progresivas-de-carcassi`. Son las piezas de la **Tercera Parte** de *New and Improved
Method for the Guitar* (Oliver Ditson & Co., Boston; escaneo en `resources/Libro Carcassi - Metodo.pdf`,
Internet Archive `newimprovedmethOOcarc`): «50 Exercises Progressing in Difficulty» / «Cinquante morceaux
progressifs», páginas impresas 77–110 (pdf 87+). El libro las numera 1–50 y la colección conserva esos
números y nombres (`pieces.json`). No son los preludios, pero incluyen valses, marchas, rondós, etc.

## De dónde salen las notas

El canal de YouTube *Guitar Notes* publica cada pieza (hasta ahora Nos. 1–36) con dos enlaces de Drive en la
descripción: un PDF con TAB y su archivo MuseScore (`.mscz`). Se usa el MuseScore, no el PDF:

1. `build.py convert N archivo.mscz` lee el pentagrama de notación del `.mscx` (alturas, ritmos, voces, ligaduras,
   tresillos, adornos, armadura, compás, repeticiones, dinámicas y reguladores) y escribe
   `sources/NN.musicxml`. Descarta digitaciones, trazos de posición y todo el estilo de MuseScore; el
   pentagrama TAB de MuseScore se ignora (lo calcula el motor).
2. La fuente se **coteja con el libro** compás a compás (notas, ritmo, repeticiones, "Fin"/"D.C.", tempo). Las
   diferencias se corrigen en `pieces.json` (`tempo`, `words`) o editando `sources/NN.musicxml`, que es la
   fuente curada: no hace falta volver a convertir.
3. `build.py N` pasa la fuente por el motor (`backend/engine/tabify.py`, con `KEEP_TEXT` para conservar tempo y
   `Fin`/`D.C.`) y deja en `downloads/carcassi-progresivas/` el PDF y el MusicXML con notación y TAB, y en
   `src/site/articles/carcassi-progresivas/` la vista previa (`progressive-NN.svg`) y las páginas del modal
   (`full/`). Reutiliza el grabado de los preludios (`scripts/carcassi-preludios/extract.py`).

La TAB es la digitación sugerida por el motor (afinación estándar). No se publican los PDF del canal, ni los
números de dedos del libro, ni las letras de la mano derecha. Las notas de adorno se escriben pero el motor no
les asigna cuerda (no aparecen en la TAB).

## Reproducir

```sh
.venv-carcassi/bin/python scripts/carcassi-progresivas/build.py convert 3 3.mscz   # opcional
.venv-carcassi/bin/python scripts/carcassi-progresivas/build.py 3
```

Entorno: ver `scripts/carcassi-preludios/README.md`. Verificación: `node --test test/carcassi-progresivas.unit.js`.
Una pieza se publica cuando están sus archivos en `downloads/` y `src/site/articles/`; el número de compases
del libro se registra en `MEASURES` del test.
