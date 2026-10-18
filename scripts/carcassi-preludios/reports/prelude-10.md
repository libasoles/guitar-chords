# Informe de calidad: Preludio 10 en Do♯ menor

| | |
|---|---|
| Compases | 10 (12/8; 2 + 2 + 3 + 3 por sistema; la vista previa usa 2 por sistema) |
| Lectura | transcripción manual desde la imagen (`transcribe_10.py` + `transcribe_lib.py`); las corcheas salen de `detect_notes.py` y los bajos huecos se leyeron con `bass_strips.py` |
| Notas descartadas por el motor | 0 |

## Notas de la transcripción

- Por mitad de compás: bajo de blanca con puntillo (voz 2) y cinco corcheas (voz 1), la primera unida a la barra del bajo.
- Fuera de la armadura: si♯4 (c. 2, 5 y 9), mi♯4 de bajo y re natural (c. 3). El re♯ del c. 5 viene de la armadura (no lleva signo).
- La cadena armónica confirma las lecturas: sol♯7 sobre re♯ (c. 2), sol♯7/fa♯ (c. 5), do♯m/mi (c. 6) y sol♯7 (c. 9).
- Compás 10: arpegio ascendente de seis corcheas, do♯6 de blanca con dedo 4 (armónico de la cuerda 1, traste 9 en la tablatura) y silencio de negra.
- El título del libro pierde el sostenido («C Minor»); la armadura de cuatro sostenidos y el sol♯7 del c. 2 confirman Do♯ menor.

## Verificación

- Comparación visual del PDF contra el libro, compás a compás: alturas, armadura, alteraciones y dedos coinciden.
- Tablatura coherente con la partitura.

## Limitaciones conocidas

- No se dibuja la apoyatura (con ligadura) antes del do♯6 final; tampoco las letras p-i-m-a, las posiciones (b_I, III, b_IX…) ni los números de cuerda en círculo.
