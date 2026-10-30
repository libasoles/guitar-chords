'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function checkHiddenBarlineEndings(page) {
  await page.evaluate(() => {
    scoreEditor.score.navigation = { 2: { first: true } };
    scoreEditor.render();
  });
  const bounds = () => page.evaluate(() => {
    const line = document.querySelector('g.ending .voltaBracket > path').getBoundingClientRect();
    const staff = document.querySelector('#m1 > g.staff > path').getBoundingClientRect();
    return { left: line.left, measureLeft: staff.left };
  });
  const handle = page.locator('.score-barline-trigger[data-measure="1"][data-side="end"]');
  await handle.click();
  await page.keyboard.press('Delete');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[1].hidden), true);
  let box = await bounds();
  assert.ok(Math.abs(box.left - box.measureLeft) < 10, 'existing ending expands left across the deleted barline: ' + JSON.stringify(box));
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  box = await bounds();
  assert.ok(Math.abs(box.left - box.measureLeft) < 10, 'saved ending keeps the visible boundary after reload');
  await page.locator('g.ending text').click();
  await page.keyboard.press('Delete');
  assert.equal(await page.locator('g.ending').count(), 0);
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.locator('g.ending').count(), 1, 'undo restores the expanded ending');
  await page.locator('g.ending text').click();
  await page.keyboard.press('Delete');
  assert.equal(await page.locator('g.ending').count(), 0);
  for (const mi of [1, 2]) {
    await page.locator('[data-navigation="first"]').click();
    const staff = await page.locator(`#m${mi} > g.staff > path`).first().boundingBox();
    await page.mouse.click(staff.x + staff.width / 2, staff.y + 12);
    await page.keyboard.press('Escape');
    box = await bounds();
    assert.ok(Math.abs(box.left - box.measureLeft) < 10, 'new ending covers the visible measure from either half: ' + JSON.stringify(box));
    const right = await page.evaluate(() => ({
      bracket: document.querySelector('g.ending .voltaBracket > path').getBoundingClientRect().right,
      staff: document.querySelector('#m2 > g.staff > path').getBoundingClientRect().right,
    }));
    assert.ok(Math.abs(right.bracket - right.staff) < 10, 'ending reaches the next visible barline: ' + JSON.stringify(right));
    await page.locator('g.ending text').click();
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('g.ending').count(), 0);
  }
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
}

async function checkNavigationRegressions(page) {
  await page.evaluate(() => {
    const score = scoreEditor.score;
    score.rows[0][0] = [{ n: 30, d: 'q', at: 0 }];
    score.navigation = { 0: { segno: true }, 1: { dc: true }, 2: { ds: true }, 4: { first: true }, 5: { second: true } };
    scoreEditor.render();
  });
  assert.equal(await page.locator('.score-navigation-hit').first().evaluate((el) => getComputedStyle(el).stroke), 'none', 'selection targets have no visible outline');
  const failures = [];
  for (const selector of ['#m0 g.repeatMark use', '#m1 g.dir text', '#m2 g.dir text', 'g.ending text >> nth=0', 'g.ending text >> nth=1']) {
    await page.locator(selector).click();
    const selected = await page.locator(selector).evaluate((el) => !!el.closest('.is-selected'));
    if (!selected) failures.push('symbol cannot be selected: ' + selector);
    else {
      const color = await page.locator(selector).evaluate((el) => ({ fill: getComputedStyle(el).fill, selectedColor: getComputedStyle(el.closest('.is-selected')).color }));
      assert.equal(color.fill, color.selectedColor, 'selected symbols use the same yellow as notes');
      const before = await page.evaluate(() => JSON.stringify(scoreEditor.score.navigation));
      await page.keyboard.press('Delete');
      assert.notEqual(await page.evaluate(() => JSON.stringify(scoreEditor.score.navigation)), before, 'Delete removes the selected symbol');
      assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0].length), 1, 'deleting a symbol keeps the notes');
      await page.keyboard.press('ControlOrMeta+z');
      assert.equal(await page.evaluate(() => JSON.stringify(scoreEditor.score.navigation)), before, 'undo restores the symbol');
    }
    await page.keyboard.press('Escape');
  }
  const positions = () => page.evaluate(() => {
    return Array.from(document.querySelectorAll('#scoreStage g.ending')).map((ending, i) => {
      const measure = document.querySelector('#m' + (4 + i) + ' > g.staff > path').getBoundingClientRect();
      const line = ending.querySelector('path').getBoundingClientRect();
      return { left: line.left, right: line.right, measureLeft: measure.left, measureRight: measure.right };
    });
  });
  const before = await positions();
  await page.evaluate(() => { scoreEditor.score.measureWidths = { 4: 0.12, 5: 0.38, 6: 0.2, 7: 0.3 }; scoreEditor.render(); });
  const after = await positions();
  for (let i = 0; i < after.length; i++) {
    const leftOffset = before[i].left - before[i].measureLeft;
    const rightOffset = before[i].right - before[i].measureRight;
    if (Math.abs(after[i].left - after[i].measureLeft - leftOffset) > 3 || Math.abs(after[i].right - after[i].measureRight - rightOffset) > 3) failures.push('ending does not follow measure width: ' + JSON.stringify({ i, before: before[i], after: after[i] }));
  }
  assert.deepEqual(failures, []);
  // Resizing through the actual barline handle must keep both ends anchored too.
  const handle = await page.locator('.score-barline-trigger[data-measure="4"][data-side="end"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 45, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  const resized = await positions();
  for (let i = 0; i < resized.length; i++) {
    assert.ok(Math.abs((resized[i].left - resized[i].measureLeft) - (before[i].left - before[i].measureLeft)) < 3, 'left anchor follows a dragged barline');
    assert.ok(Math.abs((resized[i].right - resized[i].measureRight) - (before[i].right - before[i].measureRight)) < 3, 'right anchor follows a dragged barline');
  }
  for (const closing of ['double', 'end']) {
    await page.evaluate((closing) => { scoreEditor.score.barlines = { 5: { [closing]: true } }; scoreEditor.render(); }, closing);
    assert.equal(await page.locator('g.ending >> nth=1').locator('.voltaBracket > path').count(), 3, 'second ending draws its closing hook');
  }
  // A span continued on another row is selected and removed as one symbol.
  await page.evaluate(() => {
    delete scoreEditor.score.barlines;
    scoreEditor.score.navigation = { 2: { first: true }, 3: { first: true }, 4: { first: true }, 5: { first: true } };
    scoreEditor.render();
  });
  assert.equal(await page.locator('g.ending').count(), 2, 'the ending continues on the next row');
  await page.locator('g.ending >> nth=1').locator('text').click();
  assert.equal(await page.locator('g.voltaBracket.is-selected').count(), 2, 'both continuation segments turn yellow');
  await page.keyboard.press('Backspace');
  assert.equal(await page.locator('g.ending').count(), 0);
  assert.equal(await page.evaluate(() => scoreEditor.score.navigation), undefined);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
}

