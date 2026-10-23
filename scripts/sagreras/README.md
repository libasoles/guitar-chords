# Primeras lecciones de Sagreras (libro 1 de *Las lecciones de guitarra*)

Página: `/articulos/primeras-lecciones-de-sagreras`. Una tarjeta por lección (1–86), con vista previa, partitura completa
con TAB en un modal y descarga en PDF.

## De dónde salen las notas

La edición de **Marieh (2020)**, IMSLP610099, licencia CC BY-NC 4.0, es un PDF vectorial de MuseScore 2/3 (fuente `MScore`, no
Leland). El original queda en `resources/sagreras/primeras-lecciones/fuentes/` (no se versiona; ver su `README.md`).

1. `marieh_notes.py` lee la geometría del PDF con `carcassi-valses/pdf_notes.py` y un adaptador: trazos de varias líneas
   separados, anchos de plica/barra por rango, glifos `MScore`, cifra de compás «C», tresillos (cifra «3» en cursiva) y
   asignación de cada sistema a su lección por la etiqueta «No.N».
2. `transcribe.py N …` convierte cada lección en `sources/NN.musicxml` (12 divisiones por negra, tresillos, hasta tres
   voces: la redonda sin plica del bajo va como tercera voz). **Solo escribe la fuente si pasa el control**: las alturas
   leídas de la notación deben coincidir con los números de la TAB impresa de la edición, y cada compás debe sumar su
   duración. `transcribe.py check` solo compara. Lecciones con TAB impresa vacía: `NO_PRINTED_TAB`.
3. `build.py N …` pasa la fuente por el motor (`backend/engine/tabify.py`) y deja el PDF y el MusicXML con notación y TAB en
   `downloads/sagreras-lecciones/`, la vista previa en `src/site/articles/sagreras-lecciones/lesson-NN.svg` y las páginas del
   modal en `full/`. `measures.json` guarda los compases por lección (lo lee `test/sagreras.unit.js`).

Las fusas necesitan 24 divisiones por negra: `lesson_measures` selecciona esa rejilla al detectar tres barras,
sin cambiar la de las lecciones anteriores. Dos glifos de puntillo multiplican la figura por 7/4; en el No.39,
fusa + corchea con doble puntillo completan una negra. Se conservan las dos voces de la cabeza compartida
(fusa arriba y negra del bajo), pero el control contra la TAB cuenta ese ataque una sola vez.

En el No.58, una cabeza compartida lleva blanca con puntillo en el bajo y negra en la voz superior.
Si leer ambas como blancas hace desbordar la voz superior, su duración inicial se deduce del resto del compás;
ese tramo se conserva como hueco invisible al no repetir el ataque del bajo. Así la corchea siguiente no se adelanta.

En el No.65 (12/8), los silencios tambien llevan puntillo: la voz aguda empieza con un silencio de negra
con puntillo y sigue con tres negras con puntillo, mientras la voz intermedia alterna un silencio de corchea
con dos corcheas y el bajo sostiene una redonda con puntillo. El lector aplica los puntillos a los silencios
antes de separar las voces. En los compases 15–16, bajo y arpegio comparten direccion de plica: el eje temporal
usa las cabezas, sin el desplazamiento horizontal de las plicas superiores. Asi conserva tres voces y sus
silencios, sin anticipar ataques ni crear una cuarta voz. Las regresiones de `test/sagreras.unit.js` comprueban
los 16 compases en la fuente y en el MusicXML publicado; el control de alturas o la duracion maxima del
compas por si solos no detectan una voz corta cuando otra llena el compas.

La TAB publicada es la digitación sugerida por el motor, no la de Marieh. Los dedos de la mano izquierda (cifras 0-4 de
8 pt, las de la TAB impresa son de 9 pt) sí se leen: `marieh_notes.attach_fingers` pasa cada cifra a la cabeza más cercana,
`transcribe.py` las escribe como `<fingering>` y el motor las toma como pista (descarta las digitaciones que no se pueden
tocar con esos dedos); `transcribe.py` avisa por stderr de cualquier cifra que no encuentre nota. Las letras p i m a de la
mano derecha (texto de 8 pt de un solo carácter) se leen igual y van como un segundo `<fingering>` de la misma nota
(`transcribe_lib.note_xml` admite varios separados por `|`); el motor las ignora al digitar. No se publican los PDF de la
edición ni sus textos.

