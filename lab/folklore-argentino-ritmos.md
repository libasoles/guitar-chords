# Folklore argentino: células rítmicas (bombo, guitarra, canto)

Referencia para generar bajos y melodías con IA. Apunte del laboratorio; originales de consulta en `fuentes/` (no versionados). Compilado el 2026-10-22.

## 0. Cómo leer este documento (y qué tan confiable es cada parte)

Cada patrón lleva una etiqueta de confianza:

- **[F]** Fuente leída en esta sesión: Taján (rasgueo de chacarera en guitarra), Mola (bombo legüero; partituras leídas del PDF) y tutoriales de zamba (ver §11).
- **[C]** Conocimiento general de la práctica folklórica, **no verificado contra una fuente en esta sesión**. Tomarlo como hipótesis razonable y validar de oído con grabaciones antes de darlo por canónico.

Regla de oro del folklore (la repiten todas las fuentes): **no hay una única versión correcta**. El rasguido y el bombo cambian por zona, intérprete y época. Taján analizó 150 chacareras y encontró cuatro maneras distintas de rasguear solo la chacarera. Las células de abajo son *modelos*, no leyes.

## 1. Idea central: dos métricas superpuestas, dos timbres

Las danzas "birrítmicas" (zamba, chacarera, gato, escondido, cueca, bailecito, vidala) comparten esto [F]:

- Un compás tiene **6 corcheas**, que se pueden agrupar **3+3 (6/8, dos pulsos con puntillo)** o **2+2+2 (3/4, tres negras)**. Ambas métricas suenan **a la vez**: Taján dice que "los metros no se alternan ni se excluyen, se hallan superpuestos". Las partituras suelen llevar la firma doble `6/8 · 3/4`.
- **Registro agudo ↔ 6/8; registro grave ↔ 3/4** (chacarera, zamba, cueca, gato). Agudo = **aro** del bombo y **chasquido** de la guitarra (cuerdas 1-3). Grave = **parche** del bombo y **bordonas** (cuerdas 6-5-4, pulgar).
- Excepción [F, Taján, nota 2]: en géneros líricos como el **estilo** y la **vidalita** la relación se invierte (el 6/8 va en grave y el 3/4 en agudo).
- **El primer tiempo no es el más fuerte.** El "latido" del género está en las corcheas **3, 4 y 5**. En 3/4 es el "dos-tres", con la 3ª negra (corchea 5) como apoyo principal, una acentuación "tumbada". El 1 suele ser liviano o faltar. Es lo más importante para que un bajo o una melodía suenen a folklore y no a vals europeo.

### El eje rítmico estructural (Mola) [F]

Tres golpes consecutivos a distancia de corchea, alternados de timbre, presentes en todos los géneros 6/8·3/4:

```
corchea:   1  2  3  4  5  6
bombo:     .  .  P  A  P  .      (P = parche grave, A = aro agudo)
                 └ 3/4: P en 3 y 5      └ 6/8: A en 4
```

El parche (3 y 5) marca las negras 2 y 3 del 3/4; el aro (4) marca el segundo pulso del 6/8. Cada género agrega golpes alrededor de este eje sin modificarlo.

## 2. Notación usada acá

Grilla de **12 semicorcheas** por compás (cada corchea = 2 slots). Las corcheas se cuentan 1 2 3 4 5 6; "y" = la semicorchea intermedia.

```
slot      s1  s2  s3  s4  s5  s6  s7  s8  s9  s10 s11 s12
corchea    1   ·   2   ·   3   ·   4   ·   5   ·   6   ·
pulso 6/8  ▼               ·       ▼
pulso 3/4  ▼           ▼           ▼
```

