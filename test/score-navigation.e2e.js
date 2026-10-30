'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async () => {
  const server = await serveStatic(path.join(__dirname, '../dist/site'), 0);
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath(), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/partitura`);
    await page.waitForSelector('#scoreStage g.measure');
    assert.deepEqual(await page.locator('#scoreBarlines > button').evaluateAll((buttons) => buttons.map((b) => b.id || b.dataset.tool || b.dataset.barline || b.dataset.navigation)),
      ['scoreTabToggle', 'barre', 'start', 'end', 'double', 'dc', 'ds', 'segno', 'first', 'second']);
    for (const [mi, mark] of [[0, 'segno'], [1, 'first'], [2, 'second'], [3, 'ds'], [4, 'dc']]) {
      await page.locator(`[data-navigation="${mark}"]`).click();
      const staff = await page.locator(`#m${mi} > g.staff > path`).first().boundingBox();
      await page.mouse.click(staff.x + staff.width * 0.5, staff.y + 12);
      await page.waitForFunction(([mi, mark]) => scoreEditor.score.navigation?.[mi]?.[mark], [mi, mark], { timeout: 5000 }).catch((e) => { throw new Error(mark + ': ' + e.message); });
      await page.keyboard.press('Escape');
    }
    assert.equal(await page.locator('#scoreStage g.repeatMark').count(), 1);
    assert.equal(await page.locator('#scoreStage g.ending').count(), 2);
    assert.ok((await page.locator('#scoreStage').textContent()).includes('D.C.'));
    assert.ok((await page.locator('#scoreStage').textContent()).includes('D.S.'));
    const saved = await page.evaluate(() => scoreEditor.score.navigation);
    await page.reload();
    await page.waitForSelector('#scoreStage g.measure');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.navigation), saved);
    assert.equal(await page.locator('#scoreStage g.ending').count(), 2);
    await page.locator('[data-navigation="segno"]').click();
    let staff = await page.locator('#m0 > g.staff > path').first().boundingBox();
    await page.mouse.click(staff.x + staff.width * 0.5, staff.y + 12);
    assert.equal(await page.locator('#scoreStage g.repeatMark').count(), 0, 'placing the same mark removes it');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await page.locator('#scoreStage g.repeatMark').count(), 1, 'undo restores the mark');
    // A toolbar drag uses the same measure placement as a click.
    const tool = await page.locator('[data-navigation="first"]').boundingBox();
    staff = await page.locator('#m5 > g.staff > path').first().boundingBox();
    await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
    await page.mouse.down();
    await page.mouse.move(staff.x + staff.width / 2, staff.y + 12, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => scoreEditor.score.navigation[5].first), true);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.locator('[data-navigation="second"]').click();
    assert.equal(await page.locator('[data-navigation="second"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#scoreTabToggle').click();
    assert.equal(await page.locator('#scoreTabToggle').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    console.log('Navigation toolbar, placement, rendering and persistence passed');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
