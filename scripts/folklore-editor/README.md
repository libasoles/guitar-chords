# Editor local de folklore argentino

Desde la raíz del repositorio:

```sh
.venv-carcassi/bin/python scripts/folklore-editor/server.py
```

Abrir http://127.0.0.1:8765. Requiere el laboratorio local en `lab/` y su
entorno Python con Verovio 6.3. No descarga recursos ni publica el laboratorio.
Se puede indicar otra carpeta con `--lab /ruta/al/lab` y otro puerto con `--port`.

El encabezado muestra «Lab». El selector carga los diez ejercicios de la
primera tanda o de cualquiera de las seis ramas por ritmo. Cada compás usa
el componente `ascii-tabs` editable, con columnas alineadas a sus notas.
Se puede escribir un traste o arrastrar una nota a otra cuerda del mismo
ataque, y agregar o borrar notas en cualquiera de sus seis cuerdas. Las
columnas permanecen en su sitio aunque se vacíen. Las notas nuevas heredan
la duración y la voz del agudo de ese ataque, o del bajo si no hay agudo.
No se crean columnas ni se cambian valores rítmicos. En MusicXML, una voz
que queda vacía conserva su duración como silencio oculto.

Arrastrar el pentagrama de un compás al **Track** agrega una copia de su
partitura y TAB en ese momento. Se pueden mezclar compases de distintos
sets, repetirlos, reordenarlos por arrastre y quitar cada copia con la X
de Lucide en su esquina superior derecha. «Agregar al track» y Enter sobre el pentagrama ofrecen
una alternativa al arrastre. El track queda visible al desplazarse por los
ejercicios y admite mouse o pantalla táctil.

La secuencia y sus copias se guardan en el navegador (`folklore.lab.track.v1`).
La TAB del track es de lectura; las ediciones se hacen en los ejercicios.
Una modificación posterior del ejercicio no altera las copias existentes.

Las ediciones se guardan automáticamente en `lab/editor/ediciones.json`,
por set, ejercicio y nota. Persisten al cambiar de set y reiniciar el servidor.
Los JSON compositivos y los PDF originales se conservan. El generador de los
cuadernos todavía lee esas fuentes originales: para llevar una revisión al
cuaderno, hay que incorporarla a su fuente. La página permite descargar el
MusicXML editado de cada ejercicio para seguir trabajando fuera del editor.

El diseño horizontal se calcula una sola vez, reservando seis posiciones por
ataque. Las posiciones vacías permanecen ocultas; al agregar una nota se
activa una de ellas dentro del mismo acorde. Al editar,
Verovio actualiza las alturas con `redoPagePitchPosLayout()`, sin ejecutar
`redoLayout()` ni volver a importar la partitura. Así se conservan las abscisas
de notas, barras y ataques, incluso tras recargar las ediciones. Las plicas y
líneas adicionales acompañan la nueva altura. Los puntillos, las líneas
adicionales y los calderones se actualizan según las notas activas para
evitar marcas residuales de posiciones vacías. Los cambios extremos pueden
producir colisiones: el editor mantiene la posición pedida en lugar de
redistribuir el compás. No comprueba comodidad de la mano ni armonía.

Pruebas (usan copias temporales, sin escribir en el laboratorio original):

```sh
.venv-carcassi/bin/python scripts/folklore-editor/test_editor.py
node scripts/folklore-editor/test-browser.cjs
```
