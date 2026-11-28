# Partituras de Sor

Cuatro páginas, desde los archivos LilyPond de [Mutopia](https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF)
(CC BY-SA 2.5, 3.0 o 4.0 según la pieza; el Op. 35 n.º 14 es de dominio público) y transcripciones de impresos históricos de dominio público:

| Colección | Página | Catálogo | Fuentes | Salida |
|---|---|---|---|---|
| `lecciones` | `/partituras/lecciones-progresivas-de-sor` (Op. 60, 25 lecciones) | `pieces.json` | `sources/sor_op60-NN.ly` | `downloads/sor/`, `src/site/articles/sor/` |
| `estudios` | `/partituras/estudios-de-sor` (Op. 35) | `estudios.json` | `sources/estudios/*.ly` | `downloads/sor-estudios/`, `src/site/articles/sor-estudios/` |
| `opus44` | `/partituras/piezas-progresivas-opus-44-de-sor` | `opus44.json` | `sources/opus44/sor_op44-NN.ly` | `downloads/sor-op44/`, `src/site/articles/sor-op44/` |

El Op. 6 se publica por separado en `/partituras/estudios-de-sor-opus-6`, con los mismos archivos de `estudios.json` filtrados por opus. Sus doce estudios tienen revisión pendiente.

La clave del catálogo es el número de la lección; en los estudios, opus × 100 + número (601 = Op. 6 n.º 1, 3524 = Op. 35
n.º 24; también 4401 = Op. 44 n.º 1). `form`/`es` son la tonalidad, `editor` y `license` los de la edición de Mutopia;
`license_family: "by"` distingue CC BY de la licencia BY-SA predeterminada; `tuning: "dropd"` pone la sexta
cuerda en Re (Op. 6 n.º 7 y 9) y `"lowf"` en Fa (Op. 35 n.º 12); `patches` son correcciones de erratas del `.ly` (ver abajo). `string_hints: true` hace que el conversor lea `\3` tras una nota como cuerda fija en la TAB (en el Op. 35 n.º 24, compás 19, `c,\3`: el do en la 3.ª cuerda, traste 5, en vez de la 2.ª al 1).

```sh
.venv-carcassi/bin/python scripts/sor/build.py [estudios] convert 3501   # el .ly -> sources/.../3501.musicxml
.venv-carcassi/bin/python scripts/sor/build.py [estudios] 3501           # -> downloads/ + vistas del sitio
.venv-carcassi/bin/python -m unittest discover -s scripts/sor -p 'test_*.py'
node --test test/sor.unit.js
```

Los originales (con su `.mid` y `.rdf`) están en `resources/sor/mutopia/` (no versionado). El libro de 1830
(*Méthode pour la guitare*, `resources/sor/metodo-1830/`) son escaneos difusos y casi todo son ejemplos cortos: no sirve.

Las lecciones del Op. 60 llevan el título en español («Lección 1: Do mayor») dentro del PDF, sus metadatos,
el MusicXML y las páginas del visor. Los nombres de archivo se conservan en inglés para mantener las URL de descarga.
Las tarjetas y la navegación siguen el idioma de la página.

El Op. 44 tiene una página y un catálogo propios; sus títulos del PDF y del visor también están en español,
con nombres de archivo en inglés. La colección conserva los originales completos para continuarla. Fuentes, cotejos y alcance en [la nota de procedencia](../../docs/sor-op44-procedencia.md).
No se confunde con el Op. 44 bis para dos guitarras.

## Agregar una pieza a una colección existente

Consulta el catálogo de arriba y la nota de procedencia del opus. Para el Op. 44, usa
[`docs/sor-op44-procedencia.md`](../../docs/sor-op44-procedencia.md) para localizar los facsímiles en
`resources/sor-op44/imslp/` del checkout principal. Los facsímiles se conservan intactos. Las transcripciones
LilyPond van en `scripts/sor/sources/opus44/` y el build genera las descargas y los SVG.

Por ejemplo, para incorporar la n.º 5, toma como modelo la n.º 1 o la n.º 2. Después de
localizar la pieza en el facsímil, añade `sor_op44-05.ly` y la entrada `"4405"` con `n: 5` (entero) en
`opus44.json`. Ejecuta:

