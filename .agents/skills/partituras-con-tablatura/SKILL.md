---
name: partituras-con-tablatura
description: Build a site page of public-domain guitar scores with notation and generated tablature, as done for Carcassi's preludes and waltzes. Use when adding a new collection of pieces, sourcing the originals, extracting notes from a score PDF, or publishing pieces one by one.
---

Una **colección** es una página del sitio (`/articulos/...`) con una tarjeta por pieza: vista previa con TAB, modal con
la partitura completa y descarga en PDF. Ya existen preludios de Carcassi (dos ediciones) y valses del Op. 59.
Si el pedido es solo descargar un libro o separar sus partituras en `resources/`, entrega esos recursos y su índice;
la conversión musical y la publicación de una colección corresponden a pedidos que las incluyan.

## 1. Fuentes y originales

- Fuentes probadas y descartadas: `docs/fuentes-de-partituras.md`. Léelo antes de buscar.
- **Guarda siempre copia del original en `resources/<colección>/`** (no se versiona) y escribe ahí un `README.md` con
  la procedencia y las diferencias con el libro. Es la base de toda revisión posterior.
- Si otro agente trabaja sobre una carpeta de `resources/`, trátala como solo lectura.
- Para descargar un método, buscar formatos editables o separar sus partituras en PDF, lee
  [Descarga y recorte de métodos](references/descarga-y-recorte.md): incluye fuentes verificadas con Sagreras y Aguado,
  descargas directas de IMSLP y revisión de cortes sobre escaneos.
- Compara lo extraído con el libro impreso: orden, compás, armadura, repeticiones, Fine, D.C.
- Obra y edición: dominio público no cubre la digitación ni la tipografía modernas.

## 2. Leer las notas

Elige por el tipo de original:

| Original | Método |
|---|---|
| PDF vectorial de MuseScore (fuente Leland) | Leer la geometría con PyMuPDF, sin OCR: `scripts/carcassi-valses/pdf_notes.py` |
| Escaneo antiguo | Transcripción manual en Python (`scripts/carcassi-preludios/transcribe_*.py`). El OCR (homr, Audiveris) confunde dedos con notas |
| Archivo MuseScore `.mscz` (zip con un `.mscx`) | `scripts/carcassi-progresivas/mscx_to_musicxml.py`: lee las notas exactas, sin OCR. **Preferirlo al PDF** si el autor publica el archivo (en YouTube suele ir un segundo enlace de Drive en la descripción) |
| Archivo LilyPond, MusicXML o GPX | Convertir directamente |

### Lo aprendido con PDF de MuseScore

- Las cabezas, los silencios, las alteraciones y los puntillos son texto Leland (puntos SMuFL: `E0A4` cabeza negra,
  `E4E3`–`E4E7` silencios, `E260`–`E262` alteraciones, `E240`–`E243` corchetes, `E044` puntos de repetición). Las plicas,
  barras de compás y barras de corchea son trazos y polígonos.
- Los **grosores de trazo cambian de un PDF a otro**: deducirlos por frecuencia, no fijarlos.
- Altura: posición vertical respecto de las líneas del pentagrama. Voces: dirección de la plica.
- Duración: plica + barras (el polígono inclinado se interpola en la x de la plica) + corchete + puntillo.
- Un PDF puede traer páginas extra sin TAB (copia en solo notación) y líneas adicionales cortas que no son pentagrama.
- Casos que hay que tratar: anacrusa y compás de cierre complementarios; tres voces con dos de plica abajo (el inicio
  sale de la posición horizontal); una cabeza con dos plicas es una sola nota; plica en tramos por cabeza; cabeza sin plica
  dentro de un grupo con barras; notas de adorno (glifo más pequeño); ligaduras de prolongación (curva corta entre
  cabezas de la misma altura); silencio de redonda = compás completo; cambio de armadura entre sistemas.
