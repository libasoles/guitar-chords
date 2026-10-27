'use strict';
/* Shared setup for the per-article e2e suites (test/articles-*.e2e.js): a
   static server over dist/site, one Chromium and one phone-sized page, and the
   checks that every author collection repeats. */
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

function run(name, body) {
  (async function () {
    const server = await serveStatic(DIST, 0);
    let browser;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), name + '-e2e-'));
    try {
      browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
      const base = 'http://localhost:' + server.address().port;
      const context = await browser.newContext({ viewport: { width: 375, height: 800 }, acceptDownloads: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await body({ base, context, page, tmp, DIST, BASE_URL });
      assert.deepEqual(errors, []);
      console.log(name + ' e2e: ok');
    } finally {
      if (browser) await browser.close();
      server.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* A PDF link is checked by fetching it; the click-to-download path is only
   exercised once per page, in a fresh tab (Chromium stops honouring downloads
   after ~10 in one tab). */
const servedPdfs = new Set();
async function assertPdfServed(context, base, href) {
  // The files are the same in every locale, so each one is fetched once.
  if (servedPdfs.has(href)) return;
  servedPdfs.add(href);
  const response = await context.request.get(new URL(href, base).href);
  assert.equal(response.status(), 200, href);
  assert.equal((await response.body()).subarray(0, 4).toString(), '%PDF', href);
}

async function assertFirstCardDownloads({ context, base }, url, pdf) {
  const tab = await context.newPage();
  await tab.setViewportSize({ width: 375, height: 800 });
  await tab.goto(base + url);
  const [download] = await Promise.all([tab.waitForEvent('download'), tab.locator('.prelude-card > .example-download').first().click()]);
  assert.equal(download.suggestedFilename(), pdf);
  await tab.close();
}

/* One card per published piece, with a score modal and a PDF download.
   spec: slug, published, titles(locale, published) -> expected titles,
   firstSrc: RegExp for the first modal page image, steps: lessons have
   previous/next chevrons, download: also click-download the first card,
   extra(page, locale): article-specific assertions. */
async function checkCollection(env, spec) {
  const { base, page } = env;
  const { slug, published } = spec;
  for (const locale of ['es', 'en']) {
    const url = pagePath(slug, locale);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(base + url);
    const cards = page.locator('.prelude-card');
    assert.equal(await cards.count(), published.length);
    const hrefs = await page.locator('.prelude-card > .example-download').evaluateAll((els) => els.map((el) => decodeURIComponent(el.getAttribute('href'))));
    assert.deepEqual(hrefs.map((href) => href.split('/').pop()), published.map((p) => p.pdf));
    const titles = await cards.locator('.prelude-open').allTextContents();
    const expected = spec.titles(locale, published);
    assert.equal(titles.length, expected.length);
    titles.forEach((title, i) => (expected[i] instanceof RegExp ? assert.match(title, expected[i]) : assert.equal(title, expected[i])));
    assert.equal(await cards.locator('svg.score-svg').count(), published.length);
    assert.equal(await page.locator('.article-back a[href="' + pagePath('articulos', locale) + '"]').count(), 1);
    if (spec.extra) await spec.extra(page, locale);
    await cards.first().click();
    const modal = page.locator('.modal-full:popover-open');
    assert.equal(await modal.count(), 1);
    if (locale === 'es') {
      // The page images are the same files in both locales, so they are loaded once.
      const first = modal.locator('img.modal-page').first();
      await first.evaluate((img) => img.decode());
      assert.ok(await first.evaluate((img) => img.naturalWidth > 0));
      assert.match(await first.getAttribute('src'), spec.firstSrc);
    }
    assert.equal(decodeURIComponent(await modal.locator('.modal-footer .modal-download').getAttribute('href')).split('/').pop(), published[0].pdf);
    if (spec.steps) {
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
    }
    await page.locator('.modal-full:popover-open .modal-close').click();
    assert.equal(await page.locator('.modal-full:popover-open').count(), 0);
    await page.setViewportSize({ width: 375, height: 800 });
    const overflow = await overflowOf(page);
    assert.ok(overflow <= 0, 'scroll horizontal de ' + overflow + 'px en ' + url);
    if (spec.download && locale === 'es') await assertFirstCardDownloads(env, url, published[0].pdf);
  }
}

/* Lateral desktop navigation of the score modal, including sparse publication lists. */
async function checkLateralNav({ base, context, page }, slug) {
  for (const locale of ['es', 'en']) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(base + pagePath(slug, locale));
    const ids = await page.locator('.prelude-card .modal-full').evaluateAll((els) => els.map((el) => el.id));
    await page.locator('.prelude-card').first().click();
    const modal = page.locator('.modal-full:popover-open');
    const steps = modal.locator('.modal-step');
    assert.equal(await modal.locator('.modal-download').isVisible(), true);
    if (locale === 'es') {
      const downloadTab = await context.newPage();
      await downloadTab.setViewportSize({ width: 1280, height: 800 });
      await downloadTab.goto(base + pagePath(slug, locale));
      await downloadTab.locator('.prelude-card').first().click();
      const downloadLink = downloadTab.locator('.modal-full:popover-open .modal-download');
      const [download] = await Promise.all([downloadTab.waitForEvent('download'), downloadLink.click()]);
      assert.equal(download.suggestedFilename(), decodeURIComponent(await downloadLink.getAttribute('href')).split('/').pop());
      await downloadTab.close();
    }
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

module.exports = { run, checkCollection, checkLateralNav, assertPdfServed, overflowOf, BASE_URL, DIST };
