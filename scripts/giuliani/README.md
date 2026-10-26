# Estudios de Giuliani (24 Esercizi, Op. 48)

Página: `/articulos/estudios-de-giuliani`. Cada estudio es una pieza (`pieces.json`: clave = número del estudio, `title` en
español, `en` en inglés). Opciones por pieza, las mismas que en Barrios: `short`, `eighth_triplets`, `fifths`, `time`,
`key_changes`, `fine`, `tuning`.

## De dónde salen las notas

De la edición de **Stefan Apke** (1985 / rev. 30 de mayo de 2026) en
[IMSLP](https://imslp.org/wiki/24_Etudes,_Op.48_(Giuliani,_Mauro)), licencia **CC BY-SA 4.0**: un PDF vectorial de
MuseScore 2.2.1 con los 24 estudios (30 páginas, fuente `MScore` como en Barrios), sin TAB, con dedos, ligados y
posiciones. Se baja de
`https://s9.imslp.org/files/imglnks/usimg/1/1c/IMSLP1038590-PMLP58657-Giuliani_M-24_Etudes_Op48+mid.pdf` y se guarda en
`resources/giuliani-op48/` (no versionado; SHA-256 `876da610…c0b6`). Las otras ediciones de la ficha (Haslinger, Richault,
Cocks, Krüger 1906, Ritter/Schott) son escaneos.

1. `transcribe_giuliani.py N` lee todo el PDF con `barrios/apke_notes.py` y lo parte por las barras finales (24 estudios,
   679 compases). Cada compás recuerda la métrica de su sistema. Mismo control que Barrios: cada compás debe sumar su
   duración. **Cotejar a ojo** el PDF generado con el original.
2. `slurs.py` lee los **ligados** (curvas que no son ligaduras de unión): inicio y fin sobre la cabeza o su plica, y los
   que cruzan de un sistema al siguiente se cierran en el sistema siguiente. Salen como `<slur>` en el MusicXML y el
   motor los conserva.
3. `fingers.py` empareja los **dedos** de la izquierda con su cabeza teniendo en cuenta la posición de la cifra (encima,
   a la izquierda, a la izquierda de una alteración). Las cifras sin cabeza se avisan al leer (`finger sin nota`).
4. `build.py N` pasa la fuente por el motor y deja el PDF y el MusicXML en `downloads/giuliani/` y las vistas en
   `src/site/articles/giuliani/`.

Verificación: `node --test test/giuliani.unit.js`.

## Lo que difiere de la edición de Apke

- No se copian sus cifras de cuerda ni sus marcas de posición (I, III, VIII…); sí los ligados y los dedos.
- Las barras dobles se leen como barras simples.
- Estudio 11, compases 17–18: seisillos y quintillo de fusas seguidos. Las alturas, dedos y ligados se leen bien, pero el
  ritmo no (`respace` en `pieces.json` lo reasigna). El último pulso del compás 18 (11 notas bajo un «5») se escribe como
  10 fusas y una semicorchea final: aproximado, no idéntico al impreso.

## Opciones de `pieces.json` propias de Giuliani

`low_rests` (silencios de la voz grave asignados a la aguda: `[compás, x]`), `pad` (completa con silencios el compás
indicado), `durations` (`[compás, inicio, duración]`: figura mal leída), `respace` (`{compás: [duraciones]}`: ritmo
reasignado nota a nota). Más `eighth_triplets` / `sixteenth_sextuplets` (tresillos y seisillos continuos, también para
sus silencios).

Los ligados entre voces de un mismo compás se reordenan en el XML (`order_slurs`): Verovio enlaza inicio y fin por orden
del documento y, si la voz 2 (después del `<backup>`) lleva el inicio, la curva se alargaba hasta otro compás. Se
intercambian los dos extremos (la curva une las mismas notas) y se les da un número propio.
