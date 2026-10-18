# Informe de calidad: Preludio 15 en Mi♭ mayor

| | |
|---|---|
| Compases | 8 (4/4; 2 por sistema; el PDF reparte 3 por sistema y la vista previa usa 2) |
| Lectura | transcripción manual desde la imagen (`transcribe_15.py` + `transcribe_lib.py`); las alturas salen de `detect_notes.py` (separa los acordes apilados) y los bajos huecos se leyeron con `bass_strips.py alto` |
| Notas descartadas por el motor | 0 |

## Notas de la transcripción

- Compases 1 a 4: por mitad, bajo de blanca (voz 2), tres semicorcheas, una corchea y un acorde de tres notas en corchea (voz 1). Compases 5 y 7: primera mitad con siete semicorcheas y segunda con dos bajos de negra y tres semicorcheas sobre cada uno. Compás 6: dos mitades de bajo de blanca y siete semicorcheas.
- Fuera de la armadura (si♭, mi♭, la♭): la natural (c. 2, primera mitad), si natural del bajo (c. 3). El la♭ de la segunda mitad del c. 2 repite la armadura. El libro repite bemoles y becuadros de cortesía que la transcripción no repite.
- Compás 8: acorde de blanca (mi♭5, si♭4, sol4) con mi♭4 grave en el bajo y silencio de blanca en las dos voces.
- Los bajos de los compases 3 (si natural) y 4 (la♭3) se confirmaron con las tiras de guía.

## Verificación

- Comparación visual del PDF contra el libro, compás a compás: alturas, armadura, alteraciones, acordes y dedos coinciden.
- Tablatura coherente con la partitura.

## Limitaciones conocidas

- No se muestran las letras p-i-m-a ni las posiciones (III, (III), I, II, IV, b_I, b_III).
