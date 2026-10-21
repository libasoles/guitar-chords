# Criterios de digitación: dónde tocar cada nota

> Este documento es referencia de la investigación. El catálogo con el estado de cada heurística en el código es
> `docs/catalogo-de-heuristicas-de-digitacion.md`; **la verdad está en `backend/engine/` (`tabify.py`, `fingering.py`) y sus pruebas.**

Investigación para la issue #42 (heurísticas de arpegio / melodía / acorde en `tabify`). «Casilla» = celda (cuerda, traste) del mango. Cada afirmación lleva su fuente; lo que no pude comprobar en la fuente primaria está marcado **[no verificado]**. Cómo se leyó cada fuente, al final, en «Fuentes».

## 1. Restricciones físicas

| Restricción | Dato | Fuente |
|---|---|---|
| Mano izquierda | Dedos 1 a 4; el pulgar queda detrás del mango. Carcassi marca `0` cuerda al aire, `1`, `2`, `3` y, en la tabla de la 1ª posición, el `4` (dedo y traste coinciden en 1ª posición). | Carcassi, *Method*, «The Positions» y «Gamut… First Position» (Ditson 1853) |
| Posición | Carcassi: hay tantas posiciones como trastes; **el dedo 1 determina la posición** (dedo 1 en el traste 1 = posición I). | Carcassi, «The Positions» |
| Extensión de la mano | 4 dedos cubren 4 trastes. Heijink y Meulenbroek midieron guitarristas: casi todas las digitaciones elegidas usaron un span de 4 trastes (una de 3, una de 5). | Heijink y Meulenbroek 2002, *Pre- and Posttests* |
| Cejilla | Carcassi: el dedo 1 pisa 2 o más cuerdas en el mismo traste; «small barrer» = 2 o 3 cuerdas, «great barrer» = las 6. Aguado la llama *ceja*: se usa cuando hay que pisar 2 o más cuerdas en un mismo traste (§138 y §149, lecciones 30 y 35 del OCR). | Carcassi, «The Barrer»; Aguado, *Nuevo método* |
| Mano derecha | Carcassi: bajos (cuerdas 6, 5, 4) normalmente con el pulgar; las 3 cuerdas agudas con índice, medio y anular. Aguado nombra los dedos derechos `i`, 2, 3, 4 (nota al pie 3 de la lección 1). | Carcassi, «Manner of Touching the Strings»; Aguado |
| Cuerdas | Una nota por cuerda a la vez; cada cuerda tiene su rango (traste 0 a ~19). | Trivial; `MAX_FRET = 19` en `tabify.py` |
| Elección de cuerdas por dos voces | Aguado §105 (lección 16): si dos voces simultáneas podrían ir en la misma cuerda, se busca primero el lugar de la nota aguda y luego el de la grave en otra cuerda. Carcassi (parte 2, regla en francés/inglés): dos notas juntas que se digitan en la misma cuerda: la aguda en su lugar, la grave en la cuerda siguiente. | Aguado §105; Carcassi |

## 2. Modelos de costo en la literatura (verificado)

