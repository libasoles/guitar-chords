# Fuentes de las dos ediciones

## Carcassi

Se usa el texto anterior a Santisteban de *New and improved method for the guitar*,
Oliver Ditson, 1853 (reimpresión posterior sin fecha), inglés/francés, digitalizado
por la Boston Public Library: [ejemplar completo](https://archive.org/details/newimprovedmeth00carc).
Es el ejemplar local `resources/Libro Carcassi - Metodo.pdf` y el de la imagen de Re
mayor suministrada por el usuario. Se conserva la selección y numeración de 16
tonalidades que ya tenía el sitio; el método contiene otros preludios.

| Número del sitio | Tonalidad | Página impresa (página PDF) | Compases |
|---|---|---|---|
| 1 | Do mayor | 22 (32) | 8 |
| 2 | La menor | 34 (44) | 8 |
| 3 | Sol mayor | 24 (34) | 7 |
| 4 | Mi menor | 36 (46) | 8 |
| 5 | Re mayor | 26 (36) | 8 |
| 6 | Si menor | 62 (72) | 12 |
| 7 | La mayor | 28 (38) | 8 |
| 8 | Fa# menor | 63 (73) | 11 |
| 9 | Mi mayor | 30 (40) | 16 |
| 10 | Do# menor | 63 (73) | 12 |
| 11 | Fa mayor | 32 (42) | 8 |
| 12 | Re menor | 37 (47) | 12 |
| 13 | Sib mayor | 67 (77) | 8 |
| 14 | Sol menor | 68 (78) | 8 |
| 15 | Mib mayor | 68 (78) | 8 |
| 16 | Do menor | 69 (79) | 10 |

`transcribe_originals.py` registra alturas escritas, duraciones y voces. Los
pasajes compartidos de Sol mayor, Fa# menor, Sib mayor y otros se reutilizan
explícitamente; no se infiere que dos versiones coincidan por su tonalidad.
Se omiten indicaciones de expresión y digitaciones editoriales; la tablatura
siempre es una propuesta del motor.

Se respetan las barras y las duraciones del impreso: Mi mayor lleva signo de
compás común, aunque sus primeras quince barras contienen dos negras cada una;
el cierre contiene cuatro. Do menor también lleva el signo común, con tres
negras por barra. No se rellenan esas barras con silencios audibles ni se
alargan las notas para adecuarlas al signo impreso. La transcripción no pretende
resolver críticamente esas inconsistencias del ejemplar.

## Santisteban

Se conserva la edición de 1906 del *Carcassi Method for the Guitar / Método para
la guitarra*, Oliver Ditson, según la transcripción de Jeffrey Olson publicada
por [Mutopia, ficha 2209](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2209).
El archivo `santisteban.ly`, de dominio público, se guarda como fuente cotejable;
procede del [archivo LilyPond de Mutopia](https://www.mutopiaproject.org/ftp/CarcassiM/O59/CarcassiMethodPreludes/CarcassiMethodPreludes.ly).

Los `transcribe_NN.py` escriben en `santisteban/`; los resultados publicados van
a `downloads/santisteban-preludios` y a `src/site/articles/santisteban-preludios`.
Se corrigieron errores propios de la transcripción previa: en Re mayor, re5 en
los arpegios del compás 5 y fa#4 en el segundo bajo del compás 7; en Mi menor, la
entrada del armónico final. Estas correcciones no son variantes de Carcassi.

El [prólogo del editor](https://www.scribd.com/document/365839892/Carcassi-Method-for-Guitar-Part-1-pdf)
expresa su intención de modernizar el método y facilitar su enseñanza mediante
adiciones, supresiones, digitación y orden de los ejercicios. Sus fechas
(1866–1919) figuran en el encabezado de Mutopia y en la
[ficha biográfica de IMSLP](https://imslp.org/wiki/Category:Santisteban,_G._C.).
No se atribuye a Santisteban un motivo particular para cada nota modificada.
