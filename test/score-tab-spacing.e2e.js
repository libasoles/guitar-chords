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
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    async function spacing(n, d = 'h') {
      await page.evaluate(({ n, d }) => {
        scoreEditor.score.rows = [[[{ n, d, at: 0 }], [], [], []], [[{ n: 35, d: 'q', at: 0 }], [], [], []]];
        scoreEditor.score.showTabs = true;
        scoreEditor.render();
      }, { n, d });
      await page.locator('.score-tab .ascii-tabs-cell').first().waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      });
      return page.evaluate(() => {
        const system = document.querySelector('#scoreStage g.system');
        const lines = system.querySelectorAll('g.staff > path');
        const staffBottom = lines[4].getBoundingClientRect().bottom;
        const noteBottom = system.querySelector('#e0-0').getBoundingClientRect().bottom;
        const tab = document.querySelector('.score-tab').getBoundingClientRect();
        const next = document.querySelectorAll('#scoreStage g.system')[1].getBoundingClientRect();
        return { offset: tab.top - staffBottom, gap: tab.top - noteBottom, nextGap: next.top - tab.bottom };
      });
    }
    const high = await spacing(35);
    assert.ok(Math.abs(high.offset - 32) < 1, 'ordinary notes keep the minimum spacing: ' + JSON.stringify(high));
    for (const duration of ['h', 'q', '8']) {
      const low = await spacing(14, duration);
      assert.ok(low.gap >= 7.9, 'low notes and stems leave 8px before TAB: ' + JSON.stringify(low));
      assert.ok(low.offset > high.offset, 'spacing grows for low notes');
      assert.ok(low.nextGap > 0, 'TAB stays above the next system');
    }
    const restored = await spacing(35);
    assert.ok(Math.abs(restored.offset - high.offset) < 1, 'spacing shrinks back after raising notes');
    console.log('score-tab-spacing e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
