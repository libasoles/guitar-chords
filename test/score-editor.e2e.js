/* Editor privado /partitura. Ejecutar despues de npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function checkDrag(page) {
    const target = await page.locator('#scoreStage g.staff').first().evaluate(staff => {
      const r = staff.querySelector('path').getBoundingClientRect();
      return { x: r.left + (r.right - r.left) * 0.55, y: r.top + 10 };
    });

    async function checkGhost() {
      assert.equal(await page.locator('.score-ghost').count(), 1);
      const duplicate = await page.locator('.score-marker-head').evaluateAll(nodes =>
        nodes.some(node => node.getBoundingClientRect().width && getComputedStyle(node).display !== 'none'));
      assert.equal(duplicate, false, 'only the full musical glyph should appear during dragging');
      const head = await page.locator('.score-ghost svg path').first().boundingBox();
      assert.ok(Math.abs(head.x + head.width / 2 - target.x) < 1, 'notehead follows mouse horizontally');
      assert.ok(Math.abs(head.y + head.height / 2 - target.y) < 1, 'notehead follows mouse vertically');
    }

    const button = await page.locator('.score-palette-item').nth(2).boundingBox();
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await checkGhost();
    await page.mouse.up();
    assert.equal(await page.locator('.score-ghost').count(), 0);
    await page.waitForSelector('#scoreStage g.note');

    const note = await page.locator('#scoreStage g.note .notehead').first().boundingBox();
    await page.mouse.move(note.x + note.width / 2, note.y + note.height / 2);
    await page.mouse.down();
    target.x += 35;
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await checkGhost();
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
    assert.equal(await page.locator('.score-ghost').count(), 0);
    await page.mouse.up();
    // Numbered tools stay active for repeated clicks and edit the selected figure.
    await page.reload();
    await page.waitForSelector('#scoreStage g.measure');
    assert.deepEqual(await page.locator('.score-palette-key').allTextContents(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    await page.keyboard.press('4');
    assert.equal(await page.locator('[data-shortcut="4"]').getAttribute('aria-pressed'), 'true');
    const previewPoint = await page.locator('#scoreStage g.measure').nth(1).evaluate(node => {
      const r = node.querySelector('g.staff > path').getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + 10 };
    });
    const beforeHover = await page.evaluate(() => structuredClone(scoreEditor.score));
    await page.mouse.move(previewPoint.x, previewPoint.y);
    assert.equal(await page.locator('.score-hover-ghost').count(), 1);
    const previewHead = await page.locator('.score-hover-ghost svg path').first().boundingBox();
    assert.ok(Math.abs(previewHead.x + previewHead.width / 2 - previewPoint.x) < 1);
    assert.ok(Math.abs(previewHead.y + previewHead.height / 2 - previewPoint.y) < 1);
    const eighthGlyph = await page.locator('.score-hover-ghost svg').innerHTML();
    await page.keyboard.press('5');
    assert.notEqual(await page.locator('.score-hover-ghost svg').innerHTML(), eighthGlyph);
    assert.equal(await page.locator('.score-ghost').count(), 1, 'changing tools replaces the hover glyph');
    await page.keyboard.press('4');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score), beforeHover, 'hover does not edit the score');
    assert.equal(await page.locator('[data-shortcut="4"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(246, 200, 95)');
    await page.mouse.move(1, 1);
    assert.equal(await page.locator('.score-hover-ghost').count(), 0);
    await page.mouse.move(previewPoint.x, previewPoint.y);
    assert.equal(await page.locator('.score-hover-ghost').count(), 1);
    async function clickMeasure(mi) {
      const point = await page.locator('#scoreStage g.measure').nth(mi).evaluate(node => {
        const r = node.querySelector('g.staff > path').getBoundingClientRect();
        return { x: r.left + r.width * 0.5, y: r.top + 10 };
      });
      await page.mouse.click(point.x, point.y);
    }
    await clickMeasure(1);
    const stageFocus = await page.locator('#scoreStage').evaluate(stage => {
      const style = getComputedStyle(stage);
      return { focused: document.activeElement === stage, outline: style.outlineStyle };
    });
    assert.equal(stageFocus.focused, true, 'drawing keeps keyboard editing available');
    assert.equal(stageFocus.outline, 'none', 'drawing must not show a focus line above the staves');
    await clickMeasure(2);
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0].slice(1, 3).map(m => m[0].d)), ['e', 'e']);
    const beforeEdit = await page.evaluate(() => ({ ...scoreEditor.score.rows[0][2][0] }));
    await page.keyboard.press('5');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][2][0]), { ...beforeEdit, d: 's' });
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][2][0]), beforeEdit);
    await page.keyboard.press('Escape');
    await page.locator('[data-shortcut="9"]').click();
    await clickMeasure(3);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][3][0].rest), true);
    await page.locator('#scoreTitle').fill('12345');
    assert.equal(await page.locator('[data-shortcut="9"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#scoreStage').focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator('.score-hover-ghost').count(), 0);
    await clickMeasure(4);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[1][0].length), 0);
    for (const selector of ['.score-toolbar', '#scoreDownloadToggle']) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
    }
    console.log('Score editor drag: one glyph under the mouse; drop and cancellation clean up.');
}

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

    // All options are visible; choosing one applies it immediately without closing the gallery.
    const box = await page.locator('#scoreStage g.clef').first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), true);
    assert.equal(await page.locator('#scoreClefPopup select').count(), 0);
    assert.equal(await page.locator('.score-clef-options button').count(), 5);
    assert.equal(await page.locator('.score-key-options button').count(), 15);
    assert.equal(await page.locator('.score-clef-options button svg g.clef').count(), 5);
    assert.equal(await page.locator('.score-clef-options button').evaluateAll((buttons) => buttons.every((b) => !b.textContent.trim())), true);
    assert.equal(await page.locator('.score-clef-options [aria-pressed="true"]').evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), false);
    await page.locator('.score-clef-trigger').first().focus();
    await page.keyboard.press('Enter');
    await page.locator('.score-clef-options [data-clef="bass"]').click();
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), true);
    assert.equal(await page.evaluate(() => scoreEditor.score.clef), 'bass');
    assert.equal(await page.locator('.score-clef-options [data-clef="bass"]').getAttribute('aria-pressed'), 'true');
    await page.locator('.score-key-options [data-fifths="-3"]').click();
    assert.equal(await page.locator('.score-key-options [data-fifths="-3"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
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
    await page.locator('.score-clef-options [data-clef="alto"]').click();
    await page.locator('.score-key-options [data-fifths="2"]').click();
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows), before);
    await page.keyboard.press('ControlOrMeta+z');
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
    assert.equal(await page.getByRole('group', { name: 'Key signature', exact: true }).locator('button').count(), 15);
    assert.deepEqual(errors, []);
    const dragPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await dragPage.goto(url);
    await dragPage.waitForSelector('#scoreStage g.measure');
    await checkDrag(dragPage);
    await dragPage.close();
    console.log('score-editor e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
