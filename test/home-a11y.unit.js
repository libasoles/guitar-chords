/* Home accessibility: single main landmark and AA contrast on the note-finder
   promo. Run: node --test test/home-a11y.unit.js (needs `npm run build:site`). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist', 'site');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'src', 'site', 'site.css'), 'utf8');

function luminance(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function ruleColor(selector) {
  const m = CSS.match(new RegExp(selector.replace(/\./g, '\\.') + '\\s*\\{[^}]*?\\bcolor:\\s*(#[0-9a-fA-F]{6})'));
  assert.ok(m, 'no color rule for ' + selector);
  return m[1];
}

for (const page of ['index.html', 'en/index.html']) {
  test(`${page}: un único landmark main que contiene el buscador y la CTA`, () => {
    const html = fs.readFileSync(path.join(DIST, page), 'utf8');
    assert.equal(html.match(/<main[\s>]/g)?.length, 1);
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    assert.ok(main.includes('<chord-finder'));
    assert.ok(main.includes('note-finder-promo-cta'));
    assert.ok(!main.includes('<header'));
  });
}

test('textos del promo del identificador de acordes cumplen contraste AA sobre el fondo de la página', () => {
  const paper = '#f7f4eb'; // fondo efectivo medido por Lighthouse
  for (const sel of ['.note-finder-promo-kicker', '.note-finder-promo-cta']) {
    assert.ok(contrast(ruleColor(sel), paper) >= 4.5, sel);
  }
});
