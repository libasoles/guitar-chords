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
    // Numbered tools stay active for repeated clicks and edit the selected figure.
    await page.reload();
    await page.waitForSelector('#scoreStage g.measure');
    assert.deepEqual(await page.locator('.score-palette-key').allTextContents(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    await page.keyboard.press('4');
    assert.equal(await page.locator('[data-shortcut="4"]').getAttribute('aria-pressed'), 'true');
    async function clickMeasure(mi) {
      const point = await page.locator('#scoreStage g.measure').nth(mi).evaluate(node => {
        const r = node.querySelector('g.staff > path').getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + 10 };
      });
      await page.mouse.click(point.x, point.y);
    }
    await clickMeasure(1);
    await clickMeasure(2);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0].slice(1, 3).map(m => m[0].d)), ['e', 'e']);
    const beforeEdit = await page.evaluate(() => ({ ...scoreEditor.score.rows[0][2][0] }));
    await page.keyboard.press('5');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][2][0]), { ...beforeEdit, d: 's' });
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][2][0]), beforeEdit);
    await page.keyboard.press('Escape');
    await page.locator('[data-shortcut="9"]').click();
    await clickMeasure(3);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][3][0].rest), true);
    await page.locator('#scoreTitle').fill('12345');
    assert.equal(await page.locator('[data-shortcut="9"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#scoreStage').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
    await clickMeasure(4);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[1][0].length), 0);
    for (const selector of ['.score-toolbar', '#scoreDownloadToggle']) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
    }
    console.log('Score editor drag: one glyph under the mouse; drop and cancellation clean up.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
