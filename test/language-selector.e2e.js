'use strict';
/* Selector de idioma: lleva a la misma pagina en el otro idioma, sin deteccion automatica. */
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
    const base = 'http://localhost:' + server.address().port;
    // Navegador en portugues: el sitio no cambia de idioma por su cuenta.
    const context = await browser.newContext({ locale: 'pt-BR' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    const choose = async (name) => {
      await page.locator('.site-menu summary').click();
      await page.locator('.site-menu-language-links').getByRole('link', { name, exact: true }).click();
      await page.waitForLoadState('load');
    };
    const here = () => new URL(page.url()).pathname;

    await page.goto(base + pagePath('circulo-de-quintas', 'es'));
    assert.equal(here(), '/circulo-de-quintas');
    assert.equal(await page.locator('html').getAttribute('lang'), 'es');

    await choose('Português');
    assert.equal(here(), pagePath('circulo-de-quintas', 'pt'));
    assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
    assert.equal(await page.locator('.site-menu-language-links [aria-current]').textContent(), 'Português');

    await choose('English');
    assert.equal(here(), '/en/circle-of-fifths');
    await choose('Español');
    assert.equal(here(), '/circulo-de-quintas');

    await page.goto(base + '/pt');
    assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
    await choose('Español');
    assert.equal(here(), '/');
    await choose('English');
    assert.equal(here(), '/en');

    assert.deepEqual(errors, []);
    console.log('Language selector E2E passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
