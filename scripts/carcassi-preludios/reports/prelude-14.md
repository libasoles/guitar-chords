# Informe de calidad: Preludio 14 en Sol menor

| | |
|---|---|
| Compases | 8 (12/8; 3 + 2 + 3 por sistema; la vista previa usa 3 por sistema) |
| Lectura | transcripción manual desde la imagen (`transcribe_14.py` + `transcribe_lib.py`); las corcheas salen de `detect_notes.py` y los bajos huecos se leyeron con `bass_strips.py` |
| Notas descartadas por el motor | 0 |

## Notas de la transcripción

- Tres formas de compás: dos mitades con bajo de blanca con puntillo y cinco corcheas (c. 3 a 6 y 8), una mitad así y dos pulsos de bajo de negra con puntillo y dos corcheas (c. 1 y 2), y cuatro pulsos con bajo de negra con puntillo, una corchea y un acorde de corchea (c. 7). Las barras se agrupan a medida en cada forma.
- Fuera de la armadura (si♭ y mi♭): fa♯ (c. 2 y 4, 6, 7), do♯ del bajo y mi natural (c. 4), la♭ y si natural (c. 5).
- Compás 7: acordes de dos y tres notas (mi♭5-la5, re5-sol5, do5-fa♯5 dos veces).
- Compás 8: cierre con sol4 de blanca con puntillo, sol3 de negra y silencios de corchea, negra y corchea en las dos voces.

## Verificación

- Comparación visual del PDF contra el libro, compás a compás: alturas, armadura, alteraciones, acordes y dedos coinciden.
- Tablatura coherente con la partitura.

## Limitaciones conocidas

- La barra del libro une el bajo con las corcheas de su pulso; aquí el bajo va en otra voz y las corcheas llevan su propia barra (o corchete suelto).
- No se muestran las letras p-i-m-a ni las posiciones (b_III, III, b_II, II, I).
