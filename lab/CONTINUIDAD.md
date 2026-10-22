# Continuidad de la sesión - 2026-10-22

## Estado para retomar

Está entregada la versión 1 de **Arpegios de raíz argentina**: diez ejercicios,
104 compases escritos, diez páginas A4, pentagrama y tablatura alineados.
Se verificaron las voces, posiciones y alturas y se revisaron visualmente
las diez páginas finales. El usuario todavía **no dio feedback musical**
sobre esta versión. Su última indicación fue reunir los materiales y las
notas en `lab/` para continuar en otra sesión.

El trabajo inicial se integró en `main` con el commit `2c65995` y el merge
`242406d`. Los enlaces de aquella entrega apuntaban a `output/` y `scores/`:
las rutas vigentes ahora son `lab/output/` y `lab/folklore-arpegios/`.
La fuente de verdad para modificar notas, cuerdas, acordes, células y
cierres es [coleccion.json](folklore-arpegios/coleccion.json). El MusicXML
y el PDF son derivados; una corrección hecha en un editor musical también
debe volver al JSON para sobrevivir a la próxima regeneración.

## Lo que pidió y confirmó el usuario

- Primera tanda de diez ejercicios y esperar feedback antes de continuar.
- Inspiración pedagógica en Carcassi y Sagreras: dificultad principal clara,
  repetición, avance gradual, posiciones económicas y conclusión musical.
- Partir de acordes abiertos; incorporar luego independencia del bajo,
  plaqués, terceras, sextas y densificación rítmica. Evitar cejillas completas.
- Incluir formas sencillas de vals, chamamé y milonga que se enriquezcan,
  además de zamba y chacarera. No forzar todos los géneros al mismo compás:
  vals en 3/4, milonga en 2/4; explorar el cruce 6/8-3/4 donde corresponde.
- Admitir patrones repetibles, pero escribir una conclusión. Los primeros
  cinco tienen ocho compases, los siguientes cuatro doce y el último dieciséis.
- Notas y TAB, sin `p-i-m-a`; se optó por no imprimir dedos de ninguna mano
  ni cifrado. Título, objetivo y consigna quedan fuera de los sistemas.
- Usar las sucesiones armónicas locales y sus formas descompuestas. El usuario
  aceptó transportar cuando facilite la ejecución; esta tanda no necesitó
  aplicar una transposición sistemática del corpus.
- El análisis de Fleury se delegó expresamente para que no bloqueara la
  composición. Sus hallazgos están registrados abajo y en la guía.

## Lo aprendido de los apuntes y la composición

1. **Las barras de las sucesiones separan versos, no compases.** Los documentos
   no fijan la duración de cada acorde. El ritmo armónico de estos ejercicios
   es una composición nueva, no una transcripción de las canciones.
2. El corpus tiene 27 entradas, de las que tres están marcadas como ajenas al
   folklore argentino: Vicentico, Miranda y Recuerdos de Ypacaraí. No se usaron
   en esta tanda. Se eligieron fragmentos cadenciales, sin melodías ni letras.
3. Son especialmente útiles `Am-E7`, `Dm-C-E7-Am`, `Am-A7-Dm`, `G7-C`,
   `Am-G-F-E7`, `D-G-A7`, `G-C-D7` y `Am-B7-Em`. La guía y el campo `fuente`
   de cada ejercicio identifican qué canciones aportaron los fragmentos.
4. En las danzas birrítmicas, **superponer 3+3 y 2+2+2** es más preciso que
   alternar firmas de compás. Los registros ayudan a oír las dos capas:
   agudos en dos y bordonas en tres. Los apoyos 3 grave, 4 agudo y 5 grave
   (numeración de las seis corcheas) son una referencia importante en los
   apuntes de zamba/chacarera. No trasladar automáticamente el acento del
   vals al primer tiempo de todas las danzas.
5. Hay una tensión entre los documentos: el apartado 5.5 de dos voces habla
   de alternancia; el apunte rítmico enfatiza superposición. Para la tanda
   se adoptó la superposición como base. Una hemiola o variación local puede
   cambiar el agrupamiento de una voz sin redefinir todo el género.
6. El final de la sexta corchea puede respirar en la zamba. Sustraer el bajo
   inicial, abrir un acorde y responder en otro registro producen cambios de
   textura más útiles que llenar siempre el compás de notas.
7. La milonga inicial usa corchea con puntillo, semicorchea y dos corcheas.
   La siguiente conserva el gesto inicial y subdivide el final. Son modelos
   introductorios; no agotan las variantes de milonga campera y ciudadana.