(async () => {
  const server = await serveStatic(path.join(__dirname, '../dist/site'), 0);
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath(), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/partitura`);
    await page.waitForSelector('#scoreStage g.measure');
    await checkHiddenBarlineEndings(page);
    await checkNavigationRegressions(page);
    assert.deepEqual(await page.locator('#scoreBarlines > button').evaluateAll((buttons) => buttons.map((b) => b.id || b.dataset.tool || b.dataset.barline || b.dataset.navigation)),
      ['scoreTabToggle', 'barre', 'start', 'end', 'double', 'dc', 'ds', 'segno', 'first', 'second']);
    for (const [mi, mark] of [[0, 'segno'], [1, 'first'], [2, 'second'], [3, 'ds'], [4, 'dc']]) {
      await page.locator(`[data-navigation="${mark}"]`).click();
      const staff = await page.locator(`#m${mi} > g.staff > path`).first().boundingBox();
      await page.mouse.click(staff.x + staff.width * 0.5, staff.y + 12);
      await page.waitForFunction(([mi, mark]) => scoreEditor.score.navigation?.[mi]?.[mark], [mi, mark], { timeout: 5000 }).catch((e) => { throw new Error(mark + ': ' + e.message); });
      await page.keyboard.press('Escape');
    }
    assert.equal(await page.locator('#scoreStage g.repeatMark').count(), 1);
    assert.equal(await page.locator('#scoreStage g.ending').count(), 2);
    assert.ok((await page.locator('#scoreStage').textContent()).includes('D.C.'));
    assert.ok((await page.locator('#scoreStage').textContent()).includes('D.S.'));
    const saved = await page.evaluate(() => scoreEditor.score.navigation);
    await page.reload();
    await page.waitForSelector('#scoreStage g.measure');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.navigation), saved);
    assert.equal(await page.locator('#scoreStage g.ending').count(), 2);
    await page.locator('[data-navigation="segno"]').click();
    let staff = await page.locator('#m0 > g.staff > path').first().boundingBox();
    await page.mouse.click(staff.x + staff.width * 0.5, staff.y + 12);
    assert.equal(await page.locator('#scoreStage g.repeatMark').count(), 0, 'placing the same mark removes it');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await page.locator('#scoreStage g.repeatMark').count(), 1, 'undo restores the mark');
    // A toolbar drag uses the same measure placement as a click.
    const tool = await page.locator('[data-navigation="first"]').boundingBox();
    staff = await page.locator('#m5 > g.staff > path').first().boundingBox();
    await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
    await page.mouse.down();
    await page.mouse.move(staff.x + staff.width / 2, staff.y + 12, { steps: 5 });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => scoreEditor.score.navigation[5].first), true);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.locator('[data-navigation="second"]').click();
    assert.equal(await page.locator('[data-navigation="second"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#scoreTabToggle').click();
    assert.equal(await page.locator('#scoreTabToggle').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    console.log('Navigation toolbar, placement, rendering and persistence passed');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
