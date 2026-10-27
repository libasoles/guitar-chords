/* Editor privado /partitura. Ejecutar despues de npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function checkBarlines(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.equal(await page.locator('#scoreTrash').count(), 0);
  assert.equal(await page.locator('#scoreBarlines button').count(), 3);
  async function apply(type, mi) {
    await page.locator('[data-barline="' + type + '"]').click();
    const point = await page.locator('#scoreStage g.measure').nth(mi).evaluate(node => {
      const r = node.querySelector('g.staff > path').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 10 };
    });
    await page.mouse.click(point.x, point.y);
  }
  await apply('start', 0);
  await apply('end', 3);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barlines), { 0: { start: true }, 3: { end: true } });
  assert.ok(await page.locator('#scoreStage g.barLine').count() > 0);
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[0].start), true);
  await apply('single', 0);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barlines[0]), { single: true });
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[0].start), true);
  await page.keyboard.press('Escape');
  // Arrastrar una barra tambien la aplica sin insertar figuras.
  const button = await page.locator('[data-barline="end"]').boundingBox();
  const target = await page.locator('#scoreStage g.measure').nth(1).boundingBox();
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[1].end), true);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const sheet = await page.locator('.score-sheet').boundingBox();
    const toolbar = await page.locator('#scoreBarlines').boundingBox();
    assert.ok(toolbar.x >= sheet.x + sheet.width, 'las barras quedan a la derecha');
    assert.ok(toolbar.x + toolbar.width <= width, 'la barra cabe en la pantalla');
    assert.equal(await page.locator('.site-header').evaluate(el => getComputedStyle(el).borderBottomWidth), '0px');
  }
}

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
    assert.deepEqual(await page.locator('.score-palette-key').allTextContents(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'p', 's', 'b', 'c']);
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

async function checkModifiers(page, url, keys) {
  await page.goto(url);
  await page.waitForSelector('#scoreStage g.measure');
  assert.deepEqual((await page.locator('.score-palette-key').allTextContents()).slice(-4), keys);
  // Clicking a figure activates the same persistent tool as its keyboard shortcut.
  await page.locator('[data-shortcut="3"]').click();
  await page.locator('[data-shortcut="3"]').click();
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
  await page.keyboard.press('3');
  await page.keyboard.press('3');
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
  await page.locator('[data-shortcut="3"]').click();
  assert.equal(await page.locator('[data-shortcut="3"]').getAttribute('aria-pressed'), 'true');
  for (const mi of [1, 2]) {
    const point = await page.locator('#scoreStage g.measure').nth(mi).evaluate(node => {
      const r = node.querySelector('g.staff > path').getBoundingClientRect();
      return { x: r.left + r.width * 0.25, y: r.top + 10 };
    });
    await page.mouse.click(point.x, point.y);
  }
  await page.keyboard.press('Escape');
  await page.locator('[data-shortcut="' + keys[0] + '"]').click();
  assert.equal(await page.locator('[data-shortcut="' + keys[0] + '"]').getAttribute('aria-pressed'), 'true');
  async function clickNote(mi) {
    const head = await page.locator('[id="e' + mi + '-0"] .notehead').boundingBox();
    await page.mouse.move(head.x + head.width / 2, head.y + head.height / 2);
    assert.equal(await page.locator('.score-hover-ghost').count(), 1);
    assert.equal(await page.locator('[id="e' + mi + '-0"]').evaluate(el => el.classList.contains('is-target')), true);
    await page.mouse.click(head.x + head.width / 2, head.y + head.height / 2);
  }
  await clickNote(1);
  await clickNote(2);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0].slice(1, 3).map(m => m[0].dot)), [true, true]);
  await page.keyboard.press(keys[0]);
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('.score-hover-ghost').count(), 0);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].dot), true, 'deactivation does not edit the selected note');
  await page.keyboard.press(keys[0]);
  assert.equal(await page.evaluate(() => !!scoreEditor.score.rows[0][2][0].dot), false);
  await page.keyboard.press('Shift+' + keys[1]);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].acc), '#');
  await page.keyboard.down(keys[2]);
  await page.keyboard.down(keys[2]);
  await page.keyboard.up(keys[2]);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].acc), 'b', 'holding the shortcut does not repeatedly toggle it');
  await page.keyboard.press(keys[3]);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].acc), 'n');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].acc), 'b');
  await page.keyboard.press('Escape');
  await page.locator('[id="e2-0"] .notehead').click();
  await page.locator('[data-shortcut="4"]').click();
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].d), 'e');
  await page.locator('[data-shortcut="' + keys[0] + '"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].dot), true, 'keyboard activation applies once');
  await page.locator('[data-shortcut="' + keys[0] + '"]').click();
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].dot), true);
  await page.locator('#scoreTitle').fill(keys.join(''));
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][2][0].acc), 'b');
  await page.locator('#scoreStage').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
}

async function checkDoubleClick(page) {
  await page.evaluate(() => {
    const measures = ScoreModel.measures(scoreEditor.score);
    measures[0].push({ n: 32, d: 'q', at: 0 }, { n: 34, d: 'q', at: 0 });
    measures[1].push({ n: 32, d: 'w', at: 0 });
    measures[2].push({ n: 32, d: 'q', at: 24 });
    scoreEditor.render();
  });
  const note = page.locator('#e0-0 .notehead');
  await note.click();
  assert.equal(await page.evaluate(() => !!scoreEditor.score.rows[0][0][0].dot), false, 'single click only selects');
  await note.dblclick();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][0].map(ev => !!ev.dot)), [true, true], 'double click dots the chord');
  assert.ok(await page.locator('#scoreStage g.dots').count(), 'dots are rendered');
  await note.dblclick();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][0].map(ev => !!ev.dot)), [false, false], 'double click removes the dots');
  assert.equal(await page.locator('#scoreStage g.dots').count(), 0);
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].dot), true, 'dot toggle can be undone');
  // Hollow noteheads can have a staff line at their center; hit-testing uses coordinates.
  await page.locator('#e1-0 .notehead').dblclick({ force: true });
  assert.equal(await page.evaluate(() => !!scoreEditor.score.rows[0][1][0].dot), false, 'whole notes cannot be dotted');
  await page.locator('#e2-0 .notehead').dblclick({ force: true });
  assert.equal(await page.evaluate(() => !!scoreEditor.score.rows[0][2][0].dot), false, 'dot cannot overflow the measure');
  await page.reload();
  await page.waitForSelector('#scoreStage g.note');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].dot), true, 'dot is saved');
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
    await checkBarlines(dragPage);
    await dragPage.close();
    for (const [route, keys] of [
      ['/partitura', ['p', 's', 'b', 'c']],
      ['/en/sheet-music-editor', ['d', 's', 'f', 'n']],
    ]) {
      const modifierPage = await browser.newPage();
      await checkModifiers(modifierPage, 'http://localhost:' + server.address().port + route, keys);
      await modifierPage.close();
    }
    const doubleClickPage = await browser.newPage();
    await doubleClickPage.goto(url);
    await doubleClickPage.waitForSelector('#scoreStage g.measure');
    await checkDoubleClick(doubleClickPage);
    await doubleClickPage.close();
    console.log('score-editor e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
