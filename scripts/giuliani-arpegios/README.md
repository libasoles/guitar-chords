# Los 120 arpegios de Giuliani (Op. 1, parte 1)

Página: `/articulos/120-arpegios-de-giuliani`. Una tarjeta por ejercicio (1–120), con vista previa, partitura completa
con TAB en un modal y descarga en PDF. Es una página independiente de la de Giuliani Op. 48 (`scripts/giuliani/`).

Cada ejercicio tiene tres compases: el arpegio sobre do mayor, el arpegio sobre sol con séptima (con el si en el
bajo), repetidos, y un acorde final de do. Cambia solo la combinación de dedos de la mano derecha.

## De dónde salen las notas

[IMSLP #660049](https://imslp.org/wiki/Studio_per_la_chitarra,_Op.1_(Giuliani,_Mauro)): «Degli arpeggi, Esercizio per la
mano destra (120, tablature)», edición de **Marieh** (2020), **CC0 1.0**, PDF vectorial de MuseScore 3.4.2 (fuente
`MScore`, 26 páginas, cinco ejercicios por página). Misma transcriptora y mismo programa que Sagreras, así que se lee con
las rutinas de `scripts/sagreras/` sin tocarlas. El original queda en
`resources/giuliani-arpegios/IMSLP660049-giuliani-op1-parte1-tab.pdf` (no versionado). Como `resources/` solo existe en el
checkout principal, desde un worktree hay que fijar `RESOURCES_DIR`.

Descarga sin captcha: `https://s9.imslp.org/files/imglnks/usimg/c/ca/IMSLP660049-PMLP58675-Giuliani_Op.1_Parte_1_tab.pdf`
(`c/ca` son los dos primeros hex del MD5 del nombre `PMLP58675-Giuliani_Op.1_Parte_1_tab.pdf`, el mismo de la ruta
`/images/`).

1. `transcribe.py N …` convierte cada ejercicio en `sources/NNN.musicxml`. Solo escribe la fuente si pasa el control: las
   alturas leídas deben coincidir con las de la TAB impresa y cada compás debe sumar su duración. `transcribe.py check`
   solo compara. `measures.json` guarda los compases por ejercicio (lo lee `test/giuliani-arpegios.unit.js`).
2. `build.py N …` (o `all`) pasa la fuente por el motor y deja PDF y MusicXML en `downloads/giuliani-arpegios/`, la vista
   previa en `src/site/articles/giuliani-arpegios/arpeggio-NN.svg` y las páginas del modal en `full/`.
3. `compare_positions.py` mide cuántas casillas (cuerda y traste) del motor difieren de la TAB impresa.

## Particularidades de la edición

- **Tresillos y sextillos sin «3»**: en 4/4 los compases traen 12 corcheas (tresillos) o 24 semicorcheas (sextillos), pero
  la edición no imprime la cifra. `mark_triplets` los detecta por voz: si las figuras cortas de una voz suman más de un
  compás, se leen en grupos de tres y se escribe 3:2 (corcheas) o 6:4 (semicorcheas, `TUPLET_SIZE = 6` en
  `scripts/sagreras/transcribe.py`).
- **Etiquetas**: la del ejercicio 28 es «No28» (sin punto) y las páginas 23-24 detectan mal el grosor del pentagrama (se
  fuerza 0,5). Las letras de la mano derecha van en mayúsculas en la edición y se escriben `p i m a`.
- **Dedos del acorde final**: la edición apila «1 2 3» sobre el acorde, de arriba abajo; la lectura los dejaba invertidos
  (3 2 1) en las notas agudas. `fix_final_chord_fingers` los pone donde van: 3 en el do grave, 2 en el mi grave y 1 en el do
  de la 2.ª cuerda (el sol y el mi agudo, al aire).
- **Letras sin nota**: en 89, 91, 93, 101 y 115 quedan cinco letras sin cabeza (dos letras sobre una cabeza compartida);
  no se publican.
- **Ejercicios 96, 100 y 110**: las reglas de arpegio del motor mandan el mi5 repetido a la 2.ª cuerda (traste 5). Su fuente
  lleva las casillas impresas como `<string>`/`<fret>` y `build.py` no aplica las reglas (`PRINTED_TAB`). Con eso la TAB
  publicada coincide con la edición en las 5890 casillas de los 120 ejercicios.
- **Revisión pendiente**: los ejercicios 47 a 120 llevan la marca (`scripts/lib/editor-marks.js`) hasta cotejarlos con el
  libro; el 1 al 46 ya están revisados. Los 116 a 119 (polifonía con fusas y silencios) pasan el control de alturas y compases, pero son los que más lo necesitan.

## Licencia y crédito

CC0 no exige atribución; el pie del PDF la da igualmente («Con modificaciones a partir de» / «Marieh (2020) · CC0 1.0»,
con enlaces).

El ejercicio 34 tiene una sola altura por ataque. Las notas del pulgar comparten cabeza con la voz
superior, con dos plicas: corchea en la primera semicorchea del seisillo y negra en la tercera,
ambas dentro de la subdivision 6:4. La fuente curada usa una sola voz inferior, sin silencios
de relleno ni tercera voz. La lectura anterior dejaba algunas corcheas fuera del seisillo y
creaba silencios con duracion y figura incompatibles: el grabador desplazaba las cabezas del
bajo y aparentaban notas dobles. Las marcas de grupo del bajo se ocultan (`show-number="none"`,
`bracket="no"`); las ocho cifras de la voz superior indican la subdivision. Las letras del primer
medio compas son `p i p i m a p i p i m a`, como en la pagina 7 de la edicion de Marieh.

En el 36, las letras de la mano derecha se limitan al primer grupo de cuatro semicorcheas:
`p` en el bajo y `m` en la nota aguda simultanea, despues `i p i`. La proximidad geometrica
habia intercambiado los dedos del ataque inicial y desplazado las ultimas dos letras al grupo siguiente.

En el 40, el primer grupo lleva `p+m`, `i+m`, `p`, `i`. Se corrigen en la fuente curada
los dedos intercambiados de las dos parejas y la ultima letra desplazada al grupo siguiente.

El build del 34 omite la reparacion de grupos incompletos del OMR: esa heuristica cuenta
cabezas y deshace los grupos completos de valores mixtos del bajo revisado. El motor
compartido y las demas piezas conservan su comportamiento.

## Mano derecha revisada (paginas 9-10 de Marieh)

Las letras se conservan solo en los cuatro primeros ataques, como en la edicion.
La proximidad geometrica habia intercambiado letras entre las notas de una pareja
y desplazado otras al ataque siguiente. El bajo lleva `p`, el sol `i` y el mi agudo `m`.

| Ejercicio | Primeros cuatro ataques (`+` = simultaneos) |
|---|---|
| 41 | `p / i+m / p+m / i` |
| 43 | `p+m / i / p / i+m` |
| 44 | `p+m / i / p+m / i` |
| 45 | `p / i+m / p / i+m` |
| 46 | `p+m / i+m / p+m / i` |
