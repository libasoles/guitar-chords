---
name: partituras-con-tablatura
description: Build a site page of public-domain guitar scores with notation and generated tablature, as done for Carcassi's preludes and waltzes. Use when adding a new collection of pieces, sourcing the originals, extracting notes from a score PDF, or publishing pieces one by one.
---

Una **colección** es una página del sitio (`/articulos/...`) con una tarjeta por pieza: vista previa con TAB, modal con
la partitura completa y descarga en PDF. Ya existen preludios de Carcassi (dos ediciones) y valses del Op. 59.

## 1. Fuentes y originales

- Fuentes probadas y descartadas: `docs/fuentes-de-partituras.md`. Léelo antes de buscar.
- **Guarda siempre copia del original en `resources/<colección>/`** (no se versiona) y escribe ahí un `README.md` con
  la procedencia y las diferencias con el libro. Es la base de toda revisión posterior.
- Si otro agente trabaja sobre una carpeta de `resources/`, trátala como solo lectura.
- IMSLP bloquea la descarga por script; Internet Archive sí se puede bajar.
- Compara lo extraído con el libro impreso: orden, compás, armadura, repeticiones, Fine, D.C.
- Obra y edición: dominio público no cubre la digitación ni la tipografía modernas.

## 2. Leer las notas

Elige por el tipo de original:

| Original | Método |
|---|---|
| PDF vectorial de MuseScore (fuente Leland) | Leer la geometría con PyMuPDF, sin OCR: `scripts/carcassi-valses/pdf_notes.py` |
| Escaneo antiguo | Transcripción manual en Python (`scripts/carcassi-preludios/transcribe_*.py`). El OCR (homr, Audiveris) confunde dedos con notas |
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

## 3. Generar el MusicXML y el PDF con TAB

- El MusicXML lleva solo alturas y duraciones; la TAB la propone el motor (`backend/engine/tabify.py`, afinación estándar o
  Drop D). No se copia nada del PDF original a la salida. Alturas **escritas** (clave de sol), un tiempo = una semicorchea.
- `scripts/carcassi-<colección>/build.py` reutiliza `build` de `scripts/carcassi-preludios/extract.py`. Salida:
  `downloads/<colección>/<Pieza> - Matteo Carcassi.pdf` y `.musicxml`, vista previa en
  `src/site/articles/<colección>/<prefijo>-NN.svg` y páginas en `full/`.
- El nombre del PDF debe ser `<Pieza> N in <Tonalidad> (Major|Minor) - Matteo Carcassi.pdf`: la página lo descubre por ese nombre.
- Un PDF de una sola página: si se derrama un compás a una segunda, usar `PDF_OVERRIDES` (escala menor, página virtual mayor).
- Las marcas «Fine» y «D.C.» salen del MusicXML como `<words>` al final del compás.
- Un compás con notas descartadas hace fallar el build (`Notas descartadas`): revisar la lectura de ese compás.
- Afinaciones especiales (scordatura) no las soporta el motor: dejar la pieza fuera y avisar.

## 4. Registrar la página

`AGENTS.md` pide registrar el slug en español e inglés en `scripts/lib/slugs.js` (sin redirección). Además:

- Edición nueva en `scripts/lib/article-carcassi-preludes.js` (`createEdition`).
- `scripts/build-site.js`: constante del slug, render, tarjeta en el índice de artículos, copia de assets, menú, sitemap.
- Textos en `src/i18n/strings.es.json` y `strings.en.json`; cuerpo en `src/site/articles/<colección>/body.{es,en}.html`
  con el marcador `%%PRELUDES%%`.
- El índice de artículos solo lleva tarjetas (sin enlace de texto aparte). El e2e `test/articles.e2e.js` cuenta las tarjetas.

## 5. Entregar pieza a pieza

1. Extraer, comprobar sumas, generar, **mirar el PDF** y compararlo con el original.
2. `node scripts/build-site.js`, `node test/articles.e2e.js` y `npm run test:unit`.
3. Commit y push de **cada pieza** por separado, con su TAB. Si el push se rechaza, `git pull --rebase`.
4. Cada push cancela la ejecución de CI anterior y el despliegue solo corre al terminar CI: con varios pushes seguidos
   nada se despliega hasta que una ejecución no se interrumpa. Avísalo si alguien «no ve» la página.
