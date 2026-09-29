/* E2E regression test for the infinite, interactive note picker. */
'use strict';

const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const FIXTURE = 'file://' + path.join(__dirname, 'note-finder.fixture.html');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(FIXTURE);
    await page.waitForFunction(() => document.querySelectorAll('.note-finder-keys').length === 3);

    const picker = await page.evaluate(() => {
      const grids = Array.from(document.querySelectorAll('.note-finder-keys'));
      const sharp = document.querySelector('.note-finder-note-sharp');
      const flat = document.querySelector('.note-finder-note-flat');
      const a = grids[0].getBoundingClientRect();
      const b = grids[1].getBoundingClientRect();
      const sharpStyle = getComputedStyle(sharp);
      const flatStyle = getComputedStyle(flat);
      return {
        labels: Array.from(document.querySelectorAll('.note-finder-col-label')).map((el) => el.textContent),
        cloneInteractive: !grids[0].hasAttribute('aria-hidden') && getComputedStyle(grids[0].querySelector('button')).pointerEvents !== 'none',
        gap: b.top - a.bottom,
        naturalGap: grids[0].querySelectorAll('.note-finder-note-natural')[1].getBoundingClientRect().top - grids[0].querySelectorAll('.note-finder-note-natural')[0].getBoundingClientRect().bottom,
        sharpSize: [parseFloat(sharpStyle.width), parseFloat(sharpStyle.height)],
        sharpRadius: parseFloat(sharpStyle.borderRadius),
        sharpBackground: sharpStyle.backgroundColor,
        flatBackground: flatStyle.backgroundColor,
      };
    });

    assert.deepStrictEqual(picker.labels, ['#', 'Notas', 'b']);
    assert.ok(picker.cloneInteractive, 'the cloned cycles must accept pointer interaction');
    assert.ok(Math.abs(picker.gap - picker.naturalGap) < 1, 'the seam between cycles must match the gap between notes');
    assert.ok(Math.abs(picker.sharpSize[0] - picker.sharpSize[1]) < 1, 'accidental notes should be circular');
    assert.ok(picker.sharpRadius >= picker.sharpSize[0] / 2, 'accidental notes should have a circular radius');
    assert.notStrictEqual(picker.sharpBackground, picker.flatBackground, 'sharp and flat columns should use two green shades');

    await page.locator('.note-finder-keys').first().locator('.note-finder-note-sharp').nth(1).click();
    const cloneStates = await page.locator('.note-finder-keys').first().locator('.note-finder-note-sharp').nth(1).evaluate((button) => {
      const pc = button.textContent;
      return Array.from(document.querySelectorAll('.note-finder-note-sharp')).filter((el) => el.textContent === pc).map((el) => el.getAttribute('aria-pressed'));
    });
    assert.ok(cloneStates.every((state) => state === 'true'), 'clicking a cloned note should synchronize every cycle');
  } finally {
    await browser.close();
  }
}

run().then(() => console.log('OK: note picker cycles are continuous, interactive, circular, and color-coded.'))
  .catch((error) => { console.error(error.message || error); process.exitCode = 1; });
