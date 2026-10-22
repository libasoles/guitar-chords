# Editor local de folklore argentino

Desde la raíz del repositorio:

```sh
.venv-carcassi/bin/python scripts/folklore-editor/server.py
```

Abrir http://127.0.0.1:8765. Requiere el laboratorio local en `lab/` y su
entorno Python con Verovio 6.3. No descarga recursos ni publica el laboratorio.
Se puede indicar otra carpeta con `--lab /ruta/al/lab` y otro puerto con `--port`.

El selector carga los diez ejercicios de la primera tanda o de cualquiera de
las seis ramas por ritmo. Hacer clic en una cifra de TAB (o enfocarla con Tab
y pulsar Enter) permite cambiar cuerda y traste. Se conserva la cantidad de
notas; no se agregan ataques ni se editan silencios o valores rítmicos.

Las ediciones se guardan automáticamente en `lab/editor/ediciones.json`,
por set, ejercicio y nota. Persisten al cambiar de set y reiniciar el servidor.
Los JSON compositivos y los PDF originales se conservan. El generador de los
cuadernos todavía lee esas fuentes originales: para llevar una revisión al
cuaderno, hay que incorporarla a su fuente. La página permite descargar el
MusicXML editado de cada ejercicio para seguir trabajando fuera del editor.

El diseño horizontal se calcula una sola vez desde cada original. Al editar,
Verovio actualiza las alturas con `redoPagePitchPosLayout()`, sin ejecutar
`redoLayout()` ni volver a importar la partitura. Así se conservan las abscisas
de notas, barras y ataques, incluso tras recargar las ediciones. Las plicas y
líneas adicionales acompañan la nueva altura. Los cambios extremos pueden
producir colisiones: el editor mantiene la posición pedida en lugar de
redistribuir el compás. No comprueba comodidad de la mano ni armonía.

Pruebas (usan copias temporales, sin escribir en el laboratorio original):

```sh
.venv-carcassi/bin/python scripts/folklore-editor/test_editor.py
node scripts/folklore-editor/test-browser.cjs
```
