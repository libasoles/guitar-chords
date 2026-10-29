# Catálogo de heurísticas de digitación

**La verdad está en el código; este documento es solo referencia.** Si el catálogo y el código discrepan, vale el código
(`backend/engine/tabify.py`, `backend/engine/fingering.py`) y sus pruebas (`backend/engine/test_fingering.py`,
`test_tabify.py`). Aquí se anota, para cada heurística, de dónde sale y **qué estado tiene en el código**, para no
confundir una idea de los maestros con una regla que el motor ya aplica. Los pesos son los de hoy; cámbialos en el
código, no aquí.

Procedencia y verificación de las fuentes: `docs/criterios-de-digitacion.md`. Lo que no se pudo comprobar en la
fuente primaria está marcado **[no verificado]**; las citas de Carcassi y Aguado vienen de OCR y hay que cotejarlas
con la imagen antes de citar páginas. Arpegios y plaqués tienen su propio documento
(`docs/heuristicas-plaques.md` para el reconocimiento de acordes).

«Casilla» = celda (cuerda, traste). Estados: **Implementada** (con su símbolo), **Parcial**, **No implementada**.

## 1. Restricciones físicas

| # | Heurística | Fuente | Estado en el código |
|---|---|---|---|
| F1 | Una nota por cuerda a la vez; las notas simultáneas van en cuerdas distintas. | Física | **Implementada**: `tabify.candidates` descarta combinaciones con cuerda repetida. |
| F2 | Rango de cada cuerda: traste 0 a 19. | Física | **Implementada**: `tabify.MAX_FRET = 19`. |
| F3 | Cuatro dedos cubren cuatro trastes (span ≤ 4). Heijink y Meulenbroek: casi todas las digitaciones de los guitarristas usaron span 4. | Heijink y Meulenbroek 2002 | **Parcial**: es un costo, no un descarte. `tabify.local_cost` suma `span + 10·max(0, span−4)` (`MAX_SPAN = 4`). Un acorde de span 5 sigue siendo posible si no hay otra. |
| F4 | Extensión: un dedo puede estirarse un traste más allá de su posición. | Carcassi (posiciones) | **Implementada solo con anotaciones**: `fingering.EXTENSION = 1` en `fingers_possible`. Sin dedos escritos no se aplica. |
| F5 | Posición = traste que pisa el dedo 1 (dedo 1 en el traste 1 = posición I); el dedo `d` en el traste `f` implica la posición `f − (d−1)`. | Carcassi, «The Positions» | **Implementada con anotaciones**: `fingering.fingers_possible`. |
| F6 | Cejilla: el dedo 1 pisa dos o más cuerdas en un mismo traste (pequeña, 2–3 cuerdas; grande, las 6). Aguado: *ceja*. | Carcassi, «The Barrer»; Aguado §138, §149 | **Parcial**: `fingers_possible` admite el mismo dedo 1 en el mismo traste. **Implementada con anotaciones**: una cejilla escrita en la partitura (`C 7` entera, `½C 7` media: las tres cuerdas agudas, con línea punteada) deja cada nota de las cuerdas que cubre en ese traste o más arriba, sin cuerdas al aire (`fingering.under_barre`, `tabify.barre_spans`, `backend/engine/barres.py`); si una nota no tiene celda posible bajo ella, conserva su altura. El motor no genera cejillas por su cuenta. |
| F8 | Un dedo por traste: un acorde que obliga a sostener a la vez más de cuatro trastes distintos (la cejilla cuenta como uno) no se puede tocar. | Física (cuatro dedos) | **Implementada**: `tabify.MAX_HELD_FRETS = 4` en `tabify.candidates`; si ninguna combinación cumple, se conserva la nota (nunca se descarta). Comprobado que no cambia la TAB de ninguna de las 148 fuentes de las colecciones. |
| F7 | Mano derecha: pulgar en los bajos (cuerdas 6–4), índice, medio y anular en las tres agudas. | Carcassi, «Manner of Touching the Strings» | **No implementada.** Hoy el motor ignora la mano derecha (`note_hints` descarta `p i m a`). |

## 2. Costos de la literatura (modelo de camino mínimo)

