#!/usr/bin/env node
'use strict';
/* capture-tabs-es.js — Captures the Spanish Guitar Tabs popup (same riffs as the English
   captures) into store/tabs/screenshots/es/capture-{1,2,3}.png, the source of the Spanish
   store images made by promo-tabs.js.
   Usage: npm run build:ext:tabs && node scripts/capture-tabs-es.js */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'extensions', 'tabs');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const OUT = path.join(ROOT, 'store', 'tabs', 'screenshots', 'es');

// Columns hold the 6 strings from high e to low E; each note is [string, fret].
const STRINGS = { e: 0, B: 1, G: 2, D: 3, A: 4, E: 5 };
const tab = columns => {
  const out = [];
  for (const [col, notes] of Object.entries(columns)) {
    const c = Array(6).fill('');
    for (const [s, fret] of Object.entries(notes)) c[STRINGS[s]] = fret;
    out[col] = c;
  }
  return Array.from(out, c => c || Array(6).fill(''));
};
const TABS = [
  tab({ 0: { A: 2 }, 1: { D: 4 }, 2: { G: 4 }, 3: { B: 3 }, 4: { G: 4 }, 5: { D: 4 }, 6: { e: 2 }, 7: { B: 3 }, 8: { G: 4 } }),
  tab({ 0: { A: 0 }, 1: { G: 2 }, 2: { B: 2 }, 3: { e: 0 }, 4: { B: 2 }, 5: { G: 2 }, 6: { e: 2 }, 7: { B: 2 }, 8: { G: 2 }, 9: { e: 0 }, 10: { B: 2 }, 11: { G: 2 }, 12: { E: 0 } }),
  tab({ 0: { B: 1, D: 2 }, 1: { B: 1, D: 2 }, 2: { e: 0, G: 2 }, 5: { B: 0, E: 0 }, 6: { B: 0, E: 0 }, 7: { e: 0, G: 1 } }),
  tab({ 0: { e: 3, B: 2, G: 2, D: 0 } }),
];

// ES modules do not load from file://, so serve the built extension locally.
const serve = () => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0, () => resolve(server));
});

async function run() {
  const server = await serve();
  const PAGE = `http://localhost:${server.address().port}/popup.es.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 780, height: 580 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(tabs => {
    localStorage.setItem('tabEditor.tabs', JSON.stringify(tabs));
    localStorage.setItem('tabLetterLabels', '1'); // string letters, as in the English captures
  }, TABS);
  const page = await ctx.newPage();
  await page.goto(PAGE);
  await page.waitForSelector('ascii-tabs', { state: 'attached' });
  await page.addStyleTag({ content: '.panel-footer { display: none }' }); // the English captures leave the footer out
  await page.waitForTimeout(800);
  const shot = n => page.screenshot({ path: path.join(OUT, `capture-${n}.png`) });

  await shot(1);
  await page.evaluate(() => {
    document.querySelector('.tab-tutorial').style.display = 'none';
    document.body.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(100);
  await shot(2);
  await page.evaluate(() => {
    document.body.scrollTo(0, 0);
    const tutorial = document.querySelector('.tab-tutorial');
    tutorial.style.display = '';
    tutorial.open = true;
    tutorial.scrollIntoView();
  });
  await page.waitForTimeout(200);
  await shot(3);
  await browser.close();
  server.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
