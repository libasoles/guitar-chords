/* Click a beam to select only the connection; Delete separates its notes. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async () => {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    await page.evaluate(() => {
      ScoreModel.measures(scoreEditor.score).forEach(m => { m.length = 0; });
      scoreEditor.score.rows[0][0].push(
        { d: 's', n: 38, at: 0, v: 1 }, { d: 's', n: 40, at: 6, v: 1 },
        { d: 'e', n: 39, at: 12, v: 1 }, { d: 'e', n: 41, at: 24, v: 1 },
        { d: 'e', n: 42, at: 36, v: 1 });
      scoreEditor.render();
    });
    const beams = page.locator('#scoreStage g.beam');
    await beams.first().waitFor();
    assert.equal(await beams.count(), 2);
    const clickBeam = async () => {
      const polygon = beams.first().locator(':scope > polygon').first();
      const point = await polygon.evaluate(node => {
        const points = [...node.points];
        const x = points[0].x * 0.75 + points[1].x * 0.25;
        const y = (points[0].y * 0.75 + points[1].y * 0.25 + points[3].y * 0.75 + points[2].y * 0.25) / 2;
        const point = new DOMPoint(x, y).matrixTransform(node.getScreenCTM());
        return { x: point.x, y: point.y };
      });
      await page.mouse.click(point.x, point.y);
    };
    const yellow = await page.locator('#scoreStage').evaluate(node => getComputedStyle(node).getPropertyValue('--brand-yellow').trim());
    const expectedColor = await page.evaluate(color => {
      const el = document.createElement('span');
      el.style.color = color;
      document.body.append(el);
      const result = getComputedStyle(el).color;
      el.remove();
      return result;
    }, yellow);
    const clickHead = async (index, modifiers = []) => {
      await page.locator('[id="e0-' + index + '"] .notehead').click({ modifiers });
    };
    const beamColors = () => beams.evaluateAll(nodes => nodes.map(node =>
      [...node.querySelectorAll(':scope > polygon')].map(polygon => getComputedStyle(polygon).fill)));
    const normalColors = await beamColors();
    await clickHead(0);
    assert.deepEqual(await beamColors(), normalColors, 'one selected note does not highlight its beam');
    await clickHead(1, ['Shift']);
    assert.deepEqual(await beamColors(), normalColors, 'an incomplete group does not highlight its beam');
    await clickHead(2, ['Shift']);
    let colors = await beamColors();
    assert.ok(colors[0].every(color => color === expectedColor), 'all notes selected highlight every level of their beam');
    assert.deepEqual(colors[1], normalColors[1], 'other beams stay inactive');
    await clickHead(3, ['Shift']);
    colors = await beamColors();
    assert.ok(colors[0].every(color => color === expectedColor));
    assert.deepEqual(colors[1], normalColors[1], 'a partially selected second beam stays inactive');
    await clickHead(4, ['Shift']);
    assert.ok((await beamColors()).flat().every(color => color === expectedColor), 'two complete groups highlight both beams');
    await clickHead(1, ['Shift']);
    colors = await beamColors();
    assert.deepEqual(colors[0], normalColors[0], 'deselecting one note clears its beam');
    assert.ok(colors[1].every(color => color === expectedColor), 'the other complete group stays highlighted');
    await page.keyboard.press('Escape');
    assert.deepEqual(await beamColors(), normalColors, 'clearing notes clears their beam colors');
    await clickBeam();
    assert.equal(await beams.first().locator(':scope > polygon').first().evaluate(node => getComputedStyle(node).fill), expectedColor, 'clicking a beam makes it yellow');
    assert.equal(await page.locator('#scoreStage g.note.is-selected').count(), 0, 'beam selection does not select its notes');
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => document.querySelectorAll('#scoreStage g.beam').length === 1);
    assert.equal(await page.locator('#scoreStage g.note').count(), 5, 'Delete keeps every note');
    assert.deepEqual(await page.evaluate(() => ScoreModel.onsets(scoreEditor.score.rows[0][0])), [0, 6, 12, 24, 36]);
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => document.querySelectorAll('#scoreStage g.beam').length === 2);
    await clickBeam();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#scoreStage g.beam > polygon.is-selected').count(), 0);
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('#scoreStage g.note').count(), 5);
    await clickBeam();
    await page.keyboard.press('Backspace');
    await page.waitForFunction(() => document.querySelectorAll('#scoreStage g.beam').length === 1);
    assert.equal(await page.locator('#scoreStage g.note').count(), 5, 'Backspace also keeps the notes');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => document.querySelectorAll('#scoreStage g.beam').length === 2);
    await clickBeam();
    const head = await page.locator('[id="e0-0"] .notehead').boundingBox();
    await page.mouse.click(head.x + head.width / 2, head.y + head.height / 2);
    assert.deepEqual(await beamColors(), normalColors, 'picking a single note clears the beam highlight');
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => document.querySelectorAll('#scoreStage g.note').length === 4);
    assert.deepEqual(errors, []);
    console.log('PASS: only complete note selections highlight beams; direct beam selection, Delete and undo still work');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