| # | Heurística | Fuente | Estado en el código |
|---|---|---|---|
| C1 | La digitación es el camino mínimo por capas, una capa por Ataque, resuelto por programación dinámica (Viterbi). | Sayegh 1989 **[no verificado]**; Burlet y Fujinaga 2013 | **Implementada**: `tabify.assign_frets`, `fingering.solve`. |
| C2 | Costo por la distancia que se mueve la mano entre Ataques. | Sayegh 1989; Burlet y Fujinaga 2013; Heijink y Meulenbroek 2002 (el reposicionamiento fue lo que más pesó en los juicios de dificultad) | **Implementada**: 0,6 por traste en `tabify.assign_frets` y `fingering.HAND_MOVE`. |
| C3 | Las cuerdas al aire no cuentan para la posición de la mano (costo 0). | Burlet y Fujinaga 2013 | **Implementada**: `tabify.hand` ignora trastes 0; la mano conserva su posición sobre cuerdas al aire. |
| C4 | Penalizar posiciones altas (Robotaba: +1 pasado el traste 7). Heijink y Meulenbroek: 17 de 31 digitaciones en posición baja, 13 en media, 1 en alta. | Burlet y Fujinaga 2013; Heijink y Meulenbroek 2002 | **Implementada con otros números**: `local_cost` suma `0,3·traste_mínimo + 0,5·max(0, traste_máximo−12)`; `fingering.HIGH_FRET = 0,4` por traste sobre el 4º en las notas sueltas de arpegio. |
| C5 | Span de los acordes dentro del costo. | Burlet y Fujinaga 2013 (ec. 1) | **Implementada a su manera**: `local_cost` usa el span del propio acorde, no la ec. 1. |
| C6 | Preferir la digitación que ya propone el motor frente a una alternativa equivalente. | Pesos puestos a mano con los 16 preludios | **Implementada**: `fingering.KEEP_ENGINE = 0,5` por nota cambiada. |

## 3. Criterios de los métodos

| # | Heurística | Fuente | Estado en el código |
|---|---|---|---|
| M1 | **Preferir posiciones bajas** y los tonos que evitan la cejilla; las tonalidades difíciles vienen después. | Carcassi, primera parte (Do, Sol, Re, La, Mi, Fa) | **Parcial**: lo cubren los costos de traste alto (C4); no hay noción de tonalidad. |
| M2 | **Sostener las notas**: los bajos y las demás voces suenan mientras dura su valor (*let ring*). | Carcassi, antes de los *Preludes*; Aguado, lección 9 §87 | **Implementada** (suave): `tabify.sustained_path` (solo con `tabify.SUSTAIN`, que `prepare` activa en las subidas; las colecciones siguen con el Viterbi simple). El estado del Viterbi lleva las notas pisadas que aún suenan (`(cuerda, traste, fin, dedo)`; el fin sale de `build_columns`: `column["time"]`, `column["until"]`, ligaduras de unión incluidas) y `fingering.ringing_cost` cobra al candidato de cada columna: `CUT_COST = 4,0` por nota nueva en la cuerda de una nota pisada que aún suena (se corta). Las cuerdas al aire que suenan no cuestan. |
| M3 | **Dedos quietos entre acordes** de un arpegio: los dedos de las notas ya pisadas no se mueven. | Carcassi, *Arpeggios with three and four fingers* («must remain unmoved») | **Implementada**: `tabify.sustained_path` (solo con `tabify.SUSTAIN`, que `prepare` activa en las subidas; las colecciones siguen con el Viterbi simple). El estado del Viterbi lleva las notas pisadas que aún suenan (`(cuerda, traste, fin, dedo)`; el fin sale de `build_columns`: `column["time"]`, `column["until"]`, ligaduras de unión incluidas) y `fingering.ringing_cost` cobra al candidato de cada columna: `LIFT_COST = 1,5` por nota pisada que suena y queda a más de `MAX_SPAN = 4` trastes de las notas nuevas (el dedo tendría que levantarse). Se suma a `fingering._one_cell_per_pitch` (A3). Hasta `MAX_STATES = 64` estados por columna. |
| M4 | **Dedo fijo mientras dura la nota** («el dedo 3.º permanece quieto»). | Aguado, lección 10; §87 | **Implementada** (misma regla que M2 y M3, pagada una sola vez: la nota levantada o cortada deja de contar como sostenida). |
| M5 | **Ligados en la misma cuerda**: ascendente, el dedo cae sobre la nota aguda; descendente, se tira hacia un lado. | Carcassi, «Of the Slur»; Aguado §226 | **Implementada** (blanda): `tabify.mark_slurred_columns` marca la columna que alcanza una ligadura de dos notas sueltas contiguas a ≤ 4 semitonos, y el Viterbi suma `SLUR_OFF_STRING` si cambia de cuerda. Las ligaduras largas son fraseo y no se tocan. En un compás de arpegio, `avoid_repeated_strings` puede deshacerlo. |
| M6 | **Evitar la cuerda al aire** cuando su vibración choca con la nota que sigue (disonancia) o ensucia. | Aguado, lecciones 17, 21 y 27 | **No implementada.** Solo existe la regla del acorde en posición (A4, abajo). |
| M7 | **Equísonos**: la misma nota en varias cuerdas; elegir por el timbre o por lo que sigue. | Aguado, lección 3 y §6 | **Parcial**: `tabify.candidates` genera todas las casillas posibles; elegir por timbre no tiene peso (la regla 21 de `criterios-de-digitacion.md` quedó **[no verificado]**: no hay cifra). |
| M8 | **Dos voces simultáneas**: primero el lugar de la nota aguda; la grave va a otra cuerda, más grave. | Aguado §105 (lección 16); Carcassi | **Parcial**: se cumple por construcción de `candidates` (cuerdas distintas), sin orden forzado entre la voz aguda y la grave. |
| M9 | **Ceja a prevención**: poner la cejilla aun sin ser indispensable, para anticiparse. | Aguado §143, lección 31 | **No implementada.** |
| M10 | **«Posición» en Aguado** es la forma de los dedos de un acorde, no la zona del mango (en Carcassi y Sagreras sí es la zona). | Aguado §86 | Aviso de vocabulario; no es una regla. |
| M11 | Sor, Giuliani, Coste, Sagreras, Tárrega, Pujol. | — | **[no verificado]**: sin texto accesible; no hay reglas citadas. |

