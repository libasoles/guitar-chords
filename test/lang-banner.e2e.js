'use strict';
/* Banner de sugerencia de idioma en la primera visita a / con idioma de navegador simulado. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async function () {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const base = 'http://localhost:' + server.address().port;
    const errors = [];
    // Cada caso es un visitante nuevo con las preferencias de idioma indicadas.
    const visitor = async (languages) => {
      const context = await browser.newContext();
      await context.addInitScript((list) => {
        Object.defineProperty(navigator, 'languages', { get: () => list });
        Object.defineProperty(navigator, 'language', { get: () => list[0] || '' });
      }, languages);
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/');
      return { context, page, banner: page.locator('.lang-banner') };
    };

    // pt-BR: banner en portugues; aceptar lleva a /pt y se recuerda.
    let v = await visitor(['pt-BR']);
    assert.equal(await v.banner.count(), 1);
    assert.match(await v.banner.textContent(), /também está disponível em português/);
    assert.equal(await v.page.locator('html').getAttribute('lang'), 'es', 'no redirige solo');
    assert.equal(new URL(v.page.url()).pathname, '/');
    await v.banner.getByRole('link', { name: 'Ver em português' }).click();
    await v.page.waitForURL('**/pt');
    assert.equal(await v.page.locator('html').getAttribute('lang'), 'pt-BR');
    assert.equal(await v.page.locator('.lang-banner').count(), 0);
    await v.page.goto(base + '/');
    assert.equal(await v.page.locator('.lang-banner').count(), 0, 'la eleccion aceptada no vuelve a mostrar el banner');
    await v.context.close();

    // en: banner en ingles; descartar se recuerda tras recargar.
    v = await visitor(['en-US']);
    assert.match(await v.banner.textContent(), /also available in English/);
    await v.banner.getByRole('button', { name: 'Dismiss' }).click();
    assert.equal(await v.page.locator('.lang-banner').count(), 0);
    await v.page.reload();
    assert.equal(await v.page.locator('.lang-banner').count(), 0, 'descartar se recuerda');
    await v.context.close();

    // Eleccion manual en el menu: nunca se pisa.
    v = await visitor(['pt-BR']);
    assert.equal(await v.banner.count(), 1);
    await v.page.locator('.site-menu summary').click();
    await v.page.locator('.site-menu-language-links').getByRole('link', { name: 'Español', exact: true }).click();
    await v.page.waitForLoadState('load');
    await v.page.goto(base + '/');
    assert.equal(await v.page.locator('.lang-banner').count(), 0, 'una eleccion manual no se pisa');
    await v.context.close();

    // Varios idiomas: el primero soportado; no soportado: ingles; espanol o sin preferencia: nada.
    v = await visitor(['fr', 'pt-BR', 'en']);
    assert.match(await v.banner.textContent(), /português/);
    await v.context.close();
    v = await visitor(['fr-FR']);
    assert.match(await v.banner.textContent(), /English/);
    await v.context.close();
    v = await visitor(['es-AR']);
    assert.equal(await v.banner.count(), 0);
    await v.context.close();
    v = await visitor([]);
    assert.equal(await v.banner.count(), 0, 'sin preferencia la pagina no cambia');
    await v.context.close();

    // Solo el inicio en espanol sugiere.
    v = await visitor(['pt-BR']);
    await v.page.goto(base + '/en');
    assert.equal(await v.page.locator('.lang-banner').count(), 0);
    await v.context.close();

    assert.deepEqual(errors, []);
    console.log('Language banner E2E passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
