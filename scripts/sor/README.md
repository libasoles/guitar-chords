# Lecciones progresivas de Sor (Op. 60)

Página: `/articulos/lecciones-progresivas-de-sor`. `pieces.json` es el catálogo: la clave es el número de la lección en
el Op. 60 (*Introduction à l'étude de la guitare*, 25 lecciones), `form`/`es` la tonalidad, `editor` y `license` los de
la edición de Mutopia de la que parte.

## De dónde salen las notas

Archivos LilyPond de [Mutopia](https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF) (carpeta `O60`),
licencia CC BY-SA 2.5 o 3.0 según la pieza, copiados tal cual en `sources/sor_op60-NN.ly`. Mutopia publica 13 de las 25
(la 2 y la 7 no se leen todavía: voces anidadas y `\acciaccatura`). Las copias originales, con su `.mid` y su `.rdf`,
están en `resources/sor/mutopia/` (no versionado). El libro de 1830 (*Méthode pour la guitare*) está en
`resources/sor/metodo-1830/`: son escaneos difusos y casi todo son ejemplos cortos, no piezas.

LilyPond no está instalado y no exporta MusicXML, así que `ly_to_musicxml.py` lee el `.ly` directamente (modo
`\relative`, repeticiones, `\partial`, voces simultáneas, digitación, ligaduras). Exige que cada compás sume lo que
marca la métrica, voz por voz, como hace LilyPond con las comprobaciones de compás.

```sh
.venv-carcassi/bin/python scripts/sor/build.py convert 1   # sources/sor_op60-01.ly -> sources/01.musicxml
.venv-carcassi/bin/python scripts/sor/build.py 1           # -> downloads/sor/ + vistas del sitio
.venv-carcassi/bin/python -m unittest discover -s scripts/sor -p 'test_*.py'
node --test test/sor.unit.js
```

## Altura

Con `\clef violin` el archivo da la altura **escrita** de la guitarra: el motor espera la que suena (una octava menos), y
el conversor la resta. Con `\clef "treble_8"` el archivo ya da la que suena. Se comprobó contra el MIDI de Mutopia
(el MIDI de las piezas con `\transposition` va una octava más grave: no sirve para comparar octavas).

## Cómo se comprobó cada pieza

1. Altura y posición de cada nota contra el `.mid` de Mutopia (music21, con las ligaduras fundidas y comparando
   conjuntos de (instante, altura)): lecciones 1–6, 8, 10, 11 y 13, cero diferencias. Tres diferencias que no son del
   archivo: la 9 re-ataca un mi4 mientras suena otro igual (arpegio sobre una nota larga; LilyPond lo funde en el MIDI),
   y la 12 y la 6 tienen una semicorchea con puntillo seguida de fusa que el MIDI cuantiza a tresillo. music21 además
   parte las notas largas del MIDI en cada barra contada desde 0, sin descontar la anacrusa: esas notas se descartan
   al comparar. En la 7 el MIDI no sirve a partir de la `\acciaccatura` (da tiempo al adorno).
2. Vista del PDF generado junto al PDF de Mutopia, pieza por pieza: notas, repeticiones, casillas, compases cortos,
   segno y dedos.

No se cotejó con el impreso del Op. 60: Mutopia parte de escaneos de `fernandosor.free.fr`.

## Lo que hubo que resolver

- **La misma altura en dos voces a la vez** (lecciones 5, 9, 10, 11, 12, 13): LilyPond funde las cabezas; el motor las
  tocaba dos veces en la TAB. `tabify.MERGE_UNISONS = True` (solo aquí) deja una sola nota por columna.
- **Casillas 1.ª y 2.ª** (12): el archivo no trae `|` entre ellas; cada inicio y fin de repetición o casilla es una
  barra de compás. Las marcas de repetición salen una vez aunque las lleve cada voz.
- **Compases cortos con `\partial` a mitad de pieza** (4, 6, 7, 11, 12): la anacrusa de la repeticion siguiente completa
  el compás corto y no cuenta como compás nuevo.
- **Voces que se abren a mitad de una voz** (2): pasan a voz propia, con silencios invisibles; las plicas arriba y abajo
  solo van donde suenan dos voces.
- **`\acciaccatura`** (7) como nota de adorno sin duración; **`\segno`** como dirección.
- **Ligadura entre alturas distintas** (`d, ~ d'` en la 11): se ignora, como hace LilyPond (su PDF imprime las dos notas).

## Pendiente

- Cotejar con un escaneo del Op. 60 de IMSLP.
- Las otras 12 lecciones del Op. 60 no están en Mutopia.
