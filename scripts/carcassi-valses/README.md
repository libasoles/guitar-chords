# Valses del Op. 59 de Carcassi

Página `/articulos/valses-de-carcassi`: los valses de la Tercera parte del *Método completo para guitarra*, Op. 59
(numeración del libro, ver `resources/Libro Carcassi - Metodo.pdf`, pdf 87+). Carcassi murió en 1853: la obra es de
dominio público.

## Los valses son piezas progresivas

Los ocho valses (2, 5, 7, 10, 15, 26, 34 y 36) son piezas de la Tercera Parte, con los mismos números del libro. **No tienen
build propio**: se construyen con `scripts/carcassi-progresivas/build.py` (ver su README) y la página de valses publica el
PDF y el MusicXML de `downloads/carcassi-progresivas/`, la vista previa y las páginas del modal de
`src/site/articles/carcassi-progresivas/`. Un vals es una pieza de
`pieces.json` con el campo `"key"` (su tonalidad); `scripts/lib/article-carcassi-preludes.js` (`waltzes`) lista esas
piezas, y `src/site/articles/carcassi-valses/` solo guarda la prosa de la página.

La página de piezas progresivas **no** lista los valses: solo la de valses los muestra (`publishedWaltzes` y
`publishedPieces` en `scripts/lib/article-carcassi-progressive.js`). Sus marcas del editor van bajo `carcassi-valses` en
`scripts/lib/editor-marks.js`, con el número del libro. Cuando haya más valses de la Tercera Parte con fuente, basta
agregarlos a las progresivas con `"key"` en `pieces.json`.

Para corregir un vals: la notación en `scripts/carcassi-progresivas/sources/NN.musicxml` (fuente curada, cotejada con el
libro), la digitación en `extract.waltz_voicing` (`scripts/carcassi-preludios/extract.py`), y luego
`.venv-carcassi/bin/python scripts/carcassi-progresivas/build.py N`. Pruebas: `test/carcassi-valses.unit.js`.

## Qué queda en esta carpeta

Antes los valses salían de aquí: los PDF de `resources/partituras/carcassi-op59-youtube/` (carpeta no versionada, de solo
lectura; exportaciones de MuseScore 4 con la fuente Leland, de la lista «Carcassi Op. 59» del canal Guitar Notes) se leían
de la geometría vectorial sin OCR. Esa transcripción tenía errores que las fuentes `.mscz` de las progresivas no tienen
(p. ej. un fa♯ de más en el vals 26 y sin dinámicas, ligaduras ni D.C.), así que los valses pasaron a las progresivas.
Lo que sigue aquí es la biblioteca de lectura de PDF que importan otras colecciones:

- `pdf_notes.py`: geometría del PDF de MuseScore → notas (Sagreras, Barrios y Giuliani).
- `transcribe_valses.py`: del PDF a MusicXML de notación (la usa Sagreras: `convert_measure`, `pitch_name`, etc.).
- `check.py`: comprueba que cada compás de un PDF sume su duración.
- `crop_systems.py`: recorta sistemas de un PDF.

Las reglas de digitación de los valses (contexto melódico) están en `docs/criterios-de-digitacion.md`, §8.1.
