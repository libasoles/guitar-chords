#!/usr/bin/env node
'use strict';
/* Capture the home banners' illustrations for tool link previews.
   Usage: node scripts/og-tool-banners.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'src', 'site');
const css = fs.readFileSync(path.join(SITE, 'css', '04-home-promos.css'), 'utf8');

async function run() {
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    for (const [tool, locale] of [['tab-editor', 'es'], ['note-finder', 'es'], ['note-finder', 'en']]) {
      const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', `strings.${locale}.json`), 'utf8'));
      const banner = fs.readFileSync(path.join(SITE, `${tool}-promo.html`), 'utf8')
        .replace(/%%(\w+)%%/g, (_, key) => strings[key] || '');
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>
        :root { --mono: monospace; --ink: #1a1a1a; --ink-soft: #666;
          --rule: #d8d3c7; --accent: #8b0000; }
        ${css}
        body { margin: 0; width: 1200px; height: 630px; background: #fdfaf5;
          display: grid; place-items: center; }
        section { margin: 0 !important; }
        a { display: block !important; padding: 0 !important; border: 0 !important;
          background: transparent !important; pointer-events: none; }
        .tab-promo-copy, .note-finder-promo-copy { display: none; }
        .tab-promo-sheet { transform: scale(2.65); }
        .tab-promo-ink { animation: none; width: 29ch; opacity: 1; }
        .note-finder-promo-notes { transform: scale(3); }
      </style>${banner}`);
      await page.evaluate(() => document.fonts.ready);
      const name = tool === 'tab-editor' ? 'og-tab-editor.png' : `og-note-finder-${locale}.png`;
      await page.screenshot({ path: path.join(SITE, name) });
      console.log('saved →', name);
    }
  } finally {
    await browser.close();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
