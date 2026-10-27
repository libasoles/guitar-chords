/* Editor privado /partitura. Ejecutar despues de npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function run() {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = 'http://localhost:' + server.address().port + '/partitura';
    await page.goto(url);
    await page.waitForSelector('.score-clef-trigger');
    assert.equal(await page.locator('.score-clef-trigger').count(), 3);

    // Click the printed clef itself; Escape discards the draft and restores focus.
    const box = await page.locator('#scoreStage g.clef').first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), true);
    assert.equal(await page.locator('#scoreClef').evaluate((el) => el === document.activeElement), true);
    await page.selectOption('#scoreClef', 'bass');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), false);
    assert.equal(await page.evaluate(() => scoreEditor.score.clef), 'guitar');
    await page.locator('.score-clef-trigger').first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.inputValue('#scoreClef'), 'guitar');
    await page.selectOption('#scoreClef', 'bass');
    await page.selectOption('#scoreKey', '-3');
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), false);
    assert.deepEqual(await page.evaluate(() => [scoreEditor.score.clef, scoreEditor.score.fifths]), ['bass', -3]);
    assert.equal(await page.locator('#scoreStage g.keySig').count(), 3);

    // New notes use the selected clef's actual staff positions.
    const line = await page.locator('#scoreStage g.measure > g.staff > path').nth(4).boundingBox();
    const note = page.getByRole('button', { name: 'Negra', exact: true });
    const palette = await note.boundingBox();
    await page.mouse.move(palette.x + palette.width / 2, palette.y + palette.height / 2);
    await page.mouse.down();
    await page.mouse.move(line.x + line.width * 0.6, line.y + line.height / 2, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].n), 25);
    const before = await page.evaluate(() => structuredClone(scoreEditor.score.rows));
    await page.locator('.score-clef-trigger').nth(1).click();
    await page.selectOption('#scoreClef', 'alto');
    await page.selectOption('#scoreKey', '2');
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows), before);
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual(await page.evaluate(() => [scoreEditor.score.clef, scoreEditor.score.fifths]), ['bass', -3]);
    await page.reload();
    await page.waitForSelector('.score-clef-trigger');
    assert.deepEqual(await page.evaluate(() => [scoreEditor.score.clef, scoreEditor.score.fifths]), ['bass', -3]);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows), before);

    // MusicXML includes the new clef and key (PDF uses the same model export).
    await page.locator('#scoreDownloadToggle').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#scoreDownloadXml').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let xml = '';
    for await (const chunk of stream) xml += chunk.toString();
    assert.match(xml, /<clef><sign>F<\/sign><line>4<\/line>/);
    assert.match(xml, /<fifths>-3<\/fifths>/);

    // Mobile popup stays inside the viewport; the meter remains independent.
    await page.setViewportSize({ width: 375, height: 720 });
    await page.waitForTimeout(200);
    await page.locator('.score-clef-trigger').first().click();
    const popup = await page.locator('#scoreClefPopup').boundingBox();
    assert.ok(popup.x >= 0 && popup.x + popup.width <= 375);
    assert.ok(popup.y >= 0 && popup.y + popup.height <= 720);
    await page.keyboard.press('Escape');
    await page.locator('.score-meter-trigger').click();
    assert.equal(await page.locator('#scoreMeterPopup').isVisible(), true);
    await page.getByRole('button', { name: '12/8', exact: true }).click();
    assert.equal(await page.evaluate(() => scoreEditor.score.meter), '12/8');
    await page.goto('http://localhost:' + server.address().port + '/en/sheet-music-editor');
    await page.waitForSelector('.score-clef-trigger');
    await page.locator('.score-clef-trigger').first().click();
    assert.equal(await page.getByRole('dialog', { name: 'Clef and key signature', exact: true }).isVisible(), true);
    assert.equal(await page.getByLabel('Key signature', { exact: true }).locator('option').count(), 15);
    assert.deepEqual(errors, []);
    console.log('score-editor e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
