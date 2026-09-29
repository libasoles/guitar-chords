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
      // Index 0 is A#/Bb, part of the default-selected C7 chord (as a flat);
      // pick an accidental that starts unselected to compare neutral colors.
      const sharp = document.querySelectorAll('.note-finder-note-sharp')[1];
      const flat = document.querySelectorAll('.note-finder-note-flat')[1];
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

    assert.deepStrictEqual(picker.labels, ['♭', 'Notas', '#']);
    assert.ok(picker.cloneInteractive, 'the cloned cycles must accept pointer interaction');
    assert.ok(Math.abs(picker.gap - picker.naturalGap) < 1, 'the seam between cycles must match the gap between notes');
    assert.ok(Math.abs(picker.sharpSize[0] - picker.sharpSize[1]) < 1, 'accidental notes should be circular');
    assert.ok(picker.sharpRadius >= picker.sharpSize[0] / 2, 'accidental notes should have a circular radius');
    assert.strictEqual(picker.sharpBackground, picker.flatBackground, 'accidental notes should start with the neutral, non-green background');

    const firstGrid = page.locator('.note-finder-keys').first();
    await firstGrid.locator('.note-finder-note-flat').nth(1).click();
    await firstGrid.locator('.note-finder-note-sharp').nth(1).click();
    await page.waitForTimeout(200); // let the 0.12s background-color transition settle
    const noteStates = await page.locator('.note-finder-keys').first().locator('.note-finder-note-sharp').nth(1).evaluate((button) => {
      const pc = button.textContent;
      return {
        sharps: Array.from(document.querySelectorAll('.note-finder-note-sharp')).filter((el) => el.textContent === pc).map((el) => el.getAttribute('aria-pressed')),
        flats: Array.from(document.querySelectorAll('.note-finder-note-flat')).filter((el) => el.style.gridRow === button.style.gridRow).map((el) => el.getAttribute('aria-pressed')),
        sharpBackground: getComputedStyle(button).backgroundColor,
        flatBackground: getComputedStyle(Array.from(button.parentElement.querySelectorAll('.note-finder-note-flat')).find((el) => el.style.gridRow === button.style.gridRow)).backgroundColor,
      };
    });
    assert.ok(noteStates.sharps.every((state) => state === 'true'), 'clicking a cloned note should synchronize every cycle');
    assert.ok(noteStates.flats.every((state) => state === 'false'), 'selecting a sharp must deselect its enharmonic flat');
    assert.notStrictEqual(noteStates.sharpBackground, noteStates.flatBackground, 'sharp and flat columns should use different selected colors');
  } finally {
    await browser.close();
  }
}

run().then(() => console.log('OK: note picker cycles are continuous, interactive, circular, and color-coded.'))
  .catch((error) => { console.error(error.message || error); process.exitCode = 1; });
