# Heurísticas para plaqués con cabezas desplazadas

Resultado de la issue #43. Código: `backend/ocr/chord_groups.py` (pruebas: `backend/ocr/test_chord_groups.py`). Lo usa
`scripts/carcassi-preludios/detect_notes.py`, la ayuda de transcripción local que **no** pasa por homr ni Audiveris,
así que las reglas sirven igual a las páginas de autores que se arman a mano.

## El caso de referencia

Carcassi, preludio 9 en Mi mayor, compás 3 (Ditson, página impresa 30, página PDF 40 de
`resources/Libro Carcassi - Metodo.pdf`): bajo mi3 de blanca y **tres Ataques si4–re5–mi5 de corchea**. El re y el mi,
a un grado, llevan las cabezas a ambos lados de una plica compartida. Leerlos como notas sucesivas (seis
semicorcheas) fue el error de transcripción manual de `ff1da2e`.

## ¿Lo reproduce el motor real?

No. Se recortó la página 40 y se pasó por `backend/ocr/local_run.py` (`guitar-chords-ocr`; el selector eligió homr,
por ser un escaneo con ritmo dudoso). homr devuelve los tres acordes `E5+D5+B4` de corchea sobre el bajo `E3` de blanca,
es decir, **simultáneos y de la duración correcta**. Sus fallos en ese recorte son otros: fusiona dos compases en uno
(4 de 9 compases con ritmo coherente) y lee 157 notas. Como el motor no comete este error, no hay qué corregir en el
reconocimiento; la intervención útil es **control de calidad y revisión asistida** en los flujos que no usan OCR.

Audiveris leyó 67 notas con 3 de 10 compases coherentes: no se usó.

## Reglas que implementa `chord_groups.py`

1. **Plica compartida antes que misma x.** Las cabezas que tocan una misma plica son un acorde. Una segunda se dibuja
   con la cabeza aguda a la derecha de la plica y la grave a la izquierda (con la plica arriba o abajo); eso no crea
   otro Ataque.
2. **Ritmo por la punta de la plica.** Una barra es una línea más gruesa que una del pentagrama (0,28 espacios) y más
   fina que una cabeza (0,85). Una barra es corchea; dos, semicorcheas. Sin barra no se afirma nada.
3. **Distancias en espacios de pentagrama**, no en píxeles; las pruebas corren a tres escalas y con ruido e inclinación.
4. **No agrupar solo por cercanía horizontal.** Dos voces con plicas distintas en la misma x quedan como acordes
   distintos; seis semicorcheas sucesivas con plica propia no se funden.
5. **La incertidumbre se informa** como `issues` y `detect_notes.py` marca el compás con `(REVISAR)`:
   `sin_plica`, `plica_ambigua`, `cabezas_proximas` (cabezas a un grado con plicas distintas: voces, o un acorde cuya
   plica se perdió) y `segunda_invertida` (cabeza aguda a la izquierda: dos voces o plica mal leída).
6. **Compás y armonía no deciden.** Tres corcheas y seis semicorcheas suman igual y tienen las mismas alturas; no se
   fuerza una lectura por completar el compás.

Los contraejemplos del ticket están en las pruebas: seis semicorcheas sucesivas, acordes sin segundas, segundas con
plica hacia arriba y hacia abajo, voces superpuestas, cabeza sin plica, ruido e inclinación de 0,6°.

## Límites medidos

- Sobre el escaneo real del compás (300 dpi, espaciado 20,6 px) **no resuelve las plicas**: en este grabado las
  cabezas superiores tocan la barra y la plica no sobresale, por lo que no hay un extremo libre donde distinguirla.
  El módulo responde `sin_plica` en todas las cabezas y el compás sale como `(REVISAR)`: falla de forma segura, no
  inventa acordes. Resolverlo exige otra señal (cabezas apiladas a la misma x y a distancia de un grado como evidencia
  secundaria de acorde) y un buscador de pentagramas robusto: `staff_lines` de `detect_notes.py` solo halló uno de los
  dos sistemas del recorte y falla con márgenes negros de escaneo.
