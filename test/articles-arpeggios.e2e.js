'use strict';
const assert = require('node:assert/strict');
const { pagePath } = require('../scripts/lib/slugs');
const { GROUPS: ARPEGGIOS } = require('../scripts/lib/article-arpeggios');
const { run } = require('./articles-harness');

const arpeggioGroup = (root, quality) => ARPEGGIOS.find((group) => group[1] === root && group[2] === quality);

run('articles-arpeggios', async ({ base, page }) => {
  await require('./arpeggio-layout.e2e')();
  // Arpeggio positions: qualities share accessible tabs per root.
  for (const locale of ['es', 'en']) {
    const url = pagePath('articulo-tablaturas-arpegios', locale);
    await page.goto(base + url);
    await page.waitForSelector('.arpeggio-group ascii-tabs .ascii-tabs-tab');
    assert.equal(await page.locator('h1').textContent(), locale === 'es' ? 'Tablaturas para arpegios' : 'Tabs for arpeggios');
    assert.equal(await page.locator('.lead a').getAttribute('href'), pagePath('articulo-carcassi', locale));
    assert.equal(await page.locator('.sequence-forms ascii-tabs[readonly]').count(), 87);
    const titles = await page.locator('.arpeggio-group figcaption').allTextContents();
    assert.deepEqual(titles.slice(0, 3), locale === 'es' ? ['Do mayor', 'Do menor', 'Do 7'] : ['C major', 'C minor', 'C 7']);
    const groups = await page.locator('.arpeggio-group ascii-tabs').evaluateAll((els) => els.map((el) => el.value.flat().filter((column) => column.some((f) => f !== null)).map((column) => column.map((note) => note === null ? null : typeof note === 'object' ? note.fret : note))));
    // Include every staff: long groups wrap after six forms.
    const groupIds = await page.locator('.arpeggio-group ascii-tabs').evaluateAll((els) => els.map((el) => Number(el.querySelector('.arpeggio-chord').getAttribute('popovertarget').match(/^arpeggio-chord-(\d+)-/)[1])));
    assert.deepEqual(groups, groupIds.map((id) => ARPEGGIOS[id][4]));
    groups.flat().forEach((form) => assert.equal(form.filter((f) => f !== null).length, 4));
    assert.deepEqual(await page.locator('#arpeggio-E-panel-2 ascii-tabs').first().evaluate((el) => el.value.flat().filter((column) => column.some((note) => note !== null)).map((column) => column.map((note) => note === null ? null : note.fret))), arpeggioGroup('E', 'Seventh')[4]);
    assert.equal(await page.locator('ascii-tabs[variant="flat"]').count(), groups.length);
    // Only the bass (the lowest sounding string of each chord) is bold.
    const weights = await page.locator('ascii-tabs').evaluateAll((tabs) => tabs.flatMap((tab) => {
      const cells = [...tab.querySelectorAll('.ascii-tabs-has')];
      return cells.map((cell) => ({
        bass: Number(cell.dataset.s) === Math.max(...cells.filter((other) => other.dataset.t === cell.dataset.t && other.dataset.c === cell.dataset.c).map((other) => Number(other.dataset.s))),
        weight: getComputedStyle(cell.querySelector('.ascii-tabs-fret')).fontWeight,
      }));
    }));
    assert.ok(weights.length > 0);
    weights.forEach(({ bass, weight }) => assert.equal(weight, bass ? '700' : '400'));
    if (locale === 'es') assert.match(await page.locator('.lead a').textContent(), /^descomposición/);
    // The names are annotation buttons above the strings, without underline.
    assert.deepEqual(await page.locator('#arpeggio-D-panel-2 ascii-tabs').first().locator('.ascii-tabs-annotations .arpeggio-chord').allTextContents(), arpeggioGroup('D', 'Seventh')[3]);
    // The white paper starts below the names.
    const [nameBottom, paperTop] = await page.locator('.arpeggio-group ascii-tabs').first().evaluate((el) => [
      el.querySelector('.arpeggio-chord').getBoundingClientRect().bottom,
      el.querySelector('.ascii-tabs-staff').getBoundingClientRect().bottom - parseFloat(getComputedStyle(el.querySelector('.ascii-tabs-staff'), '::before').height),
    ]);
    assert.ok(nameBottom <= paperTop + 1,'chord names sit above the paper');
    assert.equal(await page.locator('.arpeggio-chord').first().evaluate((el) => getComputedStyle(el).textDecorationLine), 'none');
    assert.deepEqual(await page.locator('#arpeggio-D-panel-2 ascii-tabs').first().evaluate((el) => el.value.flat().filter((column) => column.some((note) => note !== null)).map((column) => column.map((note) => note === null ? null : note.fret))), arpeggioGroup('D', 'Seventh')[4]);
    assert.equal(await page.locator('.arpeggio-group').count(), 13);

    // Note search: typed frets keep every chord of each root that has them, in one tab per root.
    const toggle = page.locator('.arpeggio-search-toggle');
    assert.equal(await page.locator('.arpeggio-search-popup').isHidden(), true);
    await toggle.click();
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ascii-tabs-input'));
    await page.keyboard.type('0');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('1');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => el.value[0].length), 1);
    await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
    const expectedSearchRoots = [...new Set(ARPEGGIOS.filter((group) => group[4].some((form) => form[0] === 0 && form[1] === 1)).map((group) => locale === 'es' ? group[0] : group[1]))];
    const visibleSearchRoots = await page.locator('.arpeggio-group:visible .arpeggio-root').allTextContents();
    assert.deepEqual([...visibleSearchRoots].sort(), expectedSearchRoots.sort());
    const expectedCSearch = ARPEGGIOS.filter((group) => group[1] === 'C').flatMap((group) => group[3].filter((name, i) => group[4][i][0] === 0 && group[4][i][1] === 1));
    assert.deepEqual(await page.locator('.arpeggio-group:visible').first().locator('.arpeggio-results .arpeggio-chord').allTextContents(), expectedCSearch);
    assert.equal(await page.locator('.arpeggio-group:visible [role="tabpanel"]:visible').count(), 0);
    assert.equal(await page.locator('#arpeggio-results-title').isVisible(), true);
    assert.equal(await page.locator('#arpeggio-no-results').isHidden(), true);
    await page.keyboard.type('9');
    await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('.arpeggio-group:visible').count(), 0);
    assert.equal(await page.locator('#arpeggio-no-results').isVisible(), true);
    await page.keyboard.press('Backspace');
    await page.mouse.click(10, 700);
    assert.equal(await page.locator('.arpeggio-search-popup').isHidden(), true);
    await page.waitForFunction(() => document.querySelector('.arpeggio-search').getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('.arpeggio-group:visible').count(), expectedSearchRoots.length);
    await toggle.click();
    assert.equal(await page.locator('.arpeggio-group:visible').count(), 13);
    assert.equal(await page.locator('#arpeggio-results-title').isHidden(), true);
    assert.equal(await page.locator('.arpeggio-group:visible [role="tabpanel"]:visible').count(), 13);
    assert.equal(await toggle.getAttribute('aria-label'), locale === 'es' ? 'Buscar por notas' : 'Search by notes');
    assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 13);
    // Footer button: clears the typed notes, keeps the popup open and puts the cursor back on the first string.
    await toggle.click();
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ascii-tabs-input'));
    await page.keyboard.type('0');
    await page.locator('.arpeggio-search-clear').click();
    assert.equal(await page.locator('.arpeggio-group:visible').count(), 13);
    assert.equal(await page.locator('.arpeggio-search-popup').isVisible(), true);
    assert.equal(await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => (el.value[0][0] || []).every((n) => n === null)), true);
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ascii-tabs-input'));
    await toggle.click();
    for (const [root, quality, chordNotes] of [
      ['C', 'MinorSeventh', [0, 3, 7, 10]],
      ['D', 'MinorSeventh', [2, 5, 9, 0]],
      ['E', 'MinorSeventh', [4, 7, 11, 2]],
      ['F', 'MinorSeventh', [5, 8, 0, 3]],
      ['G', 'MinorSeventh', [7, 10, 2, 5]],
      ['A', 'MinorSeventh', [9, 0, 4, 7]],
      ['B', 'MinorSeventh', [11, 2, 6, 9]],
      ['F', 'Minor', [5, 8, 0]],
      ['F', 'Seventh', [5, 9, 0, 3]],
      ['G', 'Minor', [7, 10, 2]],
      ['A', 'Seventh', [9, 1, 4, 7]],
      ['B', 'Minor', [11, 2, 6]],
      ['B', 'Seventh', [11, 3, 6, 9]],
    ]) {
      const names = arpeggioGroup(root, quality)[3];
      const expectedForms = arpeggioGroup(root, quality)[4];
      const bassNotes = expectedForms.map((form) => Math.min(...form.flatMap((fret, string) => fret === null ? [] : [[64, 59, 55, 50, 45, 40][string] + fret])) % 12);
      const label = require('../src/i18n/strings.' + locale + '.json')['artArpeggios' + quality];
      await page.locator('#arpeggio-' + root + '-root').locator('..').getByRole('tab', { name: label, exact: true }).click();
      const panel = page.locator('.arpeggio-group').filter({ has: page.locator('#arpeggio-' + root + '-root') }).locator('[role="tabpanel"]:visible');
      assert.deepEqual(await panel.locator('ascii-tabs').first().locator('.arpeggio-chord').allTextContents(), names);
      const forms = await panel.locator('ascii-tabs').first().evaluate((el) => el.value.flat().filter((column) => column.some((note) => note !== null)));
      if (root === 'A' && quality === 'Seventh') {
        assert.deepEqual(forms[1].map((note) => note === null ? null : note.fret), [null, 2, 0, 2, 0, null]);
      }
      forms.forEach((form, i) => {
        const pitches = form.map((note, string) => note === null ? null : ([64, 59, 55, 50, 45, 40][string] + note.fret));
        const sounding = pitches.filter((pitch) => pitch !== null);
        assert.equal(sounding.length, 4);
        assert.deepEqual([...new Set(sounding.map((pitch) => pitch % 12))].sort((a, b) => a - b), [...chordNotes].sort((a, b) => a - b), names[i] + ' contains every chord tone');
        assert.equal(Math.min(...sounding) % 12, bassNotes[i], names[i] + ' bass');
        assert.ok(sounding.some((pitch) => pitch % 12 === chordNotes[1]), names[i] + ' third');
        if (quality.endsWith('Seventh')) assert.ok(sounding.some((pitch) => pitch % 12 === chordNotes[3]), names[i] + ' seventh');
      });
    }
    const firstGroup = page.locator('.arpeggio-group').first();
    const qualityTabs = firstGroup.getByRole('tab');
    await qualityTabs.first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await qualityTabs.nth(1).getAttribute('aria-selected'), 'true');
    assert.ok(await qualityTabs.nth(1).evaluate((el) => el === document.activeElement));
    assert.deepEqual(await firstGroup.locator('[role="tabpanel"]:visible .arpeggio-chord').allTextContents(), arpeggioGroup('C', 'Minor')[3]);
    await page.keyboard.press('End');
    assert.equal(await qualityTabs.nth(5).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await qualityTabs.first().getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await qualityTabs.nth(5).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await qualityTabs.first().getAttribute('aria-selected'), 'true');
    // Every annotation opens its own exact four-string fingering, including inversions.
    const buttons = page.locator('[role="tabpanel"] .arpeggio-chord');
    assert.equal(await buttons.count(), groups.flat().length);
    for (let i = 0; i < await buttons.count(); i++) {
      const button = buttons.nth(i);
      const name = await button.textContent();
      const target = await button.getAttribute('popovertarget');
      const panel = button.locator('xpath=ancestor::*[@role="tabpanel"]');
      const tabId = await panel.getAttribute('aria-labelledby');
      await page.locator('[id="' + tabId + '"]').click();
      await button.click();
      const popup = page.locator('#' + target);
      assert.ok(await popup.evaluate((el) => el.matches(':popover-open')));
      await popup.locator('.finder-card svg').waitFor();
      assert.equal(await popup.locator('.finder-card .name').textContent(), name);
      assert.ok(await popup.locator('.finder-card').evaluate((el) => el.getBoundingClientRect().width <= 180));
      await popup.locator('button').click();
      assert.ok(!(await popup.evaluate((el) => el.matches(':popover-open'))));
    }
    await qualityTabs.first().click();
    // The annotation is keyboard operable; Escape dismisses and returns focus.
    await buttons.first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.chord-popover:popover-open').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.chord-popover:popover-open').count(), 0);
    assert.ok(await buttons.first().evaluate((el) => el === document.activeElement));
    // Clicking outside dismisses the native popup.
    await buttons.first().click();
    await page.locator('h1').click();
    assert.equal(await page.locator('.chord-popover:popover-open').count(), 0);
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      // Resizing reflows over the next frames, so wait instead of sampling once.
      await page.waitForFunction(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      for (const tab of await page.getByRole('tab').all()) {
        await tab.click();
        // A revealed panel lays its annotations out on the next frames.
        await page.waitForFunction(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      }
      // Native annotations are centred on the fret, including after resizing.
      await page.waitForFunction(() => Array.from(document.querySelectorAll('.ascii-tabs-annotation')).every((annotation) => {
        const staff = annotation.closest('.ascii-tabs-staff');
        const fret = staff.querySelector('.ascii-tabs-cell[data-c="' + annotation.dataset.column + '"] .ascii-tabs-fret');
        const box = annotation.getBoundingClientRect();
        const target = fret.getBoundingClientRect();
        return Math.abs(box.left + box.width / 2 - (target.left + target.width / 2)) < 1;
      }));
    }
    await page.setViewportSize({ width: 375, height: 800 });
  }
});
