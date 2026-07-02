#!/usr/bin/env node
'use strict';
/* screenshots.js — Captures all Chrome Web Store screenshots + og-image.
   Outputs:
     store/screenshots/01-search.png   (1280×800)
     store/screenshots/02-pinned.png   (1280×800)
     src/site/og-image.png             (1200×630)
   Usage: node scripts/screenshots.js  (requires dist/extension/ to be built first) */

const path = require('path');
const fs   = require('fs');
const { chromium } = require('playwright');

const ROOT   = path.join(__dirname, '..');
const POPUP  = 'file://' + path.join(ROOT, 'dist', 'extension', 'popup.html');
const STORE  = path.join(ROOT, 'store', 'screenshots');
const SITE   = path.join(ROOT, 'src', 'site');

fs.mkdirSync(STORE, { recursive: true });
fs.mkdirSync(SITE,  { recursive: true });

async function waitForCards(page) {
  await page.waitForFunction(() => document.querySelectorAll('#results .card').length > 0);
}

async function pinFirst(page) {
  await page.locator('#results .card .pin-button').first().click();
  await page.waitForFunction(() => document.querySelector('#pinned-shell:not([hidden])'));
}

// Wrap the popup DOM in a centered card on a dark gradient background.
async function applyBackground(page, vpW, vpH) {
  await page.addStyleTag({ content: `
    html, body {
      width: ${vpW}px !important;
      height: ${vpH}px !important;
      margin: 0 !important;
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: linear-gradient(140deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%) !important;
      font-family: var(--serif, Georgia, serif);
    }
    #popup-wrapper {
      width: 370px;
      background: var(--paper, #fdfaf5);
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.18);
      overflow: hidden;
      padding: 12px 14px 14px;
    }
  ` });

  await page.evaluate(() => {
    const wrapper = document.createElement('div');
    wrapper.id = 'popup-wrapper';
    const children = Array.from(document.body.childNodes);
    children.forEach(c => wrapper.appendChild(c));
    document.body.appendChild(wrapper);
  });
}

async function capture(page, outPath) {
  await page.waitForTimeout(700); // let svguitar finish
  await page.screenshot({ path: outPath });
  console.log('saved →', path.relative(ROOT, outPath));
}

async function run() {
  // ── 01-search.png  (1280×800, typing "C") ─────────────────────────────
  {
    const browser = await chromium.launch();
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(POPUP);
    await page.waitForLoadState('domcontentloaded');
    await applyBackground(page, 1280, 800);

    await page.locator('#q').fill('C');
    await waitForCards(page);

    await capture(page, path.join(STORE, '01-search.png'));
    await browser.close();
  }

  // ── 02-pinned.png  (1280×800, G + D7 pinned, searching "Am") ──────────
  {
    const browser = await chromium.launch();
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(POPUP);
    await page.waitForLoadState('domcontentloaded');
    await applyBackground(page, 1280, 800);

    const input = page.locator('#q');
    await input.fill('G');
    await waitForCards(page);
    await pinFirst(page);

    await input.fill('D7');
    await waitForCards(page);
    await pinFirst(page);

    await input.fill('Am');
    await waitForCards(page);

    await capture(page, path.join(STORE, '02-pinned.png'));
    await browser.close();
  }

  // ── og-image.png  (1200×630) ────────────────────────────────────────
  {
    const browser = await chromium.launch();
    const ctx  = await browser.newContext({ viewport: { width: 1200, height: 630 } });
    const page = await ctx.newPage();
    await page.goto(POPUP);
    await page.waitForLoadState('domcontentloaded');
    await applyBackground(page, 1200, 630);

    const input = page.locator('#q');
    await input.fill('G');
    await waitForCards(page);
    await pinFirst(page);

    await input.fill('D7');
    await waitForCards(page);
    await pinFirst(page);

    await input.fill('C');
    await waitForCards(page);

    await capture(page, path.join(SITE, 'og-image.png'));
    await browser.close();
  }

  console.log('\nDone. 3 files written.');
}

run().catch(err => { console.error(err); process.exit(1); });