## 4. Anotaciones escritas en la partitura (pista que reduce las casillas)

Un MusicXML con `<fingering>`, `<string>` o `<fret>` limita dónde puede ir una nota. Código:
`tabify.note_hints`, `fingering.allowed_cells`, `fingering.fingers_possible`.

| # | Heurística | Estado en el código |
|---|---|---|
| N1 | `<string>` y `<fret>` explícitos **fijan la casilla**. | **Implementada** (`allowed_cells`). |
| N2 | Dedo `0` ⇒ cuerda al aire. | **Implementada**. |
| N3 | Un dedo en dos trastes distintos de un mismo acorde es imposible (salvo la cejilla con el dedo 1). | **Implementada** (`fingers_possible`). |
| N4 | A mayor traste, mayor número de dedo; los cruces se descartan. | **Implementada**. |
| N5 | Las posiciones implícitas (`traste − (dedo−1)`) no difieren en más de una extensión. | **Implementada** (`EXTENSION = 1`). |
| N6 | Si la anotación contradice la altura o no deja ninguna combinación, **gana la altura** y la anotación se ignora para esa columna. | **Implementada**: una nota nunca se pierde por una anotación mal leída. |
| N7 | Continuidad de la posición entre columnas anotadas. | **Implementada**: `fingering.written_position` (el traste menos el dedo menos uno, el más bajo del acorde) y `fingering.position_jump`: `POSITION_JUMP = 1,2` por traste que la posición escrita se mueve más allá de una extensión (`EXTENSION = 1`) entre dos columnas con dedos; se suma al costo normal de mano (0,6 por traste). Solo con `SUSTAIN`. |
| N8 | Más trastes distintos que dedos, salvo cejilla. | **Implementada**: con dedos anotados la cubre N3 (cinco trastes obligan a repetir dedo); sin anotaciones, F8. |
| N9 | Mismo dedo en dos notas simultáneas sostenidas (Al Kasimi 2007, piano). | **Implementada**: `fingering.ringing_cost`: `SAME_FINGER_COST = 6,0` cuando el dedo escrito de una nota nueva es el de una nota pisada que aún suena en otra casilla (el dedo 1 en un mismo traste es cejilla y no cuenta). Solo con `SUSTAIN` y dedos escritos. |
| N10 | Marcas de posición escritas («II», «C. V») como centro de la mano. | **No implementada.** |
| N11 | Dedos de la mano derecha (`p i m a`) para fijar las cuerdas de un arpegio. | **No implementada** (ver F7). |

Los conversores de MuseScore de las colecciones **descartan** las digitaciones del original, así que estas pistas solo
actúan con un MusicXML que las traiga (una subida del usuario).

## 5. Reglas para arpegios

Se aplican solo a los compases que `fingering.detect_arpeggios` marca (o a todos si se pide `arpeggio=True`).

