'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');

async function checkArpeggioLayout() {
  const server = await serveStatic(path.join(__dirname, '../dist/site'), 0);
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  try {
    for (const width of [320, 375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      await page.route(/\/vendor\/ascii-tabs[.\w-]*\.js/, async (route) => {
        await held;
        await route.continue();
      });
      await page.goto('http://localhost:' + server.address().port + pagePath('articulo-tablaturas-arpegios', 'es'), { waitUntil: 'commit' });
      await page.locator('.arpeggio-group').last().waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.arpeggio-group .article-tab')).minHeight !== '0px');
      const geometry = () => page.locator('.arpeggio-group').evaluateAll((groups) => groups.map((group) => {
        const rect = group.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }));
      const before = await geometry();
      release();
      await page.waitForSelector('.arpeggio-group .ascii-tabs-annotations');
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await geometry();
      before.forEach((rect, i) => {
        assert.ok(Math.abs(rect.top - after[i].top) < 1, 'group stays in place at ' + width);
        assert.ok(Math.abs(rect.height - after[i].height) < 1, 'reserved height matches at ' + width);
      });
      for (const button of await page.locator('.arpeggio-group [role="tabpanel"]:visible .arpeggio-chord').all()) {
        await button.click();
        const popup = page.locator('.arpeggio-popover:popover-open');
        await popup.locator('svg .tuning').first().waitFor({ state: 'attached' });
        await page.waitForFunction(() => parseFloat(document.querySelector('.arpeggio-popover:popover-open').style.top) >= 0);
        const trigger = await button.boundingBox();
        const box = await popup.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width, 'popup fits viewport');
        assert.ok(box.y >= 0 && box.y + box.height <= 800, 'popup fits vertically');
        assert.ok(Math.min(Math.abs(box.y - trigger.y - trigger.height), Math.abs(trigger.y - box.y - box.height)) <= 11, 'popup stays by trigger');
        const labels = await popup.locator('svg .tuning').allTextContents();
        assert.equal(labels.filter(Boolean).length, 4, 'only sounding strings have notes');
        if (await button.textContent() === 'C') assert.deepEqual(labels, ['', 'C', '', 'G', 'C', 'E']);
        await page.keyboard.press('Escape');
        assert.equal(await popup.count(), 0);
        assert.ok(await button.evaluate((el) => el === document.activeElement));
      }
      const groups = page.locator('.arpeggio-group');
      const first = groups.first();
      const second = groups.nth(1);
      const viewSwitch = first.getByRole('switch');
      assert.equal(await page.getByRole('switch', { checked: true }).count(), 8);
      assert.equal(await first.locator('.arpeggio-diagrams:visible').count(), 0);
      await viewSwitch.click();
      assert.equal(await viewSwitch.getAttribute('aria-checked'), 'false');
      assert.equal(await first.locator('ascii-tabs:visible').count(), 0);
      assert.deepEqual(await first.locator('.arpeggio-diagrams:visible .name').allTextContents(), ['C', 'C/E', 'C/G']);
      assert.equal(await second.getByRole('switch').getAttribute('aria-checked'), 'true');
      assert.equal(await second.locator('ascii-tabs:visible').count(), 1);
      await first.getByRole('tab', { name: 'menor', exact: true }).click();
      assert.deepEqual(await first.locator('.arpeggio-diagrams:visible .name').allTextContents(), ['Cm', 'Cm/Eb', 'Cm/G']);
      await viewSwitch.focus();
      await page.keyboard.press('Space');
      assert.equal(await viewSwitch.getAttribute('aria-checked'), 'true');
      assert.equal(await first.locator('ascii-tabs:visible').count(), 1);
      await viewSwitch.click();
      // Filter by an open first string: diagrams follow the actual matches,
      // while each other root keeps its independent representation.
      await page.locator('.arpeggio-search-toggle').click();
      await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => {
        el.dispatchEvent(new CustomEvent('change', { detail: { value: [[[0, null, null, null, null, null]]] } }));
      });
      await page.keyboard.press('Escape');
      await page.locator('h1').click();
      const expected = await page.evaluate(() => JSON.parse(document.getElementById('arpeggio-search-data').textContent).roots[0].chords.filter((chord) => chord.form[0] === 0).map((chord) => chord.name));
      assert.equal(await viewSwitch.isVisible(), true);
      assert.deepEqual(await first.locator('.arpeggio-results .arpeggio-diagrams:visible .name').allTextContents(), expected);
      await viewSwitch.click();
      assert.equal(await first.locator('.arpeggio-results ascii-tabs').isVisible(), true);
      await viewSwitch.click();
      await page.locator('.arpeggio-search-toggle').click();
      assert.deepEqual(await first.locator('.arpeggio-diagrams:visible .name').allTextContents(), ['Cm', 'Cm/Eb', 'Cm/G']);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'representations fit viewport');
      await page.reload();
      assert.equal(await page.getByRole('switch', { checked: true }).count(), 8, 'switch state is volatile');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Arpeggio loading, popovers, string notes and per-root representation switches passed.');
  } finally {
    await browser.close();
    server.close();
  }
}

module.exports = checkArpeggioLayout;
if (require.main === module) {
  checkArpeggioLayout().catch((error) => { console.error(error); process.exitCode = 1; });
}
