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

    console.log('OK: chord-finder mounts, filters by query, shows empty state.');
    console.log('OK: pinnable pins/unpins (persists across queries); plain has no pin affordance.');
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