Atribución: la licencia (CC BY-NC 4.0) exige acreditar a Marieh e indicar los cambios en cada copia, así que `build.py`
(`stamp_footer`) pone en cada página del PDF, abajo a la izquierda, en Helvetica gris: «Con modificaciones a partir de» /
«Marieh (2020) · CC BY-NC 4.0», con enlaces a la edición en IMSLP y a la licencia. El detalle de los cambios está en la
página del artículo.

## Control de la digitación contra el libro

`compare_positions.py` compara las casillas (cuerda y traste) que propone el motor con las de la TAB impresa de la edición.
Lo aprendido: el libro mantiene los acordes en posición baja y con cuerdas al aire (A-do♯-sol = 5-2-0, no 5-6-5), y el costo
del motor solo medía la apertura de la mano. `tabify.local_cost` suma ahora 0,25 por traste pisado (53 → 18 casillas
distintas de 3070; las que quedan son las lecciones 60, 73, 79 y 37, y la 33 no tiene TAB impresa). **Tras tocar el costo
del motor o añadir una lección, corre `compare_positions.py`: el total no debe subir.** Otras trampas ya corregidas: un
♯ de la primera nota no es una armadura (`pdf_notes.key_signature` exige las alturas canónicas), y en compases con varias
voces de plica abajo los inicios se ajustan a la cuadrícula de duraciones (si no, un acorde queda entre dos pulsos).
Los corchetes de tresillo se dibujan sobre el pentagrama (debajo chocan con la redonda del bajo) y no se copian a la TAB.
Su altura se calcula por grupo, dejando espacio sobre las notas agudas y sus plicas de todas las voces simultáneas,
no a una altura fija de la última línea. La lección 55 aplica esta corrección en `engraving.clear_triplets` al generar
la vista previa, las páginas del modal y el PDF; la vista previa reserva margen superior para las cifras elevadas.

Al reconstruir varias voces con plicas en la misma dirección, la barra final fija el final del eje temporal.
No extrapolar el espaciado anterior: el ultimo grupo suele estar más comprimido. En la 53 eso superponía
dos semicorcheas y creaba una cuarta voz; con una sola nota de referencia (60 y 79), los acordes se adelantaban al inicio.
En la lección 60, compases 2, 4, 10 y 12, melodía y bajo duran tres negras; la voz intermedia empieza con
un silencio de negra y toca los dos acordes en los tiempos 2 y 3. Comparar solo las alturas de la TAB no detecta
que esos ataques se hayan desplazado: la regresión de `test/sagreras.unit.js` verifica también sus inicios y
duraciones en la fuente y en el MusicXML publicado.

## Reproducir

```sh
.venv-carcassi/bin/python scripts/sagreras/transcribe.py 44
.venv-carcassi/bin/python scripts/sagreras/build.py 44
```

Verificación: `node --test test/sagreras.unit.js`, `node scripts/build-site.js` y `node test/articles.e2e.js`.

Regresiones del lector sin el PDF local: `.venv-carcassi/bin/python -m unittest discover -s scripts/sagreras -p 'test_*.py'`.
El lector distingue las barras simples de 0,95 pt y las dobles de dos trazos de 0,8 pt; conserva el tipo
de cierre (doble, final o repeticion) al escribir MusicXML. En la 66, omitir esos trazos fusionaba los compases
8 y 9: ahora se conservan los 16 compases, con doble barra tras el 8 y Fine antes de ella.
La prueba de la leccion 39 en `test/sagreras.unit.js` verifica tambien las duraciones y los dos puntillos en la fuente y
el MusicXML publicado.

## Recuperacion de pendientes

La 59 pasa el lector actual sin correcciones: 8 compases y 0 diferencias de digitacion respecto de la TAB impresa.
La 62 (8 compases, tambien 0 diferencias) quedaba fuera porque el control contaba dos veces las cabezas compartidas
de igual duracion. `recover.py 62` valida un solo ataque por altura e inicio, conservando ambas voces en el MusicXML.
Este cotejo curado no modifica el lector ni las fuentes de las demas lecciones.

