#!/usr/bin/env node
'use strict';
/* og-partitura.js — Renders the link-preview images of the Partitura y
   tablatura page: the home banner (illustration + kicker, title and
   description from src/i18n) as 1200x630 PNGs.
   Output: src/site/og-partitura-es.png, src/site/og-partitura-en.png
   Usage: node scripts/og-partitura.js  (re-run when the banner texts change) */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'src', 'site');
const BANNER = fs.readFileSync(path.join(SITE, 'partitura-banner.webp')).toString('base64');
const HOST = 'acordesdeguitarra.com.ar';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function html(s) {
  return `<!doctype html><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; background: #fdfaf5; color: #1a1a1a;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      display: flex; align-items: center; gap: 56px; padding: 0 72px; }
    img { width: 480px; height: 436px; border-radius: 20px; flex: none; }
    .kicker { font: 600 26px -apple-system, "Helvetica Neue", Arial, sans-serif;
      text-transform: uppercase; letter-spacing: .1em; color: #8b0000; }
    h1 { font-size: 72px; line-height: 1.08; margin: 14px 0 22px; }
    p { font: 32px/1.35 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #555; }
    .host { margin-top: 36px; font: 600 24px -apple-system, "Helvetica Neue", Arial, sans-serif; color: #8b0000; }
  </style>
  <img src="data:image/webp;base64,${BANNER}" alt="">
  <div>
    <div class="kicker">${esc(s.partPromoKicker)}</div>
    <h1>${esc(s.partPromoTitle)}</h1>
    <p>${esc(s.partPromoDescription)}</p>
    <div class="host">${HOST}</div>
  </div>`;
}

async function run() {
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const locale of ['es', 'en']) {
    const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', `strings.${locale}.json`), 'utf8'));
    await page.setContent(html(strings));
    const out = path.join(SITE, `og-partitura-${locale}.png`);
    await page.screenshot({ path: out });
    console.log('saved →', path.relative(ROOT, out));
  }
  await browser.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
