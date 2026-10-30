/* Document tab dragging. Run after npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function run() {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath(), headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    const order = () => page.locator('.score-doc-tab').evaluateAll(tabs => tabs.map(tab => tab.querySelector('input')?.value ?? tab.textContent));
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('scoreEditor.tabs.v1')));
    const rows = () => page.evaluate(() => scoreEditor.score.rows.length);
    const drag = async (from, to, after = false, cancel = false) => {
      const source = await page.locator('.score-doc-tab').nth(from).boundingBox();
      const target = await page.locator('.score-doc-tab').nth(to).boundingBox();
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
      await page.mouse.down();
      await page.mouse.move(target.x + target.width * (after ? 0.85 : 0.15), target.y + target.height / 2, { steps: 12 });
      assert.equal(await page.locator('.is-reordering').count(), 1);
      if (cancel) await page.keyboard.press('Escape');
      await page.mouse.up();
      assert.equal(await page.locator('.is-reordering, .drop-before, .drop-after, .is-dragging').count(), 0);
    };
    await page.locator('.score-doc-tab-input').fill('Uno');
    const initialRows = await rows();
    await page.locator('#scoreAddRow').click();
    await page.locator('#scoreNewTab').click();
    await page.locator('.score-doc-tab-input').fill('Dos');
    await page.locator('#scoreAddRow').click();
    await page.locator('#scoreAddRow').click();
    await page.locator('#scoreNewTab').click();
    await page.locator('.score-doc-tab-input').fill('Tres');

    // Dragging the active title input preserves the current document.
    await drag(2, 0);
    assert.deepEqual(await order(), ['Tres', 'Uno', 'Dos']);
    assert.equal((await stored()).active, 0);
    assert.equal(await page.locator('#scoreTitle').inputValue(), 'Tres');
    // Inactive documents move in either direction without opening them.
    await drag(1, 2, true);
    assert.deepEqual(await order(), ['Tres', 'Dos', 'Uno']);
    await drag(2, 1);
    assert.deepEqual(await order(), ['Tres', 'Uno', 'Dos']);
    assert.equal(await page.locator('#scoreTitle').inputValue(), 'Tres');
    await drag(0, 2, true, true);
    assert.deepEqual(await order(), ['Tres', 'Uno', 'Dos']);
    // A drop outside the strip is cancelled.
    const source = await page.locator('.score-doc-tab').first().boundingBox();
    await page.mouse.move(source.x + 12, source.y + 10);
    await page.mouse.down();
    await page.mouse.move(10, 800, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual(await order(), ['Tres', 'Uno', 'Dos']);

    // Each moved document retains its own undo stack.
    await page.getByRole('tab', { name: 'Uno', exact: true }).click();
    assert.equal(await rows(), initialRows + 1);
    await page.locator('#scoreStage').focus();
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await rows(), initialRows);
    await page.getByRole('tab', { name: 'Dos', exact: true }).click();
    assert.equal(await rows(), initialRows + 2);
    await page.locator('#scoreStage').focus();
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await rows(), initialRows + 1);
    await page.locator('.score-doc-tab-input').fill('Dos editado');
    await page.reload();
    await page.waitForSelector('#scoreStage g.measure');
    assert.deepEqual(await order(), ['Tres', 'Uno', 'Dos editado']);
    assert.equal(await page.locator('#scoreTitle').inputValue(), 'Dos editado');
    assert.equal(await rows(), initialRows + 1);

    // Wrapped tabs still accept moves between rows.
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 3; i++) {
      await page.locator('#scoreNewTab').click();
      await page.locator('.score-doc-tab-input').fill('Documento largo ' + i);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const first = await page.locator('.score-doc-tab').first().boundingBox();
    const last = await page.locator('.score-doc-tab').last().boundingBox();
    assert.ok(last.y > first.y);
    await drag(5, 0);
    assert.equal((await order())[0], 'Documento largo 2');
    assert.equal((await stored()).active, 0);
    // A touch gesture can move the active input to the end via the + button.
    const session = await page.context().newCDPSession(page);
    const start = await page.locator('.score-doc-tab').first().boundingBox();
    const end = await page.locator('#scoreNewTab').boundingBox();
    const x = start.x + start.width / 2, y = start.y + start.height / 2;
    const endX = end.x + end.width / 2, endY = end.y + end.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 10; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (endX - x) * step / 10, y: y + (endY - y) * step / 10 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal((await order()).at(-1), 'Documento largo 2');
    assert.equal((await stored()).active, 5);
    await session.detach();
    console.log('score-document-tabs e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