8. Las terceras/sextas paralelas y los enlaces graves tienen apoyo documental
   especialmente claro para conjuntos de guitarras de chamamé. Llevarlos a
   una sola guitarra y a otros géneros es una adaptación compositiva; no
   presentarla como una regla universal demostrada para todos ellos.
9. Respetar la sensible en las dominantes menores: sol sostenido sobre E7,
   re sostenido sobre B7. Las dobles notas se seleccionaron según el acorde,
   en lugar de aplicar terceras diatónicas de manera mecánica.
10. Las formas descompuestas permiten evitar acordes completos innecesarios.
    El rol `T` de E7 usa sol sostenido y re para conservar tercera y séptima,
    evitando imponer el choque de segunda re-mi en los plaqués iniciales.

Los apuntes distinguen fuentes verificadas, conocimiento convencional y
deducciones propias. Conservar esa distinción: una comprobación armónica
automática no demuestra que una célula represente por sí sola un estilo.

## Imagen aportada y ejercicio 8

Se conservó el original en `fuentes/celula-aportada.png`. Es un compás de
3/4 sobre Am: bajo la sostenido una blanca; arriba, mi-do-la-mi, seguido
del arpegio la-mi-la-do. Las duraciones son corchea con puntillo +
semicorchea, dos corcheas y cuatro semicorcheas.

Alturas sonoras: E4-C4-A3-E4-A2-E3-A3-C4; TAB superior:
`1/0, 2/1, 3/2, 1/0, 5/0, 4/2, 3/2, 2/1`, más `5/0` al comienzo como
bajo de blanca. Esa lectura se comprobó visualmente sobre la imagen.

El ejercicio 8 conserva la célula en los compases de repique y la adapta a
otros acordes, alternándola con la base de zamba. El cuaderno mantiene la
firma 6/8, pero la variación conserva agrupamientos gráficos por negras.
Es una decisión de estudio consciente; evaluar con el usuario si ese
contraste se entiende y si conserva el carácter buscado al tocarlo.

## Fleury: hallazgos del análisis delegado

Fuente preservada: `fuentes/fleury-vol2.pdf`. Páginas PDF contadas desde 1;
los sistemas y compases se localizaron visualmente, no son números impresos.

| Obra | Ubicación comprobada | Hallazgo y posible aplicación |
|---|---|---|
| Guaymallén, cueca | p. 4, sistemas 1-3 | Agudos en corcheas 1 y 4, bordonas en 3 y 5; alternancia con seis corcheas. Primero enseñar la base y luego abrirla. |
| El desvelao, gato | p. 14, sistema 1, compases 2-3 | Seis corcheas agudas sobre tres ataques de bajo. Modelo de independencia entre capas. |
| Trinos y alas, chacarera | p. 23, sistema 1, compases 1-3; también p. 22 | Arpegio por registros agudo-grave-grave, y respuestas graves durante respiraciones del canto. |
| Mudanzas, malambo | p. 18, sistema 5, tres últimos compases | Canto de valores largos sobre una figura regular en registros medio y grave. |
| Lejanía, estilo | p. 6, sistemas 1-3 | Densificación del arpegio y separación del canto sostenido respecto del bajo. |

El índice del README original de Fleury tiene ubicaciones desplazadas;
confiar en estas páginas verificadas y volver a mirar el PDF antes de
transcribir. Los nombres de varios PNG de revisión reflejan búsquedas
iniciales equivocadas, no identificaciones definitivas.

Se tomaron **procedimientos de textura**, sin copiar frases completas.
No se hizo una transcripción integral ni validación auditiva contra
grabaciones. La inversión grave/agudo de estilo y vidalita mencionada en
los apuntes tampoco debe trasladarse sin más a zamba/chacarera.

## Aprendizajes técnicos para futuras revisiones

- El generador es autónomo: JSON → MusicXML → Verovio → SVG → PDF con
  `rsvg-convert`. No usa OCR ni el optimizador automático de digitación.
  No necesita los originales de consulta ni red para reconstruir la tanda.
- Las cuerdas/trastes son explícitos; las alturas se derivan de ellos. Con
  clave de sol octavada, este flujo de Verovio recibe alturas sonoras y
  coloca las notas una octava arriba en papel. Sumar otra octava en el XML
  produjo una duplicación visual que se corrigió antes de entregar.
- **Conservar el `id` de la raíz SVG de Verovio al anidarlo en la página.**
  Sus estilos CSS están acotados a ese identificador. Quitar el `id` dejó
  visibles cabezas y barras, pero ocultó líneas del pentagrama y plicas.
