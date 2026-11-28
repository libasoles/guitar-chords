# Guía para Qwen: procesar partituras del Op. 44 de Sor

Pasale este archivo a Qwen como contexto junto con el número de pieza. Trabajá en la raíz de
`guitar-chords` y seguí el orden de abajo. Procesá una pieza por vez.

## 1. Encontrá la fuente

- Leé [AGENTS.md](../AGENTS.md), la [guía de partituras con tablatura](../.agents/skills/partituras-con-tablatura/SKILL.md)
  y el [README del generador de Sor](../scripts/sor/README.md). Revisá [opus44.json](../scripts/sor/opus44.json)
  y confirmá con `rg --files downloads/sor-op44` si la pieza ya existe.
- Usá `git worktree list` para localizar el checkout principal. Los facsímiles y el entorno
  `.venv-carcassi` están allí. `resources/` es local y queda fuera de Git. Si trabajás en un
  worktree, leé los originales directamente y reutilizá el Python y las dependencias del checkout
  principal. Los comandos de abajo se ejecutan desde el worktree de la tarea.
- Consultá la [procedencia del Op. 44](sor-op44-procedencia.md). El facsímil principal es IMSLP
  #837753, edición de París de Sor y Pacini. El #470296 sirve para cotejar. Las páginas de un PDF
  pueden corresponder a otras páginas del segundo.
- Usá Poppler (`pdfinfo`, `pdftoppm`) para renderizar la página y ImageMagick (`magick`) para
  recortar o ampliar un pasaje. Abrí las imágenes con el visor de tu entorno. Este ejemplo renderiza
  la página que contiene las piezas 3 y 4. Para otra pieza, localizá primero su número impreso.

~~~sh
repo_main="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
revision_dir="$(mktemp -d)"
facsimil="$repo_main/resources/sor-op44/imslp/IMSLP837753.pdf"
pdfinfo "$facsimil"
pdftoppm -png -r 180 -f 3 -l 3 "$facsimil" "$revision_dir/pacini"
magick "$revision_dir/pacini-03.png" -crop 1270x645+85+565 +repage -resize 170% "$revision_dir/detalle.png"
~~~

Antes de escribir, registrá número impreso, página del PDF, título, armadura, compás, anacrusa,
repeticiones y casillas. Si te falta la imagen o una lectura sigue dudosa después de ampliar y
cotejar, anotá `unverified` junto a edición, página, compás, voz y signo en cuestión. Pedí revisión
humana de ese punto y mantené pendiente la publicación de la pieza. Un generador que termina bien
solo demuestra que pudo procesar la entrada.

## 2. Transcribí la notación

- Tomá como modelo [la n.º 3](../scripts/sor/sources/opus44/sor_op44-03.ly) para voces independientes
  y ligaduras que cruzan la barra, o [la n.º 4](../scripts/sor/sources/opus44/sor_op44-04.ly) para
  anacrusa, repeticiones, casillas y una voz interior.
- Escribí `scripts/sor/sources/opus44/sor_op44-NN.ly` con `\fixed c` y clave `"treble_8"`.
  Usá alturas sonantes, una octava por debajo del pentagrama impreso. La primera línea del
  pentagrama corresponde a Mi3 sonante (`e`) y el Do central escrito a Do3 sonante (`c`).
  Conservá la ortografía de las alteraciones y las duraciones de cada voz.
- Marcá las barras con `|` en cada voz. Completá los huecos de una voz con `s` cuando el original
  no dibuje un silencio. Con `r` el silencio sí se imprime. Usá `~` para prolongar la misma altura
  y paréntesis para las ligaduras de expresión. Copiá las articulaciones que correspondan.
- Añadí la entrada al [catálogo](../scripts/sor/opus44.json). La clave es `4400 + NN` y `n` es el
  número impreso como entero. Copiá el esquema de una pieza con el mismo tipo de fuente y usá
  la procedencia y licencia realmente verificadas. Seguí las convenciones de título del README.

## 3. Generá y verificá

Ejemplo para incorporar la n.º 5. Ajustá el número a la tarea. Si el entorno virtual vive en el
checkout principal, usá su Python mediante la ruta entre comillas de abajo.

~~~sh
sor_python="$repo_main/.venv-carcassi/bin/python"
if [ ! -e node_modules ] && [ -d "$repo_main/node_modules" ]; then
  ln -s "$repo_main/node_modules" node_modules
fi
"$sor_python" scripts/sor/build.py opus44 convert 4405
"$sor_python" scripts/sor/build.py opus44 4405

"$sor_python" -m unittest discover -s scripts/sor -p 'test_*.py'
node --test test/sor.unit.js test/sor-op44.unit.js
node scripts/build-site.js
git diff --check
~~~

- El conversor genera `4405.musicxml` junto al `.ly`. El generador produce PDF y MusicXML con
  tablatura en `downloads/sor-op44/`, una vista previa y un SVG por página del visor en
  `src/site/articles/sor-op44/`. Si el generador informa notas descartadas, investigá el compás y
  corregí la causa antes de continuar.
- Añadí en [procedencia](sor-op44-procedencia.md) la fuente, páginas y decisiones de transcripción.
  Actualizá el recuento en [test/sor.unit.js](../test/sor.unit.js). Contá la anacrusa como un
  elemento `<measure>` si figura como tal. Contá los compases escritos y las casillas una sola vez,
  sin desplegar las repeticiones.
- Renderizá el PDF final con `pdftoppm -png -r 145 "ruta al PDF" "$revision_dir/generado"`.
  Cotejá compás por compás con el facsímil. Revisá también que la TAB y el pie de fuente
  sean legibles y que la tarjeta y el visor aparezcan en los tres idiomas.
- Para comparar con código, usá Python (`xml.etree.ElementTree` y `fractions.Fraction`).
  Compará inicio, duración, altura y alteración de cada nota de la fuente con el pentagrama
  `staff=1` de la descarga. Interpretá `divisions`, `backup`, `forward` y `chord`.
  En `staff=2`, cada ataque debe tener la altura de la cuerda al aire más el traste. En afinación
  estándar, los MIDI al aire de la 1.ª a la 6.ª cuerda son 64, 59, 55, 50, 45 y 40.
  Una continuación de ligadura no cuenta como ataque.
- Revisá las notas sostenidas y los ataques de la misma altura en voces distintas. En el compás 8
  de la n.º 4 el Sol del bajo se mantiene en la 4.ª cuerda y el nuevo ataque usa la 3.ª al aire. El motor aplica
  `string_hints` por altura dentro del compás. Para cuerdas distintas en ataques distintos del
  mismo compás, usá `tab_fixes` como en la entrada 4404. La clave `"9"` apunta al noveno
  elemento `<measure>`, porque la anacrusa cuenta como el primero.

## 4. Entregá la pieza

Antes del commit, comprobá fuente LilyPond, MusicXML de la fuente, PDF y MusicXML descargables,
SVG de vista previa, SVG del visor, procedencia y pruebas. Agregá rutas explícitas con `git add`.
Dejá los facsímiles, recortes e imágenes de revisión fuera del commit. Seguí el flujo de
[AGENTS.md](../AGENTS.md) y de la [guía de partituras](../.agents/skills/partituras-con-tablatura/SKILL.md)
para el commit por pieza, merge directo, push y limpieza del worktree.

Al informar el resultado, indicá número, tonalidad, fuente, pruebas ejecutadas, decisiones
de lectura y cualquier `unverified`. Si consultás el despliegue con `gh api`, distinguí el
push a `main` del estado de GitHub Pages.