- **Control automático**: cada compás debe sumar su duración (`scripts/carcassi-valses/check.py`). Un compás en que una
  voz se pasa del total es un error de lectura. Los cortos suelen ser anacrusa y cierre.
- Siempre **cotejar a ojo** el PDF generado contra el original, página por página, y buscar compases que no cuadren.

### Lo aprendido con archivos MuseScore (`.mscx`)

El `.mscx` es XML limpio. El conversor (`mscx_to_musicxml.py`, solo biblioteca estándar) lee el **primer** pentagrama
(el segundo es la TAB de MuseScore, que se ignora: la calcula el motor) y descarta digitaciones, trazos de posición
(I, II, V…), saltos de página y estilo. Trampas encontradas:

- Descarga de Drive sin API: `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`
  (a veces devuelve un error 500 en HTML: reintentar y comprobar que empieza por `PK`/`%PDF`).
- Las alturas suenan **escritas** para clave de sol 8vb; la ortografía sale del `tpc` (14 = do, +1 por quinta), no del
  MIDI (si no, do♯ y re♭ se confunden).
- `Marker` (Fine, segno) y `Jump` (D.C./D.S.) **cuelgan del compás**, no de la voz; `Fermata` va antes del acorde que
  corona; `Tuplet`…`endTuplet` envuelven los acordes; las ligaduras de unión y de expresión son `Spanner` con `next`/`prev`.
- Las **casillas** (1.ª/2.ª vez) son `Volta` con `endings` y número de compases; music21 las pierde al unir dos
  pentagramas en una parte, así que `tabify.inject_endings` las reinyecta como `<ending>`.
- Los reguladores `HairPin` de subtipo 2 y 3 son «cresc.»/«dim.» **con línea de texto**, no cuñas: imprimirlos como texto
  (`Cres.`/`Dim.`). Inicio y final pueden estar en voces distintas: emparejar por posición (conversor en dos pasadas).
- `Rest` con `durationType` = `measure` es un compás completo; los silencios de relleno de una voz se ocultan.
- MuseScore usa a veces `D.S. al Fine` donde el libro dice `D.C.`, «Mineur» donde dice «Minor.», `GALOP` por «Gallop»:
  la corrección va en `pieces.json` (`texts`, `words`, `tempo`, `segno`, `ignore_marks`, `no_fermata`), no a mano en la fuente.
- **MuseScore 3 (TabGuitar, Aguado)**: la primera voz cuelga del compás sin `<voice>`, la armadura va en `<accidental>`,
  y los esquemas antiguos usan `<Tuplet id>` + `<Tuplet>id</Tuplet>` en cada acorde y `<Slur type=start|stop id>`;
  `upgrade_musescore3` los normaliza (y descarta ligaduras sin final). Una transcripción puede cambiar la métrica
  (lección 29: 3/4 con valores duplicados frente al 3/8 del libro: `"halve": true`) o numerarse distinto del libro
  (el Estudio 2 de TabGuitar no es el del libro): comprobar cada pieza con el facsímil antes de publicarla.
  Catálogo con nombre propio por pieza: `scripts/aguado/` + `scripts/lib/article-aguado.js`.
- **Comparar con el libro** sigue siendo obligatorio: el archivo del autor puede traer errores (se encontró un compás
  distinto entre dos transcripciones independientes, y la del libro decidió).

## 3. Generar el MusicXML y el PDF con TAB

- El MusicXML lleva solo alturas y duraciones; la TAB la propone el motor (`backend/engine/tabify.py`, afinación estándar o
  Drop D). No se copia nada del PDF original a la salida. Alturas **escritas** (clave de sol), un tiempo = una semicorchea.
- `scripts/carcassi-<colección>/build.py` reutiliza `build` de `scripts/carcassi-preludios/extract.py`. Salida:
  `downloads/<colección>/<Pieza> - Matteo Carcassi.pdf` y `.musicxml`, vista previa en
  `src/site/articles/<colección>/<prefijo>-NN.svg` y páginas en `full/`.
