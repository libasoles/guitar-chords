'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');

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

      // Index: a single card, linking to the article.
      await page.goto(base + index);
      assert.equal(await page.locator('.article-card').count(), 1);
      assert.equal(await page.locator('.article-card').getAttribute('href'), article);
      assert.match(await page.locator('.article-card p').textContent(), /Carcassi/);

      // Article: static examples, no horizontal scroll on mobile.
      await page.goto(base + article);
      assert.equal(await page.locator('.example-card .score-svg').count(), 2);
      assert.equal(await page.locator('.chord-diagram').count(), 2);
      assert.equal(await page.locator('.chord-card').count(), 6);
      // E7: full form, then the easy decomposition, then Carcassi's.
      const e7 = await page.locator('.chord-card', { has: page.locator('h3', { hasText: /^E7$/ }) }).locator('.form-text').allTextContents();
      assert.deepEqual(e7, ['0 0 1 0 2 0', '0 0 1 x x 0', '0 3 1 x 2 x']);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + article);
      // The score cards fit inside the viewport.
      const boxes = await page.locator('.example-card').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      boxes.forEach((right) => assert.ok(right <= 375, 'tarjeta fuera del viewport'));

      // No scripts besides analytics: the examples are not drawn client-side.
      const scripts = await page.locator('script[src]').evaluateAll((els) => els.map((el) => el.src));
      assert.ok(scripts.every((src) => src.includes('googletagmanager')), scripts.join(','));

      // Each card downloads its score PDF.
      const cards = page.locator('.example-card');
      for (let i = 0; i < PDFS.length; i++) {
        const [download] = await Promise.all([page.waitForEvent('download'), cards.nth(i).click()]);
        assert.equal(download.suggestedFilename(), PDFS[i]);
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

    // Discoverable only through the sitemap: neither the home pages nor the
    // footer link to the section.
    for (const file of ['index.html', 'en.html']) {
      const html = fs.readFileSync(path.join(DIST, file), 'utf8');
      assert.ok(!/href="[^"]*(articulos|articles)/.test(html), file + ' enlaza a los articulos');
    }
    const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
    ['articulos', 'articulo-carcassi'].forEach((key) => ['es', 'en'].forEach((locale) => {
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