- **Sayegh 1989** (*Computer Music Journal* 13(3), 76-84): digitación como camino mínimo en un grafo por capas, un nodo por posible ubicación de cada nota; resuelto con Viterbi. El costo usa la distancia que recorre la mano (horizontal y vertical). Fuente de ese detalle: resúmenes secundarios (arXiv 2407.09052, Kyoto COMJ_a_00129); **no leí el artículo original** (de pago).
- **Burlet y Fujinaga 2013** (ISMIR, *Robotaba*, §3.2 y §4.2, texto leído): A*Guitar extiende a Sayegh con A* sobre notas *y acordes*. Peso de arista = suma de tres factores tomados de Heijink y Meulenbroek: (1) distancia en trastes que se mueve la mano, (2) span en trastes de los acordes, (3) penalización 1 si la mano pasa del traste 7. Para una nota `f` seguida de un acorde con trastes `g`: `|f - (max(g)-min(g))/2|` (ec. 1). Una repetición de cuerda al aire cuesta 0.
- **Heijink y Meulenbroek 2002** (*J. Motor Behavior* 34(4), 339-351, texto leído): tres factores de complejidad de la mano izquierda: posición de la mano en el mango, span, y reposicionamiento. En la prueba posterior, el reposicionamiento fue lo que más pesó en los juicios de dificultad, luego el span, luego la posición. De 31 secuencias digitadas por los guitarristas, solo 2 requerían mover la mano (un traste); 17 en posición baja (dedo 1 bajo el traste 4), 13 en la media (4 a 7) y solo 1 en alta (>7). Conclusión: mantener las articulaciones cerca de la mitad de su rango; también observan que los ejecutantes tienden a seguir usando segmentos ya reclutados, «cambiar el patrón de segmentos aumenta el costo» (§Introducción).
- **Tuohy y Potter 2005** (ICMC, 499-502): algoritmo genético con una función de aptitud que incorpora límites de tocabilidad (dato en arXiv 2510.10619, §Related work). Su tesis (Tuohy 2006, UGA) no se pudo descargar (404): **términos exactos de la aptitud: no verificado**.
- **Radicioni y Lombardo 2005** (ICMC), **Hori, Kameoka, Sagayama 2013** (*IMT* 8(2), 477-484, HMM entrada-salida), **Ramos et al. 2015/2016** (BRACIS, ICTAI; GA y colonia de hormigas): solo verifiqué la referencia bibliográfica, no los costos: **no verificado**. (`arXiv 2510.10619` los agrupa como DP/grafos y otras optimizaciones sin dar términos.)
- Piano, por analogía: Al Kasimi, Nichols, Raphael 2007 (ISMIR 000355): Viterbi con tres restricciones por nodo (sin cruce de dedos, mismo dedo mientras una nota se sostiene, un dedo una nota) y una función de costo ajustable. Es evidencia de que «mismo dedo mientras dura la nota» se trata como restricción dura en un Viterbi.

## 3. Criterios de los métodos (verificado donde se indica)

- **Posiciones I-VII y trastes** (Carcassi, *Method*): la primera parte se escribe solo en tonos cómodos (Do, Sol, Re, La, Mi, Fa) porque los demás exigen «too often» la cejilla; el segundo libro cubre el resto. El método llega a «Gamut in the Seventh Position». Criterio: preferir posiciones bajas y evitar cejilla frecuente.
- **Mantener notas** (Carcassi, preludios): «care must be taken to sustain the notes, as well in the Bass, as in the other parts» (antes de los *Preludes*). Y en arpegios con figuras de acorde: las líneas punteadas entre acordes indican que «the fingers which press them must remain unmoved» (sección *Arpeggios with three and four fingers*).
- **Ligados** (Carcassi, «Of the Slur»): ascendentes, el dedo cae «like a hammer» sobre la nota más aguda; descendentes, se tira el dedo hacia un lado; si la nota de llegada no es al aire, hay que tenerla preparada. Todo ligado ocurre **en una misma cuerda**. Aguado §226 (ejercicios de mano izquierda): variante en que el dedo 1 se desliza por la cuerda hasta que llega el 2.
- **Dedo fijo mientras dura la nota** (Aguado, lección 10, p. antes del §100): «el dedo 3.º permanece quieto» durante el bajo con puntillo; la nota tenida se apaga recién cuando se levanta el dedo (§87, lección 9). Misma lección: un silencio exige levantar el dedo y además amortiguar con el dedo de la derecha.
- **Aguado usa «posición» en otro sentido** (§86, lección 9): la *configuración de los dedos de la izquierda* que forma un acorde; «posición» ≠ zona del mango. Importante para no mezclar vocabulario: en Carcassi/Sagreras «posición» es la zona; en Aguado es la forma. Aguado también define «posiciones completas y medias» de cada tono (§313-317, con cejuela o ceja).
- **Cuerdas al aire**: Aguado evita al aire cuando suena disonante o ensucia: lección 21, la nota *re* se hace en la cuerda 5 (traste 5) y no al aire «porque si se hiciera al aire… durarían aún las vibraciones cuando se tocase el do»; lección 27: pone la ceja en el compás 8 para que no suenen *re* y *si* del compás 7 «en cuerdas al aire»; lección 17: *re* grave no se hace en la 4.ª al aire porque en ella va el *fa#*; se hace en la 5.ª, traste 5 (equísono). Aguado llama *equísonos* a las distintas cuerdas donde sale la misma nota.
- **Afinación por lugar** (Aguado, lección 3-4 y §6-10): la nota en el 5.º traste iguala la cuerda de arriba al aire (4.º en la 3.ª). Base de las equivalencias de cuerdas.
- **Ceja a prevención** (Aguado §143, lección 31): poner la ceja aun cuando no sea indispensable, para anticiparse.
- Sor (*Méthode pour la guitare*, 1830; Merrick 1832), Giuliani, Coste, Sagreras (*Las lecciones*), Tárrega, Pujol: **no verificado**. El PDF de Sor en IMSLP/muslib es un escaneo TIFF sin capa de texto (137 págs.) y no hay OCR local; las reglas de esos autores no están citadas aquí.

