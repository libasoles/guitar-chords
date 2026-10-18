# Informe de calidad: Preludio 2 en La menor

| | |
|---|---|
| Compases | 8 (los del libro; 2 por sistema, 4 sistemas) |
| Lectura automática | homr: 8 compases, 6 con ritmo coherente, 141 notas (Audiveris no hizo falta) |
| Notas descartadas por el motor | 0 |
| Resultado publicado | transcripción manual desde la imagen (`transcribe_02.py` + `transcribe_lib.py`) |

## Correcciones manuales

Las alturas y la estructura que leyó homr coincidían con el libro, pero no era publicable:

- Los dedos se leyeron como alteraciones y octavas absurdas (`Ab4`, `Cb5`, `Eb4`).
- Cada bajo apareció duplicado como semicorchea (voz 1) y como nota larga (voz 2).
- Compases 1-2: bajos de negra con puntillo + corchea; homr los dejó como negra y corchea sin puntillo.
- El silencio de negra final se leyó dos veces (una por voz).

Transcripción a mano, en posiciones de semicorchea: bajo en la voz 2 (negra con puntillo + corchea,
blancas, negras o la negra final) y el flujo de semicorcheas en la voz 1. El bajo que el libro une a
la barra va solo en la voz 2, para que la tablatura no lo duplique. Alteraciones: sol♯ (compases 2, 4, 5-7).
Dedos de la mano izquierda nota a nota.

## Verificación

- Comparación visual compás a compás del PDF contra el libro: alturas, alteraciones, dedos, puntillos y
  el cierre (la4 de negra, silencio) coinciden.
- Tablatura coherente con la partitura: la4 = cuerda 3 traste 2, do5 = cuerda 2 traste 1, mi5 = cuerda 1
  al aire, sol♯4 = cuerda 3 traste 1; bajos la = cuerda 5 al aire, mi = cuerda 6 al aire (compases 6-7).

## Limitaciones conocidas

- No se muestran las letras p-i-m-a ni los reguladores (`f`, crescendo/diminuendo) ni `rit.`/`dim.`:
  el motor no los dibuja.
- Los dedos de la mano izquierda sí se muestran.

## Tiempo y tokens (agente)

Unos 15 min de reloj desde el recorte hasta el PDF verificado, con OCR en segundo plano (menos de 2 min)
y la librería de transcripción ya hecha; unos 70 k tokens procesados (lectura de imágenes y corrección).
