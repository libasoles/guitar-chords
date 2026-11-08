# Imágenes de Círculo de quintas

Las imágenes de la ficha de Chrome Web Store se generan, no se editan a mano:

1. `npm run build:ext:fifths` empaqueta la extensión.
2. `node scripts/capture-fifths.js` captura el popup real (780 × 580 a 2×) en inglés y español: `capture-1.png` (Do mayor), `capture-2.png` (Mi♭ mayor fijado, con sus acordes elevados) y `capture-3.png` (La menor). Las españolas van en `es/`.
3. `node scripts/promo-fifths.js` compone con ellas `01-keys.png`, `02-pinned.png` y `03-minor.png` (1280 × 800), `promo-small-440x280.png` y `promo-marquee-1400x560.png`, en inglés y en `es/`. Los textos se editan en `scripts/promo-fifths.html`.

El icono de 128 × 128 sale del build (`dist/extensions/fifths/icons/icon-128.png`, desde `src/extensions/fifths/icon.svg`). Si cambia el dibujo de la rueda, repetir los pasos 2 y 3.
