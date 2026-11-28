'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');

// "I" in the sheet-music viewer hands the score's MusicXML to /partitura: it opens with its published TAB showing.
(async () => {
  const dir = path.join(__dirname, '..', 'downloads', 'sor-op44');
  const file = fs.readdirSync(dir).find((name) => name.includes(' 10 ') && name.endsWith('.musicxml'));
  const xml = fs.readFileSync(path.join(dir, file), 'utf8');
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const base = 'http://localhost:' + server.address().port;
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(base + pagePath('partitura', 'es'));
    await page.evaluate((x) => sessionStorage.setItem('partitura.handoff', JSON.stringify({ name: 'sor.musicxml', xml: x })), xml);
    await page.goto(base + pagePath('partitura', 'es'));
    const toast = page.locator('.toast-logo');
    await toast.waitFor();
    assert.ok((await toast.boundingBox()).width < 80, 'the import toast logo is small');
    assert.equal(await page.locator('#scoreTabToggle').getAttribute('aria-pressed'), 'true', 'TAB is on by default');
    // The first note is D4 on string 2, fret 3, as published; recalculating would put it on the open D string.
    await page.locator('.score-tab').first().waitFor();
    await page.waitForTimeout(500);
    const cells = (await page.locator('.score-tab').first().evaluate((el) => el.innerText)).split('\n');
    // Strings read e, B, G, D, A, E. The first note is D4 on string 2, fret 3 as published; recalculating
    // would finger it on the open D string, leaving the B row to start at a later note.
    assert.equal(cells[cells.indexOf('B') + 1], '3', 'the published fingering is kept');
    console.log('ok score handoff');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
