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
    const head = await page.locator('#e0-0 .notehead').boundingBox();
    const box = await tab.boundingBox();
    const point = { x: head.x + head.width / 2, y: box.y + 5 };
    await page.mouse.move(point.x, point.y);
    assert.equal(await page.locator('.score-hover-ghost').count(), 1, 'phantom visible over TAB');
    await page.mouse.click(point.x, point.y);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0].length), 2,
      'an active tool inserts the bass note over TAB');
    await page.keyboard.press('Escape');
    await tab.locator('.ascii-tabs-cell').first().click();
    assert.equal(await tab.evaluate(node => node.classList.contains('ascii-tabs-editing')), true,
      'TAB editing resumes when the tool is released');
    console.log('score-tab-tool e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
