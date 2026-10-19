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
      // No text link in the list besides the cards (the banner is the link).
      assert.equal(await page.locator('main a[href*="preludios"], main a[href*="preludes"]').count(), 1);

      // Article: static examples, no horizontal scroll on mobile.
      await page.goto(base + article);
      const pdfs = locale === 'es' ? PDFS.concat('Prelude 1 in C Major - Matteo Carcassi.pdf') : PDFS;
      assert.equal(await page.locator('.example-card .score-svg').count(), pdfs.length);
      assert.equal(await page.locator('.chord-diagram').count(), 2);
      assert.equal(await page.locator('.chord-card').count(), 2);
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

      // Only analytics and ascii-tabs: the scores are static SVG.
      const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((el) => el.src));
      assert.ok(scripts.every((src) => src.includes('googletagmanager') || /vendor\/ascii-tabs/.test(src)), scripts.join(','));

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

    // Arpeggio positions: separate qualities, localized lesson link and aligned names.
    for (const locale of ['es', 'en']) {
      const url = pagePath('articulo-tablaturas-arpegios', locale);
      await page.goto(base + url);
      await page.waitForSelector('ascii-tabs .ascii-tabs-tab');
      assert.equal(await page.locator('h1').textContent(), locale === 'es' ? 'Tablaturas para arpegios' : 'Tabs for arpeggios');
      assert.equal(await page.locator('.lead a').getAttribute('href'), pagePath('articulo-carcassi', locale));
      assert.equal(await page.locator('ascii-tabs[readonly]').count(), 13);
      const titles = await page.locator('figcaption').allTextContents();
      assert.deepEqual(titles.slice(0, 3), locale === 'es' ? ['Do mayor', 'Re mayor', 'Re menor'] : ['C major', 'D major', 'D minor']);
      const groups = await page.locator('ascii-tabs').evaluateAll((els) => els.map((el) => el.value[0].filter((column) => column.some((f) => f !== null))));
      groups.flat().forEach((form) => assert.equal(form.filter((f) => f !== null).length, 4));
      assert.deepEqual(groups[5][1], [0, 3, 1, null, 2, null]);
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
        // Names and fret digits use the same column spacing and font size.
        const alignment = await page.locator('.tab-figure').evaluateAll((figures) => figures.map((figure) => {
          const name = figure.querySelector('.tab-chords span');
          const tab = figure.querySelector('.ascii-tabs-tab');
          return { nameSize: getComputedStyle(name).fontSize, tabSize: getComputedStyle(tab).fontSize };
        }));
        alignment.forEach(({ nameSize, tabSize }) => assert.equal(nameSize, tabSize));
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
      const hrefs = await cards.evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
      assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
      const titles = await cards.locator('h2').allTextContents();
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
      // Click downloads the prelude PDF with the expected name.
      // A fresh tab per download: Chromium stops honouring downloads after ~10 in one tab.
      for (let i = 0; i < published.length; i++) {
        const tab = await context.newPage();
        await tab.goto(base + url);
        const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card').nth(i).click()]);
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

    // Discoverable only through the sitemap: neither the home pages nor the
    // footer link to the section.
    for (const file of ['index.html', 'en.html']) {
      const html = fs.readFileSync(path.join(DIST, file), 'utf8');
      assert.ok(!/href="[^"]*(articulos|articles)/.test(html), file + ' enlaza a los articulos');
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
