/* E2E regression test for the infinite, interactive note picker. */
'use strict';

const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { chromePath } = require('../scripts/lib/chrome-path');

const FIXTURE = 'file://' + path.join(__dirname, 'note-finder.fixture.html');

async function run() {
  const browser = await chromium.launch({ executablePath: chromePath() });
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
      const natural = grids[0].querySelector('.note-finder-note-natural').getBoundingClientRect();
      const sharpStyle = getComputedStyle(sharp);
      const flatStyle = getComputedStyle(flat);
      const sharpShapeStyle = getComputedStyle(sharp, '::before');
      const flatShapeStyle = getComputedStyle(flat, '::before');
      const flatHeading = document.querySelector('.note-finder-col-label-flats');
      const sharpHeading = document.querySelector('.note-finder-col-label-sharps');
      return {
        labels: Array.from(document.querySelectorAll('.note-finder-col-label')).map((el) => el.textContent),
        cloneInteractive: !grids[0].hasAttribute('aria-hidden') && getComputedStyle(grids[0].querySelector('button')).pointerEvents !== 'none',
        gap: b.top - a.bottom,
        naturalGap: grids[0].querySelectorAll('.note-finder-note-natural')[1].getBoundingClientRect().top - grids[0].querySelectorAll('.note-finder-note-natural')[0].getBoundingClientRect().bottom,
        gridCenter: a.left + a.width / 2,
        naturalCenter: natural.left + natural.width / 2,
        sharpSize: [parseFloat(sharpStyle.width), parseFloat(sharpStyle.height)],
        sharpClipPath: sharpShapeStyle.clipPath,
        flatClipPath: flatShapeStyle.clipPath,
        sharpBackground: sharpShapeStyle.backgroundColor,
        flatBackground: flatShapeStyle.backgroundColor,
        headingSizes: [parseFloat(getComputedStyle(flatHeading).fontSize), parseFloat(getComputedStyle(sharpHeading).fontSize)],
        sharpHeadingGlyphTransform: getComputedStyle(sharpHeading.querySelector('.note-finder-col-label-symbol')).transform,
        accidentalSymbolSize: parseFloat(getComputedStyle(sharp.querySelector('.note-finder-note-accidental-symbol')).fontSize),
        accidentalTextSize: parseFloat(sharpStyle.fontSize),
      };
    });

    assert.deepStrictEqual(picker.labels, ['♭', 'Notas', '#']);
    assert.ok(picker.headingSizes[0] > picker.headingSizes[1], 'the flat heading needs optical compensation to match the hash');
    assert.notStrictEqual(picker.sharpHeadingGlyphTransform, 'none', 'the hash glyph should be optically aligned without moving its underline');
    assert.ok(picker.accidentalSymbolSize > picker.accidentalTextSize, 'the accidental symbol should stand out from its note letter');
    assert.ok(picker.cloneInteractive, 'the cloned cycles must accept pointer interaction');
    assert.ok(Math.abs(picker.gap - picker.naturalGap) < 1, 'the seam between cycles must match the gap between notes');
    assert.ok(Math.abs(picker.gridCenter - picker.naturalCenter) < 1, 'the central rail should align with natural notes');
    assert.ok(picker.sharpSize[0] > picker.sharpSize[1], 'accidental notes should be wide enough to read as connected bubbles');
    assert.notStrictEqual(picker.sharpClipPath, 'none', 'sharp notes should point toward the central rail');
    assert.notStrictEqual(picker.flatClipPath, 'none', 'flat notes should point toward the central rail');
    assert.notStrictEqual(picker.sharpClipPath, picker.flatClipPath, 'sharp and flat bubbles should point in opposite directions');
    assert.notStrictEqual(picker.sharpBackground, picker.flatBackground, 'sharp and flat notes should have distinct neutral colors');

    // Mobile keeps the note picker and the matching-chord column together.
    await page.setViewportSize({ width: 360, height: 800 });
    const mobileLayout = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
      const pickerRect = rect('.note-finder-picker');
      const resultsRect = rect('.note-finder-results');
      const resultsLabel = document.querySelector('.note-finder-results-label');
      const resultsScroll = document.querySelector('.note-finder-results-scroll');
      const labelRect = resultsLabel.getBoundingClientRect();
      const pickerLabel = document.querySelector('.note-finder-col-label-naturals');
      const results = document.querySelector('.note-finder-results');
      return {
        pickerRight: pickerRect.right,
        resultsLeft: resultsRect.left,
        pickerTop: pickerRect.top,
        resultsTop: resultsRect.top,
        resultsLabelTop: labelRect.top,
        labelLeft: labelRect.left,
        headingFontSize: getComputedStyle(resultsLabel).fontSize,
        pickerHeadingFontSize: getComputedStyle(pickerLabel).fontSize,
        resultsOverflowY: getComputedStyle(resultsScroll).overflowY,
        resultsHeight: results.getBoundingClientRect().height,
        resultsScrollHeight: resultsScroll.getBoundingClientRect().height,
        resultsTextAlign: getComputedStyle(results).textAlign,
      };
    });
    assert.ok(mobileLayout.resultsLeft >= mobileLayout.pickerRight, 'mobile results should sit to the right of the picker');
    assert.ok(Math.abs(mobileLayout.resultsLabelTop - mobileLayout.pickerTop) < 1, 'the results title should share the picker-heading baseline row');
    assert.ok(Math.abs(mobileLayout.labelLeft - mobileLayout.resultsLeft) < 1, 'the results title should align with its column');
    assert.strictEqual(mobileLayout.headingFontSize, mobileLayout.pickerHeadingFontSize, 'picker and results headings should share baseline metrics');
    assert.strictEqual(mobileLayout.resultsOverflowY, 'auto', 'mobile results should scroll independently');
    assert.ok(mobileLayout.resultsScrollHeight < mobileLayout.resultsHeight, 'the fixed title should sit outside the scrolling results area');
    assert.strictEqual(mobileLayout.resultsTextAlign, 'center', 'mobile results should be centered in their column');

    // Default selection (C E G B♭): the open C7 omits G, so only its
    // 5th-string barre position matches — one position, no chevrons.
    const defaultCards = await page.evaluate(() => Array.from(document.querySelectorAll('#noteFinderGrid .v7-card')).map((card) => ({
      name: card.querySelector('.name').textContent,
      notes: card.querySelector('.notes').textContent,
      chevrons: Array.from(card.querySelectorAll('.pos-nav')).filter((b) => !b.hidden).length,
    })));
    assert.deepStrictEqual(defaultCards, [{ name: 'C7', notes: 'C G B♭ E G', chevrons: 0 }]);

    // F A C D: F6, B♭maj9 and Dm9 voicings miss a note; only Dm7 remains,
    // with two matching positions to cycle through.
    const firstGrid = page.locator('.note-finder-keys').first();
    await page.locator('#noteFinderClear').click();
    for (const i of [3, 1, 6, 5]) await firstGrid.locator('.note-finder-note-natural').nth(i).click();
    const dm7 = page.locator('#noteFinderGrid .v7-card');
    assert.deepStrictEqual(await dm7.locator('.name').allTextContents(), ['Dm7']);
    const navSpacing = await dm7.evaluate((card) => {
      const diagram = card.querySelector('.diagram').getBoundingClientRect();
      const prev = card.querySelector('.pos-prev').getBoundingClientRect();
      const next = card.querySelector('.pos-next').getBoundingClientRect();
      return { prevRight: prev.right, diagramLeft: diagram.left, nextLeft: next.left, diagramRight: diagram.right };
    });
    assert.ok(navSpacing.prevRight <= navSpacing.diagramLeft + 2, 'the previous chevron should stay within a 2px gap from the mobile diagram');
    assert.ok(navSpacing.nextLeft >= navSpacing.diagramRight - 2, 'the next chevron should stay within a 2px gap from the mobile diagram');
    const before = { diagram: await dm7.locator('.diagram').textContent(), notes: await dm7.locator('.notes').textContent() };
    await dm7.locator('.pos-next').click();
    const after = { diagram: await dm7.locator('.diagram').textContent(), notes: await dm7.locator('.notes').textContent() };
    assert.notStrictEqual(after.diagram, before.diagram, 'the next chevron should switch to another position');
    assert.notStrictEqual(after.notes, before.notes, 'the notes should follow the shown position');
    await page.locator('#noteFinderClear').click();
    for (const i of [6, 4, 2]) await firstGrid.locator('.note-finder-note-natural').nth(i).click();
    await firstGrid.locator('.note-finder-note-flat').nth(0).click();

    await firstGrid.locator('.note-finder-note-flat').nth(1).click();
    await firstGrid.locator('.note-finder-note-sharp').nth(1).click();
    await page.waitForTimeout(200); // let the 0.12s background-color transition settle
    const noteStates = await page.locator('.note-finder-keys').first().locator('.note-finder-note-sharp').nth(1).evaluate((button) => {
      const pc = button.textContent;
      return {
        sharps: Array.from(document.querySelectorAll('.note-finder-note-sharp')).filter((el) => el.textContent === pc).map((el) => el.getAttribute('aria-pressed')),
        flats: Array.from(document.querySelectorAll('.note-finder-note-flat')).filter((el) => el.style.gridRow === button.style.gridRow).map((el) => el.getAttribute('aria-pressed')),
        sharpBackground: getComputedStyle(button, '::before').backgroundColor,
        flatBackground: getComputedStyle(Array.from(button.parentElement.querySelectorAll('.note-finder-note-flat')).find((el) => el.style.gridRow === button.style.gridRow), '::before').backgroundColor,
        selectedBadge: getComputedStyle(button, '::after').content,
      };
    });
    assert.ok(noteStates.sharps.every((state) => state === 'true'), 'clicking a cloned note should synchronize every cycle');
    assert.ok(noteStates.flats.every((state) => state === 'false'), 'selecting a sharp must deselect its enharmonic flat');
    assert.notStrictEqual(noteStates.sharpBackground, noteStates.flatBackground, 'sharp and flat columns should use different selected colors');
    assert.strictEqual(noteStates.selectedBadge, '"✓"', 'selected accidental notes should show a check badge');

    // The selection persists across reloads (saved debounced to localStorage).
    const pressedNotes = () => page.evaluate(() => Array.from(document.querySelectorAll('.note-finder-keys')[1].querySelectorAll('[aria-pressed="true"]'))
      .map((el) => el.className + '|' + el.style.gridRow).sort());
    const beforeReload = await pressedNotes();
    await page.reload(); // pagehide flushes the pending debounced save
    await page.waitForFunction(() => document.querySelectorAll('.note-finder-keys').length === 3);
    assert.deepStrictEqual(await pressedNotes(), beforeReload, 'the selected notes should survive a reload');
    await page.locator('#noteFinderClear').click();
    await page.waitForTimeout(400);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.note-finder-keys').length === 3);
    assert.deepStrictEqual(await pressedNotes(), [], 'a cleared selection should stay cleared after a reload');
  } finally {
    await browser.close();
  }
}

run().then(() => console.log('OK: note picker cycles are continuous, interactive, connected, and color-coded.'))
  .catch((error) => { console.error(error.message || error); process.exitCode = 1; });
