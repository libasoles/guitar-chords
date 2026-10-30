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
    await page.waitForSelector('#m11');
    await page.evaluate(async () => { await document.fonts.ready; });
    const reset = async (dense = false) => {
      await page.evaluate((dense) => {
        scoreEditor.score.rows = Array.from({ length: 3 }, (_, r) => Array.from({ length: 4 }, (_, i) => dense ? Array.from({ length: 32 }, (_, j) => ({ n: j === 0 ? 28 + r * 4 + i : 28 + (j % 7), d: 'f', at: j * 3 })) : [{ n: 28 + r * 4 + i, d: 'q', at: 0 }]));
        delete scoreEditor.score.measureWidths;
        scoreEditor.render();
      }, dense);
    };
    const box = async (mi) => page.locator(`#m${mi} > g.staff > path`).first().boundingBox();
    const order = () => page.evaluate(() => scoreEditor.score.rows.flat().map((m) => m[0].n - 28));
    const drag = async (from, to, end = false, cancel = false) => {
      const a = await box(from), b = await box(to);
      await page.keyboard.down('Shift');
      await page.mouse.move(a.x + a.width / 2, a.y + 12);
      assert.equal(await page.locator(`#m${from} > g.staff > path`).first().evaluate((el) => getComputedStyle(el).cursor), 'pointer');
      await page.mouse.down();
      await page.mouse.move(end ? b.x + b.width + 4 : b.x + b.width * 0.15, b.y + 12, { steps: 8 });
      assert.equal(await page.locator('.score-measure-guide').count(), 1);
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up();
      await page.keyboard.up('Shift');
      assert.equal(await page.locator('.score-measure-guide').count(), 0);
    };
    await reset();
    await drag(1, 6);
    assert.deepEqual(await order(), [0, 2, 3, 4, 5, 1, 6, 7, 8, 9, 10, 11]);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows.map((r) => r.length)), [4, 4, 4]);
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual(await order(), Array.from({ length: 12 }, (_, i) => i));
    await drag(6, 1);
    assert.deepEqual(await order(), [0, 6, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11]);
    await page.keyboard.press('ControlOrMeta+z');
    await drag(1, 6, false, true);
    assert.deepEqual(await order(), Array.from({ length: 12 }, (_, i) => i));
    await drag(5, 3, true);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows.map((r) => r.length)), [5, 3, 4]);
    const saved = await order();
    await page.reload();
    await page.waitForSelector('#m11');
    assert.deepEqual(await order(), saved);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows.map((r) => r.length)), [5, 3, 4]);
    await reset(true);
    await drag(5, 3, true);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows.map((r) => r.length)), [4, 4, 4]);
    assert.deepEqual(await order(), [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11], 'overflow becomes the first measure of the next row');
    assert.deepEqual(errors, []);
    console.log('Measure drag: reflow, fit/overflow, undo, cancellation and storage passed');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
