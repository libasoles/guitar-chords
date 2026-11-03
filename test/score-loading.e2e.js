'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');
const M = require('../src/site/score-model');

(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const base = 'http://localhost:' + server.address().port;
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    for (const locale of ['es', 'en', 'pt']) {
      const page = await noJs.newPage();
      await page.goto(base + pagePath('partitura', locale));
      assert.equal(await page.locator('#scoreStage g.measure').count(), 12, locale + ' includes a static score without JS');
      assert.equal(await page.locator('#scoreStage g.system').count(), 3);
      assert.equal(await page.locator('.score-page').evaluate(el => getComputedStyle(el).animationName), 'none');
      assert.ok((await page.locator('#scoreStage > svg').boundingBox()).height > 100);
      await page.close();
    }
    await noJs.close();

    for (const fallback of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const streaming = WebAssembly.instantiateStreaming.bind(WebAssembly);
        window.streaming = { attempts: 0, successes: 0 };
        WebAssembly.instantiateStreaming = async (...args) => {
          window.streaming.attempts++;
          const value = await streaming(...args);
          window.streaming.successes++;
          return value;
        };
      });
      if (fallback) {
        const score = { ...M.emptyScore(), title: 'Recuperada', rows: Array.from({ length: 4 }, M.emptyRow) };
        await page.addInitScript(score => localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] })), score);
      }
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const wasmRequested = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('.wasm'), { timeout: 15000 });
      await page.route('**/*.wasm', async route => {
        await gate;
        const response = await route.fetch();
        if (fallback) await route.fulfill({ response, contentType: 'application/octet-stream' });
        else await route.fulfill({ response });
      });
      await page.goto(base + pagePath('partitura', fallback ? 'en' : 'es'), { waitUntil: 'domcontentloaded' });
      const wasmUrl = (await wasmRequested).url();
      assert.match(wasmUrl, /\/assets\/vendor\/verovio-6\.4\.0\.[a-f0-9]{10}\.wasm$/);
      assert.equal(await page.locator('#scoreStage[aria-busy="true"] g.measure').count(), 12, 'static score remains visible while WASM downloads');
      assert.equal(await page.locator('#scoreStage.is-loading').count(), fallback ? 1 : 0);
      await page.evaluate(() => { window.initialScoreSvg = document.querySelector('#scoreStage svg'); });
      release();
      await page.waitForSelector('#scoreStage:not([aria-busy]) .score-clef-trigger');
      assert.equal(await page.evaluate(() => window.initialScoreSvg === document.querySelector('#scoreStage svg')), false);
      assert.deepEqual(await page.evaluate(() => window.streaming), { attempts: 1, successes: fallback ? 0 : 1 });
      assert.equal(await page.locator('#scoreStage g.measure').count(), fallback ? 16 : 12);
      assert.equal(await page.locator('#scoreStage.is-loading').count(), 0);
      if (fallback) assert.equal(await page.locator('#scoreTitle').inputValue(), 'Recuperada');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('score-loading e2e: OK (static HTML, streaming WASM, MIME fallback, saved scores)');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