| # | Heurística | Fuente | Estado en el código |
|---|---|---|---|
| A1 | Dos notas **distintas** seguidas no van en la misma cuerda (`0-3`, `3-0`, `0-3-0`): la primera se apaga al pisar la segunda. | Carcassi (arpegios, bajos al pulgar) | **Implementada**: `fingering.SAME_STRING = 8,0` en `solve`. |
| A2 | Una nota **repetida** se queda en su cuerda; cambiarla cuesta. | Pesos propios; Aguado (nota fija) | **Implementada**: `fingering.REPEAT_MOVED = 3,0`. |
| A3 | **Economía de dedos**: dentro de un compás cada altura conserva una casilla, solo si no rompe A1. | Carcassi, Aguado, Heijink y Meulenbroek (segmentos ya reclutados) | **Implementada**: `_one_cell_per_pitch`, con `economy=True`. |
| A4 | Un compás que mezcla cuerdas al aire con notas de los trastes 6 a 11 se digita como **forma de acorde en posición** (como una cejilla), sin cuerdas al aire; el traste 12 se excluye porque son armónicos. | Pesos propios, observados en los preludios | **Implementada**: `open_reach = 6` en `avoid_repeated_strings`. |
| A9 | Un **grupo de tres notas** (tresillo, o tres notas bajo una ligadura) usa tres cuerdas distintas, una por nota; una altura repetida dentro del grupo (do mi mi) va en dos cuerdas (3ª traste 5, 2ª traste 5, 1ª al aire) y no dos veces en una. | Pedido del editor (Aguado, estudio 5; Carcassi, pieza 18) | **Implementada**: `fingering.GROUP_SHARED = 5,0` y `tabify.beam_groups`; solo grupos de hasta 3 notas (`MAX_GROUP`); `_one_cell_per_pitch` deja libre la altura que se repite dentro del grupo. |
| A5 | Las notas sueltas de un arpegio solo usan trastes hasta el 9. | Pesos propios | **Implementada**: `max_fret = 9` en `avoid_repeated_strings`. |
| A6 | Un arpegio usa **conjuntos de cuerdas contiguas** (pulgar en 6–4; índice, medio y anular en 3–2–1). | Carcassi, arpegios p-i-m-a | **Probada y descartada por ahora**: un costo de 1,0 por cuerda saltada solo bajó los saltos de 577 a 575 en los 16 preludios y subió el movimiento de mano de 1141 a 1159 (preludio 2: 69 a 87). Muchos saltos son intencionales (el pulgar salta entre bajos), así que «contigua» no es la métrica. Pendiente hasta modelar la mano derecha (F7). |
| A7 | **Melodía en cuerdas agudas, bajos en graves.** | Carcassi, «Manner of Touching the Strings» | **No implementada.** |
| A8 | No cambiar de posición dentro de un compás de arpegio. | Heijink y Meulenbroek (el reposicionamiento pesa más en la dificultad) | **Parcial**: lo cubre el costo de movimiento de la mano (C2), sin refuerzo propio. |

**Detección** (`fingering.detect_arpeggios`; umbrales ajustados a mano con los 16 preludios): al menos 4 columnas de una
nota y el 75 % de las del compás; pulso regular (75 % de los intervalos iguales al menor); saltos de 3 o más semitonos en
la mitad de los intervalos; y que las alturas vuelvan (1,6 notas por altura) **o** que el 90 % de los intervalos sean
saltos. Una melodía por grados conjuntos o una escala no se marca, porque en ella dos notas seguidas en una cuerda son lo
normal.

## 6. Lo que falta, por orden de utilidad probable

Las pendientes tienen su ticket en GitHub («Heurísticas de digitación pendientes»).

1. ~~`lift_cost`~~ hecho (M2, M3, M4; `fingering.ringing_cost`). Pendiente: el costo de las cuerdas al aire que suenan (M6) y calibrar los pesos con digitaciones impresas de métodos con dedos (Sagreras no los trae: no mueve las pruebas de `compare_positions.py`).
2. Mano derecha (F7, A6, A7, N11): asignar cuerdas a `p i m a` y exigir cuerdas contiguas en arpegios.
3. Cuerdas al aire disonantes (M6).
4. ~~Continuidad de posición~~ hecho (N7, N9). Quedan N10 y el resto de eliminaciones por dedos.
5. Medir falsos positivos de la detección de arpegios con criterio musical (hoy solo hay conteo de infracciones).

Cada una necesita pruebas con un compás real y su digitación esperada **antes** de tocar los pesos; los pesos de este
documento son hipótesis calibradas con los 16 preludios de Carcassi, no verdades de los maestros.
