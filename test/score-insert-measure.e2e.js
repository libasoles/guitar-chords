/* Insertar compases en /partitura con el + sobre las barras del compas elegido. Ejecutar despues de npm run build:site. */
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
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://localhost:' + server.address().port + '/partitura');
    await page.waitForSelector('#scoreStage g.measure');
    await page.evaluate(() => {
      ScoreModel.measures(scoreEditor.score)[1].push({ d: 'q', n: 30 });
      scoreEditor.render();
    });
    await page.waitForTimeout(300);
    const filled = () => page.evaluate(() => ScoreModel.measures(scoreEditor.score).map((m) => m.length));
    const selectBar = async (mi) => {
      const lines = await page.locator('#scoreStage g.measure').nth(mi).locator('g.staff > path').evaluateAll((nodes) => nodes.slice(0, 5).map((n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
      await page.mouse.click(lines[0].x + lines[0].width / 2, (lines[1].y + lines[2].y) / 2);
    };

    assert.equal(await page.locator('.score-insert-measure').count(), 0, 'sin compas elegido no hay +');
    await selectBar(1);
    assert.equal(await page.locator('.score-insert-measure').count(), 2, 'un + por barra del compas elegido');
    assert.equal(await page.locator('.is-bar-selected').count(), 2);

    await page.locator('.score-insert-measure[data-where="before"]').click();
    assert.deepEqual((await filled()).slice(0, 3), [0, 0, 1], 'antes: el compas con figuras se corre');
    assert.equal(await page.evaluate(() => scoreEditor.score.rows.map((row) => row.length).join()), '4,4,4,1', 'el ultimo compas de cada renglon baja al siguiente');
    assert.equal(await page.locator('.score-insert-measure').count(), 2, 'el compas nuevo queda elegido');

    await page.locator('.score-insert-measure[data-where="after"]').click();
    assert.deepEqual((await filled()).slice(0, 4), [0, 0, 0, 1], 'despues del compas elegido');

    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual((await filled()).slice(0, 3), [0, 0, 1], 'deshacer quita el compas insertado');

    await page.locator('#scoreTitle').click();
    assert.equal(await page.locator('.score-insert-measure').count(), 0, 'cancelar la seleccion quita los +');

    assert.deepEqual(errors, []);
    console.log('score-insert-measure e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
