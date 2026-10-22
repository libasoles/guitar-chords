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

1. Altura y posición de cada nota contra el `.mid` de Mutopia (music21, con las ligaduras fundidas): lecciones 1, 3, 4 y 8, cero
   diferencias.
2. Vista del PDF generado junto al PDF de Mutopia: notas, repeticiones, compases cortos y dedos.

No se cotejó con el impreso del Op. 60: Mutopia parte de escaneos de `fernandosor.free.fr`.

## Pendiente

- 5, 6, 9, 10, 11, 12, 13: el MIDI difiere por notas iguales a la vez en dos voces (LilyPond las funde en una cabeza;
  aquí quedan duplicadas, lo que rompe la TAB) y por repeticiones con anacrusa. Hay que fundirlas antes de publicar.
- 2 (`\context Voice` dentro de la música) y 7 (`\acciaccatura`): sin soporte en el conversor.
- Cotejar con un escaneo del Op. 60 de IMSLP.
