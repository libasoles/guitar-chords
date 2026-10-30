/* Separar figuras simultaneas arrastrando una al siguiente ataque. */
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    for (const index of [1, 0]) {
      await page.evaluate(() => {
        ScoreModel.measures(scoreEditor.score).forEach(m => { m.length = 0; });
        scoreEditor.score.rows[0][0].push({ d: 'e', n: 38, at: 0, v: 1 }, { d: 'q', n: 33, at: 0, v: 2 });
        scoreEditor.render();
      });
      await page.waitForTimeout(350);
      const head = await page.locator('[id="e0-' + index + '"] .notehead').boundingBox();
      const staff = await page.locator('[id="m0"] > g.staff > path').first().boundingBox();
      const x = head.x + head.width / 2;
      const y = head.y + head.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(staff.x + staff.width - 12, y, { steps: 8 });
      await page.mouse.up();
      const starts = await page.evaluate(() => ScoreModel.onsets(scoreEditor.score.rows[0][0]));
      assert.deepEqual(starts, index === 1 ? [0, 12] : [0, 24], 'la figura arrastrada comienza despues de la otra');
      const heads = await page.locator('#scoreStage .notehead').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().x));
      assert.ok(heads[1] > heads[0] + head.width, 'las cabezas quedan separadas visualmente');
      await page.keyboard.press('ControlOrMeta+z');
      assert.deepEqual(await page.evaluate(() => ScoreModel.onsets(scoreEditor.score.rows[0][0])), [0, 0], 'deshacer restaura las voces simultaneas');
    }
    console.log('Las dos notas se separan al arrastrar una a la derecha.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
