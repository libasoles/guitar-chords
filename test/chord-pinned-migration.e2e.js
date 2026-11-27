/* Previously pinned chord names survive canonical catalog renames in both clients. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'chord-pinned-migration-'));
  let browser;
  try {
    execFileSync(process.execPath, ['scripts/build-ext.js', 'chords', '--out-dir', output], { cwd: ROOT, stdio: 'pipe' });
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    for (const client of [
      { name: 'web', file: path.join(__dirname, 'chord-finder.fixture.html'), prefix: '#pin ', label: '.name' },
      { name: 'extension', file: path.join(output, 'chords/popup.html'), prefix: '', label: '.pinned-name' },
    ]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.addInitScript(() => {
        // Sembrar solo en la primera carga de la pestaña: sessionStorage sobrevive al reload.
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem('pinnedChords', JSON.stringify([{ name: 'Bm7b5', positionIndex: 1 }, 'Cm7b5']));
        }
        localStorage.setItem('chordNotation', 'en');
      });
      await page.goto(pathToFileURL(client.file).href);
      const cards = page.locator(client.prefix + '.pinned-card');
      await cards.nth(1).waitFor();
      assert.deepEqual(await cards.locator(client.label).allTextContents(), ['Bm7♭5', 'Cm7♭5'], client.name);
      await cards.nth(1).locator('.pinned-remove').click();
      const expected = [{ name: 'Bm7♭5', positionIndex: 1 }];
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('pinnedChords'))), expected, client.name);
      await page.reload();
      await cards.first().waitFor();
      assert.equal(await cards.count(), 1, client.name);
      assert.equal(await cards.locator(client.label).textContent(), 'Bm7♭5', client.name);
      await cards.first().locator('.pinned-remove').click();
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('pinnedChords'))), [], client.name);
      await context.close();
      console.log(client.name + ': pinned names migrated, position preserved and removal persisted');
    }
  } finally {
    if (browser) await browser.close();
    fs.rmSync(output, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