| Símbolo | Bombo | Guitarra |
|---|---|---|
| `P` | parche (grave), con maza | — |
| `p` | parche suave / golpe fantasma | — |
| `A` | aro (agudo), con palillo sobre el borde de madera | — |
| `a` | aro suave | — |
| `B` | — | bajo (pulgar sobre bordonas, grave) |
| `T` | — | agudo (dedos sobre cuerdas 1-3, rasgueo del acorde) |
| `X` | — | chasquido: rasgueo agudo seco, con frenado de palma |
| `↓` `↑` | — | dirección del golpe |
| `>` | acento | acento |
| `-` | silencio | silencio (la mano puede seguir moviéndose: golpe fantasma) |
| `*` | rebote del palillo | — |

Cada patrón es de un compás de 6 corcheas, salvo que se indique otra cosa.

## 3. ZAMBA (tempo medio-lento, carácter sentimental)

Métrica: 6/8 en el canto y la danza, con apoyos de 3/4 en el acompañamiento. Pertout la describe con "énfasis en los tiempos 3, 4 y 5" de las seis corcheas [F]. Mola: la zamba hace "hincapié en la acentuación del segundo tiempo del 3/4", o sea la corchea 3 [F].

### 3.1 Bombo (Mola) [F]

Es el eje estructural más una semicorchea agregada en el primer tiempo.

**Base 1** (parche inicial):
```
slot      s1  s2  s3  s4  s5  s6  s7  s8  s9  s10 s11 s12
corchea    1   ·   2   ·   3   ·   4   ·   5   ·   6   ·
bombo      P   -   -   p   P>  -   A   -   P   -   -   -
```
**Base 2** (aro inicial; privilegia el 6/8 en el 1):
```
bombo      A   -   -   p   P>  -   A   -   P   -   -   -
```
- Los dos parches seguidos (s4 y s5) están a distancia de semicorchea, por eso se alternan las manos.
- En la partitura de Mola el primer tiempo es corchea con puntillo + semicorchea (s1-s3 y s4).

### 3.2 Guitarra: rasgueo de zamba [F: tablas de los tutoriales; C: lectura de registros]

Dos versiones documentadas (tutoriales de `javi29clases` y Néstor Gómez), 6 corcheas:

| Corchea | Rasgueo 1 | Rasgueo 2 | Registro |
|---|---|---|---|
| 1 | dedos ↓ (acorde) | pulgar ↓ | agudo (R1) / grave (R2) |
| 2 ("y") | pulgar ↑ | índice ↑ | opcional |
| 3 | pulgar ↓ | pulgar ↓ | **grave** (pilar) |
| 4 | dedos ↓ + frenado de palma = **chasquido** | idem | **agudo** (pilar) |
| 5 | pulgar ↓ | pulgar ↓ | **grave** (pilar) |
| 6 | silencio | silencio | respiración |

En slots (R1): `s1 T↓  s3 B↑  s5 B↓  s7 T↓+X  s9 B↓  s11 -`

Tiempos fijos: **3 (grave), 4 (agudo/chasquido), 5 (grave)**. Tiempos variables: **1, 2 y 6**.

**Repiques** (adornos) [F]:
- Repique 1: sumar dedos ↓ en el tiempo 2 (en el 3 puede ser pulgar o dedos).
- Repique 2: agregar un pulgar ↑ en la "y" entre el 3 y el 4.
- **Golpe muerto** (palma tapando todas las cuerdas, brusco) vs **rasgado muerto** (golpe percutido que adorna): los guitarristas avanzados cambian el primero por el segundo.
- **Arpegio**: abrir el acorde repartido en las seis corcheas, sin tocar más fuerte.
- **Variación de acento**: mover el acento a la 2ª corchea de cada grupo sin cambiar el bajo (hace aparecer o desaparecer la lectura en tres).
- Principio de textura: la guitarra **dialoga** con el bombo y no lo duplica ("si tocás encima exactamente lo mismo, el conjunto se apelmaza y se pierde el balanceo").

### 3.3 La riqueza de tiempos de la zamba: qué se toca y qué no

Presencia por corchea (guitarra + bombo), de más fijo a más libre:

