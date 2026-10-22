'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');
const { publishedPreludes, santisteban } = require('../scripts/lib/article-carcassi-preludes');
const progressive = require('../scripts/lib/article-carcassi-progressive');
const aguado = require('../scripts/lib/article-aguado');
const sagreras = require('../scripts/lib/article-sagreras');
const sor = require('../scripts/lib/article-sor');
const sorEstudios = require('../scripts/lib/article-sor-estudios');

const DIST = path.join(__dirname, '..', 'dist/site');
const BASE_URL = 'https://acordesdeguitarra.com.ar';
const PDFS = [
  'Allegretto in C - Matteo Carcassi · (1792—1853).pdf',
  'Prelude A Minor, Op.59 - Matteo Carcassi.pdf',
];

(async function () {
  const server = await serveStatic(DIST, 0);
  let browser;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'articles-e2e-'));
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const base = 'http://localhost:' + server.address().port;
    const context = await browser.newContext({ viewport: { width: 375, height: 800 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const locale of ['es', 'en']) {
      const index = pagePath('articulos', locale);
      const article = pagePath('articulo-carcassi', locale);

      // Index: one card per article, linking to it.
      await page.goto(base + index);
      assert.equal(await page.locator('.article-card').count(), 10);
      assert.equal(await page.locator('.article-card').first().getAttribute('href'), article);
      assert.equal(await page.locator('.article-card').nth(1).getAttribute('href'), pagePath('articulo-preludios-carcassi', locale));
      assert.match(await page.locator('.article-card p').first().textContent(), /Carcassi/);
      const arpeggiosImage = page.locator('.article-card').nth(2).locator('img');
      assert.match(await arpeggiosImage.getAttribute('src'), /^\/assets\/articles\/arpeggios\/preview(?:\.[a-f0-9]+)?\.svg$/);
      await arpeggiosImage.evaluate((img) => img.decode());
      // No text link in the list besides the cards (the banner is the link).
      assert.equal(await page.locator('main a[href*="preludios"], main a[href*="preludes"]').count(), 2);

      // Article: static examples, no horizontal scroll on mobile.
      await page.goto(base + article);
      const pdfs = locale === 'es' ? PDFS.concat('Prelude 1 in C Major - Matteo Carcassi.pdf') : PDFS;
      assert.equal(await page.locator('.example-card .score-svg').count(), pdfs.length);
      assert.equal(await page.locator('.chord-card').count(), 2);
      // Chord cards are the finder's component: narrow, with the chord name.
      await page.waitForSelector('.chord-card .finder-card svg');
      assert.equal(await page.locator('.chord-card .finder-card').count(), 2);
      assert.ok(await page.locator('.chord-card .finder-card').first().evaluate((el) => el.getBoundingClientRect().width <= 180));
      assert.equal(await page.locator('.chord-card .finder-card .name').first().textContent(), 'C');
      // Tabs are read-only <ascii-tabs>: no copy button, no hint, no `x` marks.
      await page.waitForSelector('ascii-tabs .ascii-tabs-tab');
      assert.equal(await page.locator('pre').count(), 0);
      assert.equal(await page.locator('.ascii-tabs-copy, .ascii-tabs-hint').count(), 0);
      assert.ok(!(await page.locator('main').textContent()).includes(' x '));
      // The four Prelude chords share one tab per form: full, easy E7, Carcassi.
      const values = await page.locator('.sequence-forms ascii-tabs').evaluateAll((els) => els.map((el) => el.value[0].filter((c) => c.some((f) => f !== null))));
      assert.equal(values.length, 3);
      values.forEach((chords) => assert.equal(chords.length, 4));
      // Only the E7 changes between the two decomposed sequences.
      assert.deepEqual(values[1].slice(0, 3), values[2].slice(0, 3));
      assert.deepEqual(values[1][3], [0, 0, 1, null, null, 0]);
      assert.deepEqual(values[2][3], [0, 3, 1, null, 2, null]);
      // Letter labels on the strings.
      assert.match(await page.locator('.sequence-forms ascii-tabs').first().locator('.ascii-tabs-tab').first().innerText(), /^e\|/);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + article);
      // The score cards fit inside the viewport.
      const boxes = await page.locator('.example-card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      boxes.forEach((right) => assert.ok(right <= 375, 'tarjeta fuera del viewport'));

      // The shared C-major example must agree with the original edition's G7/B.
      if (locale === 'es') {
        const forms = await page.locator('.bass-forms ascii-tabs').last().evaluate((el) => el.value[0].filter((c) => c.some((f) => f !== null)));
        const sounding = forms[1].flatMap((f, i) => f === null ? [] : [[64, 59, 55, 50, 45, 40][i] + f]).sort((a, b) => a - b);
        const xml = fs.readFileSync(path.join(__dirname, '../scripts/carcassi-preludios/corrected/prelude-01.musicxml'), 'utf8');
        const measure = [...xml.matchAll(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g)][3][1];
        const pitches = new Set();
        let offset = 0;
        for (const [, tag, content] of measure.matchAll(/<(note|backup)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
          const duration = Number(content.match(/<duration>(\d+)<\/duration>/)[1]);
          if (tag === 'backup') { offset -= duration; continue; }
          const step = content.match(/<step>([A-G])<\/step>/);
          if (step && offset >= 8) {
            const octave = Number(content.match(/<octave>(\d)<\/octave>/)[1]);
            const alter = Number((content.match(/<alter>(-?\d+)<\/alter>/) || [null, 0])[1]);
            pitches.add(12 * octave + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step[1]] + alter);
          }
          offset += duration;
        }
        assert.deepEqual(sounding, [...pitches].sort((a, b) => a - b));
      }

      // Only analytics, ascii-tabs and the site's own chord card scripts: the scores are static SVG.
      const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((el) => el.src));
      assert.ok(scripts.every((src) => src.includes('googletagmanager') || /vendor\/(ascii-tabs|svguitar)|\/assets\/chord-(diagram|card)/.test(src)), scripts.join(','));

      // Each card downloads its score PDF.
      const cards = page.locator('.example-card');
      for (let i = 0; i < pdfs.length; i++) {
        const [download] = await Promise.all([page.waitForEvent('download'), cards.nth(i).click()]);
        assert.equal(download.suggestedFilename(), pdfs[i]);
        const saved = path.join(tmp, 'download-' + i + '.pdf');
        await download.saveAs(saved);
        assert.equal(fs.readFileSync(saved).subarray(0, 4).toString(), '%PDF');
      }

      // Canonical and hreflang pair.
      const links = await page.locator('link[rel=canonical], link[rel=alternate]').evaluateAll((els) => els.map((el) => [el.getAttribute('hreflang'), el.href]));
      assert.ok(links.some(([, href]) => href === BASE_URL + article));
      assert.ok(links.some(([lang, href]) => lang === 'es' && href === BASE_URL + pagePath('articulo-carcassi', 'es')));
      assert.ok(links.some(([lang, href]) => lang === 'en' && href === BASE_URL + pagePath('articulo-carcassi', 'en')));
    }

    // Arpeggio positions: qualities share accessible tabs per root.
    for (const locale of ['es', 'en']) {
      const url = pagePath('articulo-tablaturas-arpegios', locale);
      await page.goto(base + url);
      await page.waitForSelector('.arpeggio-group ascii-tabs .ascii-tabs-tab');
      assert.equal(await page.locator('h1').textContent(), locale === 'es' ? 'Tablaturas para arpegios' : 'Tabs for arpeggios');
      assert.equal(await page.locator('.lead a').getAttribute('href'), pagePath('articulo-carcassi', locale));
      assert.equal(await page.locator('ascii-tabs[readonly]').count(), 45);
      const titles = await page.locator('.arpeggio-group figcaption').allTextContents();
      assert.deepEqual(titles.slice(0, 3), locale === 'es' ? ['Do mayor', 'Do menor', 'Do 7'] : ['C major', 'C minor', 'C 7']);
      const groups = await page.locator('.arpeggio-group ascii-tabs').evaluateAll((els) => els.map((el) => el.value[0].filter((column) => column.some((f) => f !== null)).map((column) => column.map((note) => note === null ? null : typeof note === 'object' ? note.fret : note))));
      groups.flat().forEach((form) => assert.equal(form.filter((f) => f !== null).length, 4));
      assert.deepEqual(groups[14][1], [0, 3, 1, null, 2, null]);
      assert.equal(await page.locator('ascii-tabs[variant="flat"]').count(), groups.length);
      const weights = await page.locator('.ascii-tabs-has').evaluateAll((cells) => cells.map((cell) => ({
        string: Number(cell.dataset.s),
        weight: getComputedStyle(cell.querySelector('.ascii-tabs-fret')).fontWeight,
      })));
      weights.forEach(({ string, weight }) => assert.equal(weight, string >= 3 ? '700' : '400'));
      if (locale === 'es') assert.match(await page.locator('.lead a').textContent(), /^descomposición/);
      // The names are annotation buttons above the strings, without underline.
      assert.deepEqual(await page.locator('.arpeggio-group ascii-tabs').nth(8).locator('.ascii-tabs-annotations .arpeggio-chord').allTextContents(), ['D7', 'D7/F#', 'D7/A', 'D7/C']);
      // The white paper starts below the names.
      const [nameBottom, paperTop] = await page.locator('.arpeggio-group ascii-tabs').first().evaluate((el) => [
        el.querySelector('.arpeggio-chord').getBoundingClientRect().bottom,
        el.querySelector('.ascii-tabs-staff').getBoundingClientRect().bottom - parseFloat(getComputedStyle(el.querySelector('.ascii-tabs-staff'), '::before').height),
      ]);
      assert.ok(nameBottom <= paperTop + 1,'chord names sit above the paper');
      assert.equal(await page.locator('.arpeggio-chord').first().evaluate((el) => getComputedStyle(el).textDecorationLine), 'none');
      assert.deepEqual(groups[8], [
        [2, 1, 2, 0, null, null], [2, 1, 2, 4, null, null],
        [2, 1, 2, null, 0, null], [2, 1, 2, null, 3, null],
      ]);
      assert.equal(await page.locator('.arpeggio-group').count(), 8);

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
      assert.deepEqual(await page.locator('.arpeggio-group:visible .arpeggio-root').allTextContents(), locale === 'es' ? ['Do', 'Fa', 'La'] : ['C', 'F', 'A']);
      assert.deepEqual(await page.locator('.arpeggio-group:visible').first().locator('.arpeggio-results .arpeggio-chord').allTextContents().then((names) => names.slice(0, 3)), ['C', 'C/E', 'C/G']);
      assert.equal(await page.locator('.arpeggio-group:visible [role="tabpanel"]:visible').count(), 0);
      assert.equal(await page.locator('#arpeggio-results-title').isVisible(), true);
      assert.equal(await page.locator('#arpeggio-no-results').isHidden(), true);
      await page.keyboard.type('9');
      assert.equal(await page.locator('.arpeggio-group:visible').count(), 0);
      assert.equal(await page.locator('#arpeggio-no-results').isVisible(), true);
      await page.keyboard.press('Backspace');
      await page.mouse.click(10, 700);
      assert.equal(await page.locator('.arpeggio-search-popup').isHidden(), true);
      assert.equal(await page.locator('.arpeggio-group:visible').count(), 3);
      await toggle.click();
      assert.equal(await page.locator('.arpeggio-group:visible').count(), 8);
      assert.equal(await page.locator('#arpeggio-results-title').isHidden(), true);
      assert.equal(await page.locator('.arpeggio-group:visible [role="tabpanel"]:visible').count(), 8);
      assert.equal(await toggle.getAttribute('aria-label'), locale === 'es' ? 'Buscar por notas' : 'Search by notes');
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 8);
      // Footer button: clears the typed notes, keeps the popup open and puts the cursor back on the first string.
      await toggle.click();
      await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ascii-tabs-input'));
      await page.keyboard.type('0');
      await page.locator('.arpeggio-search-clear').click();
      assert.equal(await page.locator('.arpeggio-group:visible').count(), 8);
      assert.equal(await page.locator('.arpeggio-search-popup').isVisible(), true);
      assert.equal(await page.locator('.arpeggio-search ascii-tabs').evaluate((el) => (el.value[0][0] || []).every((n) => n === null)), true);
      await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ascii-tabs-input'));
      await toggle.click();
      for (const [root, quality, names, chordNotes, bassNotes] of [
        ['C', 'MinorSeventh', ['Cm7', 'Cm7/Eb', 'Cm7/G', 'Cm7/Bb'], [0, 3, 7, 10], [0, 3, 7, 10]],
        ['D', 'MinorSeventh', ['Dm7', 'Dm7/F', 'Dm7/A', 'Dm7/C'], [2, 5, 9, 0], [2, 5, 9, 0]],
        ['E', 'MinorSeventh', ['Em7', 'Em7/G', 'Em7/B', 'Em7/D'], [4, 7, 11, 2], [4, 7, 11, 2]],
        ['F', 'MinorSeventh', ['Fm7', 'Fm7/Ab', 'Fm7/C', 'Fm7/Eb'], [5, 8, 0, 3], [5, 8, 0, 3]],
        ['G', 'MinorSeventh', ['Gm7', 'Gm7/Bb', 'Gm7/D', 'Gm7/F'], [7, 10, 2, 5], [7, 10, 2, 5]],
        ['A', 'MinorSeventh', ['Am7', 'Am7/C', 'Am7/E', 'Am7/G'], [9, 0, 4, 7], [9, 0, 4, 7]],
        ['B', 'MinorSeventh', ['Bm7', 'Bm7/D', 'Bm7/F#', 'Bm7/A'], [11, 2, 6, 9], [11, 2, 6, 9]],
        ['F', 'Minor', ['Fm', 'Fm/Ab', 'Fm/C'], [5, 8, 0], [5, 8, 0]],
        ['F', 'Seventh', ['F7', 'F7/A', 'F7/C', 'F7/Eb'], [5, 9, 0, 3], [5, 9, 0, 3]],
        ['G', 'Minor', ['Gm', 'Gm/Bb', 'Gm/D'], [7, 10, 2], [7, 10, 2]],
        ['A', 'Seventh', ['A7', 'A7', 'A7/C#', 'A7/E', 'A7/G'], [9, 1, 4, 7], [9, 9, 1, 4, 7]],
        ['B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#'], [11, 2, 6], [11, 2, 6]],
        ['B', 'Seventh', ['B7', 'B7', 'B7/D#', 'B7/F#', 'B7/F#'], [11, 3, 6, 9], [11, 11, 3, 6, 6]],
      ]) {
        const label = require('../src/i18n/strings.' + locale + '.json')['artArpeggios' + quality];
        await page.locator('#arpeggio-' + root + '-root').locator('..').getByRole('tab', { name: label, exact: true }).click();
        const panel = page.locator('.arpeggio-group').filter({ has: page.locator('#arpeggio-' + root + '-root') }).locator('[role="tabpanel"]:visible');
        assert.deepEqual(await panel.locator('.arpeggio-chord').allTextContents(), names);
        const forms = await panel.locator('ascii-tabs').evaluate((el) => el.value[0].filter((column) => column.some((note) => note !== null)));
        if (root === 'A' && quality === 'Seventh') {
          assert.deepEqual(forms[1].map((note) => note === null ? null : note.fret), [3, 2, 0, null, 0, null]);
        }
        forms.forEach((form, i) => {
          const pitches = form.map((note, string) => note === null ? null : ([64, 59, 55, 50, 45, 40][string] + note.fret));
          const sounding = pitches.filter((pitch) => pitch !== null);
          assert.equal(sounding.length, 4);
          sounding.forEach((pitch) => assert.ok(chordNotes.includes(pitch % 12), names[i] + ' uses chord tones'));
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
      assert.deepEqual(await firstGroup.locator('[role="tabpanel"]:visible .arpeggio-chord').allTextContents(), ['Cm', 'Cm/Eb', 'Cm/G']);
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
        await page.locator('#' + tabId).click();
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

    // Carcassi preludes: one card per published prelude, in numeric order.
    for (const [editionKey, catalog, otherKey] of [
      ['articulo-preludios-carcassi', { publishedPreludes }, 'articulo-preludios-santisteban'],
      ['articulo-preludios-santisteban', santisteban, 'articulo-preludios-carcassi'],
    ]) {
      const published = catalog.publishedPreludes();
      for (const locale of ['es', 'en']) {
        const url = pagePath(editionKey, locale);
        await page.goto(base + url);
        assert.equal(await page.locator('.article-back a[href="' + pagePath(otherKey, locale) + '"]').count(), 1);
        assert.ok(await page.locator('.article-back a[href="' + pagePath(otherKey, locale) + '"]').evaluate((link) => Boolean(document.querySelector('.prelude-grid').compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING)));
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        titles.forEach((title, i) => assert.match(title, new RegExp('^' + (locale === 'es' ? 'Preludio ' : 'Prelude ') + published[i].number + ' (en|in) ')));
        // Inline static SVG with alternative text naming the prelude; no extra JS.
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        const alts = await cards.locator('svg.score-svg').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
        alts.forEach((alt, i) => assert.ok(alt.includes(titles[i]), alt));
        const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((el) => el.src));
        assert.ok(scripts.every((src) => src.includes('googletagmanager')), scripts.join(','));
        // Fits the phone viewport without horizontal scroll.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
        const rights = await cards.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
        rights.forEach((right) => assert.ok(right <= 375, 'tarjeta fuera del viewport'));
        // On a phone the card does not open the preview: its title downloads the PDF directly.
        assert.equal(await cards.first().locator('.prelude-open').isVisible(), false);
        assert.equal(decodeURIComponent(await cards.first().locator('.prelude-pdf-link').getAttribute('href')).split('/').pop(), published[0].pdf);
        {
          const tab = await context.newPage();
          await tab.setViewportSize({ width: 375, height: 800 });
          await tab.goto(base + url);
          const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card').first().click()]);
          assert.equal(download.suggestedFilename(), published[0].pdf);
          assert.equal(await tab.locator('.modal-full:popover-open').count(), 0);
          await tab.close();
        }
        // On desktop, clicking the card opens a full-screen modal with the score pages (SVG), requested only on open; the X closes it.
        const fullRequests = () => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/full/')).length);
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 1280, height: 800 });
        // (Blink loads lazy images that are already in its memory cache, so only the first visit is checked.)
        if (locale === 'es') assert.equal(await fullRequests(), 0);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const box = await modal.evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
        assert.deepEqual(box, [1280, 800]);
        // The footer sits at the bottom of the viewport even though the score is short, and the pages have no card background.
        assert.equal(await page.evaluate(() => innerHeight - Math.round(document.querySelector('.modal-full:popover-open .modal-footer').getBoundingClientRect().bottom)), 0);
        assert.equal(await modal.locator('img.modal-page').first().evaluate((img) => getComputedStyle(img).backgroundColor), 'rgba(0, 0, 0, 0)');
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0 && img.getBoundingClientRect().right <= 1280 && img.getBoundingClientRect().width <= 1440));
        assert.match(await first.getAttribute('src'), /\/full\/(?:santisteban-)?prelude-01-p1(?:\.[a-f0-9]+)?\.svg$/);
        assert.ok(await fullRequests() >= 1);
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        assert.equal(await modal.locator('.modal-pages').evaluate((el) => getComputedStyle(el).maxWidth), '1440px');
        // The footer links to the relative key (C major -> A minor) and the dominant (G major), each replacing this preview.
        const keys = modal.locator('.modal-footer .modal-key');
        assert.equal(await keys.count(), 2);
        assert.equal(await keys.nth(0).locator('svg').count(), 1);
        assert.equal(await keys.nth(0).locator('.modal-key-label').evaluate((el) => getComputedStyle(el).color), 'rgb(118, 118, 118)');
        const expected = locale === 'es'
          ? [/^Preludio \d+ en La menor Relativo menor$/, /^Preludio \d+ en Sol mayor Dominante$/]
          : [/^Prelude \d+ in A minor Relative minor$/, /^Prelude \d+ in G major Dominant$/];
        const suffix = locale === 'es' ? [/La menor$/, /Sol mayor$/] : [/A minor$/, /G major$/];
        for (let k = 0; k < 2; k++) {
          assert.match(await keys.nth(k).evaluate((el) => Array.from(el.querySelectorAll('span')).map((s) => s.textContent).join(' ')), expected[k]);
          await keys.nth(k).click();
          assert.equal(await page.locator('.modal-full:popover-open').count(), 1);
          assert.match(await page.locator('.modal-full:popover-open').getAttribute('aria-label'), suffix[k]);
          await page.locator('.modal-full:popover-open .modal-close').click();
          assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
          if (k === 0) await cards.first().click();
        }
        // The open modal is mirrored in the URL hash: opening sets it, closing clears it, and a reload or a shared link reopens it.
        await cards.first().click();
        const openId = await page.locator('.modal-full:popover-open').getAttribute('id');
        await page.waitForFunction((id) => location.hash === '#' + id, openId);
        await page.reload();
        assert.equal(await page.locator('.modal-full:popover-open').getAttribute('id'), openId);
        await page.locator('.modal-full:popover-open .modal-close').click();
        await page.waitForFunction(() => location.hash === '');
        await page.goto('about:blank');
        await page.goto(base + url + '#' + openId);
        assert.equal(await page.locator('.modal-full:popover-open').getAttribute('id'), openId);
        await page.locator('.modal-full:popover-open .modal-close').click();
        await page.setViewportSize({ width: 375, height: 800 });
        // The footer link downloads the prelude PDF with the expected name.
        // A fresh tab per download: Chromium stops honouring downloads after ~10 in one tab.
        for (let i = 0; i < published.length; i++) {
          const tab = await context.newPage();
          await tab.goto(base + url);
          const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').nth(i).click()]);
          assert.equal(download.suggestedFilename(), published[i].pdf);
          const saved = path.join(tmp, 'prelude-' + i + '.pdf');
          await download.saveAs(saved);
          assert.equal(fs.readFileSync(saved).subarray(0, 4).toString(), '%PDF');
          await tab.close();
        }
        const links = await page.locator('link[rel=canonical], link[rel=alternate]').evaluateAll((els) => els.map((el) => [el.getAttribute('hreflang'), el.href]));
        assert.ok(links.some(([, href]) => href === BASE_URL + url));
        ['es', 'en'].forEach((l) => assert.ok(links.some(([lang, href]) => lang === l && href === BASE_URL + pagePath(editionKey, l))));
      }

    }

    // Progressive pieces: one card per published piece, in numeric order, with a score modal and a PDF download.
    {
      const published = progressive.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-piezas-progresivas-carcassi', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        titles.forEach((title, i) => assert.match(title, new RegExp('^' + (locale === 'es' ? 'Pieza ' : 'Piece ') + published[i].number + ': ')));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        assert.equal(await page.locator('main a[href="' + pagePath('articulo-preludios-carcassi', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), /\/full\/progressive-01-p1(?:\.[a-f0-9]+)?\.svg$/);
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        await modal.locator('.modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
        const tab = await context.newPage();
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').first().click()]);
        assert.equal(download.suggestedFilename(), published[0].pdf);
        await tab.close();
      }
    }

    // Aguado's sheet music: one card per published piece, in catalog order, with a score modal and a PDF download.
    {
      const published = aguado.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-partituras-aguado', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        assert.deepEqual(titles, published.map((p) => aguado.pieceName(p, locale)));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), /\/full\/aguado-01-p1(?:\.[a-f0-9]+)?\.svg$/);
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        await modal.locator('.modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
      }
    }

    // Sagreras lessons: one card per published lesson, in numeric order, with a score modal and a PDF download.
    {
      const published = sagreras.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-lecciones-sagreras', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        titles.forEach((title, i) => assert.match(title, new RegExp('^' + (locale === 'es' ? 'Lecci\u00f3n ' : 'Lesson ') + published[i].number + '$')));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), new RegExp('/full/lesson-' + String(published[0].number).padStart(2, '0') + '-p1(?:\\.[a-f0-9]+)?\\.svg$'));
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        // Lessons are progressive: the footer has previous/next chevrons, disabled at either end.
        const steps = modal.locator('.modal-footer .modal-step');
        assert.equal(await steps.count(), 2);
        assert.equal(await steps.nth(0).isDisabled(), true);
        assert.equal(await steps.nth(1).isDisabled(), published.length < 2);
        if (published.length > 1) {
          await steps.nth(1).click();
          const second = page.locator('.modal-full:popover-open');
          assert.equal(await second.count(), 1);
          assert.equal(await second.getAttribute('id'), 'sagreras-score-' + published[1].number);
          assert.equal(await second.locator('.modal-step').nth(0).isDisabled(), false);
          assert.equal(await second.locator('.modal-step').nth(1).isDisabled(), published.length < 3);
        }
        await page.locator('.modal-full:popover-open .modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
        const tab = await context.newPage();
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').first().click()]);
        assert.equal(download.suggestedFilename(), published[0].pdf);
        await tab.close();
      }
    }

    // Sor's progressive lessons: one card per published piece, in catalog order, with a score modal and a PDF download.
    {
      const published = sor.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-lecciones-sor', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        assert.deepEqual(titles, published.map((p) => sor.pieceName(p, locale)));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), /\/full\/sor-01-p1(?:\.[a-f0-9]+)?\.svg$/);
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        await modal.locator('.modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
      }
    }

    // Sagreras lessons: one card per published lesson, in numeric order, with a score modal and a PDF download.
    {
      const published = sagreras.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-lecciones-sagreras', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        titles.forEach((title, i) => assert.match(title, new RegExp('^' + (locale === 'es' ? 'Lecci\u00f3n ' : 'Lesson ') + published[i].number + '$')));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), new RegExp('/full/lesson-' + String(published[0].number).padStart(2, '0') + '-p1(?:\\.[a-f0-9]+)?\\.svg$'));
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        // Lessons are progressive: the footer has previous/next chevrons, disabled at either end.
        const steps = modal.locator('.modal-footer .modal-step');
        assert.equal(await steps.count(), 2);
        assert.equal(await steps.nth(0).isDisabled(), true);
        assert.equal(await steps.nth(1).isDisabled(), published.length < 2);
        if (published.length > 1) {
          await steps.nth(1).click();
          const second = page.locator('.modal-full:popover-open');
          assert.equal(await second.count(), 1);
          assert.equal(await second.getAttribute('id'), 'sagreras-score-' + published[1].number);
          assert.equal(await second.locator('.modal-step').nth(0).isDisabled(), false);
          assert.equal(await second.locator('.modal-step').nth(1).isDisabled(), published.length < 3);
        }
        await page.locator('.modal-full:popover-open .modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
        const tab = await context.newPage();
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').first().click()]);
        assert.equal(download.suggestedFilename(), published[0].pdf);
        await tab.close();
      }
    }

    // Sor's studies: one card per published piece, in catalog order, with a score modal and a PDF download.
    {
      const published = sorEstudios.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-estudios-sor', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        assert.deepEqual(titles, published.map((p) => sorEstudios.pieceName(p, locale)));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), /\/full\/sor-est-601-p1(?:\.[a-f0-9]+)?\.svg$/);
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        await modal.locator('.modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
      }
    }

    // Sagreras lessons: one card per published lesson, in numeric order, with a score modal and a PDF download.
    {
      const published = sagreras.publishedPieces();
      for (const locale of ['es', 'en']) {
        const url = pagePath('articulo-lecciones-sagreras', locale);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + url);
        const cards = page.locator('.prelude-card');
        assert.equal(await cards.count(), published.length);
        const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
        assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
        const titles = await cards.locator('.prelude-open').allTextContents();
        titles.forEach((title, i) => assert.match(title, new RegExp('^' + (locale === 'es' ? 'Lecci\u00f3n ' : 'Lesson ') + published[i].number + '$')));
        assert.equal(await cards.locator('svg.score-svg').count(), published.length);
        assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
        await cards.first().click();
        const modal = page.locator('.modal-full:popover-open');
        assert.equal(await modal.count(), 1);
        const first = modal.locator('img.modal-page').first();
        await first.evaluate((img) => img.decode());
        assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
        assert.match(await first.getAttribute('src'), new RegExp('/full/lesson-' + String(published[0].number).padStart(2, '0') + '-p1(?:\\.[a-f0-9]+)?\\.svg$'));
        assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
        // Lessons are progressive: the footer has previous/next chevrons, disabled at either end.
        const steps = modal.locator('.modal-footer .modal-step');
        assert.equal(await steps.count(), 2);
        assert.equal(await steps.nth(0).isDisabled(), true);
        assert.equal(await steps.nth(1).isDisabled(), published.length < 2);
        if (published.length > 1) {
          await steps.nth(1).click();
          const second = page.locator('.modal-full:popover-open');
          assert.equal(await second.count(), 1);
          assert.equal(await second.getAttribute('id'), 'sagreras-score-' + published[1].number);
          assert.equal(await second.locator('.modal-step').nth(0).isDisabled(), false);
          assert.equal(await second.locator('.modal-step').nth(1).isDisabled(), published.length < 3);
        }
        await page.locator('.modal-full:popover-open .modal-close').click();
        assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
        await page.setViewportSize({ width: 375, height: 800 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
        const tab = await context.newPage();
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').first().click()]);
        assert.equal(download.suggestedFilename(), published[0].pdf);
        await tab.close();
      }
    }

    // All author collections share lateral desktop navigation, including sparse publication lists.
    for (const slug of ['articulo-preludios-carcassi', 'articulo-preludios-santisteban',
      'articulo-valses-carcassi', 'articulo-piezas-progresivas-carcassi',
      'articulo-partituras-aguado', 'articulo-lecciones-sagreras', 'articulo-lecciones-sor', 'articulo-estudios-sor']) {
      for (const locale of ['es', 'en']) {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(base + pagePath(slug, locale));
        const ids = await page.locator('.prelude-card .modal-full').evaluateAll((els) => els.map((el) => el.id));
        await page.locator('.prelude-card').first().click();
        const modal = page.locator('.modal-full:popover-open');
        const steps = modal.locator('.modal-step');
        assert.equal(await modal.locator('.modal-download').isVisible(), true);
        const downloadTab = await context.newPage();
        await downloadTab.setViewportSize({ width: 1280, height: 800 });
        await downloadTab.goto(base + pagePath(slug, locale));
        await downloadTab.locator('.prelude-card').first().click();
        const downloadLink = downloadTab.locator('.modal-full:popover-open .modal-download');
        const [download] = await Promise.all([downloadTab.waitForEvent('download'), downloadLink.click()]);
        assert.equal(download.suggestedFilename(), decodeURIComponent(await downloadLink.getAttribute('href')).split('/').pop());
        await downloadTab.close();
        assert.equal(await steps.first().isDisabled(), true);
        for (const width of [800, 1280, 2560]) {
          await page.setViewportSize({ width, height: 800 });
          const measure = () => modal.evaluate((el) => {
            const [left, right] = [...el.querySelectorAll('.modal-step')].map((b) => b.getBoundingClientRect());
            const score = el.querySelector('.modal-pages').getBoundingClientRect();
            return { left: left.x, right: right.right, y: left.y + left.height / 2,
              gapLeft: score.left - left.right, gapRight: right.left - score.right,
              overflow: el.scrollWidth - el.clientWidth };
          });
          const before = await measure();
          assert.ok(before.left >= 0 && before.right <= width, slug + ': buttons inside viewport');
          assert.ok(Math.abs(before.y - 400) <= 1, slug + ': vertically centered');
          assert.ok(before.gapLeft >= 0 && before.gapLeft <= 200, slug + ': left distance capped');
          assert.ok(before.gapRight >= 0 && before.gapRight <= 200, slug + ': right distance capped');
          assert.ok(before.overflow <= 0, slug + ': no horizontal overflow');
          await modal.evaluate((el) => { el.scrollTop = 250; });
          assert.equal((await measure()).y, before.y, slug + ': navigation stays fixed while scrolling');
          await modal.evaluate((el) => { el.scrollTop = 0; });
        }
        await page.setViewportSize({ width: 1280, height: 800 });
        if (ids.length > 1) {
          await steps.last().click();
          assert.equal(await modal.count(), 1);
          assert.equal(await modal.getAttribute('id'), ids[1]);
          await page.waitForFunction((id) => location.hash === '#' + id, ids[1]);
          await steps.first().click();
          assert.equal(await modal.getAttribute('id'), ids[0]);
          await modal.locator('.modal-close').click();
          await page.locator('.prelude-card').last().click();
          assert.equal(await steps.last().isDisabled(), true);
        }
        await modal.locator('.modal-close').click();
        await page.setViewportSize({ width: 375, height: 800 });
        await page.evaluate((id) => document.getElementById(id).showPopover(), ids[0]);
        assert.equal(await steps.first().isVisible(), slug === 'articulo-lecciones-sagreras');
        await page.keyboard.press('Escape');
      }
    }

    // The home pages link to the section only from the hamburger menu.
    for (const file of ['index.html', 'en.html']) {
      const html = fs.readFileSync(path.join(DIST, file), 'utf8');
      const locale = file === 'en.html' ? 'en' : 'es';
      const outsideMenu = html.replace(/<details class="site-menu">[\s\S]*?<\/details>/, '');
      assert.ok(html.includes('href="' + pagePath('articulo-carcassi', locale) + '"'), file + ' no enlaza a los articulos desde el menu');
      assert.ok(!/href="[^"]*(articulo|article)/.test(outsideMenu), file + ' enlaza a los articulos fuera del menu');
    }
    const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
    ['articulos', 'articulo-carcassi', 'articulo-preludios-carcassi', 'articulo-preludios-santisteban', 'articulo-tablaturas-arpegios'].forEach((key) => ['es', 'en'].forEach((locale) => {
      assert.ok(sitemap.includes('<loc>' + BASE_URL + pagePath(key, locale) + '</loc>'), key + ' ' + locale);
    }));

    // Sitemap entries carry the es/en hreflang pair.
    const esUrl = BASE_URL + pagePath('articulo-carcassi', 'es');
    const enUrl = BASE_URL + pagePath('articulo-carcassi', 'en');
    const entry = sitemap.split('<url>').find((chunk) => chunk.includes('<loc>' + esUrl + '</loc>'));
    assert.ok(entry.includes('hreflang="es" href="' + esUrl + '"') && entry.includes('hreflang="en" href="' + enUrl + '"'));

    assert.deepEqual(errors, []);
    console.log('articles e2e: ok');
  } finally {
    if (browser) await browser.close();
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
