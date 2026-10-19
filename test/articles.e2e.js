'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');
const { publishedPreludes } = require('../scripts/lib/article-carcassi-preludes');

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
      assert.equal(await page.locator('.article-card').count(), 3);
      assert.equal(await page.locator('.article-card').first().getAttribute('href'), article);
      assert.equal(await page.locator('.article-card').nth(1).getAttribute('href'), pagePath('articulo-preludios-carcassi', locale));
      assert.match(await page.locator('.article-card p').first().textContent(), /Carcassi/);
      const arpeggiosImage = page.locator('.article-card').nth(2).locator('img');
      assert.match(await arpeggiosImage.getAttribute('src'), /^\/assets\/articles\/arpeggios\/preview(?:\.[a-f0-9]+)?\.svg$/);
      await arpeggiosImage.evaluate((img) => img.decode());
      // No text link in the list besides the cards (the banner is the link).
      assert.equal(await page.locator('main a[href*="preludios"], main a[href*="preludes"]').count(), 1);

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
      await page.waitForSelector('ascii-tabs .ascii-tabs-tab');
      assert.equal(await page.locator('h1').textContent(), locale === 'es' ? 'Tablaturas para arpegios' : 'Tabs for arpeggios');
      assert.equal(await page.locator('.lead a').getAttribute('href'), pagePath('articulo-carcassi', locale));
      assert.equal(await page.locator('ascii-tabs[readonly]').count(), 28);
      const titles = await page.locator('figcaption').allTextContents();
      assert.deepEqual(titles.slice(0, 3), locale === 'es' ? ['Do mayor', 'Do menor', 'Do 7 mayor'] : ['C major', 'C minor', 'C major 7']);
      const groups = await page.locator('ascii-tabs').evaluateAll((els) => els.map((el) => el.value[0].filter((column) => column.some((f) => f !== null)).map((column) => column.map((note) => note === null ? null : typeof note === 'object' ? note.fret : note))));
      groups.flat().forEach((form) => assert.equal(form.filter((f) => f !== null).length, 4));
      assert.deepEqual(groups[10][1], [0, 3, 1, null, 2, null]);
      assert.equal(await page.locator('.tab-chords').count(), groups.length);
      const weights = await page.locator('.ascii-tabs-has').evaluateAll((cells) => cells.map((cell) => ({
        string: Number(cell.dataset.s),
        weight: getComputedStyle(cell.querySelector('.ascii-tabs-fret')).fontWeight,
      })));
      weights.forEach(({ string, weight }) => assert.equal(weight, string >= 3 ? '700' : '400'));
      if (locale === 'es') assert.match(await page.locator('.lead a').textContent(), /^descomposición/);
      // The names are buttons above the tab, outside the white sheet, without underline.
      assert.deepEqual(await page.locator('.tab-chords').nth(6).locator('.arpeggio-chord').allTextContents(), ['D7', 'D7/F#', 'D7/A', 'D7/C']);
      assert.equal(await page.locator('ascii-tabs .arpeggio-chord').count(), 0);
      assert.equal(await page.locator('.arpeggio-chord').first().evaluate((el) => getComputedStyle(el).textDecorationLine), 'none');
      assert.deepEqual(groups[6], [
        [2, 1, 2, 0, null, null], [2, 1, 2, 4, null, null],
        [2, 1, 2, null, 0, null], [2, 1, 2, null, 3, null],
      ]);
      assert.equal(await page.locator('.arpeggio-group').count(), 7);
      assert.equal(await page.locator('[role="tabpanel"]:visible').count(), 7);
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
        ['A', 'Seventh', ['A7', 'A7/C#', 'A7/E', 'A7/G'], [9, 1, 4, 7], [9, 1, 4, 7]],
        ['B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#'], [11, 2, 6], [11, 2, 6]],
      ]) {
        const label = require('../src/i18n/strings.' + locale + '.json')['artArpeggios' + quality];
        await page.locator('#arpeggio-' + root + '-root').locator('..').getByRole('tab', { name: label, exact: true }).click();
        const panel = page.locator('.arpeggio-group').filter({ has: page.locator('#arpeggio-' + root + '-root') }).locator('[role="tabpanel"]:visible');
        assert.deepEqual(await panel.locator('.arpeggio-chord').allTextContents(), names);
        const forms = await panel.locator('ascii-tabs').evaluate((el) => el.value[0].filter((column) => column.some((note) => note !== null)));
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
      assert.equal(await qualityTabs.nth(3).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('ArrowRight');
      assert.equal(await qualityTabs.first().getAttribute('aria-selected'), 'true');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await qualityTabs.nth(3).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Home');
      assert.equal(await qualityTabs.first().getAttribute('aria-selected'), 'true');
      // Every annotation opens its own exact four-string fingering, including inversions.
      const buttons = page.locator('.arpeggio-chord');
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
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
        for (const tab of await page.getByRole('tab').all()) {
          await tab.click();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
        }
        // Native annotations anchor at the fret, including after resizing.
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.ascii-tabs-annotation')).every((annotation) => {
          const staff = annotation.closest('.ascii-tabs-staff');
          const fret = staff.querySelector('.ascii-tabs-cell[data-c="' + annotation.dataset.column + '"][data-s="0"] .ascii-tabs-fret');
          return Math.abs(annotation.getBoundingClientRect().left - fret.getBoundingClientRect().left) < 1;
        }));
      }
      await page.setViewportSize({ width: 375, height: 800 });
    }

    // Carcassi preludes: one card per published prelude, in numeric order.
    const published = publishedPreludes();
    for (const locale of ['es', 'en']) {
      const url = pagePath('articulo-preludios-carcassi', locale);
      await page.goto(base + url);
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
      assert.match(await first.getAttribute('src'), /\/full\/prelude-01-p1(?:\.[a-f0-9]+)?\.svg$/);
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
      ['es', 'en'].forEach((l) => assert.ok(links.some(([lang, href]) => lang === l && href === BASE_URL + pagePath('articulo-preludios-carcassi', l))));
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
    ['articulos', 'articulo-carcassi', 'articulo-preludios-carcassi', 'articulo-tablaturas-arpegios'].forEach((key) => ['es', 'en'].forEach((locale) => {
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