`recover.py 54` separa las blancas mi4 del arpegio en el compas 7, usando el mismo patron ritmico del compas 3.
Conserva el si del compas 2 en tercera cuerda, traste 4, como pide el texto de la leccion. Los 8 compases pasan el
control de alturas y duraciones y la digitacion tiene 0 diferencias en 121 notas. Una regresion comprueba las
blancas, los ataques de la melodia y las 12 semicorcheas del compas 7 en la fuente y en la descarga publicada.

`recover.py 56` transcribe los 16 compases de la pagina PDF 29: el lector solo devolvia 15 porque omitia el cierre
del primer sistema (sol4 y sol3 de blanca con puntillo). Tambien separa las tres voces del compas 10. Control de
alturas y duraciones correcto, 0 diferencias de digitacion en 65 notas; regresiones en fuente y descarga.

`recover.py 57` separa las tres voces de los compases 2, 4 y 10: las blancas de la melodia y del bajo arrancan en
el primer tiempo, mientras la voz intermedia entra en el segundo. No se concatenan sus duraciones. Conserva los
16 compases y la doble barra de seccion del compas 8. La regresion comprueba todas las alturas, inicios y duraciones
de esos tres compases en la fuente y en la descarga.
El do5 del cierre de la primera seccion se conserva en segunda cuerda, traste 1: 0 diferencias de digitacion en 67 notas.

Para reproducir estas cuatro fuentes usar `recover.py N` y despues `build.py N`; `transcribe.py N` sigue siendo el
lector automatico sin este cotejo manual. La 59 se reproduce con `transcribe.py 59` y `build.py 59`.

## Polifonia recuperada (67–72)

La 67 conserva tres voces de cuatro tiempos: el bajo es una redonda, la melodia empieza con silencio de
negra y el arpegio con silencio de semicorchea. Un silencio centrado no va siempre arriba: se asigna segun
la duracion que falta en cada voz, usando duraciones de tresillo cuando corresponde. Los compases 1, 6, 7,
9, 12 y 14 tienen regresiones en la fuente y la descarga. Control correcto y 0 diferencias en 234 casillas.

En la 68, la voz grave del compas 15 contiene dos silencios de negra: no se concatenan con los acordes
superiores. En 2, 3, 10 y 11, el sol grave compartido tiene dos plicas de igual duracion y una sola cifra
en la TAB impresa; el cotejo admite ese ataque unico sin borrar las voces. 0 diferencias en 97 casillas.

En la 69, las curvas paralelas de un acorde se emparejan por la altura de sus extremos, no solo por
su anchura. Los compases 7, 10 y 14 conservan todas sus ligaduras; 0 diferencias en 130 casillas.

La 70 recupera el cierre del compas 8 junto a la doble barra (16 compases), las tres ligaduras de los
compases 7 y 15 y el ataque compartido del 5. Ambos cierres incluyen el mi grave. 0 diferencias en 120 casillas.

La 71 conserva la anacrusa de corchea y las cuatro blancas con puntillo del noveno compas. Puntillos
con la misma x son de alturas distintas, no doble puntillo; el del bajo se busca con el espacio del
pentagrama. El silencio de blanca con linea adicional del cierre conserva el sol grave en el tercer
tiempo. El motor procesa los 17 compases sin descartar notas: 0 diferencias en 102 casillas.

La 72 conserva los 24 compases de las dos paginas del original. En 2, 6, 15, 18, 22 y 23, los silencios
centrales son del acompanamiento: permiten separar las notas tenidas de la cadena de corcheas. Las
regresiones comprueban los inicios y duraciones de las tres voces; 0 diferencias en 242 casillas.

Estas seis fuentes se reproducen con `transcribe.py 67 68 69 70 71 72` y `build.py N`. El cotejo acepta
una o dos cifras para un unisono y la omision de cifras ligadas, pero conserva todas las voces y ligaduras
en el MusicXML. `test/sagreras-recovered.unit.js` verifica tambien que ningun compas publicado desborde.