- El nombre del PDF debe ser `<Pieza> N in <Tonalidad> (Major|Minor) - Matteo Carcassi.pdf`: la página lo descubre por ese nombre.
- Un PDF de una sola página: si se derrama un compás a una segunda, usar `PDF_OVERRIDES` (escala menor, página virtual mayor).
  `scripts/carcassi-progresivas/build.py` lo prueba solo (`SCALES`): sube la página virtual y baja la escala de Verovio
  (entera) hasta que el PDF ocupa menos páginas. Cambiar solo `scale` no mueve nada: hay que cambiar también el tamaño
  de página en proporción (`pageWidth`/`pageHeight` × 45/escala).
- Las marcas «Fine» y «D.C.» salen del MusicXML como `<words>` al final del compás. Para que el motor las conserve en
  una colección curada hay que poner `tabify.KEEP_TEXT = True` (por defecto se borran porque en una subida son ruido del OCR).
- Las colecciones con **nombre propio por pieza** (no «N in tonalidad») no usan `article-carcassi-preludes.js`: ver
  `scripts/lib/article-carcassi-progressive.js` (`Progressive Piece N - <forma> - Matteo Carcassi.pdf`, formas en
  `scripts/carcassi-progresivas/pieces.json`) y `scripts/lib/score-svg.js` con los helpers de SVG compartidos.
- La fuente curada es `sources/NN.musicxml` (se puede editar a mano); `build.py convert N archivo.mscz` la regenera, y
  `build.py N` la pasa por el motor.
- Un compás con notas descartadas hace fallar el build (`Notas descartadas`): revisar la lectura de ese compás.
- Afinaciones especiales (scordatura) no las soporta el motor: dejar la pieza fuera y avisar.

## 4. Registrar la página

`AGENTS.md` pide registrar el slug en español e inglés en `scripts/lib/slugs.js` (sin redirección). Además:

- Edición nueva en `scripts/lib/article-carcassi-preludes.js` (`createEdition`).
- `scripts/build-site.js`: constante del slug, render, tarjeta en el índice de artículos, copia de assets, menú, sitemap.
- Textos en `src/i18n/strings.es.json` y `strings.en.json`; cuerpo en `src/site/articles/<colección>/body.{es,en}.html`
  con el marcador `%%PRELUDES%%` (o `%%PIECES%%` en la colección de piezas progresivas).
- Un módulo nuevo debe aportar su propio test (`test/carcassi-progresivas.unit.js`: compases del libro por pieza en
  `MEASURES`) y un bloque en `test/articles.e2e.js`; el número de tarjetas del índice sube con cada colección.
- `.gitignore` excluye `resources/` y `__pycache__`: no usar `git add -f` sobre un directorio entero de scripts (se coló
  el bytecode una vez).
- El índice de artículos solo lleva tarjetas (sin enlace de texto aparte). El e2e `test/articles.e2e.js` cuenta las tarjetas.

## 5. Entregar pieza a pieza

1. Extraer, comprobar sumas, generar, **mirar el PDF** y compararlo con el original.
2. `node scripts/build-site.js`, `node test/articles.e2e.js` y `npm run test:unit`.
3. Commit y push de **cada pieza** por separado, con su TAB. Si el push se rechaza, `git pull --rebase` (otra sesión puede
   estar publicando otra colección en paralelo y tocando `build-site.js`, `slugs.js` y `strings.*.json`: los conflictos
   se resuelven conservando ambas entradas).
   Un arreglo del conversor o del motor obliga a **reconstruir todas las piezas ya publicadas** y a revisarlas.
4. Cada push cancela la ejecución de CI anterior y el despliegue solo corre al terminar CI: con varios pushes seguidos
   nada se despliega hasta que una ejecución no se interrumpa. Avísalo si alguien «no ve» la página.
