# Acordes de guitarra

Sitio estático de herramientas para guitarristas (acordes, notas, tablaturas) más la herramienta Partitura y tablatura, que convierte una partitura en notación con tablatura. Este glosario fija el vocabulario de esa herramienta; código, docs y tickets deben usar estos términos.

## Language

**Ataque**:
Un instante de un compás en el que suena al menos una nota (todas las voces agrupadas). Tiene hasta seis posiciones, una por cuerda, cada una con un traste o vacía; la cuerda 1 (la más aguda) va primero.
_Avoid_: Acorde, evento, nota (una nota es una sola altura; un Ataque puede tener varias)

**Columna**:
Solo la posición visual de un Ataque en el editor de TAB. No es un concepto musical ni de la API.
_Avoid_: Ataque (cuando se habla de datos), tiempo

**Trabajo**:
Una subida de partitura con su procesamiento y exportaciones, identificado por un id aleatorio largo que sirve de secreto en el enlace. Vive 24 horas.
_Avoid_: Sesión, proyecto, tarea

**Digitación sugerida**:
La asignación de cuerda y traste a cada Ataque que calcula el motor automáticamente, antes de que el visitante la toque.
_Avoid_: Tablatura automática, resultado

**Digitación confirmada**:
La Digitación sugerida con las ediciones del visitante, enviada al exportar. Un Trabajo puede exportarse varias veces (hasta un límite).
_Avoid_: Tablatura final, edición

**Afinación**:
Las alturas de las cuerdas al aire con las que se calcula la digitación: Automática (detecta Drop D si hay notas por debajo de Mi2), Estándar o Drop D.
_Avoid_: Tuning

**Notas descartadas**:
Notas de la partitura para las que no hay posición posible en el diapasón con la Afinación elegida, o que sobran en un Ataque con más de seis; se informan por compás y altura. Se priorizan bajo y melodía.
_Avoid_: Notas perdidas, errores

**MusicXML intermedio**:
El MusicXML que produce el reconocimiento óptico a partir de un PDF. Es descargable para corregir errores de reconocimiento en un editor externo y volver a subirlo.
_Avoid_: OCR, MusicXML original (el original es el que sube el visitante)

**Acorde de la base**:
Un acorde de la base de datos de acordes del sitio, con una o más posiciones. Su posición abierta estándar es la Forma completa del acorde.
_Avoid_: Digitación (eso es el dato por Ataque de una partitura)

**Forma completa**:
La tablatura de un acorde con todas sus notas (`G7 | 1 0 0 0 2 3`). Las cifras son trastes.
_Avoid_: Digitación completa, posición de dedos

**Forma descompuesta**:
La tablatura de un acorde con solo las notas que se usan al arpegiar (o en un plaqué o contrapunto); las cuerdas que no suenan quedan sin cifra (`G7 | 1 0 0 x x 3`).
_Avoid_: Forma reducida, digitación parcial

**Descomposición**:
Tomar algunas notas de un acorde en vez de su Forma completa para generar un arpegio, plaqué o contrapunto.
_Avoid_: Simplificación

## Relationships

- Un **Trabajo** parte de un PDF o MusicXML, produce un **MusicXML intermedio** (solo PDF) y una **Digitación sugerida**.
- Cada compás contiene **Ataques**; en el editor cada Ataque ocupa una **Columna**.
- Exportar una **Digitación confirmada** habilita PDF, MusicXML final, JSON y MusicXML intermedio.

## Flagged ambiguities

- "Tablatura" se usaba para la digitación y para el pentagrama TAB del PDF: usar **Digitación** para los datos y "pentagrama TAB" para el dibujo.
- Editar la TAB no corrige errores de la notación; eso se corrige en el MusicXML intermedio.