## Revision de pendientes (2026-10-23)

Se volvieron a leer las diez lecciones con marca pendiente despues de las reglas de 67–72, cotejando las
paginas PDF 36, 45–47 y 50–55 de Marieh. **Solo la 74 pasa ahora el control completo del lector**:
16 compases de 2/4, sin diferencias de alturas. En el compas 12, la melodia la5 y el bajo la3 son blancas
simultaneas; el silencio de corchea pertenece a la tercera voz, que toca do5–mi5 a partir de la segunda
corchea. Las reglas nuevas tambien recuperan las tres ligaduras paralelas en cada acorde de 3, 13 y 14.
Se regeneraron fuente, descarga y vistas, y se retiro su marca pendiente. Las regresiones comprueban
estos ataques y ligaduras en la fuente y la descarga, ademas de la duracion de los 16 compases.
La digitacion sugerida conserva 4 diferencias en 116 casillas frente a la TAB impresa: los dos acordes
do5–mi5 del compas 12 se digitan en posicion baja, mientras la edicion usa quinta posicion; las alturas coinciden.

Las otras nueve **seguian pendientes en esta revision** (66, 82 y 83 se recuperaron despues; ver abajo). Este es el resultado del lector actual, no una validacion de las
fuentes antiguas publicadas. No se regeneraron esas fuentes: completar el compas de la voz mas larga o
coincidir en el total de alturas no garantiza que todas las voces esten bien.

| Leccion | Pagina PDF | Resultado y siguiente caso por resolver |
| --- | --- | --- |
| 66 | 36 | 16 compases correctos en longitud, pero el fa5 del compas 10 debe ser fa♯5. La nueva armadura comienza en el 9; recuperar la doble barra no resolvio esa altura. |
| 76 | 46 | 8 compases sin desbordes; falta el re del armonico natural de la cuarta cuerda, traste 12, en el cierre. La indicacion `Hr.12` y la cabeza de armonico necesitan lectura propia. |
| 78 | 47 | 16 compases sin desbordes; sobra un mi5 en el cotejo global. Revisar las prolongaciones entre 7–8 y 11–12: las curvas cruzan barras y un salto de sistema. |
| 81 | 50 | El compas 8 llega a 3,5 negras en vez de 2 y lee do5 en lugar de do♯5; hay que separar el acorde sostenido del acompanamiento. Tambien falta el armonico re del cierre (16). |
| 82 | 51 | Alturas correctas, pero 3, 4, 11 y 12 duran 3 negras en lugar de 2: el silencio central se concatena con la melodia y el bajo con el acorde intermedio. Necesita separar esas tres voces. |
| 83 | 52 | El lector recupera 16 compases (la fuente publicada tiene 15), pero lee sol5 en vez de sol♯5 en el 9. La nueva armadura de tres sostenidos debe regir desde ese compas, no desde el 11. |
| 84 | 53 | Los compases 8 y 9 desbordan (38 y 67 divisiones, en vez de 36). Ademas, en otros compases aparecen cuatro voces espurias y valores mezclados de corchea normal y de tresillo: hay que revisar la asignacion de los tresillos a notas y silencios antes de regenerar. |
| 85 | 54 | Alturas correctas, pero 3 y 11 duran 5,5 negras en lugar de 3: el bajo y las corcheas intermedias siguen concatenados. El resto del cotejo de alturas no valida sus inicios ni duraciones. |
| 86 | 55 | Alturas correctas, pero el 6 dura 7 negras en lugar de 4. Separar las cuatro negras de la melodia, las dos blancas del bajo y el arpegio de semicorcheas con sus silencios. |

Repetir el control sin escribir fuentes:

```sh
.venv-carcassi/bin/python scripts/sagreras/transcribe.py check 66 74 76 78 81 82 83 84 85 86
```

Los casos de 82, 85 y 86 son cercanos a las separaciones de voces ya recuperadas, pero las reglas actuales
todavia no los resuelven automaticamente. Los cambios de armadura de 66/83, las prolongaciones de 78,
los armonicos de 76/81 y los tresillos de 84 requieren sus propios cotejos y regresiones.


