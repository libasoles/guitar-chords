# Informe de calidad: Preludio 3 en Sol mayor

| | |
|---|---|
| Compases | 7 (los del libro; 2 + 2 + 3 por sistema, el último de blanca y silencio) |
| Lectura automática | homr: 7/7 compases con ritmo coherente, 122 notas (Audiveris no hizo falta) |
| Notas descartadas por el motor | 0 |
| Resultado publicado | transcripción manual desde la imagen (`transcribe_03.py` + `transcribe_lib.py`) |

## Correcciones manuales

- Los dedos se leyeron como alteraciones y octavas absurdas (`Gb3`, `Cb5`, `Fb5`).
- Bajo duplicado (semicorchea en voz 1 + negra en voz 2) en cada pulso.
- Compás 7: el sol grave de blanca salió duplicado y con dos silencios.
- El único accidente fuera de la armadura es el re♯ del compás 3 (pulso 3); el fa♯ viene de la armadura.

Transcripción a mano: por pulso, bajo de negra (voz 2) y tres semicorcheas (voz 1); compás 7: sol3 de
blanca y silencio de blanca. Dedos de la mano izquierda nota a nota.

## Verificación

- Comparación visual compás a compás del PDF contra el libro: alturas, armadura, re♯, dedos y cierre coinciden.
- Tablatura coherente con la partitura: sol3 grave = cuerda 6 traste 3, si = cuerda 2 al aire,
  sol5 = cuerda 1 traste 3.

## Limitaciones conocidas

- No se muestran las letras p-i-m-a (el motor no las dibuja). Los dedos de la mano izquierda sí.

## Tiempo y tokens (agente)

Unos 10 min de reloj desde el recorte hasta el PDF verificado; unos 45 k tokens procesados.
