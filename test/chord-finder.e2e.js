/* E2E smoke test for <chord-finder>. Run: npm run test:e2e */
'use strict';

const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const FIXTURE = 'file://' + path.join(__dirname, 'chord-finder.fixture.html');

async function visibleNames(page) {
  return page.evaluate(() => {
    const finder = document.querySelector('#pin');
    const cards = finder.shadowRoot.querySelectorAll('.card:not(.hidden)');
    return Array.from(cards).map((c) => c.querySelector('.name').textContent);
  });
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];

  try {
    await page.goto(FIXTURE);

    // 1. Mount: shadow root exists and renders one card per chord.
    await page.waitForFunction(() => {
      const f = document.querySelector('#pin');
      return f && f.shadowRoot && f.shadowRoot.querySelectorAll('.card').length > 0;
    });
    const total = await page.evaluate(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card').length
    );
    assert.ok(total > 10, `expected many cards, got ${total}`);

    const input = '#pin .search';

    // 1b. Initial view is paginated to 12 with a "More" button.
    const moreSel = '#pin .load-more';
    const initialVisible = (await visibleNames(page)).length;
    assert.strictEqual(initialVisible, 12, `initial view should show 12 cards, got ${initialVisible}`);
    const moreShownInitially = await page.evaluate((s) =>
      !document.querySelector(s).shadowRoot.querySelector('.load-more').hidden, '#pin');
    assert.ok(moreShownInitially, 'More button should be visible initially');

    // 1c. Clicking "More" reveals 12 more.
    await page.evaluate((s) =>
      document.querySelector(s).shadowRoot.querySelector('.load-more-btn').click(), '#pin');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length === 24);
    const afterMore = (await visibleNames(page)).length;
    assert.strictEqual(afterMore, 24, `expected 24 after one More click, got ${afterMore}`);

    // 2. "Am7" query.
    await page.fill(input, 'Am7');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    const am7 = await visibleNames(page);
    assert.ok(am7.includes('Am7'), `expected "Am7" visible, got: ${am7.join(', ')}`);
    assert.ok(am7.includes('Amaj7'), `expected "Amaj7" (alias AM7) visible, got: ${am7.join(', ')}`);
    assert.ok(!am7.includes('C'), `"C" should not match "Am7", got: ${am7.join(', ')}`);
    assert.ok(am7.length < total, 'query should filter (fewer than total)');

    // 3. Different query filters differently.
    await page.fill(input, 'C');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    const cList = await visibleNames(page);
    assert.ok(cList.includes('C'), `expected "C" visible, got: ${cList.join(', ')}`);
    assert.ok(!cList.includes('Am7'), `"Am7" should not appear for "C", got: ${cList.join(', ')}`);
    assert.notDeepStrictEqual(cList, am7, 'two queries should filter differently');

    // 4. No match → empty message.
    await page.fill(input, 'Zzz9');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelector('.empty') !== null
    );
    const visibleWhenEmpty = (await visibleNames(page)).length;
    assert.strictEqual(visibleWhenEmpty, 0, 'no cards should be visible with no match');

    // ---- Pinning ----

    const pinnedNames = (sel) => page.evaluate((s) => {
      const f = document.querySelector(s);
      const strip = f.shadowRoot.querySelector('.pinned-strip');
      if (!strip || strip.hidden) return [];
      return Array.from(strip.querySelectorAll('.pinned-card .name')).map((n) => n.textContent);
    }, sel);

    const clickPinFor = (sel, name) => page.evaluate((args) => {
      const f = document.querySelector(args.sel);
      const cards = f.shadowRoot.querySelectorAll('.card');
      for (const c of cards) {
        if (c.querySelector('.name').textContent === args.name) {
          c.querySelector('.pin-button').click();
          return true;
        }
      }
      return false;
    }, { sel, name });

    // 5. Without pinnable (#plain): strip hidden, no pin button visible.
    const plainStripHidden = await page.evaluate(() => {
      const f = document.querySelector('#plain');
      const strip = f.shadowRoot.querySelector('.pinned-strip');
      return strip ? strip.hidden : true;
    });
    assert.ok(plainStripHidden, 'plain finder must not show the pinned strip');
    const plainPinVisible = await page.evaluate(() => {
      const f = document.querySelector('#plain');
      const btn = f.shadowRoot.querySelector('.card .pin-button');
      if (!btn) return false;
      return window.getComputedStyle(btn).display !== 'none';
    });
    assert.ok(!plainPinVisible, 'plain finder must not show pin button');

    // 6. Pinnable (#pin): pin button is visible.
    const pinBtnVisible = await page.evaluate(() => {
      const f = document.querySelector('#pin');
      const btn = f.shadowRoot.querySelector('.card .pin-button');
      return btn && window.getComputedStyle(btn).display !== 'none';
    });
    assert.ok(pinBtnVisible, 'pinnable finder must show pin button');

    await page.fill(input, 'Am7');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );

    // 7. Pin Am7.
    assert.ok(await clickPinFor('#pin', 'Am7'), 'should find Am7 card');
    await page.waitForFunction(() => {
      const strip = document.querySelector('#pin').shadowRoot.querySelector('.pinned-strip');
      return strip && !strip.hidden;
    });
    let pins = await pinnedNames('#pin');
    assert.deepStrictEqual(pins, ['Am7'], `expected only Am7 pinned, got: ${pins.join(', ')}`);

    // 8. Pin survives changing query.
    await page.fill(input, 'C');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    pins = await pinnedNames('#pin');
    assert.deepStrictEqual(pins, ['Am7'], `Am7 should stay pinned after re-query, got: ${pins.join(', ')}`);

    // 9. Second click unpins.
    await page.fill(input, 'Am7');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    assert.ok(await clickPinFor('#pin', 'Am7'), 'should find Am7 to unpin');
    await page.waitForFunction(() => {
      const strip = document.querySelector('#pin').shadowRoot.querySelector('.pinned-strip');
      return strip && strip.hidden;
    });
    pins = await pinnedNames('#pin');
    assert.strictEqual(pins.length, 0, `expected nothing pinned after unpin, got: ${pins.join(', ')}`);

    // 4b. Typing a new query resets a sticky TIPO filter (regression: filter
    // used to stay applied and silently hide non-matching results).
    await page.fill(input, 'C');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    await page.evaluate(() => {
      const f = document.querySelector('#pin');
      const advToggle = f.shadowRoot.querySelector('.advanced-toggle');
      advToggle.click();
      const pill = f.shadowRoot.querySelector('.filter-group-pills .pill[data-filter="slash"]');
      pill.click();
    });
    const slashOnly = await visibleNames(page);
    assert.ok(slashOnly.every((n) => n.includes('/')), `expected only slash chords, got: ${slashOnly.join(', ')}`);
    await page.fill(input, 'C');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    const afterRetype = await visibleNames(page);
    assert.ok(afterRetype.includes('C'), `typing a new query should clear the sticky TIPO filter and show "C", got: ${afterRetype.join(', ')}`);
    const filterStillActive = await page.evaluate(() => {
      const f = document.querySelector('#pin');
      const pill = f.shadowRoot.querySelector('.filter-group-pills .pill[data-filter="slash"]');
      return pill.getAttribute('aria-pressed') === 'true';
    });
    assert.ok(!filterStillActive, 'TIPO filter pill should no longer be pressed after typing a new query');

    console.log('OK: chord-finder mounts, filters by query, shows empty state.');
    console.log('OK: typing a new query clears a sticky TIPO filter.');
    console.log('OK: pinnable pins/unpins (persists across queries); plain has no pin affordance.');

    // ---- Notation toggle (cifrado americano ⇄ español) ----

    await page.fill(input, 'Am7');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    let names = await visibleNames(page);
    assert.ok(names.includes('Am7'), `expected English "Am7" by default, got: ${names.join(', ')}`);

    const clickNotationOption = (sel, label) => page.evaluate((args) => {
      const options = document.querySelector(args.sel).shadowRoot.querySelectorAll('.notation-option');
      Array.from(options).find((el) => el.textContent === args.label).click();
    }, { sel, label });

    await clickNotationOption('#pin', 'Do');
    await page.waitForFunction(() => {
      const f = document.querySelector('#pin');
      const card = Array.from(f.shadowRoot.querySelectorAll('.card')).find((c) => !c.classList.contains('hidden'));
      return card && card.querySelector('.name').textContent === 'Lam7';
    });
    names = await visibleNames(page);
    assert.ok(names.includes('Lam7'), `expected Spanish "Lam7" after toggle, got: ${names.join(', ')}`);

    // Search still works in Spanish notation regardless of display toggle.
    await page.fill(input, 'sol7');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    names = await visibleNames(page);
    assert.ok(names.includes('Sol7'), `expected "sol7" query to match G7 (shown as "Sol7"), got: ${names.join(', ')}`);

    // Search still works in English notation too, after switching display to Spanish.
    await page.fill(input, 'G7');
    await page.waitForFunction(() =>
      document.querySelector('#pin').shadowRoot.querySelectorAll('.card:not(.hidden)').length > 0
    );
    names = await visibleNames(page);
    assert.ok(names.includes('Sol7'), `expected "G7" query to still match, got: ${names.join(', ')}`);

    // Toggle back to English.
    await clickNotationOption('#pin', 'C');
    await page.waitForFunction(() => {
      const f = document.querySelector('#pin');
      const card = Array.from(f.shadowRoot.querySelectorAll('.card')).find((c) => !c.classList.contains('hidden'));
      return card && card.querySelector('.name').textContent === 'G7';
    });

    console.log('OK: notation toggle switches chord names between American and Spanish (cifrado); search accepts both regardless of toggle.');
  } catch (err) {
    failures.push(err);
  } finally {
    await browser.close();
  }

  if (failures.length) {
    failures.forEach((f) => console.error(f && f.message ? f.message : f));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
