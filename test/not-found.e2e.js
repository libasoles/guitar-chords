'use strict';
/* El 404 de GitHub Pages es un solo documento: en rutas /pt/ se muestra en portugues. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

const DIST = path.join(__dirname, '..', 'dist/site');

(async function () {
  const server = await serveStatic(DIST, 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const base = 'http://localhost:' + server.address().port;
    const notFound = fs.readFileSync(path.join(DIST, '404.html'), 'utf8');
    // Como Pages: el mismo 404.html con estado 404 en cualquier ruta inexistente.
    const open = async (pathname) => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(base + pathname, (route) => route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: notFound }));
      await page.goto(base + pathname);
      assert.deepEqual(errors, [], pathname);
      return page;
    };

    for (const pathname of ['/pt/nao-existe', '/pt/artigos/nao-existe/']) {
      const page = await open(pathname);
      assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR', pathname);
      assert.equal(await page.locator('h1').textContent(), 'Página não encontrada', pathname);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
      assert.equal(await page.locator('.brand').first().getAttribute('href'), '/pt');
      assert.equal(await page.locator('.privacy-link a').getAttribute('href'), '/pt/politica-de-privacidade');
      await page.close();
    }
    const es = await open('/nao-existe');
    assert.equal(await es.locator('h1').textContent(), 'Página no encontrada');
    assert.equal(await es.locator('html').getAttribute('lang'), 'es');
    await es.close();
    const ptLike = await open('/ptolomeo');
    assert.equal(await ptLike.locator('h1').textContent(), 'Página no encontrada');
    console.log('Not found E2E passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
