#!/usr/bin/env node
'use strict';
/* promo-tabs.js — Generates the Guitar Tabs Chrome Web Store images in
   store/tabs/screenshots/ from the captures image.png, image 2.png, image 3.png:
   01-editor, 02-tabs, 03-tutorial (1280×800), promo-small-440x280 and promo-marquee-1400x560.
   The Spanish set goes to store/tabs/screenshots/es/ from es/capture-{1,2,3}.png
   (made by capture-tabs-es.js).
   Usage: node scripts/promo-tabs.js */

const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'scripts', 'promo-tabs.html');
const OUT = path.join(ROOT, 'store', 'tabs', 'screenshots');

const IMAGES = [
  { file: '01-editor.png', query: 'mode=shot&n=1', width: 1280, height: 800 },
  { file: '02-tabs.png', query: 'mode=shot&n=2', width: 1280, height: 800 },
  { file: '03-tutorial.png', query: 'mode=shot&n=3', width: 1280, height: 800 },
  { file: 'promo-small-440x280.png', query: 'mode=tile', width: 440, height: 280 },
  { file: 'promo-marquee-1400x560.png', query: 'mode=marquee', width: 1400, height: 560 },
];

async function run() {
  const browser = await chromium.launch();
  for (const lang of ['en', 'es']) for (const { file, query, width, height } of IMAGES) {
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
    await page.goto(`${PAGE}?${query}&lang=${lang}`);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
    await page.screenshot({ path: path.join(OUT, lang === 'es' ? 'es' : '', file) });
    console.log('saved →', path.join('store/tabs/screenshots', lang === 'es' ? 'es' : '', file));
  }
  await browser.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
