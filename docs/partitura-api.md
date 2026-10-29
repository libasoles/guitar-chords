# Partitura y tablatura: contrato sitio <-> API

La fuente de verdad es `backend/README.md` ("API publica"). Este resumen fija lo que consume `src/site/partitura.js`.

- Build: la pagina solo se genera con `PARTITURA_API_URL` (y `TURNSTILE_SITE_KEY`, default `0x4AAAAAAFX8ivpyYAAvr-8D`). `SITE_OUT_DIR` cambia el directorio de salida.
- E2E: `test/partitura.e2e.js` sirve `dist/site` y simula la API interceptando la URL con la que se construyo el sitio (la real en CI). En local, construir antes con cualquier URL, p. ej. `PARTITURA_API_URL=https://api.partitura.test npm run build:site`; nunca se hacen llamadas reales.
- `POST /jobs` `{filename, kind: pdf|musicxml, tuning: auto|standard|dropd, turnstileToken}` (action de Turnstile: `partitura-tablatura`) -> `{id, upload: {url, fields}}`: POST multipart a `upload.url` con `fields` y el archivo al final. El cliente tambien tolera `upload.method`/`headers` (PUT).
- `POST /jobs/:id/process`, luego `GET /jobs/:id` cada 2 s: `status`, `stage`, `error`, `elapsedSeconds`, `discardedNotes`, `lowQualityScan` (escaneo que el OCR solo pudo leer con dudas), `preview {json, suggestion, svgs[]}`.
- Preview: `preview.json` `{staff_space, rows: [{svg, first, last}]}` (`svgs[i]` = `rows[i]`, `first`/`last` indices de compas base 0); `suggestion.json` `uneven_measures` (indices base 0 de compases cuyo ritmo no suma; la vista previa los marca con un aviso y un borde discontinuo), `tabs[m][c]` (6 x `number|null`, cuerda 1 primero) y `preview_columns[m][c] = {note_ids, bass_strings}`. Los `note_ids` coinciden con `data-id` en el SVG: el cliente calcula `columnLayout` buscando cada nota por id, nunca por orden del DOM. Los compases de un renglon son los `g.measure` del SVG, en orden.
- `POST /jobs/:id/export` `{tabs: Tab[]}` (un Tab por compas). En movil se envian los `tabs` de la sugerencia y se descarga el PDF sin vista previa.
- `GET /jobs/:id/downloads` -> `{downloads: {pdf, musicxml, tabs, intermediate}}`.
- Errores HTTP: `{"error": {"code", "message"}}`; trabajo fallido: `status: "failed"` + `error`. Todos los codigos tienen texto en `src/i18n/strings.*.json` (`partErr_<codigo>`); los desconocidos muestran `partErrDefault`.
- Ediciones: `localStorage` `partitura.edits.v1.<id>` (try/catch). El solfeo respeta la afinacion resuelta (`suggestion.tuning`/`job.tuning`, `dropd` -> `tuning="E B G D A D"` en ascii-tabs >= 0.6.0).
