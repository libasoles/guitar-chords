# Completar las lecciones de Sor, Op. 60

Plan revisado el 27 de noviembre de 2026. Esta tarea queda planificada; no se han descargado ni publicado piezas nuevas como parte de la separación de los Op. 6 y 35.

## Punto de partida

La página ya existe: `/partituras/lecciones-progresivas-de-sor` y sus versiones inglesa y portuguesa. Conservar sus URL y completar esa colección, sin crear una página duplicada.

El [catálogo](../../scripts/sor/pieces.json), los MusicXML, los PDF y las vistas del repositorio llegan del n.º 1 al 15. Los números 1–13 proceden de Mutopia; 14–15 son transcripciones de Gitarrefreund. Faltan **16–25**. La descripción antigua de «13 de las 25» quedó desactualizada. No se encontró la carpeta local `resources/sor/` durante esta revisión; comprobar su disponibilidad al iniciar el trabajo.

## Fuentes elegidas

La [ficha de IMSLP del Op. 60](https://imslp.org/wiki/Introduction_%C3%A0_l%27%C3%A9tude_de_la_guitare,_Op.60_(Sor,_Fernando)) registra 25 lecciones y ofrece estos escaneos como dominio público:

| Uso previsto | Edición y archivo de IMSLP |
|---|---|
| Fuente principal | París, chez l’auteur, 1837; digitalización de la Biblioteca Real de Dinamarca, **#836891**, 19 páginas |
| Segundo testimonio completo | París, l’Editeur et Auteur, **#470312**, 30 páginas |
| Cotejo de la edición ya empleada | Múnich, Gitarrefreund, 1915–17; grupos **#43565, #43566, #43567, #43476, #43477, #43478, #43479, #43445**, hasta el n.º 24 |
| Alternativa si un grabado es ilegible | Frankfurt, Dunst, plancha D. 543, **#120240**, 18 páginas |

Preferir el impreso publicado por el propio Sor como referencia musical; confirmar visualmente portada, numeración y legibilidad antes de transcribir. Los números de archivo permiten identificar la edición aunque cambie el enlace de descarga. Las descargas consultadas de IMSLP redirigieron a una página que exige JavaScript: usar el navegador y el flujo normal de descarga si continúa así.

Conservar las fuentes editables existentes de [Mutopia](https://www.mutopiaproject.org/cgibin/make-table.cgi?Composer=SorF) y sus créditos y licencias por pieza. La licencia concreta ya figura en cada entrada de `pieces.json`; verificarla contra el original descargado al renovarlo.

## Ejecución prevista

1. Descargar primero el escaneo completo de París y los fragmentos necesarios para el cotejo. Guardarlos sin modificaciones en `resources/sor/imslp/`, fuera de Git. Registrar URL, ID de IMSLP, edición, fecha de descarga, páginas de cada lección y SHA-256 en una nota de procedencia. Abrir los PDF y comprobar que están completos; no dar la descarga por realizada por disponer de un enlace.
2. Procesar **una lección por vez, del 16 al 25**. Usar el conversor y el generador de `scripts/sor/`; escribir `sources/sor_op60-NN.ly` y generar su MusicXML, PDF, vista previa y páginas del modal. Evitar otra implementación del motor.
3. Mantener las voces explícitas y la continuidad de las líneas según [voice-leading.md](../voice-leading.md). Cotejar alturas, octava de guitarra, ataques, duraciones, silencios, ligaduras, alteraciones y repeticiones contra el impreso. Una coincidencia rítmica no autoriza a fusionar voces. Revisar por separado la ejecutabilidad de la TAB y las notas sostenidas.
4. Anotar cualquier discrepancia entre ediciones con lección y compás; conservar la lectura original y justificar cada corrección editorial. Revisar también los parches ya existentes, especialmente el bajo del n.º 5, contra el impreso elegido.
5. Añadir cada pieza a `pieces.json` con su fuente y crédito exactos. Corregir la prosa en español, inglés y portugués: actualmente atribuye toda la página a Mutopia y debe distinguir las nuevas transcripciones de dominio público.
6. Revisar visualmente el PDF y el visor junto al original. Ejecutar las pruebas de conversión de `scripts/sor/` y `node --test test/sor.unit.js`; construir el sitio. Ejecutar solamente la suite e2e correspondiente si se modifica una prueba o se investiga una rotura; no la suite completa.
7. Publicar una lección revisada por commit, siguiendo el flujo de integración de `AGENTS.md`. Al terminar, comprobar las 25 tarjetas, sus descargas, los modales, el orden y la navegación en los tres idiomas.

## Criterio de finalización

La página existente contiene las 25 lecciones, cada una cotejada con un impreso identificable, con PDF y TAB revisados y procedencia documentada. La descarga de fuentes y la transcripción permanecen pendientes hasta ejecutar este plan.
