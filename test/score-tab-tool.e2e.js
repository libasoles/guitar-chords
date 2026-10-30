'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('.score-clef-trigger');
    await page.evaluate(() => {
      scoreEditor.score.rows[0][0] = [{ n: 28, d: 'q', at: 0 }];
      scoreEditor.render();
      return document.fonts.ready;
    });
    const toggle = page.locator('#scoreTabToggle');
    if (!(await page.locator('.score-tab').count())) await toggle.click();
    const tab = page.locator('.score-tab').first();
    await tab.locator('.ascii-tabs-cell').first().waitFor();
    await page.keyboard.press('4');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true',
      'TAB stays pressed when a note tool is selected');
    assert.equal(await page.evaluate(() => scoreEditor.score.showTabs), true,
      'selecting a tool keeps tablature enabled');
    const head = await page.locator('#e0-0 .notehead').boundingBox();
    const box = await tab.boundingBox();
    const point = { x: head.x + head.width / 2, y: box.y + 5 };
    await page.mouse.move(point.x, point.y);
    assert.equal(await page.locator('.score-hover-ghost').count(), 1, 'phantom visible over TAB');
    await page.mouse.click(point.x, point.y);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0].length), 2,
      'an active tool inserts the bass note over TAB');
    await page.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true',
      'TAB stays pressed when the tool is released with Escape');
    await tab.locator('.ascii-tabs-cell').first().click();
    assert.equal(await tab.evaluate(node => node.classList.contains('ascii-tabs-editing')), true,
      'TAB editing resumes when the tool is released');
    // Low ledger-line heads overlap the TAB's first empty string cell.
    await page.evaluate(() => {
      scoreEditor.score.rows[0][0] = [{ n: 24, d: 'h', at: 0 }];
      scoreEditor.render();
    });
    await tab.locator('.ascii-tabs-cell').first().waitFor();
    const lowHead = await page.locator('#e0-0 .notehead').boundingBox();
    const lowPoint = { x: lowHead.x + lowHead.width / 2, y: lowHead.y + lowHead.height / 2 };
    assert.ok(await page.evaluate(p => !!document.elementFromPoint(p.x, p.y).closest('.score-tab'), lowPoint),
      'the regression clicks a note head underneath the TAB');
    await page.mouse.move(lowPoint.x, lowPoint.y);
    await page.mouse.down();
    await page.mouse.move(lowPoint.x, lowPoint.y - 30, { steps: 6 });
    await page.mouse.up();
    assert.notEqual(await page.evaluate(() => scoreEditor.score.rows[0][0][0].n), 24,
      'dragging the overlapping head changes the score pitch instead of editing TAB');
    assert.equal(await tab.evaluate(node => node.classList.contains('ascii-tabs-editing')), false,
      'the note drag does not open TAB editing');
    assert.equal(await page.locator('#e0-0.is-selected').count(), 1,
      'the dragged score note stays selected');
    await tab.locator('.ascii-tabs-cell[data-s="5"]').first().click();
    assert.equal(await tab.evaluate(node => node.classList.contains('ascii-tabs-editing')), true,
      'TAB cells away from the note remain editable');
    await page.keyboard.press('Escape');
    for (const enabled of [true, false]) {
      if (!enabled) await toggle.click();
      const tools = page.locator('.score-palette-item[data-shortcut], .score-palette-item[data-barline], .score-palette-item[data-tool]');
      for (const tool of await tools.all()) {
        await tool.click();
        assert.equal(await tool.getAttribute('aria-pressed'), 'true', 'the clicked tool is selected');
        assert.equal(await toggle.getAttribute('aria-pressed'), String(enabled),
          'selecting any tool preserves the TAB toggle');
        await tool.click();
        assert.equal(await tool.getAttribute('aria-pressed'), 'false', 'clicking the tool again releases it');
        assert.equal(await toggle.getAttribute('aria-pressed'), String(enabled),
          'releasing any tool preserves the TAB toggle');
        assert.equal(await page.evaluate(() => !!scoreEditor.score.showTabs), enabled,
          'tool changes preserve tablature visibility');
        assert.equal(await page.locator('.score-tab').count() > 0, enabled,
          'rendered tablature matches the TAB toggle');
      }
    }
    console.log('score-tab-tool e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
