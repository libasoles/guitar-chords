#!/usr/bin/env node
'use strict';
/* capture-fifths.js — Captures the real Circle of Fifths popup (780×580 at 2×) in English and
   Spanish into store/fifths/screenshots/capture-{1,2,3}.png and es/capture-{1,2,3}.png, the source
   of the store images made by promo-fifths.js:
     1  C major selected (the default view)
     2  E♭ major pinned, its chords lifted off the wheel
     3  A minor selected, with its diminished chord
   Usage: npm run build:ext:fifths && node scripts/capture-fifths.js */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'extensions', 'fifths');
const OUT = path.join(ROOT, 'store', 'fifths', 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const serve = () => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(0, () => resolve(server));
});

// The popup reads its texts through chrome.i18n; stand in for it with the packaged messages.
const stubChrome = ({ locale, messages }) => {
  window.chrome = { i18n: { getUILanguage: () => locale, getMessage: key => (messages[key] || {}).message || '' } };
};

const SHOTS = {
  en: [
    { n: 1, key: 'C major' },
    { n: 2, key: 'E♭ major', pin: true },
    { n: 3, key: 'A minor' },
  ],
  es: [
    { n: 1, key: 'Do mayor' },
    { n: 2, key: 'Mi♭ mayor', pin: true },
    { n: 3, key: 'La menor' },
  ],
};

async function run() {
  const server = await serve();
  const url = `http://localhost:${server.address().port}/popup.html`;
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  for (const locale of ['en', 'es']) {
    const messages = JSON.parse(fs.readFileSync(path.join(DIST, '_locales', locale, 'messages.json'), 'utf8'));
    const ctx = await browser.newContext({ viewport: { width: 780, height: 580 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(stubChrome, { locale, messages });
    const page = await ctx.newPage();
    for (const { n, key, pin } of SHOTS[locale]) {
      await page.goto(url);
      await page.waitForSelector('.fifths-key');
      const button = page.getByRole('button', { name: key, exact: true });
      if (pin) await button.click(); else await button.hover();
      await page.waitForTimeout(900); // the lift and the sidebar crossfade settle
      await page.screenshot({ path: path.join(OUT, locale === 'es' ? 'es' : '', `capture-${n}.png`) });
      console.log('saved → store/fifths/screenshots/' + (locale === 'es' ? 'es/' : '') + `capture-${n}.png`);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
}

run().catch(err => { console.error(err); process.exit(1); });
