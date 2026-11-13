'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const M = require('../src/site/score-model');

// The previews are rendered lazily after the popup opens, so measure until they settle instead of once.
async function expectFramed(page, selector, count) {
  const previews = page.locator(selector + ' svg');
  const measure = async () => previews.evaluateAll(nodes => nodes.map(svg => {
    const group = svg.querySelector(':scope > g');
    const box = group ? group.getBBox() : { x: 0, y: 0, width: 0, height: 0 };
    const view = svg.viewBox.baseVal;
    return {
      width: box.width,
      height: box.height,
      inside: box.x >= view.x && box.y >= view.y &&
        box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height,
    };
  }));
  const framed = boxes => boxes.length === count && boxes.every(box => box.width > 0 && box.height > 0 && box.inside);
  const deadline = Date.now() + 10000;
  let boxes = await measure();
  while (!framed(boxes) && Date.now() < deadline) {
    await page.waitForTimeout(100);
    boxes = await measure();
  }
  assert.equal(boxes.length, count);
  for (const box of boxes) {
    assert.ok(box.width > 0 && box.height > 0 && box.inside, JSON.stringify(box));
  }
}

// The editor re-renders once the page settles (a debounced resize), which closes any open popup. Open them only after that.
async function waitForStableStage(page) {
  let previous = '', stable = 0;
  for (let i = 0; i < 100 && stable < 4; i++) {
    const current = await page.evaluate(() => document.getElementById('scoreStage').clientWidth + ':' + document.getElementById('scoreStage').innerHTML.length);
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    await page.waitForTimeout(100);
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
        await waitForStableStage(page);
        for (const kind of order) {
          await page.locator(`.score-${kind}-trigger`).first().click();
          await page.locator('#scoreClefPopup').waitFor({ state: 'visible' });
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
