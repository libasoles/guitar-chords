# Partituras de Sor

Dos páginas, las dos desde los archivos LilyPond de [Mutopia](https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF)
(CC BY-SA 2.5, 3.0 o 4.0 según la pieza; el Op. 35 n.º 14 es de dominio público):

| Colección | Página | Catálogo | Fuentes | Salida |
|---|---|---|---|---|
| `lecciones` | `/articulos/lecciones-progresivas-de-sor` (Op. 60, 13 de las 25) | `pieces.json` | `sources/sor_op60-NN.ly` | `downloads/sor/`, `src/site/articles/sor/` |
| `estudios` | `/articulos/estudios-de-sor` (Op. 6 y Op. 35) | `estudios.json` | `sources/estudios/*.ly` | `downloads/sor-estudios/`, `src/site/articles/sor-estudios/` |

La clave del catálogo es el número de la lección; en los estudios, opus × 100 + número (601 = Op. 6 n.º 1, 3524 = Op. 35
n.º 24). `form`/`es` son la tonalidad, `editor` y `license` los de la edición de Mutopia; `tuning: "dropd"` pone la sexta
cuerda en Re (Op. 6 n.º 7 y 9); `patches` son correcciones de erratas del `.ly` (ver abajo).

```sh
.venv-carcassi/bin/python scripts/sor/build.py [estudios] convert 3501   # el .ly -> sources/.../3501.musicxml
.venv-carcassi/bin/python scripts/sor/build.py [estudios] 3501           # -> downloads/ + vistas del sitio
.venv-carcassi/bin/python -m unittest discover -s scripts/sor -p 'test_*.py'
node --test test/sor.unit.js
```

Los originales (con su `.mid` y `.rdf`) están en `resources/sor/mutopia/` (no versionado). El libro de 1830
(*Méthode pour la guitare*, `resources/sor/metodo-1830/`) son escaneos difusos y casi todo son ejemplos cortos: no sirve.

## El conversor

LilyPond no está instalado y no exporta MusicXML, así que `ly_to_musicxml.py` lee el `.ly` directamente: modo
`\relative` y `\fixed`, repeticiones (`volta`, `unfold`, `\alternative`), `\partial` a mitad de pieza, voces simultáneas y
anidadas, tresillos, notas de adorno, ligaduras por altura, números de dedo, `\key`/`\time` que cambian, nombres alemanes
(`\include "deutsch.ly"`) y funciones de música definidas en el archivo. Exige que cada compás sume lo que marca la métrica,
voz por voz, como hace LilyPond con las comprobaciones de compás.

Reglas de LilyPond que se comprobaron contra el MIDI y no son las que dice el manual a primera vista:

- En modo relativo, **cada rama de `<< >>` parte de donde acabó la anterior** (no de la altura previa al `<<`).
- `\repeat unfold N { ... }` resuelve las alturas relativas **una vez** y copia el bloque: las copias son idénticas.
- Una ligadura entre alturas distintas se ignora (`d, ~ d'` en Op. 60 n.º 11).
- Con `\clef violin` el archivo da la altura **escrita**; el motor espera la que suena (una octava menos). Con
  `\clef "treble_8"` (también si va dentro de `global`) ya da la que suena.
- Dos voces con la misma altura a la vez son una sola nota en la TAB: `tabify.MERGE_UNISONS = True` (solo aquí).

Si se cambia el conversor hay que **reconstruir y revisar** todas las piezas: `test_ly_to_musicxml.py` comprueba que cada
`NN.musicxml` versionado es lo que genera el conversor actual.

## Cómo se comprobó cada pieza

1. Altura y posición de cada nota contra el `.mid` de Mutopia (music21, ligaduras fundidas, conjuntos de (instante,
   altura)). Hay diferencias que no son del archivo: music21 parte las notas largas del MIDI en cada barra contada desde 0 y
   no une una nota con el acorde que la contiene; LilyPond da tiempo real a las notas de adorno y el MIDI cuantiza las
   semicorcheas con puntillo y los tresillos de semicorcheas. Con `\partial` dentro de una repetición el MIDI se desplaza
   una negra: ahí decide el PDF de Mutopia.
2. Vista del PDF generado junto al PDF de Mutopia.

No se cotejó con el impreso: Mutopia parte de escaneos.

## Diferencias con la edición de Mutopia

- Op. 35 n.º 13, compás 27: el archivo escribe `g,16` en la voz interna mientras el bajo toca `gis,2`; la figura es un
  sol♯ (y el sol natural más el sol♯ no se pueden tocar a la vez). Se corrige con `patches` a `gis,16`.
- Op. 60 n.º 5, compás 3, segundo bajo: se cambia sol por mi grave en ambas voces, siguiendo la edición de
  [Stefan Nesyba en IMSLP](https://s9.imslp.org/files/imglnks/usimg/7/71/IMSLP606871-PMLP93616-Etude_a-Moll_op._60_Nr._5.mscz.pdf),
  que coincide con la versión con TAB cotejada. El LilyPond de Mutopia y su facsímil escriben sol; se conserva
  el archivo original y se aplica la corrección editorial con `patches`.
- Op. 60 n.º 5 empieza en la menor y pasa a La mayor en el compás 17: título «A Minor and A Major».

## Pendiente

- **Op. 35 n.º 12** queda fuera: Mutopia indica «Low E tuned to F» (la sexta cuerda en Fa) y el motor solo admite
  afinación estándar y Re en la sexta (`tuning: "dropd"`). Su `.ly` está en `sources/estudios/` pero no se publica.
- Cotejar con un escaneo del Op. 60, Op. 6 y Op. 35 de IMSLP.
- Las otras 12 lecciones del Op. 60 no están en Mutopia.
- En Op. 35 n.º 6, 8, 16 y 21 el MIDI de Mutopia se desfasa (`\partial` dentro de repeticiones, `Timing.measureLength`): se
  publicaron por el PDF (mismos compases y notas) y el recuento de alturas.
