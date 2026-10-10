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
        spacing: el.spacing,
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
    assert.strictEqual(editor.spacing, 2);
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
        sliderDisplay: getComputedStyle(document.querySelector('.ascii-tabs-spacing')).display,
        toolsTop: tools.getBoundingClientRect().top,
        tabTop: sheet.querySelector('.ascii-tabs-tab').getBoundingClientRect().top,
      };
    });
    assert.strictEqual(mobileTools.direction, 'row');
    assert.strictEqual(mobileTools.sheetDirection, 'column');
    assert.strictEqual(mobileTools.sliderDisplay, 'none');
    assert.ok(mobileTools.toolsTop < mobileTools.tabTop);

    // ascii-tabs 0.2.0 duplicates the whole column, including empty strings,
    // with either shortcut. The cursor advances and storage receives one edit.
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const modifier of ['Meta', 'Alt']) {
      const original = [0, null, 12, null, 5, 24];
      await page.evaluate((column) => {
        const el = document.querySelector('ascii-tabs');
        el.value = [[column, [9, 9, 9, 9, 9, 9]]];
        window.tabChanges = [];
        el.addEventListener('change', (event) => window.tabChanges.push(event.detail.value));
      }, original);
      await page.locator('.ascii-tabs-cell[data-c="0"][data-s="2"]').click();
      await page.keyboard.press(modifier + '+ArrowRight');
      const duplicated = await page.evaluate(() => {
        const el = document.querySelector('ascii-tabs');
        const cursor = el.querySelector('.ascii-tabs-cur');
        return {
          value: el.value,
          cursor: [cursor.dataset.c, cursor.dataset.s],
          changes: window.tabChanges,
          saved: JSON.parse(localStorage.getItem('tabEditor.tabs')),
        };
      });
      assert.deepStrictEqual(duplicated.value, [[original, original]]);
      assert.deepStrictEqual(duplicated.cursor, ['1', '2']);
      assert.deepStrictEqual(duplicated.changes, [[[original, original]]]);
      assert.deepStrictEqual(duplicated.saved, [[['0', '', '12', '', '5', '24'], ['0', '', '12', '', '5', '24']]]);

      // Editing the duplicate leaves the source column untouched.
      await page.keyboard.press('Delete');
      const edited = await page.evaluate(() => document.querySelector('ascii-tabs').value);
      assert.strictEqual(edited[0][0][2], 12);
      assert.strictEqual(edited[0][1][2], null);
      await page.reload();
      await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
      assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), edited);
    }

    // ascii-tabs 0.3.0 fills empty strings with zeros without replacing frets
    // or moving the cursor. Repeating it on a full column is a no-op.
    for (const modifier of ['Meta', 'Alt']) {
      await page.evaluate(() => {
        const el = document.querySelector('ascii-tabs');
        el.value = [[[null, 12, null, 0, null, 24]]];
        window.tabChanges = [];
        el.addEventListener('change', (event) => window.tabChanges.push(event.detail.value));
      });
      await page.locator('.ascii-tabs-cell[data-c="0"][data-s="2"]').click();
      await page.keyboard.press(modifier + '+0');
      await page.keyboard.press(modifier + '+0');
      const filled = await page.evaluate(() => {
        const el = document.querySelector('ascii-tabs');
        const cursor = el.querySelector('.ascii-tabs-cur');
        return { value: el.value, cursor: [cursor.dataset.c, cursor.dataset.s], changes: window.tabChanges };
      });
      assert.deepStrictEqual(filled.value, [[[0, 12, 0, 0, 0, 24]]]);
      assert.deepStrictEqual(filled.cursor, ['0', '2']);
      assert.deepStrictEqual(filled.changes, [filled.value]);
      await page.reload();
      await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
      assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), filled.value);
    }

    // Duplicating the last column grows the Tab; an unmodified arrow only moves.
    await page.evaluate(() => {
      document.querySelector('ascii-tabs').value = [[[3, null, null, null, null, null]]];
    });
    await page.locator('.ascii-tabs-cell[data-c="0"][data-s="0"]').click();
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value[0].length), 1);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Alt+ArrowRight');
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [
      [[3, null, null, null, null, null], [3, null, null, null, null, null]],
    ]);

    // v0.4.0 selects notes with a rectangle and duplicates only that group.
    await page.evaluate(() => {
      document.querySelector('ascii-tabs').value = [
        [[3, null, null, null, null, null], [null, 12, null, null, null, null], [7, null, null, null, null, null]],
      ];
    });
    const cell = (c, s) => page.locator(`.ascii-tabs-cell[data-c="${c}"][data-s="${s}"]`);
    const start = await cell(0, 2).boundingBox();
    const end = await cell(1, 0).boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width, end.y, { steps: 8 });
    // v0.4.1 keeps the selection rectangle behind frets so notes stay legible.
    const selectionLayers = await page.evaluate(() => ({
      marquee: Number(getComputedStyle(document.querySelector('.ascii-tabs-marquee')).zIndex),
      fret: Number(getComputedStyle(document.querySelector('.ascii-tabs-fret')).zIndex),
    }));
    assert.ok(selectionLayers.fret > selectionLayers.marquee);
    await page.mouse.up();
    assert.strictEqual(await page.locator('.ascii-tabs-marquee').count(), 0);
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 2);
    await page.keyboard.press('Alt+ArrowRight');
    const grouped = [
      [3, null, null, null, null, null], [null, 12, null, null, null, null],
      [3, null, null, null, null, null], [null, 12, null, null, null, null],
    ];
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [grouped]);
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 2);

    // Copy the selection as ASCII and move it down one string and right one
    // column. Relative positions survive and the originals stay untouched.
    const copied = await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      document.querySelector('.ascii-tabs-input').dispatchEvent(new ClipboardEvent('copy', { clipboardData, cancelable: true }));
      return clipboardData.getData('text/plain');
    });
    assert.strictEqual(copied.split('\n').length, 6);
    assert.ok(copied.includes('12'));
    const from = await cell(2, 0).boundingBox();
    const to = await cell(3, 1).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    // The entire selected group follows the pointer in a visual preview.
    assert.strictEqual(await page.locator('.ascii-tabs-drag-preview .ascii-tabs-fret').count(), 2);
    assert.strictEqual(await page.locator('.ascii-tabs-drag-preview').getAttribute('aria-hidden'), 'true');
    await page.mouse.up();
    assert.strictEqual(await page.locator('.ascii-tabs-drag-preview').count(), 0);
    const moved = [
      grouped[0], grouped[1], [null, null, null, null, null, null],
      [null, 3, null, null, null, null], [null, null, 12, null, null, null],
    ];
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [moved]);
    await page.keyboard.press('Delete');
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 0);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value[0].slice(0, 2)), grouped.slice(0, 2));

    // Paste at the current column preserves string positions and saves the
    // result. Escape dismisses the selection without changing the notes.
    await cell(2, 0).click();
    await page.evaluate((text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      document.querySelector('.ascii-tabs-input').dispatchEvent(new ClipboardEvent('paste', { clipboardData, cancelable: true }));
    }, copied);
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 2);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [grouped]);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 0);
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [grouped]);

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

    console.log('OK: tab editor saves edits, supports shortcuts, group selection/movement and ASCII copy/paste; sixths exercise is read-only with no controls.');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