## Cambios de armadura recuperados

La 66 pasa de do mayor a sol mayor tras la doble barra del compas 8, dentro del
segundo sistema. El lector de Marieh reconoce ahora las alteraciones anteriores
al primer ataque tras una doble barra, en el orden y las alturas canonicas de
una armadura, y mantiene esa armadura en los compases siguientes del sistema.
Las alteraciones de nota tras una barra simple siguen siendo locales. No cambia
la lectura de las demas lecciones salvo la 83, que presenta el mismo caso.

La 66 conserva sus 16 compases de 3/4, Fine en el 8 y D.C. al Fine en el 16.
El fa5 del compas 10 se lee como fa♯5. El control contra las alturas de la TAB
impresa pasa sin diferencias. Se regeneraron fuente, descarga y vistas y se retiro
la marca pendiente. Las regresiones comprueban la armadura desde el 9, el fa♯5 y
la longitud de todos los compases en la fuente y la descarga.

La 83 pasa de re mayor a la mayor tambien desde el compas 9, tras la doble
barra del 8. El sol5 del 9 se lee como sol♯5. La regeneracion recupera ademas el
compas 8 que faltaba en la fuente antigua: son 16 compases de 3/4, con Fine en
el 8 y D.C. al Fine en el 16. Alturas sin diferencias y digitacion sugerida con
8 diferencias en 142 casillas respecto de la TAB impresa: el motor elige si4
en segunda cuerda al aire donde la edicion usa tercera cuerda, traste 4. Fuente, descarga y vistas
regeneradas; retirada la marca pendiente. Las regresiones cubren armadura, sol♯5
y longitud de los 16 compases en fuente y descarga. La 66 tambien tiene 0 diferencias
de digitacion en 101 casillas.

Reproducir: `transcribe.py 66 83` y `build.py 66 83`.
Quedan pendientes 76, 78, 81, 84, 85 y 86.

## Silencios centrales y voces de la 82

En los compases 3, 4, 11 y 12, el origen del glifo de silencio queda entre
0,30 y 0,40 espacios por encima del centro del pentagrama. El margen anterior
de 0,30 lo clasificaba como voz superior: al concatenarlo con la melodia,
ambas direcciones de plica desbordaban y se perdia el eje temporal para separar
el bajo del acorde intermedio. El margen superior de medio espacio permite asignarlo
segun la duracion que falta en cada voz.

Los cuatro compases conservan ahora el fa♯4 de blanca desde el inicio,
el silencio de negra seguido por si4–re♯5 en el segundo tiempo y la melodia
independiente. Los 16 compases de 2/4 pasan el cotejo de alturas y duraciones.
Se regeneraron fuente, descarga y vistas y se retiro la marca pendiente.
Las regresiones verifican alturas, inicios y duraciones en fuente y descarga;
el lector tiene ademas una prueba sin PDF con ambos desplazamientos del glifo.

La digitacion sugerida coincide en las 81 casillas de la TAB impresa.

Reproducir: `transcribe.py 82` y `build.py 82`.
El mismo cambio permite pasar el control preliminar de alturas y longitud a
85 y 86; siguen pendientes hasta cotejar sus voces, inicios y duraciones con
el original. La 84 sigue fallando en el compas 8 y requiere revisar los tresillos.


## Leccion 85 recuperada

La regla de silencios centrales desplazados incorporada para la 82 tambien
separa correctamente las tres voces de los compases 3 y 11 de la 85. Se cotejaron
los 16 compases de 6/8 con la pagina PDF 54: melodia y bajo entran juntos,
y la voz intermedia alterna silencio de corchea con dos corcheas en cada pulso.
Las fuentes y descargas anteriores aun concatenaban el bajo y el acompanamiento.
Se regeneraron con `transcribe.py 85` y `build.py 85`, sin cambiar el lector
ni el motor, y se retiro la marca pendiente. La regresion comprueba las tres
voces, sus alturas, inicios y duraciones en 3 y 11 y la longitud de los 16
compases, tanto en la fuente como en la descarga publicada.
