'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const M = require('../src/site/score-model');
(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${server.address().port}/partitura`);
    await page.waitForSelector('#m0');
    const source = M.emptyScore(); source.meter = '6/8'; source.fifths = -2;
    source.rows[0][0] = [{ d: 'q', n: 37 }];
    const fragment = M.copySelection(source, [{ mi: 0, i: 0 }]);
    const paste = async shift => {
      const staff = await page.locator('#m2 > g.staff > path').first().boundingBox();
      await page.mouse.click(staff.x + staff.width / 2, staff.y + 10);
      if (shift) await page.keyboard.down('Shift');
      await page.evaluate(fragment => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', JSON.stringify(fragment));
        document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
      }, fragment);
      if (shift) await page.keyboard.up('Shift');
    };
    await paste(false);
    assert.equal(await page.evaluate(() => scoreEditor.score.keys[2]), -2);
    assert.equal(await page.evaluate(() => scoreEditor.score.meters[2]), '6/8');
    assert.equal(await page.locator('#m2 g.meterSig').count(), 1);
    assert.equal(await page.locator('#m2 g.keyAccid').count(), 2);
    await page.reload(); await page.waitForSelector('#m2');
    assert.equal(await page.evaluate(() => scoreEditor.score.meters[2]), '6/8');
    await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('#m2');
    await paste(true);
    assert.equal(await page.evaluate(() => scoreEditor.score.meters), undefined);
    assert.equal(await page.evaluate(() => scoreEditor.score.keys), undefined);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2].length), 1);
    assert.deepEqual(errors, []);
    console.log('PASS: paste signatures, reload and Shift paste');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
