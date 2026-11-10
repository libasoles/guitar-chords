'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');

(async function () {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const base = 'http://localhost:' + server.address().port;
    await page.route('https://www.googletagmanager.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
    for (const locale of ['es', 'en', 'pt']) {
      await page.setViewportSize({ width: 1100, height: 900 });
      const response = await page.goto(base + pagePath('acordes-de-novena', locale));
      assert.equal(response.status(), 200);
      await page.waitForSelector('.dim-grid .diagram svg');
      assert.equal(await page.locator('section').count(), 7);
      for (const grid of await page.locator('.dim-grid').all()) {
        assert.equal(await grid.locator('.v7-card').count(), 12);
        assert.equal(await grid.locator('.diagram svg').count(), 12);
        assert.ok((await grid.locator('.name').first().textContent()).startsWith('C'));
        assert.ok((await grid.locator('.name').last().textContent()).startsWith('B'));
      }
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://acordesdeguitarra.com.ar' + pagePath('acordes-de-novena', locale));
      assert.equal(await page.locator('link[hreflang]').count(), 4);
      assert.ok(!(await page.content()).includes('%%'));
      await page.setViewportSize({ width: 360, height: 800 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale}: mobile overflow`);
      assert.ok(await page.locator('.dim-grid .name').evaluateAll((names) => names.every((name) => name.scrollWidth <= name.clientWidth)), `${locale}: chord labels fit their cards`);
      await page.goto(base + (locale === 'es' ? '/' : '/' + locale));
      assert.equal(await page.locator(`a[href="${pagePath('acordes-de-novena', locale)}"]`).count(), 1);
    }
    // The shared renderer must preserve the diminished guide's 3 × 12 cards.
    await page.goto(base + pagePath('acordes-disminuidos', 'es'));
    assert.equal(await page.locator('.dim-grid .diagram svg').count(), 36);
    assert.deepEqual(errors, []);
    console.log('Ninth guide E2E passed (three locales, 84 diagrams, mobile, diminished regression)');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
