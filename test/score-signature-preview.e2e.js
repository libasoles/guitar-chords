'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const M = require('../src/site/score-model');

async function expectFramed(page, selector, count) {
  const previews = page.locator(selector + ' svg');
  assert.equal(await previews.count(), count);
  const boxes = await previews.evaluateAll(nodes => nodes.map(svg => {
    const box = svg.querySelector(':scope > g').getBBox();
    const view = svg.viewBox.baseVal;
    return {
      width: box.width,
      height: box.height,
      inside: box.x >= view.x && box.y >= view.y &&
        box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height,
    };
  }));
  for (const box of boxes) {
    assert.ok(box.width > 0 && box.height > 0 && box.inside, JSON.stringify(box));
  }
}

(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    // Each order gets a fresh context so no gallery previews are cached.
    for (const order of [['clef', 'key'], ['key', 'clef']]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(score => {
          localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] }));
        }, { ...M.emptyScore(), clef: 'guitar', fifths: -1, meter: '6/8' });
        await page.goto(`http://localhost:${server.address().port}/partitura`);
        await page.waitForSelector('#scoreStage:not([aria-busy]) .score-key-trigger');
        for (const kind of order) {
          await page.locator(`.score-${kind}-trigger`).first().click();
          assert.ok(await page.locator('#scoreClefPopup').isVisible());
          await expectFramed(page, `.score-${kind}-options`, kind === 'clef' ? Object.keys(M.CLEFS).length : 14);
          await page.keyboard.press('Escape');
        }
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    console.log('PASS: clef and key previews stay framed in either opening order');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