| Corchea | Presencia | Qué pasa |
|---|---|---|
| 3 | casi siempre | apoyo principal: parche en bombo, bajo en guitarra |
| 4 | casi siempre | aro en bombo, chasquido en guitarra |
| 5 | casi siempre | parche en bombo, bajo en guitarra |
| 1 | frecuente pero liviano | parche *o* aro en bombo (Base 1/2); acorde suave en guitarra. A veces se **sustrae** |
| 2 / "y" | opcional | semicorchea de parche fantasma en bombo; pulgar ↑ o índice ↑ en guitarra |
| 6 | a menudo silencio | respiración antes del 1; la melodía lo usa para la anacrusa |

Variaciones del bombo (Mola) [F]:
- **Sustracción**: quitar el primer golpe del compás manteniendo la digitación: `- - - p P> - A - P - - -`. Es el compás de entrada ("adentro!").
- **Variación del 3er tiempo del 3/4** (corcheas 5-6): se llena con semicorcheas alternando manos para llegar al parche del 1 siguiente (dos opciones, una empezando en parche y otra en aro).
- **Fórmula de cierre**: repique de semicorcheas en 5-6 (y a veces también en 1-2) que desemboca en parche; marca cambio de estrofa o final.
- Con melodía de **alta densidad** (muchas notas), el bombo se queda en la base y reserva variaciones y cierres para donde la melodía respira (Mola, sobre "Zamba para un bohemio guitarrero").

Hipótesis de trabajo [C]: la zamba **cuyana/norteña** va más rápida y con más rasgueo; la lenta y lírica de Tucumán/Salta se sostiene más en bajos y arpegios.

### 3.4 Canto en zamba [C, con apoyo parcial en F]
- Melodía en 6/8 (dos pulsos de 3 corcheas) sobre acompañamiento con apoyos de 3/4.
- Frases con **anacrusa**: la sílaba inicial cae en la corchea 5-6 y el apoyo en el 1 (o en la 3).
- Células de canto frecuentes (en corcheas; `_` = prolongación):
  - `1 _ _ | 4 _ _` (dos pulsos largos, cantábile)
  - `1 2 3 | 4 _ 6` (corcheas + nota larga)
  - `1 _ 3 | 4 _ 6` (agrupación en 3/4 = hemiola)
  - `5 6 | 1 _ _ | 4 5 6` (anacrusa y ascenso)
- La frase típica ocupa 2 o 4 compases con respiro en la corchea 6 del último.

## 4. CHACARERA (tempo vivo, muchísimas variantes)

Métrica: 6/8 · 3/4 superpuestos. Apoyo: "una clara marcación en la tercera negra del 3/4" (corchea 5) [F: Mola].

### 4.1 Bombo (Mola) [F]

**Base 1:**
```
slot      s1  s2  s3  s4  s5  s6  s7  s8  s9  s10 s11 s12
corchea    1   ·   2   ·   3   ·   4   ·   5   ·   6   ·
bombo      A   -   -   -   P   -   A>  -   P   -   P*  -
```
`P*` es el rebote del palillo: la izquierda repite para asegurar que el compás siguiente arranque con el aro (mano derecha).

Coincide con una descripción de otra fuente [F, wiki en francés, a verificar]: negra aro – corchea parche – corchea aro – negra parche.

Otras formas (Mola) [F]:
- **Base 2**: se cambia el aro del 1 por parche: `P - - - P - A - P - P* -`
- **Variación sobre el 1er tiempo**: repetir el golpe en la corchea 2.
- **Variación sobre el 3er tiempo**: repetir en 5-6.
- **"Repiqueteo" en el aro, tiempo 1**: tres golpes de aro en tresillo de corcheas.
- **Sustracción** ("adentro!"): quitar el primer golpe del compás.
- **Chacarera "en 3/2" / "vidalear la chacarera"**: ciclo de 2 compases con golpes sustraídos, de modo que a nivel de blancas se percibe el patrón de la **vidala** (§8).
- **Fórmula de cierre**: repiqueteado; hay una versión para la **chacarera trunca**.