- Un error real que salió de esta prueba: con el pentagrama pegado al borde superior, los límites de filas quedaban
  negativos; ahora se recortan a la imagen.
- No se midieron falsas agrupaciones en escaneos (solo en imágenes sintéticas), ni distintos niveles de degradación
  fuera del ruido y la inclinación de las pruebas.

## Relación con la digitación

Un plaqué reconocido se digita como una forma de mano conjunta; las reglas de arpegio (`backend/engine/fingering.py`,
issue #42) solo actúan sobre columnas de una sola nota, así que no tratan las notas internas del acorde como
sucesivas.

## Conexión con el flujo de subidas (voces y acordes del MusicXML)

`chord_groups.py` trabaja sobre la **imagen** (cabezas, plicas, barras). El flujo de subidas solo tiene el MusicXML del motor
OCR, y ese no trae lo que `chord_groups` necesita. Lo que sí trae se usa en `backend/engine/rhythm.py` (regla 5, solo en
`prepare`, junto con el resto de la reparación por voces):

- **Se conecta**: dos notas consecutivas de **una misma voz** dibujadas en la misma x (`default-x` de Audiveris, ±3 décimas), con
  la misma duración, plica y altura distinta, son un acorde cuyas cabezas el OCR separó en dos ataques. En una misma voz las
  notas sucesivas nunca se superponen, así que es la regla 1 de arriba (plica compartida) leída con la x en lugar de los píxeles.
  El segundo ataque pasa a `<chord/>` y los `<backup>`/`<forward>` se recalculan.
- **No se conecta**: las cabezas desplazadas a ambos lados de la plica (la segunda). Su x difiere en una cabeza (~11 décimas),
  igual que una escala por grados en semicorcheas apretadas; solo la plica las distingue (regla 4: «no agrupar solo por cercanía»).

Medido con `backend/ocr/quality.py` (compases con ritmo coherente) sobre siete lecturas reales (la Milonga de Buscaglia y las
del muestrario), junto con la reparación por voces: 249 en crudo, 252 con la reparación de tresillos que ya había, **256**
con las reglas nuevas, y ningún compás que estuviera bien dejó de estarlo. La regla de la misma x **no se disparó en
ninguna** de esas lecturas: Audiveris y homr ya agrupan bien los acordes (como medía este documento con el preludio 9), así
que hoy es una red de seguridad, no una mejora medida.

### Lo que falta para usar `chord_groups.py` tal cual

1. **homr no escribe geometría**: ninguna de las 323 notas del escaneo de prueba lleva `default-x`. Solo ofrece
   `--write-staff-positions` (cajas de pentagramas), no posiciones de notas.
2. **Audiveris** escribe `default-x` por nota (décimas desde el inicio del compás), el ancho de cada compás
   y los márgenes del sistema, pero **no** `default-y` de las notas, ni dónde está cada pentagrama (solo `top-system-distance`), ni
   la x de la plica. Sin eso no se puede recortar la imagen del pentagrama ni decir qué nota del XML es qué cabeza detectada.
3. `chord_groups.read_chords` necesita además una máscara binaria de la página, `top`, `bottom` y el espaciado de **cada**
   pentagrama; el buscador de pentagramas de `detect_notes.py` no es robusto con escaneos (ver «Límites medidos»).

### Alternativas, en orden

- Pedirle a Audiveris el proyecto `.omr` (sus glifos y pentagramas con cajas en píxeles) además del MusicXML y agrupar ahí; **sin
  verificar** que el lote lo deje disponible en el contenedor.
- Para escaneos (homr): `--write-staff-positions` da los pentagramas; falta la posición de cada nota. Opción: usar
  `chord_groups` solo como **control de calidad por pentagrama** (nº de plicas con ≥2 cabezas contra nº de `<chord/>` en el XML),
  sin asignar nota por nota, y avisar en la revisión.
- Para las cabezas desplazadas: la plica es la señal; hasta tener su x, lo correcto es no adivinar.
