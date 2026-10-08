/* E2E test for the pages built on ascii-tabs: the tab editor and the read-only
   sixths exercise. Serves dist/site, so run `npm run build:site` first. */
'use strict';

const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

const DIST_SITE = path.join(__dirname, '..', 'dist', 'site');

async function run() {
  const server = await serveStatic(DIST_SITE, 0);
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  const page = await browser.newPage();
  try {
    // A first visit starts with three empty Tabs, like the previous editor.
    await page.goto(base + '/crear-tablaturas-de-guitarra');
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const fresh = await page.evaluate(() => document.querySelector('ascii-tabs').value);
    assert.deepStrictEqual(fresh, [[], [], []]);

    // Tabs saved by the previous editor (same key, frets as text) still load.
    await page.evaluate(() => {
      localStorage.setItem('tabEditor.tabs', JSON.stringify([[['', '', '', '', '3', ''], ['0', '', '', '2', '', '']]]));
    });
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const editor = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      return {
        value: el.value,
        readonly: el.readonly,
        tools: el.tools,
        toolsAttribute: el.getAttribute('tools'),
        toolsDirection: getComputedStyle(el.querySelector('.ascii-tabs-tools')).flexDirection,
        hint: el.querySelector('.ascii-tabs-hint').textContent,
        hintFontSize: getComputedStyle(el.querySelector('.ascii-tabs-hint')).fontSize,
        spacingFontSize: getComputedStyle(el.querySelector('.ascii-tabs-spacing')).fontSize,
        hintTop: el.querySelector('.ascii-tabs-hint').getBoundingClientRect().top,
        spacingTop: el.querySelector('.ascii-tabs-spacing').getBoundingClientRect().top,
      };
    });
    assert.deepStrictEqual(editor.value, [[[null, null, null, null, 3, null], [0, null, null, 2, null, null]]]);
    assert.strictEqual(editor.readonly, false);
    assert.strictEqual(editor.tools, 'side');
    assert.strictEqual(editor.toolsAttribute, null);
    assert.strictEqual(editor.toolsDirection, 'column');
    assert.strictEqual(editor.hint, 'Hacé clic en una cuerda y escribí el número de traste.');
    assert.strictEqual(editor.hintFontSize, editor.spacingFontSize);
    assert.strictEqual(editor.hintTop, editor.spacingTop);

    // The editor has one shared spacing slider. It changes every current Tab
    // and remains the setting for Tabs added afterwards.
    const sharedSpacing = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      const slider = el.querySelector('.ascii-tabs-spacing-input');
      slider.value = '5';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      el.addTab();
      return {
        sliders: el.querySelectorAll('.ascii-tabs-spacing-input').length,
        spacing: el.spacing,
        sheetCount: el.querySelectorAll('.ascii-tabs-sheet').length,
        sliderValue: slider.value,
      };
    });
    assert.deepStrictEqual(sharedSpacing, {
      sliders: 1,
      spacing: 5,
      sheetCount: 2,
      sliderValue: '5',
    });

    // On phones the sheet actions move above the Tab, in a horizontal row.
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTools = await page.evaluate(() => {
      const sheet = document.querySelector('.ascii-tabs-sheet');
      const tools = sheet.querySelector('.ascii-tabs-tools');
      return {
        direction: getComputedStyle(tools).flexDirection,
        sheetDirection: getComputedStyle(sheet).flexDirection,
        toolsTop: tools.getBoundingClientRect().top,
        tabTop: sheet.querySelector('.ascii-tabs-tab').getBoundingClientRect().top,
      };
    });
    assert.strictEqual(mobileTools.direction, 'row');
    assert.strictEqual(mobileTools.sheetDirection, 'column');
    assert.ok(mobileTools.toolsTop < mobileTools.tabTop);

    // The sixths exercise shows its three Tabs read-only, with no controls.
    await page.goto(base + '/ejercicio-de-sextas');
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const sixths = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      return {
        tabs: el.value.length,
        first: el.value[0][0],
        readonly: el.readonly,
        spacing: el.spacing,
        buttons: el.querySelectorAll('button').length,
      };
    });
    assert.strictEqual(sixths.tabs, 3);
    assert.deepStrictEqual(sixths.first, [null, null, null, null, 3, 0]);
    assert.strictEqual(sixths.readonly, true);
    assert.strictEqual(sixths.spacing, 3);
    assert.strictEqual(sixths.buttons, 0);

    console.log('OK: tab editor loads saved tabs; sixths exercise is read-only with no controls.');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
