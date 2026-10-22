# Arpegios de raíz argentina - primera tanda

Diez estudios originales para guitarra de seis cuerdas en afinación estándar.
La colección se detiene en esta primera tanda para recibir comentarios del
intérprete antes de ampliar o reordenar la progresión.

## Entregables

- [PDF completo](../../output/pdf/folklore-arpegios.pdf): diez páginas A4,
  un ejercicio por página, pentagrama y TAB alineados.
- [Fuente editable](coleccion.json): formas descompuestas, células, sucesiones,
  objetivos y consignas. Esta es la fuente de verdad para revisiones.
- [MusicXML](../../output/musicxml/folklore-arpegios/): un archivo por ejercicio,
  con los dos pentagramas y las posiciones de cuerda y traste explícitas.
  Se puede importar en un editor musical; para cambios persistentes hay que
  llevar la corrección también a la fuente JSON.

## Decisiones acordadas

Partir de acordes abiertos; aumentar gradualmente la independencia del bajo,
los ataques simultáneos y la densidad rítmica. Evitar cejillas completas. Las
formas llegan al traste 4, con una extensión máxima de tres trastes entre
notas pisadas simultáneas. Los últimos ejercicios incorporan terceras,
sextas y pequeños repiques. No se imprimen dedos de ninguna mano ni cifrado
de acordes: los sistemas contienen notación y tablatura. Los títulos,
objetivos y consignas van fuera de los sistemas.

Cada ejercicio tiene una sección repetible de cuatro u ocho compases y una
continuación que termina en tónica con calderón. Los ejercicios 1-5 tienen
ocho compases; los 6-9, doce; el 10, dieciséis. La consigna es repetir una vez
la sección delimitada por barras de repetición y continuar hasta el final.
El final sostenido puede suspender el patrón de acompañamiento.

Las células son modelos de estudio, no descripciones exhaustivas de los
géneros ni arreglos completos de las canciones del corpus. La distribución
temporal de los acordes es nueva: las barras de los apuntes separan versos,
no compases. Se reutilizan fragmentos armónicos, sin melodías ni letras de
las canciones.

| Nº | Ritmo | Objetivo | Sucesión escrita, sin desarrollar repeticiones |
|---|---|---|---|
| 1 | Vals, 3/4 | Bajo largo y notas separadas | C G7 C G7 / C G7 G7 C |
| 2 | Vals, 3/4 | Seis corcheas sobre bajo largo | Am E7 Am E7 / Dm C E7 Am |
| 3 | Milonga, 2/4 | Bordona y plaqué | Am E7 Am E7 / Dm C E7 Am |
| 4 | Milonga, 2/4 | Apertura del plaqué en arpegio | Am E7 Am E7 / Dm C E7 Am |
| 5 | Chamamé, 6/8 | Dos pulsos agudos y tres graves | G D7 G D7 / C G D7 G |
| 6 | Chamamé, 6/8 | Respuestas en terceras | Em B7 Em B7 Am Em B7 Em / Am Em B7 Em |
| 7 | Zamba, 6/8 | Apoyos en corcheas 3 y 5 | Am Am E7 E7 Am Am E7 E7 / Dm C E7 Am |
| 8 | Zamba, 6/8 | Bajo sostenido y repique | Am A7 Dm Dm G7 C E7 Am / Dm C E7 Am |
| 9 | Chacarera, 6/8 | Arpegio 3+3 sobre bordonas en tres | C G E7 Am D7 G G7 C / C G D7 G |
| 10 | Chacarera, 6/8 | Arpegio, terceras, sextas y cierre | Am A7 Dm Dm G7 C E7 Am / Am G F E7 Dm C E7 Am |

## Editar la fuente

Todas las posiciones se escriben `cuerda/traste`; la cuerda 1 es la aguda.
Las alturas se derivan de esas posiciones para evitar discrepancias entre
el pentagrama y la TAB. Las formas tienen estos roles:

| Rol | Uso |
|---|---|
| B | Fundamental grave |
| Q | Quinta grave, por encima o por debajo de la fundamental |
| L / M / H | Notas del acorde en las cuerdas 3 / 2 / 1 |
| N | Nota del registro medio-grave para el enlace |
| P | Pareja de notas para la respuesta armónica |
| T | Plaqué agudo; en E7 conserva la tercera y la séptima |

Una célula tiene las voces `agudo` y `bajo`. Cada entrada es
`[inicio, duración, rol_o_posición, acento_opcional]`. La unidad es **una
semicorchea**: un compás de 2/4 tiene ocho unidades; uno de 3/4 o 6/8,
doce. Una lista de roles o posiciones produce notas simultáneas.

```json
{
  "agudo": [[0, 6, "M"], [6, 6, "H"]],
  "bajo": [[0, 4, "B"], [4, 4, "Q"], [8, 4, "B"]]
}
```

Este ejemplo superpone dos negras con puntillo agudas a tres negras graves.
Los huecos se completan con silencios ocultos; la respiración final de la
base de zamba se imprime como silencio visible. Los valores indican cuánto
mantener cada nota, sin exigir cortar la resonancia natural de todas las
otras cuerdas. No sostener una cuerda más allá de su valor si impide el
ataque siguiente.

