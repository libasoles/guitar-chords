/* Previously pinned chord names survive canonical catalog renames in both clients. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'chord-pinned-migration-'));
  let browser;
  try {
    execFileSync(process.execPath, ['scripts/build-ext.js', 'chords', '--out-dir', output], { cwd: ROOT, stdio: 'pipe' });
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    for (const client of [
      { name: 'web', root: ROOT, urlPath: '/test/chord-finder.fixture.html', prefix: '#pin ', label: '.name' },
      { name: 'extension', root: output, urlPath: '/chords/popup.html', prefix: '', label: '.pinned-name' },
    ]) {
      const server = await serveStatic(client.root, 0);
      const context = await browser.newContext();
      try {
        const base = 'http://127.0.0.1:' + server.address().port;
        const page = await context.newPage();
        // Sembrar localStorage sobre el mismo origen HTTP antes de abrir el cliente
        // para no depender de addInitScript ni de sessionStorage en file:// al recargar.
        await page.route(base + '/__seed__', (route) =>
          route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html>' })
        );
        await page.goto(base + '/__seed__');
        await page.evaluate(() => {
          localStorage.setItem('pinnedChords', JSON.stringify([{ name: 'Bm7b5', positionIndex: 1 }, 'Cm7b5']));
          localStorage.setItem('chordNotation', 'en');
        });
        await page.goto(base + client.urlPath);
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
        console.log(client.name + ': pinned names migrated, position preserved and removal persisted');
      } finally {
        await context.close();
        await new Promise((resolve) => server.close(resolve));
      }
    }
  } finally {
    if (browser) await browser.close();
    fs.rmSync(output, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