### 4.2 Guitarra: rasgueo de chacarera (Taján) [F]

Plano 6/8 en **agudo** = **chasquido en cada negra con puntillo** (corcheas **1 y 4**). Plano 3/4 en **grave** = bordonas en la **2ª y 3ª negra** (corcheas **3 y 5**, el "**dos-tres**"), con apoyo en la 3ª (corchea 5). Dirección dominante: la 2ª negra **hacia arriba** (de agudas a graves) y la 3ª hacia abajo; la opción menos frecuente es abajo-abajo.

Esquema base, modo "tética 1" (42% del corpus):
```
slot      s1  s2  s3  s4  s5  s6  s7  s8  s9  s10 s11 s12
corchea    1   ·   2   ·   3   ·   4   ·   5   ·   6   ·
guitarra   X>  (t) -   -   B↑  -   X   -   B↓> -   -   -
onomat.    chí     ta      chi     ca  (chi)
```
`t` = "segundo impulso del tiempo 1": golpe suave/corto/vibrado, a veces solo el movimiento de la mano sin sonar. La asignación exacta de sílabas a slots es una lectura mía de la onomatopeya.

Los **4 modos documentados** (porcentaje del corpus de 150) [F]:

| Modo | % | Onomatopeya | Característica | Intérpretes |
|---|---|---|---|---|
| Tética 1 | 42 | chí-ta chi-ca // chí-ta chi-ca chi | chasquidos parecidos; acento en el 1º; inercia hacia el 1 | Manseros Santiagueños, Hnos. Ábalos, Chazarreta, Cafrune, Los Fronterizos |
| Tética 2 | 8 | tan-ta chi-ca | 1º chasquido grave/vibrado/abanico, 2º seco y agudo; suena más en 3/4 | Hnos. Ábalos, Hnos. Simón, Gardel-Razzano (1926) |
| Acéfala larga | 24 | ta cu-chí cu tu-ch | empieza en la "y" del 1º tiempo (el "3er chasquido" es el golpe de inicio); acento marcado en el 2º chasquido; suena más en 6/8 | santiagueños contemporáneos: Peteco Carabajal, Raly Barrionuevo, Chaza |
| Acéfala corta | 26 | ta chi-ca ta-chi | empieza en la corchea 3 (2º tiempo del 3/4); equilibrada entre 6/8 y 3/4 | Yupanqui, Mercedes Sosa, Los Chalchaleros, Guarany |

Tipos de chasquido: seco, medio seco, vibrado, abanico, silencio.

Otras onomatopeyas tradicionales: *tachicatachín*, *talegadepan*, *papitopapá*.

Funciones: guitarra **base** (pocas variaciones) o **florida** (variaciones insistentes). Las variaciones "descansan" sobre la fórmula básica (tensión-distensión). La mano mantiene el movimiento continuo arriba-abajo aunque no suene cada golpe (golpes fantasma).

### 4.3 Canto/melodía en chacarera [F/C]
- Melodía mayormente en 6/8 con el bombo en 3/4 (Smithsonian [F]); mucha síncopa y notas repetidas [C].
- Los cierres de frase caen "tumbados" sobre la corchea 5 [F, por analogía con el apoyo del 3/4].
- La chacarera **doble** (Santiago del Estero) y la **trunca** (frase cortada con pausa final) tienen cierres propios [C].

## 5. GATO y ESCONDIDO [C]

Sin verificar contra fuente directa. Mola solo dice que el patrón de chacarera sirve de base para acompañar gato, escondido y huella [F].

- **Gato**: 6/8 dominante y saltarín, más rápido que la chacarera. Bombo con aro más presente, sobre el mismo eje P3-A4-P5; guitarra con rasgueo tipo chacarera (chasquido 1-4, bajo 3-5), más vivo.
- **Escondido**: parecido a la chacarera pero más lento; apoyos de 3/4 más marcados y frases más largas, cercano al vals criollo.

