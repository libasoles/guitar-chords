#!/usr/bin/env node
'use strict';
/* promo-fifths.js — Generates the Circle of Fifths Chrome Web Store images in
   store/fifths/screenshots/ from the captures capture-{1,2,3}.png (made by capture-fifths.js):
   01-keys, 02-pinned, 03-minor (1280×800), promo-small-440x280 and promo-marquee-1400x560.
   The Spanish set goes to store/fifths/screenshots/es/.
   Usage: node scripts/promo-fifths.js */

const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'scripts', 'promo-fifths.html');
const OUT = path.join(ROOT, 'store', 'fifths', 'screenshots');

const IMAGES = [
  { file: '01-keys.png', query: 'mode=shot&n=1', width: 1280, height: 800 },
  { file: '02-pinned.png', query: 'mode=shot&n=2', width: 1280, height: 800 },
  { file: '03-minor.png', query: 'mode=shot&n=3', width: 1280, height: 800 },
  { file: 'promo-small-440x280.png', query: 'mode=tile', width: 440, height: 280 },
  { file: 'promo-marquee-1400x560.png', query: 'mode=marquee', width: 1400, height: 560 },
];

async function run() {
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  for (const lang of ['en', 'es']) for (const { file, query, width, height } of IMAGES) {
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
    await page.goto(`${PAGE}?${query}&lang=${lang}`);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
    await page.screenshot({ path: path.join(OUT, lang === 'es' ? 'es' : '', file) });
    console.log('saved →', path.join('store/fifths/screenshots', lang === 'es' ? 'es' : '', file));
  }
  await browser.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
