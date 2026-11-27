# Prompt para agregar partituras

Estás trabajando en `libasoles/guitar-chords`. Cuando el usuario pida agregar partituras, lee `AGENTS.md` y sigue estos pasos.

1. **Ubica el pedido.** Distingue entre conseguir o recortar originales, incorporar piezas a una colección publicada y crear una colección. Para saber qué está publicado, comprueba el catálogo, el artículo y sus archivos de salida. Si el usuario solo pide originales, entrega esos archivos y su índice.
2. **Lee las guías.** Abre `docs/fuentes-de-partituras.md` y `.agents/skills/partituras-con-tablatura/SKILL.md` como archivos Markdown. Para Sor abre también `scripts/sor/README.md` y la nota de procedencia del opus si existe. Usa el README y el catálogo de la colección para decidir el conversor y sus opciones. El `AGENTS.md` rige el flujo Git y las pruebas.
3. **Busca el original local.** En un worktree, localiza el checkout de `main` con `git worktree list` y busca allí en `resources/`. Git ignora esa carpeta. Consulta los README, índices y manifiestos antes de buscar afuera. Si tienes que conseguir otra edición, usa las fuentes documentadas. Identifica obra, edición, páginas y licencia. Guarda el original y su procedencia en `resources/` del checkout principal. Si ese checkout o el original son inaccesibles, identifica qué archivo o permiso falta.
4. **Reutiliza la colección.** Abre una pieza publicada del mismo opus y sigue su catálogo, sus fuentes y sus salidas. Prefiere una fuente editable autorizada y cotéjala con el facsímil. Si solo hay un escaneo, transcribe del impreso. Conserva alturas, ritmo, voces, anacrusa, armadura y repeticiones según la fuente. Documenta las correcciones editoriales y genera el MusicXML, el PDF con tablatura y los SVG mediante el build existente. Para una pieza de una colección existente, usa su página y su slug.
5. **Verifica antes de entregar.** Coteja la notación compás por compás con la fuente. Revisa en el PDF que la tablatura corresponda a las notas y respete las voces sostenidas. Comprueba en el sitio la tarjeta, el visor y las descargas. Ejecuta las pruebas puntuales que correspondan. Registra la procedencia y la licencia de la edición usada. Si incorporas varias piezas, sigue la regla de un commit por pieza y la integración de `AGENTS.md`. Cuenta qué quedó publicado y qué verificaste.

## Rutas para Sor

- `resources/` del checkout principal guarda los facsímiles y demás originales intactos. Indica la página de la pieza solo después de verla en el facsímil o de leerla en una nota de procedencia. Si todavía no sabes la página, deja el dato pendiente.
- `scripts/sor/sources/` guarda las fuentes de trabajo que usa el build. Usa la subcarpeta indicada en el README. Para un facsímil escaneado, transcribe a mano y coteja.
- `downloads/` y `src/site/articles/` reciben las salidas del build. Para sumar una pieza a una página existente, añade la entrada según el catálogo y conserva la integración de la página. En el catálogo del Op. 44, la clave JSON es una cadena como `"4403"` y `n` es un entero como `3`.

## Ejemplo con Sor, Op. 44 n.º 3

Consulta `docs/sor-op44-procedencia.md` y el catálogo `scripts/sor/opus44.json`. Si falta la pieza, busca en `resources/sor-op44/imslp/` el facsímil principal `IMSLP837753.pdf` y el de cotejo `IMSLP470296.pdf`. Localiza la n.º 3 en ambos. Usa la n.º 1 o la n.º 2 como ejemplo de integración y añade la entrada `4403` con `n: 3` y su fuente en `scripts/sor/sources/opus44/`. Según el README, el comando con `opus44 convert 4403` genera el MusicXML de trabajo y el comando con `opus44 4403` genera descargas y SVG. Revisa `test/sor.unit.js` y `test/sor-op44.unit.js` para actualizar y ejecutar los controles de la colección.

## Si la sesión solo tiene chat de Ollama

El cliente debe darte acceso a los archivos y a la terminal para ejecutar estos pasos. Si solo recibes texto, pide el contenido de las guías pertinentes, el listado de los originales y una pieza publicada de ejemplo. Puedes orientar el trabajo con esa evidencia. Indica qué acciones quedaron pendientes de ejecución o cotejo.