## 4. Anotaciones de digitación presentes en la partitura

Convenciones verificadas: Carcassi `0`/`1`-`3`(`4`) para la izquierda y puntos/`x` para la derecha; Aguado `i`, 2, 3, 4 derecha, números dentro de un circulito = cuerda (§ armónicos, lección 43), armónicos con dos números. Sagreras y Tárrega: **no verificado**.

### 4.1 Mapeo MusicXML

| Marca | MusicXML | Tipo |
|---|---|---|
| Dedo izq. 1-4 | `<technical><fingering>n</fingering>` (con `placement`) | duro/blando |
| Dedo der. `p i m a` | `<fingering>` en la nota (`p` = `<pluck>` en 4.0) | blando, informa el tipo de pasaje |
| Cuerda ①-⑥ | `<technical><string>n</string>` (1 = aguda) | **duro**: fija la cuerda |
| Traste | `<technical><fret>n</fret>` | **duro**: fija la casilla |
| Posición (II, C. V) | `<words>` de dirección «II», «C. V», «CII»; `<bracket>` para el tramo | blando, centro de posición |

### 4.2 Fórmulas

Sea `pos` la posición (traste del dedo 1, convención de Carcassi) y `d` el dedo izquierdo de la nota.

- **Dedo ⇒ traste**: con la mano fija en `pos`, el dedo `d` cae en `f = pos + d - 1`. Para un `fingering` dado en una nota con traste candidato `f` (y `f > 0`): la posición implícita es `pos = f - (d - 1)`. Una `pos` en 1..MAX_FRET-3 (`pos >= 1`) es necesaria.
- **Extensión**: se permite que el 1 y el 4 se estiren un traste: `f ∈ [pos + d - 1 - 1, pos + d - 1 + 1]` solo si `d ∈ {1, 4}`, con costo, y para `d ∈ {2,3}` exacto salvo desplazamiento de posición.
- **Dedo + cuerda ①-⑥ + traste dados**: si la nota trae `string` o `fret`, se descartan todas las candidatas con otro valor (restricción dura). Si hay conflicto entre `fret` y la altura (MIDI), gana la altura y se avisa.
- **Cuerda al aire**: `fingering = 0` ⇒ `f = 0`; eso elimina toda candidata con `f > 0`.

### 4.3 Eliminación de candidatas imposibles (todas se aplican por columna y entre columnas adyacentes sin soltar)

1. **Span** > 4 trastes entre dedos distintos (`max f - min f` de los trastes pisados > `MAX_SPAN`) sin extensión ⇒ descartar (hoy `local_cost` solo lo penaliza ×10).
2. **Mismo dedo, dos trastes distintos en un acorde** ⇒ descartar. Dos cuerdas en el mismo traste con el mismo dedo = cejilla (válido solo si es el dedo 1; si es otro dedo, descartar).
3. **Orden de dedos vs. trastes**: en un acorde, a mayor traste, mayor número de dedo (se permiten empates solo en cejilla; los cruces se permiten solo con cuerdas contiguas a distancia de 1 traste y una nota de bajo con el pulgar fuera del acorde: marca «con costo», no duro). Con `f_a < f_b` y `d_a > d_b` ⇒ descartar.
4. **4 trastes pisados distintos con solo 3 dedos disponibles** ⇒ descartar salvo cejilla del 1 sobre ≥ 2 cuerdas en el mismo traste.
5. **Mismo dedo en dos notas simultáneas sostenidas** (Al Kasimi 2007, restricción 2 y 3) ⇒ descartar.
6. **Dedos guía**: si el dedo `d` pisa `f` en la columna `t` y la columna `t+1` lo vuelve a pisar en la misma cuerda, no hace falta moverlo: costo 0 (ver §6).

Si ningún candidato sobrevive, se relaja en este orden: extensión, orden de dedos, y se deja el mejor del Viterbi con una advertencia.

## 5. Mapa al Viterbi de `tabify.py` y `extract.py`

Estado actual (`assign_frets` / `local_cost`):
- candidato = una asignación cuerda/traste distinta por altura (`candidates`); costo local = `span + 10·max(0, span-4) + 0.3·min_traste + 0.5·max(0, max_traste-12)`.
- transición = `0.6 · |h - h_prev|` con `h = min(traste pisado)`; la mano no se mueve sobre cuerdas al aire.
- **No hay término de cuerda**: nada impide dos notas distintas consecutivas en la misma cuerda ni favorece cuerdas contiguas.