En `compases`, una cadena usa el patrón general del ejercicio. Un objeto
como `{"acorde":"Am","patron":"zamba-repique"}` cambia la célula de ese
compás. El campo `final` contiene las voces del último compás: conserva el
arpegio inicial en los dos primeros ejercicios y termina con notas
simultáneas sostenidas en los demás. También se edita en el mismo JSON.

Los MusicXML codifican las alturas sonoras y una clave de sol octavada
hacia abajo. El pentagrama muestra las notas una octava por encima de su
sonido, como es habitual en guitarra. La TAB lleva alturas sonoras y
posiciones explícitas; su ritmo se lee en el pentagrama superior.

## Regenerar y verificar

Requiere Python 3.10+, `verovio==6.*`, `rsvg-convert` y `pdfinfo`.
No se requieren reconocimiento óptico, conexión de red ni los originales
de `resources/` para reconstruir la colección.

```bash
python scores/folklore-arpegios/build.py
```

La opción `--output /ruta/de/salida` permite una reconstrucción de revisión
sin sobrescribir los entregables. El generador comprueba:

- duración y ausencia de solapamientos dentro de cada voz;
- alturas pertenecientes al acorde de cada compás;
- cuerdas distintas para todas las notas sostenidas simultáneamente;
- hasta cuatro notas pisadas simultáneas y extensión de hasta tres trastes;
- concordancia de alturas y duraciones entre el pentagrama y la TAB del
  MusicXML ya serializado;
- diez páginas en el PDF final.

Estas comprobaciones no sustituyen una prueba física de la mano izquierda
ni garantizan la interpretación estilística. El PDF se revisó además
renderizando sus diez páginas con Poppler. Los renders de revisión se
mantienen fuera de git.

## Materiales y criterio musical

La base armónica es `resources/lab folklore/folklore-argentino-acordes.md`;
la procedencia concreta se guarda en `fuente` dentro de cada ejercicio.
Se excluyen los temas marcados como ajenos al folklore argentino en ese
corpus. Los apuntes rítmicos y de dos voces de la misma carpeta orientan
la distribución de registros. Se conserva su distinción entre fuentes
verificadas, convenciones y propuestas compositivas.

Las formas descompuestas toman como referencia el artículo
[Tablaturas para arpegios](https://acordesdeguitarra.com.ar/articulos/tablaturas-para-arpegios)
y su implementación local `scripts/lib/article-arpeggios.js`. Se privilegian
tres cuerdas agudas más una bordona, con cambios según las necesidades del
estudio. La relación con Carcassi y Sagreras es pedagógica: repetición de
una dificultad, claridad de voces, economía de posiciones y cadencia final;
no se transcribe ninguno de sus estudios.

La imagen aportada por el usuario inspira los compases de repique del
ejercicio 8: corchea con puntillo + semicorchea, dos corcheas y cuatro
semicorcheas sobre un bajo de blanca. En Am reproduce sus posiciones de
cuerda y traste. Se conserva la agrupación gráfica por negras de esa
variación, dentro del 6/8 de la colección, en contraste con los compases
de base. La imagen original es material local de sesión; no hace falta
para regenerar el ejercicio.

La milonga del ejercicio 3 utiliza la célula corchea con puntillo,
semicorchea y dos corcheas. El ejercicio 4 conserva el gesto inicial y
subdivide el último ataque. Como comprobación adicional se consultó el
[trabajo de Melicchio, UNCuyo](https://bdigital.uncuyo.edu.ar/objetos_digitales/19822/tesis-melicchio.pdf),
cuyo extracto indexado identifica esa fórmula; el servidor impidió abrir
el documento completo, por lo que no se atribuye una transcripción de sus
ejemplos. Para el chamamé, el estudio primario de Troitiño y Polemann,
[El chamamé desde la guitarra](https://sedici.unlp.edu.ar/handle/10915/80528),
documenta el bajo en tres negras y la armonización por terceras y sextas.
Su aplicación a una sola guitarra en estos ejercicios es una adaptación.

El análisis delegado de Fleury examinó `resources/partituras/fleury/vol2.pdf`
visualmente. Las páginas siguientes son **páginas PDF, contadas desde 1**;
los compases son conteos locales por sistema, no números impresos:

| Obra | Ubicación | Procedimiento tomado como referencia |
|---|---|---|
| Guaymallén, cueca | p. 4, sistemas 1-3 | Agudos en 1 y 4, bordonas en 3 y 5 |
| El desvelao, gato | p. 14, sistema 1, compases 2-3 | Seis corcheas agudas sobre tres negras graves |
| Trinos y alas, chacarera | p. 23, sistema 1, compases 1-3; también p. 22 | Arpegio por registros y respuestas de bordonas |
| Mudanzas, malambo | p. 18, sistema 5, tres últimos compases | Contraste entre canto y acompañamiento |
| Lejanía, estilo | p. 6, sistemas 1-3 | Densificación del arpegio y voces independientes |

Se toman procedimientos texturales, no frases completas ni una atribución
de estas células como fórmulas únicas de cada género. El análisis fue
visual; no se realizó contraste auditivo con grabaciones.
