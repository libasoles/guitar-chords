#!/usr/bin/env node
'use strict';
/* Rasterize the existing notation + TAB previews for social link cards.
   Re-run with node scripts/og-articles.js when the score previews change. */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');

const SITE = path.join(__dirname, '..', 'src', 'site');
const previews = {
  arpeggios: require('./lib/article-arpeggios').cardImage(),
  carcassi: require('./lib/article-carcassi').cardImage(),
  preludes: require('./lib/article-carcassi-preludes').cardImage(),
};

async function run() {
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    for (const [name, preview] of Object.entries(previews)) {
      const svg = fs.readFileSync(preview.src).toString('base64');
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>
        body { margin: 0; width: 1200px; height: 630px; background: white;
          display: flex; align-items: center; justify-content: center; }
        img { width: 1080px; height: 510px; object-fit: contain; }
      </style><img alt="" src="data:image/svg+xml;base64,${svg}">`);
      await page.locator('img').evaluate((img) => img.decode());
      const out = path.join(SITE, `og-score-${name}.png`);
      await page.screenshot({ path: out });
      console.log('saved →', path.relative(SITE, out));
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
