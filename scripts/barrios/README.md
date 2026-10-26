# Partituras de Barrios (piezas didácticas)

Página: `/articulos/partituras-de-barrios`. Estudios, minuetos y preludios de Agustín Barrios Mangoré, con partitura y
tablatura. `pieces.json` es el catálogo: la clave es el orden en la página; `title` es el título de Barrios (en español en
las dos lenguas), `en` solo traduce la tonalidad, `pdf` el archivo de `resources/barrios/imslp/`, `imslp` la página de la
edición y `year` el año de Apke para el crédito del PDF.

## De dónde salen las notas

De las ediciones de **Stefan Apke** (2017–2019) en [IMSLP](https://imslp.org/wiki/Category:Barrios_Mangor%C3%A9,_Agust%C3%ADn),
licencia **CC BY-SA 4.0**: PDF vectoriales de MuseScore 2 (fuente `MScore`). Barrios murió en 1944; la obra es de dominio
público, la edición no, y esta adaptación se comparte con la misma licencia (el PDF lleva el crédito al pie, como en
Sagreras). Los originales están en `resources/barrios/imslp/` (no versionado). IMSLP bloquea `/images/...` con un
captcha; se baja de `https://s9.imslp.org/files/imglnks/usimg/<a>/<ab>/IMSLP<id>-PMLP<obra>-<archivo>`.

1. `apke_notes.py` lee la geometría del PDF con `sagreras/marieh_notes.py` y `carcassi-valses/pdf_notes.py`. Esta
   edición usa los **códigos antiguos de la fuente MScore** (`LEGACY`: cabezas `E12D`/`E12C`, ♯ `E10E`, ♮ `E113`,
   ♭ `E114`, silencios `E100`–`E10A`, puntillo `E127`, corchetes `E190`/`E194`/`E197`, cifras del compás en ASCII),
   líneas de pentagrama de 0,4 pt y sistemas más juntos (cada sistema solo ve hasta el punto medio con sus vecinos).
   Los dedos son cifras `MScoreBC`; las que llevan un círculo (cuerdas) se descartan.
2. `transcribe_barrios.py N` escribe `sources/NN.musicxml` si cada compás suma su duración (reutiliza
   `sagreras/transcribe.py`). No hay TAB impresa, así que ese es el único control automático: **hay que cotejar a ojo**
   el PDF generado con el original. Opciones de `pieces.json`: `short` (compases cortos que la edición imprime así:
   anacrusa, medio compás antes de la repetición), `eighth_triplets` (corcheas de tresillo sin el «3»), `fifths`/`time`
   (cuando el lector no los reconoce), `key_changes` (conserva los cambios de armadura leídos; por defecto una sola
   armadura por pieza), `tuning` (`dropd`).
3. `build.py N` pasa la fuente por el motor y deja el PDF y el MusicXML en `downloads/barrios/` y las vistas en
   `src/site/articles/barrios/`.

Desde un worktree, `resources/` se toma del checkout principal. Verificación: `node --test test/barrios.unit.js`.

## Lo que difiere de la edición de Apke

- No se copian sus ligados, cifras de cuerda ni marcas de posición; sí los dedos de la izquierda y las letras p i m a.
- Las barras dobles se leen como barras simples.
- El motor no digita E♯, B♯, F♭ ni C♭: se escriben como F, C, E y B (misma altura).
