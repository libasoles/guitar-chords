'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async function () {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = 'http://localhost:' + server.address().port;
    for (const locale of ['', '/en']) {
      await page.goto(base + locale + '/circulo-de-quintas');
      const key = label => page.getByRole('button', { name: label, exact: true });
      const es = !locale;
      const chords = () => page.locator('.fifths-chord strong').allTextContents();
      assert.equal(await page.locator('.fifths-key').count(), 24);
      assert.equal(await page.locator('.fifths-outer-signature svg').count(), 12);
      assert.equal(await page.locator('.fifths-key.is-related').count(), 6);
      assert.deepEqual(await chords(), es ? ['Do', 'Rem', 'Mim', 'Fa', 'Sol', 'Lam', 'Si°'] : ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
      await key(es ? 'Sol mayor' : 'G major').hover();
      assert.equal(await page.locator('#fifths-signature span').textContent(), es ? 'Fa♯' : 'F♯');
      assert.deepEqual(await chords(), es ? ['Sol', 'Lam', 'Sim', 'Do', 'Re', 'Mim', 'Fa♯°'] : ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F♯°']);
      await page.locator('h1').hover();
      assert.equal(await page.locator('#fifths-key').textContent(), es ? 'Do mayor' : 'C major');
      await key(es ? 'La menor' : 'A minor').click();
      await page.locator('h1').hover();
      assert.deepEqual(await chords(), es ? ['Lam', 'Si°', 'Do', 'Rem', 'Mim', 'Fa', 'Sol'] : ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
      await key(es ? 'Fa♯ mayor' : 'F♯ major').focus();
      assert.deepEqual(await chords(), es ? ['Fa♯', 'Sol♯m', 'La♯m', 'Si', 'Do♯', 'Re♯m', 'Mi♯°'] : ['F♯', 'G♯m', 'A♯m', 'B', 'C♯', 'D♯m', 'E♯°']);
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#fifths-key').textContent(), es ? 'Re♭ mayor' : 'D♭ major');
      assert.deepEqual(await chords(), es ? ['Re♭', 'Mi♭m', 'Fam', 'Sol♭', 'La♭', 'Si♭m', 'Do°'] : ['D♭', 'E♭m', 'Fm', 'G♭', 'A♭', 'B♭m', 'C°']);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.locator('h1').hover();
      await page.evaluate(() => document.activeElement.blur());
      assert.equal(await page.locator('#fifths-key').textContent(), es ? 'Re♭ mayor' : 'D♭ major');
      for (const button of await page.locator('.fifths-key').all()) {
        await button.focus();
        assert.equal(await page.locator('.fifths-key.is-related').count(), 6);
        assert.equal(await page.locator('.fifths-chord').count(), 7);
      }
      await page.locator('h1').hover();
      await page.evaluate(() => document.activeElement.blur());
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.locator('.lead').count(), 0);
      assert.ok(!(await page.content()).includes('%%'));
    }
    assert.deepEqual(errors, []);
    console.log('Fifths wheel E2E passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
