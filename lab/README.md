# Laboratorio de folklore argentino

Punto de entrada para continuar el trabajo de esta sesión (22 de octubre de
2026). El usuario reunió aquí los apuntes y `output/`; después se trasladaron
también la fuente editable y el generador. La próxima tarea depende de su
feedback sobre los primeros diez ejercicios: no ampliar todavía la serie.

- [Continuidad: decisiones, aprendizajes y próximas ideas](CONTINUIDAD.md).
- [Ejercicios: edición, sucesiones y procedencia](folklore-arpegios/README.md).
- [Fuente editable única](folklore-arpegios/coleccion.json).
- [Cuaderno PDF, versión 1](output/pdf/folklore-arpegios.pdf).
- [Diez MusicXML con pentagrama y TAB](output/musicxml/folklore-arpegios/).
- Apuntes: [sucesiones](folklore-argentino-acordes.md),
  [ritmos](folklore-argentino-ritmos.md) y
  [armonía a dos voces](folklore-argentino-dos-voces.md).
- [Inventario de materiales locales](MATERIALES.md).

`fuentes/` contiene los originales de consulta y `revision/`, los renders y
las pruebas de maquetación. Ambas carpetas se conservan en este laboratorio
local y están excluidas de git. Los apuntes, la fuente editable, el generador
y las salidas finales sí están versionados. Los renders antiguos son
intermedios de trabajo; el PDF de `output/` es el entregable vigente.

Desde la raíz del repositorio:

```bash
python lab/folklore-arpegios/build.py
```

El comando escribe por defecto en **`lab/output/`**, sin recrear una carpeta
`output/` en la raíz. Requiere Python con Verovio 6, `rsvg-convert` y
`pdfinfo`; la guía de los ejercicios describe la verificación.