Parches en `extract.py` (`_solve`, `avoid_repeated_strings`): costo por separarse de la elección del motor 0.5; `0.4·max(0, h-4)`; `0.6·|h-h_prev|`; **8** por dos notas sueltas distintas en la misma cuerda; **3** por repetir un mismo tono en otra cuerda. Además, `avoid_repeated_strings` quita las cuerdas al aire de un compás que mezcla al aire con trastes 6-11 (forma de cejilla). Son reglas de arpegio, hoy solo para los preludios.

### 5.1 Señales de detección por pasaje (por compás o ventana de ~1 compás)

| Tipo | Señal | Fuente de la señal |
|---|---|---|
| Arpegio | ≥ 3 columnas seguidas de 1 nota, con 3 o más tonos distintos que se repiten en un patrón (ciclo de 3 a 6 notas); notas sostenidas por un acorde implícito; 1 nota por pulso subdividido | Carcassi, arpegios de 3/4 dedos; Aguado, lección 9 |
| Melodía | voz superior en notas de valor ≥ corchea sin patrón repetido; la voz inferior en notas largas; saltos de grado conjunto | `fingering` con `p` ausente |
| Acorde | columna con ≥ 3 notas simultáneas | `build_columns` |
| Anotado | `fingering p/i/m/a` presente: `p` solo en 6-4 y `i m a` en 3-2-1 fijan cuerdas en un arpegio | Carcassi, «Manner of Touching the Strings» |

## 6. Economía de dedos (dedos fijos, dedo guía, let-ring)

Quién lo dice (verificado): **Carcassi** (dedos «unmoved» entre acordes del arpegio; sostener bajos y voces); **Aguado** (dedo 3 «permanece quieto» durante el bajo; el sonido de una cuerda pisada cesa al levantar el dedo, y cuánto más tarda el dedo en colocarse más sonido se pierde; §87 lección 9; ligado deslizante con dedo guía §226); **Heijink y Meulenbroek** (tendencia a seguir usando segmentos ya reclutados). **Sayegh, Radicioni, Tuohy, Hori**: la literatura de costo no la trata con ese nombre en lo que pude leer (**no verificado** para sus artículos completos). **Pujol, Tárrega, Sor**: **no verificado**.

**Término propuesto** (para el estado del Viterbi): estado = `(candidato, hand, set de (cuerda, traste, fin_de_nota))`.
- `lift_cost = 2.0` por cada dedo que se levanta cuya nota aún no terminó (su `end` > inicio de la columna siguiente) y que no se vuelve a pisar.
- `reuse_bonus = -0.5` por cada (cuerda, traste) igual entre columnas consecutivas con intención de mantener (misma nota, mismo dedo).
- Una nota nueva en la **misma cuerda** que una sostenida corta la anterior ⇒ `+8` (ya existe en `_solve`); si la anterior está sostenida (let-ring), `+12` o duro.
- `guide_cost = 0` al cambiar de posición si queda un dedo común de la posición anterior.

**Prueba en preludios de Carcassi** (`scripts/carcassi-preludios/`): los preludios arpegiados (p. ej. n.º 1, 3, 6, 9; elegir por la señal 5.1) deben cumplir: (a) 0 pares de notas distintas consecutivas en la misma cuerda; (b) ningún cambio de posición dentro de un compás de arpegio; (c) el número de dedos levantados con la nota aún sonando es 0 en el compás; (d) cada tono repetido se queda en su cuerda. Comparar el recuento de infracciones antes/después de cada regla en `downloads/carcassi-preludios` y contra la digitación impresa del libro.

## 7. Tabla de reglas propuestas

