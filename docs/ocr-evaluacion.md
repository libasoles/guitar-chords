# Evaluación del OCR con dedos y letras p-i-m-a (Carcassi, Op. 59)

Los preludios de Carcassi llevan dedos de la mano izquierda y letras p-i-m-a. Al publicarlos (#33) el OCR
parecía «no servir»: `homr` leía bien los compases y el ritmo pero convertía esas anotaciones en notas y
alteraciones falsas. La pregunta era si eso le pasa a cualquier usuario del conversor y qué hacer.

## Método

Verdad de referencia: las transcripciones revisadas a mano (`scripts/carcassi-preludios/corrected/`). Se
pasaron los preludios 1, 4, 5 y 8 (60 a 124 notas cada uno) por cada motor y entrada, en el contenedor local
`guitar-chords-ocr`, y se compararon por compás los tonos leídos con los del libro. Se reproduce con:

```bash
.venv-carcassi/bin/python scripts/carcassi-preludios/ocr_eval.py 1 4 5 8 \
  --variants homr-png,homr-clean,audiveris-png,audiveris-clean,audiveris-vector,homr-scan,audiveris-scan
```

Entradas: `png` (recorte a 400 dpi, lo que ya se había hecho), `clean` (mismo recorte con dedos y letras
borrados, `annotations.py`), `vector` (el PDF fuente recortado, sin rasterizar) y `scan` (el recorte degradado
como un escaneo: 300 dpi, inclinado, desenfocado, ruido, fondo de papel y JPEG al 45 %).

## Resultados (media de 4 preludios)

| Motor y entrada | Precisión | Recall | Peor recall |
|---|---|---|---|
| `homr` sobre PNG | 0,60 | 0,70 | 0,62 |
| `homr` sobre PNG sin dedos ni letras | 0,71 | 0,82 | 0,68 |
| `homr` sobre escaneo simulado | 0,57 | 0,67 | 0,64 |
| Audiveris sobre PNG | 0,84 | 0,99 | 0,96 |
| Audiveris sobre PNG sin dedos ni letras | 0,84 | 0,99 | 0,96 |
| Audiveris sobre el PDF vectorial | 0,87 | 0,97 | 0,92 |
| Audiveris sobre escaneo simulado | 0,84 | 0,99 | 0,96 |

- **El problema era el motor elegido, no el OCR en general.** Audiveris ignora dedos y letras (los trata como
  texto) y acierta casi todas las notas. Con él, la tablatura final sale limpia de punta a punta.
- La precisión de Audiveris (0,84) viene de los bajos que el libro une a la barra y escribe también como
  blanca: salen duplicados en la partitura, pero no cambian la TAB. En 3 de 4 preludios no hay ni una nota
  falsa ni una que falte; en el 5 hay 6 falsas y 5 que faltan.
- `homr` inventa entre 27 y 37 notas y pierde entre 17 y 35 por preludio. Borrar dedos y letras le sube el
  recall unos 12 puntos, pero no llega a Audiveris. No se conectó al OCR de producción.
- A 150 dpi (interlínea de 10 px) Audiveris no produce nada; `homr` sí. Es coherente con lo ya medido en
  escaneos viejos y borrosos (Giuliani Op. 100: `homr` 0,95, Audiveris 0,34), así que no conviene fijar un
  solo motor.
- Todos los recortes salen de un PDF limpio: faltan escaneos reales con dedos y letras para confirmar que
  la regla de abajo se sostiene también ahí.

## Por qué el conversor no lo vio

`run.py` daba por buena una lectura si al menos el 70 % de los compases tenía el ritmo coherente. `homr`
leyó los 8 compases del preludio 1 con el ritmo bien (8/8) aunque 27 de sus 74 notas eran falsas: los dedos
no rompen la suma de duraciones. Tampoco servía filtrar notas fuera del rango de la guitarra: ninguna de las
notas falsas quedaba fuera de rango (0 en los 4 preludios).

## Señal que sí separa: notas fuera de la tonalidad

Fracción de notas que caen fuera de la escala mayor que mejor encaja (`quality.out_of_key_ratio`):

| Preludio | Verdad | Audiveris | `homr` | `homr` sin dedos |
|---|---|---|---|---|
| 1 | 0,02 | 0,01 | 0,24 | 0,19 |
| 4 | 0,07 | 0,06 | 0,27 | 0,14 |
| 5 | 0,09 | 0,09 | 0,13 | 0,13 |
| 8 | 0,06 | 0,05 | 0,21 | 0,17 |

Una lectura correcta de música tonal queda por debajo de 0,10; las lecturas con anotaciones leídas como
notas, por encima de 0,13. Con el umbral en 0,12 se separan los 4 casos (el del preludio 5 con poco margen).

## Qué se cambió

- `backend/ocr/quality.py`: `out_of_key_ratio` (tests en `test_quality.py`).
- `backend/ocr/run.py`: una lectura es dudosa si el ritmo no suma (menos del 70 %) **o** hay más de un 12 %
  de notas fuera de la tonalidad; en ese caso corre el otro motor (si queda tiempo) y gana la lectura con
  mejor puntuación (compases coherentes × notas dentro de la tonalidad), siempre que la supere por un margen
  y lea al menos el 60 % de sus notas. Comprobado en el contenedor con el preludio 1: `homr` 24 % fuera de
  tonalidad → Audiveris 1 % → se usa Audiveris.
- El OCR deja `omr-meta.json` junto a su salida (`scan`, `suspect`, ...); el Lambda del motor lo reenvía; la
  API lo expone como `lowQualityScan` y la página de Partitura y tablatura muestra un aviso («convendría buscar
  una partitura de mejor calidad») solo si es un escaneo cuya lectura sigue siendo dudosa.

## Pendiente

- Probar con escaneos reales de partituras con dedos (no hay ninguno en el repositorio).
- Los bajos duplicados de Audiveris (blanca + corchea unidas a la barra) podrían unificarse al normalizar.
- El borrado de dedos y letras (`scripts/carcassi-preludios/annotations.py`) podría ayudar cuando `homr` sea
  el único motor viable (escaneos de baja resolución); sin evaluar ahí todavía.
