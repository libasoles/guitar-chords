# Partituras de Aguado (Nuevo método para guitarra, 1843)

Página: `/articulos/partituras-de-aguado`. Lecciones con ejemplo musical, ejercicios de mano derecha y estudios de la
sección tercera del *Nuevo método para guitarra* (Madrid, 1843). `pieces.json` es el catálogo: la clave es el orden
en la página, `kind`/`n` dan el nombre del libro (`Lesson 14`, `Study 9`) y `form`/`es` el nombre de la forma.

## De dónde salen las notas

Los MuseScore de TabGuitar (Luigi Borgognoni), descarga gratuita, citan el facsímil Boije 0018 como fuente. Están en
`resources/aguado/nuevo-metodo/editables-tabguitar/` (no versionado, con su `manifest.json`); el libro, en
`resources/aguado/nuevo-metodo/fuentes/` y recortado en `partituras/`. No se ha declarado licencia para las
transcripciones: se usan las notas, no los PDF ni la tipografía de TabGuitar.

1. `build.py convert N` lee el `.mscz` con `scripts/carcassi-progresivas/mscx_to_musicxml.py` y escribe
   `sources/NN.musicxml` (fuente curada).
2. `build.py N` pasa la fuente por el motor y deja el PDF y el MusicXML en `downloads/aguado/` y las vistas en
   `src/site/articles/aguado/`.

Como `resources/` solo existe en el checkout principal, desde un worktree hay que fijar `RESOURCES_DIR`.

```sh
RESOURCES_DIR=/ruta/al/checkout/resources .venv-carcassi/bin/python scripts/aguado/build.py convert 1
.venv-carcassi/bin/python scripts/aguado/build.py 1
```

## Lo que difiere del archivo de TabGuitar

- Son archivos de MuseScore 3 (y algunos con esquema de MuseScore 2): el conversor los lleva al esquema de MuseScore 4
  (`upgrade_musescore3`): primera voz sin `<voice>`, tresillos y ligaduras con `id`, armadura en `<accidental>`.
  Las ligaduras sin final en el archivo (lección 33) se descartan.
- Lección 29: el archivo escribe 3/4 con valores duplicados; el libro tiene 3/8. `"halve": true` lo devuelve a 3/8.
- Se conservan los dedos de la izquierda (0-4) y las letras p i m a de la derecha de cada nota (`hand_marks=True` en el
  conversor, como `<fingering>`); el motor toma los dedos como pista de la TAB y no cambia las letras. Los números de
  cuerda con círculo no se copian. Cada PDF lleva al pie el crédito a TabGuitar (`pdf_footer.py`, igual que Sagreras con
  Marieh); la web ya lo cita en la introducción.
- **Cejillas**: los textos `C.VII`, `Barré` y `Ceja` no se imprimen tal cual (`DROP_TEXTS`), pero el conversor los lee
  (`Converter.barre_spans`) y escribe una cejilla `C 7` / `½C 7` con línea punteada (`backend/engine/barres.py`); el motor
  mantiene bajo ella las cuerdas que cubre en ese traste o más arriba. Como no traen final ni, casi siempre, el traste,
  salen de la TAB que TabGuitar dibuja en el archivo (cuerda y traste de cada nota): se elige la cejilla que esa TAB respeta
  por más notas seguidas y dura hasta la primera que la contradice o hasta la marca siguiente. Las marcas de posición
  (`VII D7`) se descartan. Se añaden o corrigen los textos que el libro imprime
  (`Andante.`, `Wals.`, `Fin.`, `Cantabile.`) en `pieces.json`.
- El libro abrevia compases con el signo de repetición de compás; el archivo los escribe completos y así se publican.
- **Estudio 2 de TabGuitar queda fuera**: es una pieza en 12/8 distinta del «Est. 2.º» del libro (2/4, Andante).
  Los demás estudios y lecciones se cotejaron con el facsímil. Mapeo pendiente: los estudios del libro que TabGuitar no
  publica (1, 3, 4, 6, 7, 12, 15–18, 20–27), las lecciones sin ejemplo en TabGuitar y los ejercicios de ambas manos.

Verificación: `node --test test/aguado.unit.js`.
