#!/usr/bin/env node
'use strict';
/* screenshot.js — Captures the website home page for social sharing and README.
   Output: src/site/og-image.png (1200×630)
   Usage: node scripts/screenshot.js (run npm run build:site first) */

const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');
const { serveStatic } = require('./lib/static-server');

const ROOT = path.join(__dirname, '..');

async function run() {
  const server = await serveStatic(path.join(ROOT, 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
      locale: 'es-AR',
      reducedMotion: 'reduce',
    });
    await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'networkidle' });
    await page.locator('chord-finder .card:not(.hidden) svg').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, 'src', 'site', 'og-image.png') });
    console.log('saved → src/site/og-image.png (1200×630)');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exitCode = 1; });
}

module.exports = { run };