- No basta ocultar el ritmo de TAB con CSS: todavía ocupa espacio de
  maquetación. Se quitan los `tabDurSym` del MEI intermedio antes de la
  segunda carga en Verovio, junto con el metro repetido de TAB y la llave.
  No se quitan notas ni duraciones musicales.
- El contenedor SVG declara `xmlns:xlink`, necesario para las referencias
  a glifos. Un contenedor sin ese espacio de nombres impidió crear el PDF.
- Mantener un pequeño margen izquierdo para no cortar números de compás.
  `minLastJustification=0.0` hace que el último sistema de cuatro compases
  use el mismo ancho que los anteriores. Los cortes están codificados cada
  cuatro compases. El ejercicio 10 necesita cuatro sistemas en su página.
- Los finales están también en el JSON, en `final`; no hay que modificar
  Python para cambiar el cierre de un ejercicio.
- La afinación está fijada a estándar y se comprueba. Cambiar el campo
  `afinacion` no implementa por sí solo otra afinación: también habría que
  generalizar la conversión de alturas y la exportación de las cuerdas.
- En esta máquina se usó `.venv-carcassi/bin/python`, con Music21 10.5.0 y
  Verovio 6.3.0 instalado. El generador actual sólo necesita Verovio, no
  Music21; también requiere `rsvg-convert` y `pdfinfo` disponibles en PATH.

## Qué se verificó y qué falta

Verificado: diez ejercicios / 104 compases, duración de voces, notas del
acorde, ausencia de cuerdas ocupadas por dos notas incompatibles, hasta
cuatro notas pisadas a la vez, extensión simultánea máxima de tres trastes,
coincidencia entre pentagrama y TAB serializados, diez páginas A4 y revisión
visual de todas las páginas finales.

No verificado: ejecución física completa en guitarra, validación auditiva
del carácter de cada ritmo, recepción pedagógica por parte del usuario ni
importación en distintos editores musicales. No afirmar que esos puntos
ya están resueltos. Tampoco se necesitó probar cambios en el sitio: esta
tanda no agregó páginas web.

## Ideas pendientes, no compromisos de la próxima tanda

1. Empezar por el feedback del usuario: dificultad real, comodidad de las
   posiciones, legibilidad y si cada género se reconoce al tocarlo.
2. Revisar si 3→4 y 6→7 son saltos demasiado grandes. Se puede insertar una
   variante del mismo patrón manteniendo la armonía, antes de cambiar ritmo
   y textura a la vez. No aumentar cantidad todavía sin su aprobación.
3. Explorar bajo fundamental-tercera-quinta, enlaces por grado conjunto y
   respuestas que ocupen los silencios del canto, con pocas notas.
4. Introducir más adelante una melodía superior realmente sostenida sobre
   acompañamiento móvil, tomando el procedimiento de Mudanzas o Lejanía.
   La versión actual no desarrolla plenamente esa independencia a tres capas.
5. Revisar el repique de Dm en el ejercicio 8: el rol `N` repite la misma
   posición que `B`. Una alternativa a probar es `N = 4/3` (fa), para hacer
   un ascenso re-fa-la-re. Aún no se aplicó; escuchar y tocar antes de elegir.
6. El ejercicio 9 termina en G y usa un recorrido funcionalmente cercano a
   Sol mayor, aunque la armadura actual es de cero alteraciones. Evaluar
   escribir una armadura de Sol y los fa naturales locales en G7; no es un
   error de alturas, sino una decisión editorial pendiente.
7. Comparar familias de células por densidad: base, apertura en arpegio,
   dobles notas, enlace y cierre. La dificultad debe crecer por control de
   voces y balance, no sólo por velocidad o cantidad de notas.
8. Si el usuario lo pide, generar audio de comprobación o una versión más
   compacta para imprimir. El formato vigente tiene una página por ejercicio,
   con bastante espacio libre en los primeros para anotaciones.
9. Contrastar de oído los patrones con interpretaciones concretas antes de
   llamar canónica a una variante. Los documentos originales señalan varios
   géneros y detalles todavía no corroborados.

## Cómo volver a generar sin perder la versión entregada

Desde la raíz del repositorio, con las dependencias disponibles:

```bash
python lab/folklore-arpegios/build.py --output /tmp/folklore-revision
```

Comparar los MusicXML y renderizar el PDF de revisión con Poppler. Para
actualizar los entregables, omitir `--output`: la salida predeterminada es
`lab/output/`. No recrear la antigua carpeta de salida en la raíz.
Conservar los renders manuales en `lab/revision/`, fuera de git.