```sh
.venv-carcassi/bin/python scripts/sor/build.py opus44 convert 4405
.venv-carcassi/bin/python scripts/sor/build.py opus44 4405
node --test test/sor.unit.js test/sor-op44.unit.js
```

Añade la procedencia y el recuento de compases cotejado en los controles de la colección que correspondan.

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

Las lecciones 16–25 y el bajo del compás 3 de la lección 5 se cotejaron con los impresos de París.
La procedencia, páginas y decisiones están en [la nota del Op. 60](../../docs/sor-op60-procedencia.md).
Esto no da por revisadas las demás piezas de Mutopia contra esos impresos.

## Diferencias con la edición de Mutopia

- Op. 35 n.º 13, compás 27: el archivo escribe `g,16` en la voz interna mientras el bajo toca `gis,2`; la figura es un
  sol♯ (y el sol natural más el sol♯ no se pueden tocar a la vez). Se corrige con `patches` a `gis,16`.
- Op. 60 n.º 5, compás 3, segundo bajo: se restaura Sol grave. Los impresos de París #836891 (p. 4) y
  #470312 (p. 6), Mutopia y su facsímil escriben Sol. Se retira el antiguo parche a Mi, que seguía la edición
  moderna de Stefan Nesyba; no se considera una errata demostrada del original.
- Op. 60 n.º 5 empieza en la menor y pasa a La mayor en el compás 17: título «A Minor and A Major».
- Op. 60 n.º 7, compás 6: los dos mi se tocan en la primera cuerda al aire. Mutopia indica dedo 4 en el segundo;
  el motor interpreta esa indicación junto al do con dedo 1 como posición pisada y asigna ambos mi al traste 5 de
  la segunda cuerda. Se sustituyen las indicaciones de ambos mi por dedo 0 con `patches`, como elección editorial
  para mantener la primera posición y facilitar el fa del compás siguiente; las alturas no cambian.

## Lecciones del Op. 60 transcritas de IMSLP (14 en adelante)

Mutopia publica las primeras 13. Las lecciones 14–25 se transcriben a mano de los escaneos de dominio público de
[IMSLP](https://imslp.org/wiki/Introduction_%C3%A0_l%27%C3%A9tude_de_la_guitare,_Op.60_(Sor,_Fernando)),
conservados intactos en `resources/sor/imslp/` (no versionado):

- Gitarrefreund, Múnich 1915-17: fuente de las lecciones 14–15 y cotejo de 16–24.
- París, chez l'auteur, ca. 1837, #836891: fuente principal de 16–25.
- París, l'Editeur et Auteur, #470312: segundo testimonio completo; Dunst #120240 como cotejo adicional.

Se escribe `sources/sor_op60-NN.ly` a mano con `\fixed c` (alturas que suenan: la escrita menos una octava), una voz de
`\score` por voz de la partitura (`upper`, `inner`, `bass`; `s` para el hueco que el grabado no dibuja) y `\repeat volta`
con `\alternative` en cada voz. Sin digitación. El conversor exige que cada compás sume lo que marca la métrica en
cada voz, lo que atrapa los errores de duración, pero no los de altura: esos se buscan comparando el PDF generado con
el escaneo compás a compás. En `pieces.json` llevan `"license": "public-domain"` y `credit`/`credit_url`, que
sustituyen al crédito a Mutopia del pie.

La lección 25 usa Drop D y armónicos naturales. El `.ly` contiene los sonidos resultantes; las notas auxiliares de
operación del original no se convierten en otra voz. `harmonics` en el catálogo fija los contactos (cuerda y traste,
inicio en negras). `harmonics.py` añade diamantes y metadatos de armónico natural, aplica esos contactos a la TAB y
conserva las alturas sonoras en el MusicXML exportado. El 3 especial de Sor es el nodo del sexto parcial, cerca de
3,16, hacia el puente. `test_harmonics.py` contrasta cada contacto con la afinación y su parcial;
`test_sustained_strings.py` impide cortar las notas prolongadas de 16–25 al cambiar de altura en la misma cuerda.

## Pendiente

- Cotejar las lecciones 1–15 restantes y los Op. 6 y Op. 35 con los impresos históricos.
- En Op. 35 n.º 6, 8, 16 y 21 el MIDI de Mutopia se desfasa (`\partial` dentro de repeticiones, `Timing.measureLength`): se
  publicaron por el PDF (mismos compases y notas) y el recuento de alturas.
