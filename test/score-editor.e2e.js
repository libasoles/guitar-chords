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
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    const target = await page.locator('#scoreStage g.staff').first().evaluate(staff => {
      const r = staff.querySelector('path').getBoundingClientRect();
      return { x: r.left + (r.right - r.left) * 0.55, y: r.top + 10 };
    });

    async function checkGhost() {
      assert.equal(await page.locator('.score-ghost').count(), 1);
      const duplicate = await page.locator('.score-marker-head').evaluateAll(nodes =>
        nodes.some(node => node.getBoundingClientRect().width && getComputedStyle(node).display !== 'none'));
      assert.equal(duplicate, false, 'only the full musical glyph should appear during dragging');
      const head = await page.locator('.score-ghost svg path').first().boundingBox();
      assert.ok(Math.abs(head.x + head.width / 2 - target.x) < 1, 'notehead follows mouse horizontally');
      assert.ok(Math.abs(head.y + head.height / 2 - target.y) < 1, 'notehead follows mouse vertically');
    }

    const button = await page.locator('.score-palette-item').nth(2).boundingBox();
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await checkGhost();
    await page.mouse.up();
    assert.equal(await page.locator('.score-ghost').count(), 0);
    await page.waitForSelector('#scoreStage g.note');

    const note = await page.locator('#scoreStage g.note .notehead').first().boundingBox();
    await page.mouse.move(note.x + note.width / 2, note.y + note.height / 2);
    await page.mouse.down();
    target.x += 35;
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await checkGhost();
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
    assert.equal(await page.locator('.score-ghost').count(), 0);
    await page.mouse.up();
    console.log('Score editor drag: one glyph under the mouse; drop and cancellation clean up.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
