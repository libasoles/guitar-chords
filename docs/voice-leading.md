# Voces, acordes y conducción

## Fuentes consultadas y alcance

Se consultaron los pasajes indicados, no se afirma haber estudiado íntegramente estos tratados.

- Walter Piston, *Counterpoint* (1947), capítulos I–II, VII (pp. 118–125) y VIII (pp. 143–145): [transcripción del original](https://pdfcoffee.com/walter-piston-counterpoint-pdf-free.html). Su punto de partida es la combinación de líneas melódicas. El contorno, el ritmo y la actividad de cada parte contribuyen a su individualidad. En la escritura a varias partes, las combinaciones verticales pueden ser acordes sin eliminar las líneas que las producen. También trata cruces de voces; el registro no identifica permanentemente una parte.
- Arnold Schoenberg, *Fundamentals of Musical Composition* (1967), capítulo IX, «Voice Leading» y «Treatment of the Bass Line», pp. 84–86; capítulo XII, «Watch the Bass Line», p. 117: [original digitalizado](https://api.unilibrary.uz/storage/PublisherResourceFile/240733/images/1677046499.pdf#page=97). El acompañamiento conserva conducción de sus partes; el bajo requiere atención melódica propia. El número de partes y las duplicaciones pueden variar según la textura. Estos pasajes no autorizan a identificar voces únicamente por coincidencia rítmica.
- Robert Hutchinson, *Music Theory for the 21st-Century Classroom*, [§26.1, Voice Leading](https://musictheory.pugetsound.edu/mt21c/VoiceLeading.html): expone conducción como movimiento de las partes, con independencia y economía melódica; sus ejemplos SATB producen acordes a cuatro voces.

La teoría orienta qué entidades conservar. No ofrece una deducción única de la intención del compositor a partir de alturas y duraciones. La implementación siguiente es nuestra heurística de inferencia, no un algoritmo atribuido a Piston o Schoenberg ni un analizador completo de contrapunto.

## Distinciones del modelo

1. Una voz es una línea que continúa horizontalmente. Dos voces pueden coincidir en ritmo, cruzarse o moverse por saltos.
2. Un acorde es una relación vertical entre sonidos; no determina cuántas voces musicales intervienen.
3. Un acorde de **notación** agrupa notas bajo una plica. Es una decisión de escritura explícita, distinta del análisis contrapuntístico. El modelo lo codifica con el mismo `v`, inicio y duración. Esa agrupación no demuestra que exista una sola voz en un análisis musical más profundo.
4. El barrado opera sobre figuras consecutivas de la misma línea escrita. No puede borrar silencios ni desplazar notas para unirlas.

## Reglas implementadas

- Las notas simultáneas sin voz declarada se consideran partes distintas, incluso cuando coinciden sus duraciones. Es una elección conservadora de edición para no fusionar líneas sin autorización, no una ley universal sobre la textura.
- La primera columna con más partes inicia las identidades de agudo a grave. El registro deja de ser una frontera fija: se busca continuidad horizontal.
- En cada columna, una asignación conjunta de coste mínimo conecta las notas con las partes disponibles. El coste es la distancia diatónica a la última nota de esa parte y, cuando existe, a su siguiente nota de voz declarada. Las asignaciones explícitas son restricciones; la altura inicial desempata partes todavía sin contexto. Una parte que empieza con silencio recibe una referencia inicial de registro cuando todavía no tiene alturas propias; un silencio no cuenta como ancla melódica futura. El emparejamiento usa Hungarian, evitando enumerar permutaciones.
- No se deduce identidad de voz de la igualdad de duración. El ritmo sigue siendo una restricción de las figuras y del barrado; no se aplica una preferencia por homorritmia que vuelva a fusionar partes.
- Al duplicar se fijan las voces de origen antes de insertar las copias, para que la operación continúe esas partes. Recalcular no se ofrece cuando la distribución musical de voces ya coincide, aunque falten etiquetas guardadas.
- Al mover una nota dentro de un compás con voces declaradas se rechaza el movimiento si adelantaría o retrasaría una parte distinta. Es una protección ante los límites del modelo temporal, no una reinterpretación de la escritura.
- Al insertar, se conserva la identidad de las notas existentes. Si todas las partes tienen una figura en esa columna, se abre una nueva según su posición inicial; en otro caso, se infiere una parte disponible por continuidad.
- «Formar acorde» reúne una selección simultánea de igual figura, puntillo y grupo irregular. Incluye las cabezas completas de los acordes seleccionados y se rechaza si movería alguna nota en el tiempo.
- «Recalcular voces del compás» vuelve a inferir el compás completo, incluida la selección que lo invoca. Permite reparar agrupaciones antiguas. No reduce arbitrariamente a dos voces. Se rechaza si excede la capacidad, las 16 voces admitidas por la implementación, o cambia algún inicio musical.
- Se conservan las voces guardadas y las decisiones explícitas del MusicXML importado, también si solo tiene una voz de notación. No se migran automáticamente partituras existentes: el programa no puede distinguir una agrupación elegida de una producida por la regla antigua.

## Caso reportado

En el compás en 6/8, las alturas superiores `35, 36, 38, 35` forman una línea y las inferiores `28, 30, 32, 28` otra. Recalcular cambia las voces guardadas a `1, 2, 1, 2, 1, 2, 1, 2`, conservando todos los valores e inicios.

La primera corchea grave termina en 12 y la siguiente empieza en 24. Esa separación temporal sigue existiendo después de corregir las voces. Las corcheas graves de 24 y 36 sí pueden barrarse independientemente de la melodía. Resolver el hueco inicial requiere una decisión rítmica del autor.

## Límites y trabajo posterior

La inferencia actual trabaja por compás, con proximidad diatónica y decisiones explícitas como anclas. No interpreta motivos, fraseo, función tonal, duplicaciones estructurales ni líneas compuestas; tampoco resuelve de manera única cruces sin información suficiente. Los cruces ya declarados se preservan. La conservación de un acorde de notación no equivale a haber separado sus voces contrapuntísticas internas.

El modelo temporal anterior sigue contando por orden y usa `at` para alinear columnas: comprime huecos sin silencios escritos. Una revisión futura debe representar tiempos y silencios de cada línea de forma explícita antes de inferir entradas bajo notas sostenidas o continuidad entre compases. Esta entrega no presenta esa arquitectura temporal como una consecuencia de la teoría musical.

La importación MIDI todavía reduce ataques simultáneos a bloques antes de crear las figuras. Inferir voces sobre esos bloques no recupera duraciones independientes que ya se hayan perdido en esa conversión. Revisar esa importación requiere otro cambio y ejemplos con notas sostenidas.

Las reglas estilísticas de composición (por ejemplo, el tratamiento de paralelismos en un coral tonal) no se usan para prohibir ni reescribir la música del usuario. Reconocer líneas y evaluar su conducción son tareas diferentes.

## Verificación

`test/score-voice-leading.unit.js` cubre homorritmia a cuatro partes, continuidad sin cortes fijos de registro, asignación conjunta, cruces explícitos, anclas futuras, saltos monofónicos, el compás reportado, seis notas simultáneas, persistencia, agrupación explícita y copia/pegado. Las fuentes dan principios musicales; los resultados concretos de la heurística se justifican con esos casos, no atribuyéndolos a los autores.