| # | Regla | Fuente | Aplica a | Tipo / peso propuesto |
|---|---|---|---|---|
| 1 | Span ≤ 4 trastes salvo extensión de 1 o 4 | Heijink 2002; Carcassi (posición) | todo | duro; hoy 10 por traste, subir a duro |
| 2 | Distancia de mano entre columnas | Sayegh 1989; Burlet 2013 | todo | blando 0.6 por traste (ya existe) |
| 3 | Penalizar posiciones altas (> VII) | Burlet 2013 (+1 sobre traste 7); Heijink 2002 | todo | blando 0.3·min + 0.5 sobre 12 (ya existe) |
| 4 | Preferir posición baja/media (I-VII) | Carcassi (primeros tonos, luego VII); Heijink 17/13/1 | todo | blando |
| 5 | Evitar reposicionamiento dentro de un compás | Heijink 2002 (peso más alto en juicios) | arpegio, acorde | blando 2 por cambio |
| 6 | Cuerdas al aire no cuentan para la mano | Burlet 2013 (costo 0) | todo | existente |
| 7 | Evitar al aire si suena disonante con una nota que sigue o si hay que mantener | Aguado, lecciones 17, 21, 27 | melodía, acorde | blando 1; dura si disonancia de 2.ª |
| 8 | Dos notas distintas seguidas no van en la misma cuerda | Carcassi (arpegios, bajos al pulgar); `_solve` | arpegio | blando 8 (ya existe); duro si hay nota sostenida |
| 9 | Nota repetida se queda en la cuerda | `_solve`; Aguado (nota fija) | todo | blando 3 (ya existe) |
| 10 | Melodía en cuerdas agudas, bajos en graves (pulgar 6-4, `i m a` en 3-2-1) | Carcassi, «Manner of Touching the Strings» | arpegio, melodía | blando: `+2` por bajo en 1-3 o melodía en 4-6 |
| 11 | Arpegio en conjunto de cuerdas contiguas | Carcassi, arpegios p-i-m-a | arpegio | blando 1 por salto de cuerda > 1 |
| 12 | Dedo ⇒ traste (`pos + d - 1`) y elimina conflictos | Carcassi, «The Positions» | anotado | duro |
| 13 | `string`/`fret` de MusicXML | MusicXML 4.0 | anotado | duro |
| 14 | Orden de dedos = orden de trastes en un acorde | física; Al Kasimi 2007 (sin cruces) | acorde | duro |
| 15 | Cejilla: ≥ 2 cuerdas, mismo traste, dedo 1 | Carcassi; Aguado §138 | acorde | duro; costo 1.5 de cejilla |
| 16 | Mismo dedo no sostiene dos notas | Al Kasimi 2007 | todo | duro |
| 17 | Dedos guía y let-ring: no levantar nota sostenida | Carcassi; Aguado §87; Heijink | arpegio | blando 2 por dedo levantado; −0.5 por reutilización |
| 18 | Ligado en la misma cuerda | Carcassi, «Of the Slur» | melodía con ligadura | duro: misma cuerda, distinto traste |
| 19 | Dos voces simultáneas: aguda primero, grave en cuerda más grave | Aguado §105; Carcassi | acorde | duro |
| 20 | Ceja a prevención | Aguado §143 | acorde seguido de al aire | blando −1 |
| 21 | Color de cuerda (misma nota en distinto equísono) | Aguado §6 y lección 3; no hay cifra | melodía | **no verificado** como regla de peso |

## 8. Estado de implementación (issues #42 y #43)

Código: `backend/engine/fingering.py` (reglas y detección, puro Python) y `tabify.assign_frets(..., arpeggio=)`;
pruebas en `backend/engine/test_fingering.py`.

- **Reglas 8, 9 y 17 (parcial)**: sin dos notas distintas seguidas en una cuerda (8), nota repetida en su cuerda (3,
  ya existente) y, como economía de dedos, una sola casilla por altura dentro del compás. La economía se descarta si
  empeora la regla 8. El Viterbi de una sola nota vive ahora una sola vez: `extract.avoid_repeated_strings` es un alias.
  Con las reglas sobre todos los compases, los preludios publicados no cambian (equivalencia comprobada con 300 tabs
  aleatorias contra la versión anterior); la economía de dedos queda apagada en ese camino.
- **Detección por compás** (`detect_arpeggios`): ≥ 4 columnas de una nota y ≥ 75 % de las columnas; pulso regular
  (≥ 75 % de los intervalos iguales al menor); saltos de 3 o más semitonos en ≥ 50 % de los intervalos; y que las
  alturas vuelvan (≥ 1,6 notas por altura) **o** que casi todos los intervalos sean saltos (≥ 90 %). Umbrales
  ajustados a mano con los 16 preludios; el último criterio se agregó porque los arpegios largos (preludios 13 a 15)
  no repiten alturas.
