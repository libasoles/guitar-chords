#!/usr/bin/env node
'use strict';
/* Capture the built popup and compose the README promotion.
   Usage: npm run build:ext:chords && node scripts/promo-chords-readme.js */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('./lib/chrome-path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store/chords/screenshots/promo-readme.png');

async function search(page, chord) {
  await page.locator('#q').fill(chord);
  await page.waitForFunction(name =>
    [...document.querySelectorAll('#results .card .name')].some(el => el.textContent === name), chord);
  await page.locator('#results .card .diagram svg').first().waitFor();
}

async function run() {
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  try {
    const page = await browser.newPage({
      viewport: { width: 360, height: 600 }, deviceScaleFactor: 2, locale: 'en-US',
    });
    await page.goto(pathToFileURL(path.join(ROOT, 'dist/extensions/chords/popup.html')).href);
    await search(page, 'C');
    await page.evaluate(() => document.fonts.ready);
    const searching = await page.screenshot();
    for (const chord of ['G', 'D7', 'Am']) {
      await search(page, chord);
      await page.locator('#results .card').filter({ has: page.locator('.name', { hasText: new RegExp(`^${chord}$`) }) }).locator('.pin-button').click();
    }
    await search(page, 'Cmaj7');
    await page.locator('#pinned .pinned-card').nth(2).waitFor();
    const pinned = await page.screenshot();
    const icon = fs.readFileSync(path.join(ROOT, 'src/site/guitar-player-cubist-left-head.svg')).toString('base64');
    const promo = await browser.newPage({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: 1 });
    await promo.setContent(`<!doctype html><html lang="en"><meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; width: 1400px; height: 820px; padding: 64px;
          display: flex; align-items: center; gap: 44px; background: #fdfaf5; color: #1a1a1a;
          font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
        .copy { width: 400px; flex: none; padding-right: 24px; }
        .logo { width: 64px; height: 64px; margin-bottom: 28px; }
        .kicker { font: 600 14px system-ui, sans-serif; color: #8b0000;
          letter-spacing: .12em; text-transform: uppercase; }
        h1 { font-size: 52px; font-weight: 400; line-height: 1.08; margin: 20px 0 24px; }
        p { font: 21px/1.5 system-ui, sans-serif; color: #555; margin: 0; }
        .offline { display: inline-block; margin-top: 30px; padding: 9px 14px;
          background: #efe9db; border: 1px solid #d8d2c4; border-radius: 7px;
          font: 600 15px system-ui, sans-serif; color: #8b0000; }
        figure { width: 392px; margin: 0; flex: none; }
        figcaption { font: 600 16px system-ui, sans-serif; margin-bottom: 16px; }
        .shot { display: block; width: 392px; height: auto; border-radius: 12px;
          border: 1px solid #d8d2c4; box-shadow: 0 12px 30px #00000016; }
      </style>
      <div class="copy"><img class="logo" src="data:image/svg+xml;base64,${icon}" alt="">
        <div class="kicker">Guitar Chords · Chrome extension</div>
        <h1>Find a chord.<br>Keep it close.</h1>
        <p>Search by name and explore chord diagrams. Pin your favorites while you play.</p>
        <span class="offline">100% offline</span>
      </div>
      <figure><figcaption>01 / Search by chord name</figcaption>
        <img class="shot" src="data:image/png;base64,${searching.toString('base64')}" alt="Chord search"></figure>
      <figure><figcaption>02 / Keep your favorites pinned</figcaption>
        <img class="shot" src="data:image/png;base64,${pinned.toString('base64')}" alt="Pinned chords"></figure>
      </html>`);
    await promo.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth));
    await promo.evaluate(() => document.fonts.ready);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await promo.screenshot({ path: OUT });
    console.log('saved →', path.relative(ROOT, OUT));
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error(err); process.exitCode = 1; });
