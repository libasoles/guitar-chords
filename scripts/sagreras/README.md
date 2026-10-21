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

La TAB publicada es la digitación sugerida por el motor, no la de Marieh. Los dedos de la mano izquierda (cifras 0-4 de
8 pt, las de la TAB impresa son de 9 pt) sí se leen: `marieh_notes.attach_fingers` pasa cada cifra a la cabeza más cercana,
`transcribe.py` las escribe como `<fingering>` y el motor las toma como pista (descarta las digitaciones que no se pueden
tocar con esos dedos); `transcribe.py` avisa por stderr de cualquier cifra que no encuentre nota. Las letras p i m a de la
mano derecha (texto de 8 pt de un solo carácter) se leen igual y van como un segundo `<fingering>` de la misma nota
(`transcribe_lib.note_xml` admite varios separados por `|`); el motor las ignora al digitar. No se publican los PDF de la
edición ni sus textos.

## Control de la digitación contra el libro

`compare_positions.py` compara las casillas (cuerda y traste) que propone el motor con las de la TAB impresa de la edición.
Lo aprendido: el libro mantiene los acordes en posición baja y con cuerdas al aire (A-do♯-sol = 5-2-0, no 5-6-5), y el costo
del motor solo medía la apertura de la mano. `tabify.local_cost` suma ahora 0,25 por traste pisado (53 → 18 casillas
distintas de 3070; las que quedan son las lecciones 60, 73, 79 y 37, y la 33 no tiene TAB impresa). **Tras tocar el costo
del motor o añadir una lección, corre `compare_positions.py`: el total no debe subir.** Otras trampas ya corregidas: un
♯ de la primera nota no es una armadura (`pdf_notes.key_signature` exige las alturas canónicas), y en compases con varias
voces de plica abajo los inicios se ajustan a la cuadrícula de duraciones (si no, un acorde queda entre dos pulsos).
Los corchetes de tresillo se dibujan sobre el pentagrama (debajo chocan con la redonda del bajo) y no se copian a la TAB.

## Reproducir

```sh
.venv-carcassi/bin/python scripts/sagreras/transcribe.py 44
.venv-carcassi/bin/python scripts/sagreras/build.py 44
```

Verificación: `node --test test/sagreras.unit.js`, `node scripts/build-site.js` y `node test/articles.e2e.js`.