## 6. CUECA [F: bombo Mola; C: resto]

Hermana de la zamba: "tiene todos los mismos eventos rítmicos, y al nuevo ritmo se le suman nuevos golpes". Mola nota que algunos docentes acentúan la cueca más sobre el 6/8 (más aro).

Bombo base (Mola) [F]: aro en 1, dos golpes finos sobre la corchea 2, luego `P>` en 3, `A` en 4, `P` en 5 y `P*` en 6.
```
slot      s1  s2  s3  s4  s5  s6  s7  s8  s9  s10 s11 s12
bombo      A   -   p   a   P>  -   A   -   P   -   P*  -
```
La notación original de los dos golpes finos es poco nítida en el PDF: verificar de oído.

Variaciones [F]: sustracción del primer golpe; semicorcheas alternadas en el 1er tiempo (1-2); semicorcheas alternadas en el 3er tiempo (5-6, debe desembocar en parche); fórmula de cierre con repiques en ambos extremos.

Guitarra [C]: rasgueo vivo con chasquido en 1 y 4 y bajo en 3 y 5. En Cuyo se baila rápido y el bombo es menos habitual.

## 7. BAILECITO y danzas binarias del NOA [C]

- **Bailecito** (Jujuy, Salta, Tucumán): 6/8 con hemiola 3/4, ágil; guitarra con bajo y dos golpes agudos; charango y quena en la melodía.
- **Carnavalito, huayno, takirari, chaya**: **binarios** (2/4), no híbridos. Sirven de contraste: bombo en negra y dos corcheas, rasguido en corcheas con acento en el tiempo 1.

## 8. VIDALA, VIDALITA, ESTILO, HUELLA (lentas y líricas)

Vidala [F: Mola]: "se percibe claramente el compás de 3/4 por sobre el de 6/8". Base: estructura de tres tiempos en 3/4 con digitación izquierda-derecha-izquierda (parche-aro-parche); variaciones sobre la última negra del 3/4 y con todas las pulsaciones del 3/4. Es el modelo de lo que se llama "vidalear" una chacarera.

```
slot       s1  s2  s3  s4  s5  s6  s7  s8  s9  s10 s11 s12
vidala     P   -   -   -   A   -   -   -   P   -   -   -     (P A P a negras del 3/4)
```
La ubicación exacta de cada golpe se leyó de una imagen escaneada poco nítida: validar de oído.

Estilo y vidalita [F: Taján, nota 2]: registros invertidos (grave = 6/8, agudo = 3/4). Tempo lento, rubato, acompañamiento más arpegiado que rasgueado [C].

## 9. CHAMAMÉ, MALAMBO, MILONGA, VALS CRIOLLO [C]

No verificados en esta sesión.

- **Chamamé** (Litoral): 3/4 con sensación de 6/8; acordeón, guitarra, bandoneón; "puenteo" de bajos; apoyo en los tiempos 2 y 3.
- **Malambo**: 6/8 de zapateo, con repiques y cierres.
- **Milonga campera**: binaria (2/4), bajo alternado.
- **Vals criollo**: 3/4 con acento tético (a diferencia de las danzas birrítmicas) y rubato.

## 10. Reglas prácticas para generar bajos y melodías

Valen para zamba, chacarera, gato, cueca y escondido; en estilo/vidalita invertir lo dicho sobre registros. Son síntesis mía de [F] y [C].

