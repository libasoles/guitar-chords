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
- Op. 60 n.º 5 empieza en la menor y pasa a La mayor en el compás 17: título «A Minor and A Major».

## Lecciones del Op. 60 transcritas de IMSLP (14 en adelante)

Mutopia solo publica 13 de las 25; el resto no existe como LilyPond, MusicXML ni MIDI en ninguna fuente libre. Se
transcriben a mano de los escaneos de dominio público de
[IMSLP](https://imslp.org/wiki/Introduction_%C3%A0_l%27%C3%A9tude_de_la_guitare,_Op.60_(Sor,_Fernando)) (la descarga
tiene captcha: se bajan a mano a `resources/sor/imslp/`, no versionado):

- Gitarrefreund, Múnich 1915-17 (la misma edición de la que parten las lecciones 6 a 13 de Mutopia): `Sor_-_Op.60_No.13-16.pdf`,
  `No.17-19`, `No.20-21`, `No.22`, `No.23`, `No.24`. Es la fuente principal.
- Edición de París (`Sor_op.60.pdf`, una lección por página, la única con la 25): se usa para resolver lo que el escaneo
  de Gitarrefreund deja dudoso (alteraciones, puntillos, ligaduras).

Se escribe `sources/sor_op60-NN.ly` a mano con `\fixed c` (alturas que suenan: la escrita menos una octava), una voz de
`\score` por voz de la partitura (`upper`, `inner`, `bass`; `s` para el hueco que el grabado no dibuja) y `\repeat volta`
con `\alternative` en cada voz. Sin digitación. El conversor exige que cada compás sume lo que marca la métrica en
cada voz, lo que atrapa los errores de duración, pero no los de altura: esos se buscan comparando el PDF generado con
el escaneo compás a compás. En `pieces.json` llevan `"license": "public-domain"` y `credit`/`credit_url`, que
sustituyen al crédito a Mutopia del pie.

## Pendiente

- **Op. 35 n.º 12** queda fuera: Mutopia indica «Low E tuned to F» (la sexta cuerda en Fa) y el motor solo admite
  afinación estándar y Re en la sexta (`tuning: "dropd"`). Su `.ly` está en `sources/estudios/` pero no se publica.
- Cotejar con un escaneo del Op. 60, Op. 6 y Op. 35 de IMSLP.
- Las lecciones 15 a 25 del Op. 60 no están en Mutopia: se transcriben de IMSLP (ver abajo).
- En Op. 35 n.º 6, 8, 16 y 21 el MIDI de Mutopia se desfasa (`\partial` dentro de repeticiones, `Timing.measureLength`): se
  publicaron por el PDF (mismos compases y notas) y el recuento de alturas.
