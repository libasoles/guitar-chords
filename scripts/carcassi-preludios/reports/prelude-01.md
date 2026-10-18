# Informe de calidad: Preludio 1 en Do mayor

| | |
|---|---|
| Compases | 8 (la partitura del libro tiene 8; 4 por sistema, 2 sistemas) |
| Lectura automática | homr: 8/8 compases con ritmo coherente, 74 notas (Audiveris no hizo falta) |
| Notas descartadas por el motor | 0 |
| Resultado publicado | transcripción manual desde la imagen (`transcribe_01.py`) |

## Correcciones manuales

La lectura automática acertó compases y ritmo pero no es publicable:

- Los números de dedo se leyeron como notas con octava absurda (`C-14`, `D-15`, `G-13`...).
- Cada bajo de blanca quedó duplicado como corchea + blanca en la misma voz.
- Faltaba el do♯ del compás 5 como alteración visible y los dedos/letras no se conservaron.

Se transcribió a mano, a partir del recorte a 400 dpi: bajo de blanca (voz 2, plica abajo) y dos grupos
de tres corcheas (voz 1, plica arriba) por compás; 7 compases de arpegio y un acorde final C4-G4-C5-E5
con silencio de blanca. Alteración: do♯ en el compás 5. Dedos de la mano izquierda de la edición
puestos nota a nota.

## Verificación

- Comparación visual compás a compás del PDF generado contra el libro: alturas, alteración y dedos coinciden.
- Tablatura coherente con la partitura (Digitación sugerida, afinación Estándar): do bajo = cuerda 5 traste 3,
  sol = cuerda 3 al aire, do = cuerda 2 traste 1, mi = cuerda 1 al aire; do♯ = cuerda 2 traste 2.

## Limitaciones conocidas

- Las letras p-i-m-a de la edición (compás 1) no se muestran: el motor no dibuja letras de pulsación
  (se probaron `pluck`, un segundo `fingering` y `lyric`; el MusicXML las acepta pero Verovio no las pinta).
- Los dedos de la mano izquierda sí se muestran sobre las notas.

## Tiempo y tokens (agente)

Del primer comando al PDF final del Preludio 1: unos 35 min de reloj, de los cuales el OCR local fueron
menos de 2 min (la imagen Docker ya existía). Unos 180 k tokens procesados, dominados por la
exploración inicial del backend y las iteraciones de formato (clave, alteración, letras).
