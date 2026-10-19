#!/usr/bin/env node
'use strict';
/* Capture the built circle of fifths for social previews.
   Usage: npm run build:site && node scripts/og-fifths.js */
const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');
const { serveStatic } = require('./lib/static-server');
const { pagePath } = require('./lib/slugs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const server = await serveStatic(path.join(ROOT, 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({ viewport: { width: 1000, height: 1100 }, deviceScaleFactor: 2 });
    const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    // Only local assets are needed for the capture.
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === 'localhost'
      ? route.continue() : route.abort());
    for (const locale of ['es', 'en']) {
      await page.goto('http://localhost:' + server.address().port + pagePath('circulo-de-quintas', locale));
      await page.waitForSelector('.fifths-key');
      await page.evaluate(() => document.fonts.ready);
      const wheel = await page.locator('#fifths-wheel').screenshot();
      await card.setContent(`<!doctype html><style>
        body { margin: 0; width: 1200px; height: 630px; background: #fdfaf5;
          display: grid; place-items: center; }
        img { width: 590px; height: 590px; object-fit: contain; }
      </style><img alt="" src="data:image/png;base64,${wheel.toString('base64')}">`);
      await card.locator('img').evaluate((img) => img.decode());
      const name = `og-fifths-${locale}.png`;
      await card.screenshot({ path: path.join(ROOT, 'src', 'site', name) });
      console.log('saved →', name);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
