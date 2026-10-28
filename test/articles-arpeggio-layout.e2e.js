'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');

const { GROUPS: ARPEGGIOS } = require('../scripts/lib/article-arpeggios');
const arpeggioGroup = (root, quality) => ARPEGGIOS.find((group) => group[1] === root && group[2] === quality);

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
      let checkedFirstC = false;
      // The popup's placement does not depend on the chord, so the first one of each panel stands for the rest.
      const chordButtons = (await page.locator('.arpeggio-group [role="tabpanel"]:visible').all()).map((panel) => panel.locator('.arpeggio-chord').first());
      for (const [index, button] of chordButtons.entries()) {
        await button.click();
        const popup = page.locator('.arpeggio-popover:popover-open');
        await popup.locator('svg .tuning').first().waitFor({ state: 'attached' });
        // Placement and dismissal do not depend on the chord, so the first one stands for all.
        if (index === 0) {
          await page.waitForFunction(() => parseFloat(document.querySelector('.arpeggio-popover:popover-open').style.top) >= 0);
          const trigger = await button.boundingBox();
          const box = await popup.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width, 'popup fits viewport');
          assert.ok(box.y >= 0 && box.y + box.height <= 800, 'popup fits vertically');
          assert.ok(Math.min(Math.abs(box.y - trigger.y - trigger.height), Math.abs(trigger.y - box.y - box.height)) <= 11, 'popup stays by trigger');
        }
        const labels = await popup.locator('svg .tuning').allTextContents();
        assert.equal(labels.filter(Boolean).length, 4, 'only sounding strings have notes');
        // Other voicings share the name C; only the first is the open-position one.
        if (!checkedFirstC && await button.textContent() === 'C') {
          checkedFirstC = true;
          assert.deepEqual(labels, ['', 'C', '', 'G', 'C', 'E']);
        }
        await page.keyboard.press('Escape');
        if (index === 0) {
          assert.equal(await popup.count(), 0);
          assert.ok(await button.evaluate((el) => el === document.activeElement));
        }
      }
      const groups = page.locator('.arpeggio-group');
      const first = groups.first();
      const second = groups.nth(1);
      const rootToggle = first.locator('.arpeggio-root');
      const firstTab = first.locator('ascii-tabs').first();
      const fretText = await firstTab.textContent();
      assert.equal(await rootToggle.getAttribute('aria-pressed'), 'false');
      await rootToggle.click();
      assert.equal(await rootToggle.getAttribute('aria-pressed'), 'true');
      assert.equal(await firstTab.getAttribute('notation'), 'solfege');
      assert.match(await firstTab.textContent(), /do/);
      assert.notEqual(await firstTab.textContent(), fretText);
      assert.equal(await rootToggle.evaluate((el) => getComputedStyle(el).color === getComputedStyle(el.closest('section').querySelector('[aria-selected="true"]')).color), true, 'active root uses the selected-tab blue');
      assert.equal(await second.locator('.arpeggio-root').getAttribute('aria-pressed'), 'false');
      await first.getByRole('tab', { name: 'menor', exact: true }).click();
      assert.equal(await first.locator('ascii-tabs:visible').getAttribute('notation'), 'solfege');
      await rootToggle.focus();
      await page.keyboard.press('Space');
      assert.equal(await rootToggle.getAttribute('aria-pressed'), 'false');
      assert.equal(await firstTab.textContent(), fretText, 'toggle restores the original fret digits');
      await first.getByRole('tab', { name: 'mayor', exact: true }).click();
      const viewSwitch = first.getByRole('switch');
      assert.equal(await page.getByRole('switch', { checked: true }).count(), 13);
      assert.equal(await first.locator('.arpeggio-diagrams:visible').count(), 0);
      await viewSwitch.click();
      assert.equal(await viewSwitch.getAttribute('aria-checked'), 'false');
      assert.equal(await first.locator('ascii-tabs:visible').count(), 0);
      assert.deepEqual(await first.locator('.arpeggio-diagrams:visible .name').allTextContents(), arpeggioGroup('C', 'Major')[3]);
      assert.equal(await second.getByRole('switch').getAttribute('aria-checked'), 'true');
      assert.equal(await second.locator('ascii-tabs:visible').count(), 1);
      await first.getByRole('tab', { name: 'menor', exact: true }).click();
      assert.deepEqual(await first.locator('.arpeggio-diagrams:visible .name').allTextContents(), arpeggioGroup('C', 'Minor')[3]);
      await viewSwitch.focus();
      await page.keyboard.press('Space');
      assert.equal(await viewSwitch.getAttribute('aria-checked'), 'true');
      assert.equal(await first.locator('ascii-tabs:visible').count(), 1);
      await first.getByRole('tab', { name: '7', exact: true }).click();
      assert.equal(await first.locator('.arpeggio-block-label').textContent(), 'Con 7ma, pero sin 5ta');
      assert.equal(await first.locator('ascii-tabs:visible').count(), 2, 'both seventh blocks show tablature');
      await viewSwitch.click();
      assert.equal(await first.locator('ascii-tabs:visible').count(), 0);
      assert.equal(await first.locator('.arpeggio-diagrams:visible').count(), 2, 'both seventh blocks show diagrams');
      assert.deepEqual(await first.locator('.arpeggio-diagrams:visible').last().locator('.name').allTextContents(), arpeggioGroup('C', 'SeventhNoFifth')[3]);
      // Every search resets all roots to tablature, including hidden roots.
      await second.getByRole('switch').click();
      await groups.last().getByRole('switch').click();
      await page.locator('.arpeggio-search-toggle').click();
      await rootToggle.click();
      await page.locator('.arpeggio-search ascii-tabs').evaluate(async (el) => {
        const change = (fret) => el.dispatchEvent(new CustomEvent('change', { detail: { value: [[[fret, null, null, null, null, null]]] } }));
        change(19);
        await new Promise((resolve) => setTimeout(resolve, 100));
        change(18);
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      assert.equal(await page.locator('.arpeggio-results').count(), 0, 'typing restarts the debounce before rendering');
      await page.locator('.arpeggio-search-clear').evaluate((el) => el.click());
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.arpeggio-group:visible').count(), 13, 'clearing cancels a pending search');
      assert.equal(await page.locator('.arpeggio-results').count(), 0);
      await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => new Promise((resolve) => {
        const first = document.querySelector('.arpeggio-group');
        const observer = new MutationObserver(() => {
          if (!first.classList.contains('is-filtering')) return;
          observer.disconnect();
          // Replace the query while the previous search is between roots.
          el.dispatchEvent(new CustomEvent('change', { detail: { value: [[[19, null, null, null, null, null]]] } }));
          resolve();
        });
        observer.observe(first, { attributes: true, attributeFilter: ['class'] });
        el.dispatchEvent(new CustomEvent('change', { detail: { value: [[[0, null, null, null, null, null]]] } }));
      }));
      await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('.arpeggio-group:visible').count(), 0, 'a newer query cancels the search already rendering');
      await page.locator('.arpeggio-search-clear').evaluate((el) => el.click());
      await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => {
        el.dispatchEvent(new CustomEvent('change', { detail: { value: [[[0, null, null, null, null, null]]] } }));
      });
      await page.keyboard.press('Escape');
      await page.locator('h1').click();
      await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
      const expected = await page.evaluate(() => JSON.parse(document.getElementById('arpeggio-search-data').textContent).roots[0].chords.filter((chord) => chord.form[0] === 0).map((chord) => chord.name));
      assert.equal(await viewSwitch.isVisible(), true);
      assert.equal(await page.getByRole('switch', { checked: true, includeHidden: true }).count(), 13);
      assert.equal(await first.locator('.arpeggio-results ascii-tabs').isVisible(), true);
      assert.equal(await first.locator('.arpeggio-results ascii-tabs').getAttribute('notation'), 'solfege', 'new search results inherit note mode');
      await rootToggle.click();
      assert.equal(await first.locator('.arpeggio-results ascii-tabs').getAttribute('notation'), 'frets');
      await viewSwitch.click();
      assert.deepEqual(await first.locator('.arpeggio-results .arpeggio-diagrams:visible .name').allTextContents(), expected);
      await viewSwitch.click();
      assert.equal(await first.locator('.arpeggio-results ascii-tabs').isVisible(), true);
      await viewSwitch.click();
      await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => {
        el.dispatchEvent(new CustomEvent('change', { detail: { value: [[[null, 1, null, null, null, null]]] } }));
      });
      await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
      assert.equal(await page.getByRole('switch', { checked: true, includeHidden: true }).count(), 13, 'editing the query resets the view again');
      assert.equal(await first.locator('.arpeggio-results ascii-tabs').isVisible(), true);
      await viewSwitch.click();
      await page.locator('.arpeggio-search-toggle').click();
      assert.equal(await page.getByRole('switch', { checked: true, includeHidden: true }).count(), 13);
      assert.equal(await first.locator('[role="tabpanel"]:visible ascii-tabs:visible').count(), 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'representations fit viewport');
      await page.reload();
      assert.equal(await page.getByRole('switch', { checked: true }).count(), 13, 'switch state is volatile');
      await page.locator('.arpeggio-search-toggle').click();
      await page.waitForFunction(() => document.activeElement?.classList.contains('ascii-tabs-input'));
      await page.keyboard.type('1');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.arpeggio-results:not([hidden]) ascii-tabs')).every((tab) => parseFloat(getComputedStyle(tab).fontSize) >= 16));
      const searchRows = await page.locator('.arpeggio-group:visible').evaluateAll((groups) => groups.map((group) => {
        const result = group.querySelector('.arpeggio-results');
        const tab = result.querySelector('ascii-tabs');
        return {
          root: group.querySelector('.arpeggio-root').textContent,
          font: parseFloat(getComputedStyle(tab).fontSize),
          names: Array.from(tab.querySelectorAll('.arpeggio-chord'), (button) => button.textContent),
          rows: Array.from(tab.querySelectorAll('.ascii-tabs-staff'), (staff) => staff.querySelectorAll('.arpeggio-chord').length),
        };
      }));
      assert.ok(searchRows.some((group) => group.names.length > 6), 'reproduces a long result group');
      for (const group of searchRows) {
        assert.ok(group.rows.every((count) => count <= 6), group.root + ' wraps at six chords');
        if (group.names.length > 6) assert.ok(group.rows.length > 1);
        if (width === 1280) assert.deepEqual(group.rows, Array.from({ length: Math.ceil(group.names.length / 6) }, (_, i) => Math.min(6, group.names.length - i * 6)), 'desktop groups six chords per row');
        assert.ok(group.font >= 16, 'readable search font');
      }
      const namesByRoot = await page.evaluate(() => JSON.parse(document.getElementById('arpeggio-search-data').textContent).roots.map((root) => root.chords.filter((chord) => chord.form[0] === 1).map((chord) => chord.name)).filter((names) => names.length));
      assert.deepEqual(searchRows.map((group) => group.names), namesByRoot, 'wrap preserves every chord and its order');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'wrapped search fits viewport');
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
