'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
(async () => {
  const server = await serveStatic(path.join(__dirname, '../dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath(), headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/partitura`);
    await page.waitForSelector('#m0');
    await page.evaluate(async () => { await document.fonts.ready; });
    // 6/8: blanca sola en la voz 2 bajo un silencio y cinco corcheas de la voz 1.
    await page.evaluate(() => {
      scoreEditor.score.meter = '6/8';
      scoreEditor.score.rows = [[[
        { d: 'e', rest: true, v: 1, at: 0 }, { d: 'h', n: 25, at: 0, v: 2 }, { d: 'e', n: 30, at: 12, v: 1 },
        { d: 'e', n: 32, at: 24, v: 1 }, { d: 'e', n: 35, at: 36, v: 1 }, { d: 'e', n: 34, at: 48, v: 1 }, { d: 'e', n: 39, at: 60, v: 1 },
      ]]];
      scoreEditor.render();
    });
    await page.waitForTimeout(300);
    const head = await page.evaluate(() => { const r = document.querySelector('[id="e0-1"] .notehead').getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; });
    // Bajar la nota arrastrando un poco hacia la derecha: sigue en su voz y no aparece el aviso de nota repetida.
    await page.mouse.move(head[0], head[1]);
    await page.mouse.down();
    await page.mouse.move(head[0] + 2, head[1] + 4, { steps: 3 });
    await page.mouse.move(head[0] + 12, head[1] + 15, { steps: 8 });
    await page.mouse.up();
    const half = await page.evaluate(() => scoreEditor.score.rows[0][0].filter((ev) => ev.d === 'h').map((ev) => ({ n: ev.n, v: ev.v, at: ev.at })));
    assert.deepEqual(half, [{ n: 23, v: 2, at: 0 }]);
    assert.equal(await page.evaluate(() => document.body.innerText.includes('ya suena')), false, 'sin aviso de nota repetida');
    assert.deepEqual(errors, []);
    console.log('Lone voice move passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
