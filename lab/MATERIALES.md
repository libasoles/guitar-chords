# Inventario de materiales conservados

Todos los archivos siguientes están dentro de `lab/`. Los originales de
consulta y renders quedan locales, excluidos de git por `lab/.gitignore`.
Los apuntes, JSON, generador y salidas finales sí se versionan.

## Fuentes locales

### `fuentes/fleury-vol2.pdf`

Copia del PDF ya existente en resources/partituras/fleury/vol2.pdf; utilizado por el análisis delegado.

- Tamaño: 975154 bytes.
- SHA-256: `c5a62979d68389170df8422dc37537eaa5a8a2bb8fdb9875b82a852ce9594661`.

### `fuentes/celula-aportada.png`

Copia de la imagen aportada por el usuario; base de la variación del ejercicio 8.

- Tamaño: 303479 bytes.
- SHA-256: `da74b4ffd6cc1375da01e56d126a05452f084c2a376c19df0e74a9c855a3b2b4`.

### `fuentes/chamame-troitino-polemann.pdf`

Descarga archivada el 2026-10-22 del estudio primario de Troitiño y Polemann (UNLP, 2019), 7 páginas.

- Tamaño: 193274 bytes.
- SHA-256: `4ebd66d4580ec63602818833f52424c62da606d1fa4c98e76e80286e5371d542`.

### `fuentes/tablaturas-para-arpegios.html`

Captura HTML descargada el 2026-10-22 del artículo de referencia del usuario; no incluye una descarga recursiva de sus recursos externos.

- Tamaño: 218298 bytes.
- SHA-256: `0ae62582377e62ff19fa703365f7669b07754591a9370f4788689c304b5edd27`.

Procedencia de las descargas:

- Chamamé: <https://sedici.unlp.edu.ar/bitstream/handle/10915/80528/Documento_completo.pdf-PDFA.pdf?isAllowed=y&sequence=1>.
- Arpegios: <https://acordesdeguitarra.com.ar/articulos/tablaturas-para-arpegios>.

La consulta de Melicchio/UNCuyo sobre milonga se limitó al extracto indexado:
el sitio devolvió una protección al intentar abrir el PDF. No hay una copia
local de ese PDF y no se guardó una página de bloqueo como si fuera el original.
URL para retomar: <https://bdigital.uncuyo.edu.ar/objetos_digitales/19822/tesis-melicchio.pdf>.

## Renders e intermedios de revisión

- `revision/arpegios/pagina-01.png` a `pagina-10.png`: las diez páginas del PDF final, renderizadas con Poppler a 100 dpi.
- `revision/arpegios/contact-1.jpg` y `contact-2.jpg`: contactos de una revisión anterior; no representan necesariamente el PDF final.
- `revision/arpegios/debug.*`, `new.*`, `compact.*`: pruebas de octavación, espacios y estilos SVG; algunas contienen errores ya corregidos.
- `revision/fleury/`: quince PNG del análisis delegado. Los nombres de búsqueda no siempre coinciden con la ubicación correcta; usar la tabla de CONTINUIDAD.md.

## Apuntes y entregables

- `folklore-argentino-acordes.md`: sucesiones del corpus, trasladado por el usuario.
- `folklore-argentino-ritmos.md`: células, fuentes y grados de confianza, trasladado por el usuario.
- `folklore-argentino-dos-voces.md`: armonía, punteos y ejemplos, trasladado por el usuario.
- `folklore-arpegios/coleccion.json`: fuente editable única de la tanda.
- `folklore-arpegios/build.py` y `README.md`: generación y guía musical/técnica.
- `output/pdf/folklore-arpegios.pdf`: versión 1 entregada, diez páginas.
- `output/musicxml/folklore-arpegios/`: diez MusicXML con pentagrama y TAB.

No se movieron ni borraron los otros originales de la biblioteca de Fleury
en `resources/`: se archivó aquí una copia del volumen usado. No se descargó
ningún navegador, herramienta o paquete durante la creación de la tanda.
