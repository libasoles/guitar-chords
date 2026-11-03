'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { readScoreStorage } = require('./score-storage-helpers');
const M = require('../src/site/score-model');
const IO = require('../src/site/score-io');

(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const original = { ...M.emptyScore(), title: 'Guardada', showTabs: true };
    original.rows[0][0] = [{ n: 23, d: 'q' }, { n: 25, d: 'q' }];
    await page.addInitScript(score => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('scoreEditor.tabs.v1', JSON.stringify({ active: 0, scores: [score] }));
        sessionStorage.setItem('seeded', '1');
      }
    }, original);
    const url = 'http://localhost:' + server.address().port + '/partitura';
    await page.goto(url);
    await page.waitForSelector('.score-tuning-trigger');
    assert.equal(await page.locator('#scoreTitle').inputValue(), 'Guardada');
    assert.equal(await page.evaluate(() => localStorage.getItem('scoreEditor.tabs.v1')), null);
    assert.equal((await readScoreStorage(page)).scores[0].title, 'Guardada');
    assert.deepEqual((await page.locator('.ascii-tabs-label').allTextContents()).map(label => label.replace(/\|$/, '')), ['e', 'B', 'G', 'D', 'A', 'E']);
    await page.locator('.score-tuning-trigger').click();
    await page.locator('[data-tuning="drop-d"]').click();
    assert.deepEqual((await page.locator('.ascii-tabs-label').allTextContents()).map(label => label.replace(/\|$/, '')), ['e', 'B', 'G', 'D', 'A', 'D']);
    assert.equal(await page.locator('ascii-tabs').first().locator('.ascii-tabs-fret').first().textContent(), '2');
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await page.locator('ascii-tabs').first().locator('.ascii-tabs-fret').first().textContent(), '0');
    await page.locator('.score-tuning-trigger').click();
    await page.locator('[data-tuning="drop-d"]').click();
    assert.equal((await readScoreStorage(page)).scores[0].tuning, 'drop-d');
    await page.reload();
    await page.waitForSelector('.score-tuning-trigger');
    assert.equal(await page.evaluate(() => scoreEditor.score.tuning), 'drop-d');

    await page.locator('#betaOpen').click();
    assert.equal(await page.locator('#betaPopover').isVisible(), true);
    const beta = await page.locator('#betaOpen').boundingBox();
    assert.ok(beta.x < 25 && beta.y > 940, 'Beta sits at the bottom left');
    assert.equal(await page.locator('#betaPopover p').count(), 4);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#betaPopover').isVisible(), false);
    await page.locator('#betaOpen').click();
    await page.locator('#scoreTitle').click();
    assert.equal(await page.locator('#betaPopover').isVisible(), false);

    // Place a crescendo through the same palette action as a visitor.
    await page.locator('[data-hairpin="cresc"]').press('Enter');
    const staff = await page.locator('#m0 g.staff > path').first().boundingBox();
    await page.mouse.click(staff.x + staff.width * 0.5, staff.y + 12);
    await page.waitForSelector('.score-hairpin-hit');
    await page.keyboard.press('Escape');
    await page.locator('.score-hairpin-hit').click();
    await page.locator('.score-hairpin-dyn[data-side="start"]').click();
    await page.locator('[data-dynamic="pp"]').click();
    assert.equal(await page.evaluate(() => scoreEditor.score.hairpins[0][0].startDyn), 'pp');
    await page.locator('.score-hairpin-grip[data-side="end"]').focus();
    await page.keyboard.press('ArrowLeft');
    assert.ok(await page.evaluate(() => scoreEditor.score.hairpins[0][0].to < 96));
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await page.evaluate(() => scoreEditor.score.hairpins[0][0].to), undefined);

    const midiDownload = page.waitForEvent('download');
    await page.locator('#scoreDownloadToggle').click();
    await page.locator('#scoreDownloadMidi').click();
    const midi = await midiDownload;
    const bytes = await fs.readFile(await midi.path());
    assert.equal(bytes.subarray(0, 4).toString(), 'MThd');
    assert.deepEqual(M.attacks(IO.parseMidi(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), M)).flatMap(a => a.midis), [40, 43]);
    const xmlDownload = page.waitForEvent('download');
    await page.locator('#scoreDownloadToggle').click();
    await page.locator('#scoreDownloadXml').click();
    const xml = await fs.readFile(await (await xmlDownload).path());
    assert.match(xml.toString(), /wedge type="crescendo"/);
    await page.locator('#scoreImportFile').setInputFiles({ name: 'reimportada.musicxml', mimeType: 'application/xml', buffer: xml });
    await page.waitForFunction(() => document.querySelectorAll('.score-doc-tab').length === 2);
    assert.deepEqual(await page.evaluate(() => ScoreModel.attacks(scoreEditor.score).flatMap(a => a.midis)), [40, 43]);
    await page.locator('#scoreImportFile').setInputFiles({ name: 'reimportada.mid', mimeType: 'audio/midi', buffer: bytes });
    await page.waitForFunction(() => document.querySelectorAll('.score-doc-tab').length === 3);
    assert.deepEqual(await page.evaluate(() => ScoreModel.attacks(scoreEditor.score).flatMap(a => a.midis)), [40, 43]);
    await page.locator('#scoreImportFile').setInputFiles({ name: 'invalida.mid', mimeType: 'audio/midi', buffer: Buffer.from('invalid') });
    await page.waitForFunction(() => document.body.textContent.includes(JSON.parse(document.getElementById('scoreStrings').textContent).importFailed));
    assert.equal(await page.locator('.score-doc-tab').count(), 3);
    assert.equal((await readScoreStorage(page)).scores[0].title, 'Guardada');
    assert.deepEqual(errors, []);
    await page.close();

    // A browser without IndexedDB still migrates legacy scores and saves edits.
    const fallback = await browser.newPage();
    await fallback.addInitScript(score => {
      Object.defineProperty(window, 'indexedDB', { get() { throw new Error('blocked'); } });
      if (!sessionStorage.getItem('fallback-seeded')) {
        localStorage.setItem('scoreEditor.v2', JSON.stringify(score));
        sessionStorage.setItem('fallback-seeded', '1');
      }
    }, original);
    await fallback.goto(url);
    await fallback.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    await fallback.locator('#scoreTitle').fill('Respaldo');
    await fallback.reload();
    await fallback.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    assert.equal(await fallback.locator('#scoreTitle').inputValue(), 'Respaldo');
    assert.equal(await fallback.evaluate(() => JSON.parse(localStorage.getItem('scoreEditor.tabs.v1')).scores[0].title), 'Respaldo');
    console.log('score-migration e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
