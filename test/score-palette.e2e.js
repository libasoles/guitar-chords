/* Figuras completas y escala de los silencios de /partitura. Ejecutar despues de npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function run() {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto('http://localhost:' + server.address().port + '/partitura');
      await page.waitForSelector('#scoreStage g.measure');
      const notes = await page.locator('.score-palette [data-shortcut]').evaluateAll(buttons => buttons.slice(0, 6).map(button => {
        const svg = button.querySelector('svg');
        const box = svg.getBBox();
        const view = svg.viewBox.baseVal;
        return { key: button.dataset.shortcut, fits: box.x >= view.x && box.y >= view.y && box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height };
      }));
      for (const note of notes) assert.ok(note.fits, `${width}px: la nota ${note.key} cabe entera en su SVG`);
      await page.evaluate(() => {
        scoreEditor.score.rows[0][0] = ['f', 's', 'e', 'q', 'h', 'w'].map((d, i) => ({ d, rest: true, at: i * 2 }));
        scoreEditor.render();
        return document.fonts.ready;
      });
      const sizes = await page.evaluate(() => {
        const keys = ['q', 'w', 'e', 'r', 't', 'y'];
        return keys.map((key, i) => {
          const svg = document.querySelector(`[data-shortcut="${key}"] svg`);
          const glyph = svg.querySelector('g path').getBoundingClientRect();
          const score = document.querySelectorAll('#m0 g.rest use')[i].getBoundingClientRect();
          const frame = svg.getBoundingClientRect();
          return {
            key, ratio: glyph.height / score.height,
            fits: glyph.top >= frame.top && glyph.bottom <= frame.bottom && glyph.left >= frame.left && glyph.right <= frame.right,
          };
        });
      });
      for (const size of sizes) {
        const expected = ['q', 'w', 'e'].includes(size.key) ? 20 / 24 : 1;
        assert.ok(Math.abs(size.ratio - expected) < 0.05, `${width}px: el silencio ${size.key} tiene la escala esperada (${size.ratio})`);
        assert.ok(size.fits, `${width}px: el silencio ${size.key} cabe entero en su SVG`);
      }
      await page.close();
    }
    console.log('score-palette e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
