#!/usr/bin/env node
'use strict';
/* screenshot.js — Captures a popup screenshot for og:image / social sharing.
   Output: src/site/og-image.png
   Usage: node scripts/screenshot.js  (requires dist/extension/ to be built first) */

const path = require('path');
const { chromium } = require('playwright');

const POPUP = 'file://' + path.join(__dirname, '..', 'dist', 'extension', 'popup.html');
const OUT   = path.join(__dirname, '..', 'src', 'site', 'og-image.png');

async function waitForCards(page) {
  await page.waitForFunction(() => {
    const cards = document.querySelectorAll('#results .card');
    return cards.length > 0;
  });
}

async function pinFirst(page) {
  await page.locator('#results .card .pin-button').first().click();
  await page.waitForFunction(() => document.querySelector('#pinned-shell:not([hidden])'));
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 380, height: 620 } });
  const page    = await context.newPage();

  await page.goto(POPUP);
  await page.waitForLoadState('domcontentloaded');

  const input = page.locator('#q');

  // Pin G
  await input.fill('G');
  await waitForCards(page);
  await pinFirst(page);

  // Pin D7
  await input.fill('D7');
  await waitForCards(page);
  await pinFirst(page);

  // Show C in the search results (mirrors the reference screenshot)
  await input.fill('C');
  await waitForCards(page);

  // Let svguitar finish rendering SVGs
  await page.waitForTimeout(600);

  await page.screenshot({ path: OUT });
  console.log('og:image saved → ' + path.relative(path.join(__dirname, '..'), OUT));

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
