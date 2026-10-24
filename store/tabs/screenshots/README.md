# Capturas de Guitar Tabs

Preparar capturas de esta extensión, separadas de Guitar Chords, para la ficha de tienda (1280 × 800 o 640 × 400):

- Editor con un riff y varias tablaturas.
- Opciones de nombres de notas y etiquetas de cuerdas.
- Tutorial de gestos y atajos abierto.

El popup mide 780 × 580 px; ubicarlo sobre un fondo con las dimensiones exigidas por la tienda. Usar el icono de tablatura propio. Las capturas manuales de revisión van en temporales y no se agregan a las pruebas.

## Imágenes de la tienda

`node scripts/promo-tabs.js` genera, a partir de `image.png`, `image 2.png` e `image 3.png`: `01-editor.png`, `02-tabs.png` y `03-tutorial.png` (1280 × 800), `promo-small-440x280.png` y `promo-marquee-1400x560.png`. Los textos se editan en `scripts/promo-tabs.html`.

Las versiones en español están en `es/`. Primero `npm run build:ext:tabs` y `node scripts/capture-tabs-es.js` capturan el popup real en español (`es/capture-*.png`, con los mismos riffs que las capturas en inglés); luego `node scripts/promo-tabs.js` genera ambos juegos de imágenes.
