#!/usr/bin/env node
'use strict';
/* promo-marquee.js — Generates store/screenshots/promo-marquee-1400x560.png
   using the real svguitar-based ChordDiagram renderer (6-string diagrams),
   instead of hand-faked artwork.
   Usage: node scripts/promo-marquee.js  (requires dist/extension/ to be
   built first via `npm run build:ext`, for dist/extension/chords-db.js) */

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'scripts', 'promo-marquee.html');
const OUT = path.join(ROOT, 'store', 'screenshots', 'promo-marquee-1400x560.png');

async function run() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 560 } });
  const page = await ctx.newPage();
  await page.goto(PAGE);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.querySelectorAll('.diagram svg').length === 2);
  await page.waitForTimeout(200); // let svguitar finish painting

  await page.screenshot({ path: OUT });
  await browser.close();

  console.log('saved →', path.relative(ROOT, OUT));
}

run().catch((err) => { console.error(err); process.exit(1); });