### 10.1 Bajos (grave = bordonas = parche)
1. Poner las notas de bajo en las corcheas **3 y 5** ("dos-tres"), con apoyo en la 5. Nunca asumir que el 1 es el tiempo más fuerte.
2. Opcional: bajo suave en 1 o pulgar ↑ en la "y" del 2. La 6 suele quedar en silencio.
3. Alternar fundamental y quinta (o nota de paso) entre 3 y 5 es habitual [C].
4. Cambiar de acorde en el 1 del compás (o anticipar en la 6) más que en 3 o 5.
5. Dejar el hueco de la corchea 4 para lo agudo (chasquido/acorde); ahí el bajo no se mueve.
6. Al final de verso, llenar las corcheas 5-6 con un repique de dos notas de bajo o una escala descendente que llegue al 1 siguiente.

### 10.2 Melodías (canto en 6/8 sobre bajo en 3/4)
1. Pensar la melodía en **dos pulsos de 3 corcheas** (1-2-3 | 4-5-6), con apoyos en 1 y 4.
2. Usar la **hemiola**: a veces agrupar la melodía en negras (1-3-5) para cruzarse con el 6/8.
3. Frases con **anacrusa** (empiezan en 5-6 del compás anterior) y respiro en la 6 del último compás.
4. No hacer coincidir siempre los ataques de melodía con los del bombo: el canto sigue al bombo con dibujo propio.
5. Si la melodía es densa, bombo y guitarra simplifican (sustracción); si respira, entran variaciones y cierre.
6. Cierres: nota larga sobre el 1 con descenso a la tónica y silencio en la 6, o el cierre tumbado (nota larga en la corchea 5) en chacarera.

### 10.3 Cuándo variar
- Alternar compases de **base**, de **variación** (relleno en 5-6) y de **cierre** (repique al final de estrofa).
- Sustracción del primer golpe en el compás de entrada y en transiciones.
- Alternar el timbre del 1: parche en un compás, aro en otro (Base 1 / Base 2 de zamba).

## 11. Fuentes

Leídas en esta sesión:

- Octavio Taján, *El rasgueo de la chacarera en la guitarra. Análisis de sus rasgos estructurales y de estilo*, UNLP. <https://jornadassecyt.fba.unlp.edu.ar/Jidap_pdf/eje_3/Tajan.pdf> [F, texto completo].
- Sergio J. Mola, *Bombo legüero: una propuesta metodológica para la enseñanza de su ejecución*, 9as JIDAP, UNLP, 2019. <https://jornadassecyt.fba.unlp.edu.ar/JIDAP2019/jidap/eje1/eje1-07.pdf> [F, texto y partituras; notación de cueca y vidala poco nítida].
- Néstor Gómez, "Ritmo de zamba en la guitarra". <https://nestorgomezescuela.com/blog/acompanar-zamba-en-6-8> y "Clase de rasgueo de zamba". <https://javi29clases.blogspot.com/2013/03/clase-de-rasgueo-de-zamba.html> [F, tablas de rasgueo].
- Resultados de búsqueda (solo resúmenes): Pedro Rossi (aro↔6/8, parche↔3/4), Pertout "Zambalogy" (énfasis 3-4-5), Smithsonian Folkways lesson plan (melodía en 6/8 sigue al bombo en 3/4), wiki en francés sobre chacarera.

Sin leer (para profundizar): Romero García (Univ. Distrital, 2017), dos formas de zamba para guitarra; educ.ar "Rasgueo de Zamba. Partitura" (Jorge Jewsbury); Madoery y Mola (2015), "Del bombo legüero a la batería"; Carlos Rivero, *Bombo legüero y percusión folclórica argentina* (2004); Carlos Vega, *Las danzas populares argentinas*; Hnos. Ábalos, *Primer álbum para piano* (1952).

## 12. Pendientes para cerrar la fidelidad

- Verificar de oído los bombos de **zamba lírica vs cuyana**, **gato**, **escondido**, **chamamé**, **bailecito** y **vidala** (hoy en [C] o ilegibles).
- Transcribir el rasgueo exacto de educ.ar/Jewsbury y de la tesis de Romero García para fijar bajos reales.
- Decidir si se exportan los modelos (§3 a §6) a JSON por género con slots, timbre y probabilidad de aparición, para alimentar la generación.
