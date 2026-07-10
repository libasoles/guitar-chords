# Changelog

## [Sin publicar] - 2026-07-10

### Agregado
- Acordes de 6ª (6th) para las 12 tónicas: voicings abiertos para C6, D6, E6, G6 y A6, y formas movibles para el resto (F6, F♯6, A♭6, B♭6, B6, D♭6, E♭6).
- Acordes de 9ª mayor (maj9) para las 12 tónicas: voicings movibles (raíz + 3ª + 7ª mayor + 9ª, sin la 5ª) para Cmaj9, Dmaj9, Emaj9, Gmaj9, Amaj9 y el resto de las tónicas.
- Botón para vaciar la sección de acordes pineados en el popup.
- Color de acento en el encabezado de "pineados" del popup.

### Corregido
- Persistencia de los acordes pineados entre sesiones del popup: ahora se guardan y se cargan desde `localStorage` correctamente.
- Búsqueda difusa de acordes: antes solo hacía match si el nombre normalizado empezaba exactamente con la query (prefijo estricto), por lo que "C9" nunca encontraba "CMaj9" y una query como "9" no encontraba nada. Ahora la nota raíz de la query debe matchear exacto, pero el resto de la query solo necesita aparecer en orden (subsecuencia) dentro del resto del nombre del acorde — mejora directa en la búsqueda del popup de la extensión.

### Otros
- Ajustes de configuración del servidor de desarrollo (manifest de la extensión).

---

Nota: este changelog cubre los cambios del 2026-07-10 relevantes para la extensión de Chrome (los cambios de datos y búsqueda de acordes son compartidos entre el sitio y la extensión vía `src/shared/`). No incluye cambios exclusivos del sitio web (rediseño de filtros del buscador, exportación de PDF de pineados, logo en el PDF).