- **Medición** sobre los 16 preludios (`assign_frets` sin postproceso): infracciones de la regla 8 = **86** sin reglas,
  **0** con `arpeggio="auto"` y 0 con todos los compases. Falta una medición de falsos positivos con criterio
  musical: con `auto` se marcan casi enteras las lecciones de arpegios de Sagreras (46 a 55, 80) y de Aguado (13 a 18),
  pero también compases de varias piezas progresivas de Carcassi (por ejemplo 11 y 16, con más del 85 % de los compases).
  Conviene mirarlas a ojo antes de activar `ARPEGGIO` en una colección.
- **Anotaciones (§4)**: implementadas las eliminaciones por columna: `<string>` y `<fret>` fijan la casilla, dedo `0`
  fija la cuerda al aire, y se descartan combinaciones con el mismo dedo en dos trastes (salvo cejilla con el dedo 1),
  dedos en orden contrario al de los trastes y posiciones (`traste − (dedo − 1)`) que difieren en más de un traste.
  Si la anotación contradice la altura o no deja ninguna combinación, se ignora (gana la altura). **No implementado**:
  continuidad de la posición entre columnas anotadas, 4 trastes con 3 dedos, y los pesos de la economía de dedos
  del §6 (`lift_cost`, `reuse_bonus`); son hipótesis sin calibrar.
- **Preludios publicados**: no se reconstruyeron; sus compases ya salen del script con las reglas aplicadas a todos.
  Activar `ARPEGGIO` en Sagreras, Aguado o las progresivas cambia su TAB y obliga a reconstruir y revisar esas piezas.

## 9. Resumen

Reglas clave: span ≤ 4 con extensión limitada; mano quieta en el compás; arpegios en cuerdas contiguas con pulgar en los graves; no repetir cuerda entre notas distintas; mantener dedos y cejilla mientras suenan; marcas de la partitura (dedo, cuerda, traste) como restricciones duras.

Huecos de verificación: no pude leer Sayegh 1989 (de pago), Tuohy 2005 y su tesis (404), Radicioni, Hori ni Ramos; Sor es un escaneo sin texto; no revisé Giuliani, Coste, Sagreras, Tárrega ni Pujol. Las citas de Carcassi y Aguado vienen de OCR (Carcassi: texto de archive.org `newimprovedmeth00carc`; Aguado: facsímil IMSLP265882 local); la numeración de lección del OCR de Aguado tiene errores (5 por 3), cotejar con la imagen antes de citar páginas. Los pesos propuestos son hipótesis para calibrar con tests.

## Fuentes

- Sayegh, S. (1989). Fingering for string instruments with the optimum path paradigm. *Computer Music Journal* 13(3), 76-84. Solo referencia (resúmenes: arXiv 2407.09052; repositorio Kyoto COMJ_a_00129).
- Heijink, H. y Meulenbroek, R. G. J. (2002). On the complexity of classical guitar playing: functional adaptations to task constraints. *Journal of Motor Behavior* 34(4), 339-351. Texto: https://www.socsci.ru.nl/meulenbroek/Publications/Heijink%20en%20Meulenbroek%202002.pdf
- Burlet, G. y Fujinaga, I. (2013). Robotaba guitar tablature transcription framework. *ISMIR 2013*. https://archives.ismir.net/ismir2013/paper/000217.pdf
- Al Kasimi, A., Nichols, E., Raphael, C. (2007). A simple algorithm for automatic generation of polyphonic piano fingerings. *ISMIR 2007*. https://archives.ismir.net/ismir2007/paper/000355.pdf
- Tuohy, D. R. y Potter, W. D. (2005). A genetic algorithm for the automatic generation of playable guitar tablature. *ICMC*, 499-502 (referencia vía arXiv 2510.10619: https://arxiv.org/html/2510.10619v1).
- Radicioni, D. y Lombardo, V. (2005); Hori, Kameoka, Sagayama (2013); Ramos et al. (2015, 2016): referencias vía el mismo arXiv 2510.10619.
- Carcassi, M. *New and Improved Method for the Guitar* (Ditson, 1853), edición con inglés/francés: https://archive.org/details/newimprovedmeth00carc. Secciones: «The Positions», «The Barrer», «Manner of Touching the Strings», «Of the Slur», «Arpeggios with three and four fingers». Sin números de página (OCR).
- Aguado, D. *Nuevo método para guitarra* (Madrid, 1843), IMSLP265882 (copia en `resources/aguado/nuevo-metodo/fuentes/`). Citado por párrafo (§) y lección.
- Sor, F. *Méthode pour la guitare* (1830) / *Method for the Spanish Guitar*, trad. A. Merrick (c. 1832): no leído (escaneo sin texto).
