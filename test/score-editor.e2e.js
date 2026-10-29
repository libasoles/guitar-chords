/* Editor privado /partitura. Ejecutar despues de npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function checkInteriorDoubleBar(page) {
  await page.locator('[data-barline="double"]').click();
  const staff = await page.locator('#scoreStage g.measure').first().locator('g.staff > path').first().boundingBox();
  const x = staff.x + staff.width * 0.31, y = staff.y + 10;
  await page.mouse.move(x, y);
  const marker = await page.locator('.score-marker-line').boundingBox();
  assert.ok(Math.abs(marker.x - x) < 3, 'la guia sigue el punto interior');
  await page.mouse.click(x, y);
  const split = await page.evaluate(() => ({ durations: scoreEditor.score.measureDurations, rows: scoreEditor.score.rows, bars: scoreEditor.score.barlines }));
  assert.equal(split.rows.flat().length, 13, 'el clic interior divide el compas');
  assert.ok(split.durations[0] > 0 && split.durations[0] < 96);
  assert.equal(split.durations[0] + split.durations[1], 96);
  assert.deepEqual(split.bars[0], { double: true });
  const divided = await page.locator('#m0 > g.staff > path').first().boundingBox();
  assert.ok(Math.abs(divided.x + divided.width - x) < 2, 'la barra queda en la x del clic, no en el centro ni en la distribucion automatica');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows.flat().length), 12);
  await page.mouse.click(x, y);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows.flat().length), 13);
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.measureDurations), split.durations);
  assert.equal(await page.locator('#scoreStage g.measure').count(), 13);
}

async function checkSplitKeepsRows(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  await page.evaluate(() => {
    scoreEditor.score.rows[2] = [[], []];
    scoreEditor.score.rows[0][3] = [{ n: 30, d: 'q', at: 0 }, { n: 32, d: 'q', at: 72 }];
    scoreEditor.score.rows[1][0] = [{ n: 35, d: 'q', at: 0 }];
    scoreEditor.render();
    return document.fonts.ready;
  });
  await page.waitForTimeout(200); // El ResizeObserver completa el dibujo inicial antes de medir.
  const rowWidths = () => page.evaluate(() => {
    let first = 0;
    return scoreEditor.score.rows.map((row) => {
      const head = document.querySelector('#m' + first + ' > g.staff > path').getBoundingClientRect();
      const last = document.querySelector('#m' + (first + row.length - 1) + ' > g.staff > path').getBoundingClientRect();
      first += row.length;
      return last.right - head.left;
    });
  });
  const before = await rowWidths();
  await page.locator('[data-barline="double"]').click();
  const box = await page.locator('#m3 > g.staff > path').first().boundingBox();
  const x = box.x + box.width * 0.6;
  await page.mouse.click(x, box.y + 10);
  const check = async () => {
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows.map(row => row.length)), [5, 4, 2], 'el corte conserva la continuacion en su renglon');
    assert.equal(await page.locator('#scoreStage g.measure').count(), 11);
    const after = await rowWidths();
    after.forEach((width, row) => assert.ok(Math.abs(width - before[row]) < 2, 'el renglon ' + row + ' no se acorta'));
    const continuation = await page.locator('#m4 > g.staff > path').first().boundingBox();
    assert.ok(continuation.width > 20, 'el compas posterior sigue visible');
    assert.ok(Math.abs(continuation.x - x) < 2, 'el compas posterior empieza en el corte');
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][4][0].n), 32, 'se conserva la nota posterior al corte');
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[1][0][0].n), 35, 'el renglon siguiente conserva sus notas');
  };
  await check();
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  await check();
}

async function checkBarResizeConstraints(page) {
  await page.evaluate(() => { scoreEditor.score.barlines = { 0: { double: true } }; scoreEditor.render(); });
  for (const direction of [1, -1]) {
    await page.locator('[data-barline="double"]').click();
    const bar = await page.locator('.score-barline-trigger[data-measure="0"][data-side="end"]').boundingBox();
    const adjacent = await page.locator('#m' + (direction > 0 ? 1 : 0) + ' > g.staff > path').first().boundingBox();
    const x = bar.x + bar.width / 2, y = bar.y + bar.height / 2;
    const beyond = direction > 0 ? adjacent.x + adjacent.width + 30 : adjacent.x - 20;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(beyond, y, { steps: 5 });
    const guide = await page.locator('.score-width-guide').boundingBox();
    assert.ok(direction > 0 ? guide.x < adjacent.x + adjacent.width : guide.x > adjacent.x, 'la guia se detiene antes de cruzar la barra vecina');
    const phantom = await page.locator('.score-hover-ghost').count();
    assert.equal(phantom, 0, 'al ajustar el ancho no queda un phantom de insercion siguiendo al puntero fuera del limite');
    await page.mouse.move(beyond + direction * 25, y);
    assert.ok(Math.abs((await page.locator('.score-width-guide').boundingBox()).x - guide.x) < 1, 'la vista previa permanece en el limite');
    await page.mouse.up();
    const result = await page.locator('#m0 > g.staff > path').first().boundingBox();
    assert.ok(Math.abs(result.x + result.width - guide.x) < 2, 'el drop coincide con la vista previa limitada');
    await page.keyboard.press('ControlOrMeta+z');
  }
}

async function checkMeasureWidths(page) {
  await page.evaluate(() => {
    scoreEditor.score.rows[0][0] = [{ n: 30, d: 'e', at: 0 }, { n: 32, d: 'e', at: 12 }, { n: 30, d: 'e', at: 84, tie: true }];
    scoreEditor.score.rows[0][1] = [{ n: 30, d: 'q', at: 0 }];
    scoreEditor.render();
  });
  const staff = (mi) => page.locator('#m' + mi + ' > g.staff > path').first().boundingBox();
  const before = await staff(0), nextBefore = await staff(1);
  const headBefore = await page.locator('#e0-0 .notehead').boundingBox();
  const music = await page.evaluate(() => JSON.stringify(scoreEditor.score.rows));
  const tieGap = async () => {
    const tie = await page.locator('#m0 g.tie path').first().boundingBox();
    const head = await page.locator('#e1-0 .notehead').boundingBox();
    return head.x - tie.x - tie.width;
  };
  const gapBefore = await tieGap();
  const trigger = page.locator('.score-barline-trigger[data-measure="0"][data-side="end"]');
  const bar = await trigger.boundingBox();
  const x = bar.x + bar.width / 2, y = bar.y + bar.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y, { steps: 5 });
  await page.mouse.up();
  const after = await staff(0), nextAfter = await staff(1);
  assert.ok(Math.abs(after.width - before.width - 45) < 2, 'el compas izquierdo gana el ancho arrastrado');
  assert.ok(Math.abs(nextBefore.width - nextAfter.width - 45) < 2, 'el compas vecino cede ese espacio');
  assert.ok(Math.abs(nextBefore.x + nextBefore.width - nextAfter.x - nextAfter.width) < 2, 'las otras barras permanecen en su lugar');
  assert.equal(await page.locator('.score-barline-remove').count(), 0, 'arrastrar no abre el menu de la barra');
  const headAfter = await page.locator('#e0-0 .notehead').boundingBox();
  assert.ok(Math.abs(headBefore.width - headAfter.width) < 0.2, 'las cabezas no se estiran');
  assert.equal(await page.evaluate(() => JSON.stringify(scoreEditor.score.rows)), music, 'el ancho no cambia la musica');
  assert.ok(Math.abs(await tieGap() - gapBefore) < 3, 'la ligadura sigue llegando a la nota del compas vecino');
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.ok(Math.abs((await staff(0)).width - after.width) < 2, 'el ancho se conserva al recargar');
  const current = await trigger.boundingBox();
  await page.mouse.move(current.x + current.width / 2, current.y + 10);
  await page.mouse.down();
  await page.mouse.move(current.x + current.width / 2 - 35, current.y + 10, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.ok(Math.abs((await staff(0)).width - after.width) < 2, 'Escape cancela el ajuste');
  await page.mouse.move(current.x + current.width / 2, current.y + 10);
  await page.mouse.down();
  await page.mouse.move(current.x + current.width / 2 - 25, current.y + 10, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press('ControlOrMeta+z');
  assert.ok(Math.abs((await staff(0)).width - after.width) < 2, 'deshacer restaura los anchos');
}

async function checkBarlines(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.equal(await page.locator('#scoreTrash').count(), 0);
  assert.equal(await page.locator('#scoreBarlines button:not(#scoreTabToggle)').count(), 4);
  assert.equal(await page.locator('#scoreBarlines #scoreTabToggle').count(), 1);
  async function apply(type, mi) {
    await page.locator('[data-barline="' + type + '"]').click();
    const point = await page.locator('#scoreStage g.measure').nth(mi).evaluate((node, type) => {
      const r = node.querySelector('g.staff > path').getBoundingClientRect();
      return { x: type === 'double' ? r.right - 1 : r.left + r.width / 2, y: type === 'double' ? r.top - 15 : r.top + 10 };
    }, type);
    await page.mouse.click(point.x, point.y);
  }
  await apply('start', 0);
  await apply('end', 3);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barlines), { 0: { start: true }, 3: { end: true } });
  assert.ok(await page.locator('#scoreStage g.barLine').count() > 0);
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[0].start), true);
  await apply('double', 0);
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barlines[0]), { double: true });
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[0].start), true);
  await page.keyboard.press('Escape');
  // Las tres barras comparten la misma linea fina en x=15 y quedan en la misma columna, asi apiladas no se ven cortadas.
  const thin = await page.locator('#scoreBarlines [data-barline] svg').evaluateAll((svgs) => svgs.map((svg) => {
    const line = [...svg.querySelectorAll('path')].find((p) => p.getAttribute('d') === 'M15 4v24' && p.getAttribute('stroke-width') === '1.6' || p.getAttribute('d') === 'M10 4v24M15 4v24');
    const box = svg.getBoundingClientRect();
    return Boolean(line) && Math.round(box.left) + '/' + Math.round(box.width);
  }));
  assert.equal(new Set(thin).size, 1, 'barras alineadas: ' + thin);
  assert.ok(thin.every((x) => x), 'la linea fina comun esta en las tres: ' + thin);
  // Arrastrar una barra tambien la aplica sin insertar figuras.
  const button = await page.locator('[data-barline="end"]').boundingBox();
  const target = await page.locator('#scoreStage g.measure').nth(1).boundingBox();
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[1].end), true);
  assert.equal(await page.locator('#scoreBarlines').evaluate(el => getComputedStyle(el).borderWidth), '0px');
  assert.equal(await page.locator('#scoreBarlines').evaluate(el => getComputedStyle(el).boxShadow), 'none');
  async function selectBar(mi, side) {
    const trigger = page.locator('.score-barline-trigger[data-measure="' + mi + '"][data-side="' + side + '"]');
    await trigger.click();
    const bar = await trigger.boundingBox();
    const remove = await page.locator('.score-barline-remove').boundingBox();
    assert.ok(remove.y + remove.height < bar.y, 'la x aparece encima de la barra');
    assert.equal(await page.locator('.score-barline-remove').count(), 1);
  }
  // Seleccionar la barra desactiva la herramienta de insercion que seguia activa.
  await selectBar(0, 'start');
  await page.locator('.score-barline-remove').click();
  assert.equal(await page.locator('.score-barline-trigger[data-measure="0"][data-side="start"]').count(), 0);
  assert.equal(await page.locator('.score-barline-remove').count(), 0);
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[0].start), true);
  await selectBar(3, 'end');
  await page.locator('.score-barline-remove').click();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barlines[3]), { hidden: true });
  assert.equal(await page.locator('[id="m3"] g.barLine path').count(), 0);
  await selectBar(2, 'end'); // barra simple original
  await page.locator('.score-barline-remove').focus();
  await page.keyboard.press('Enter');
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.equal(await page.evaluate(() => scoreEditor.score.barlines[2].hidden), true);
  assert.equal(await page.locator('.score-barline-trigger[data-measure="2"]').count(), 0);
  await selectBar(1, 'end');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.score-barline-remove').count(), 0);
  await selectBar(1, 'end');
  await page.locator('#scoreTitle').click();
  assert.equal(await page.locator('.score-barline-remove').count(), 0);
  // Click en el compas (sin herramienta): la x aparece sobre su barra especial, y pequeña.
  await page.keyboard.press('Escape');
  const dragBox = await page.locator('[id="m1"]').boundingBox();
  await page.mouse.move(dragBox.x + 10, dragBox.y + dragBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.locator('.score-barline-remove').count(), 0, 'arrastrar para seleccionar no selecciona el compas');
  const measureBox = await page.locator('[id="m1"]').boundingBox();
  await page.mouse.click(measureBox.x + measureBox.width / 2, measureBox.y + measureBox.height / 2);
  await page.waitForSelector('.score-barline-remove');
  assert.equal(await page.locator('.score-barline-remove').count(), 1);
  assert.ok((await page.locator('.score-barline-remove').boundingBox()).width <= 28);
  // El compas siguiente no tiene barra propia: la x sale sobre la barra de su izquierda (cierre del anterior).
  const nextBox = await page.locator('[id="m2"]').boundingBox();
  await page.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  await page.waitForFunction(() => document.querySelectorAll('.score-barline-remove').length === 1);
  await page.locator('#scoreTitle').click();
  await page.locator('#scoreDownloadToggle').click();
  const pendingDownload = page.waitForEvent('download');
  await page.locator('#scoreDownloadXml').click();
  const download = await pendingDownload;
  const stream = await download.createReadStream();
  let xml = '';
  for await (const chunk of stream) xml += chunk.toString();
  assert.equal((xml.match(/<bar-style>none<\/bar-style>/g) || []).length, 2);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const sheet = await page.locator('.score-sheet').boundingBox();
    const toolbar = await page.locator('#scoreBarlines').boundingBox();
    assert.ok(toolbar.x >= sheet.x + sheet.width, 'las barras quedan a la derecha');
    assert.ok(toolbar.x + toolbar.width <= width, 'la barra cabe en la pantalla');
    assert.equal(await page.locator('.site-header').evaluate(el => getComputedStyle(el).borderBottomWidth), '0px');
    await selectBar(1, 'end');
    await page.keyboard.press('Escape');
  }
}

async function checkKeyChanges(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  const keys = () => page.evaluate(() => [scoreEditor.score.fifths, scoreEditor.score.keys || null]);
  // La armadura elegida en el segundo renglon no toca el primero.
  await page.locator('.score-clef-trigger').nth(1).click();
  await page.locator('.score-key-options [data-fifths="2"]').click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await keys(), [0, { 4: 2 }]);
  assert.equal(await page.locator('#scoreStage g.measure').nth(0).locator('g.keyAccid').count(), 0);
  assert.equal(await page.locator('#scoreStage g.measure').nth(4).locator('g.keyAccid').count(), 2);
  // La clave elegida en el segundo renglon tampoco toca el primero.
  await page.locator('.score-clef-trigger').nth(1).click();
  await page.locator('.score-clef-options [data-clef="bass"]').click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => [scoreEditor.score.clef, scoreEditor.score.clefs || null]), ['guitar', { 4: 'bass' }]);
  // Una barra simple solo ofrece eliminarla, sin menu de clave y armadura.
  await page.locator('.score-barline-trigger[data-measure="1"][data-side="end"]').click();
  assert.equal(await page.locator('#scoreClefPopup').isVisible(), false);
  assert.equal(await page.locator('.score-barline-remove').count(), 1);
  await page.keyboard.press('Escape');
  // Una barra doble al final del renglon no tiene compas siguiente: solo ofrece eliminarla.
  await page.evaluate(() => { scoreEditor.score.barlines = { 3: { double: true } }; scoreEditor.render(); });
  await page.locator('.score-barline-trigger[data-measure="3"][data-side="end"]').click();
  assert.equal(await page.locator('#scoreClefPopup').isVisible(), false);
  assert.equal(await page.locator('.score-barline-remove').count(), 1);
  await page.keyboard.press('Escape');
  // La barra de cierre de un compas (aqui doble) cambia la armadura del compas siguiente.
  await page.evaluate(() => { scoreEditor.score.barlines = { 1: { double: true } }; scoreEditor.render(); });
  await page.locator('.score-barline-trigger[data-measure="1"][data-side="end"]').click();
  assert.equal(await page.locator('#scoreClefPopup').isVisible(), true);
  await page.locator('.score-key-options [data-fifths="-2"]').click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await keys(), [0, { 2: -2, 4: 2 }]);
  // La barra de inicio de un compas (repeticion) cambia la armadura de ese mismo compas.
  await page.locator('[data-barline="start"]').click();
  const point = await page.locator('#scoreStage g.measure').nth(5).evaluate(node => {
    const r = node.querySelector('g.staff > path').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 10 };
  });
  await page.mouse.click(point.x, point.y);
  await page.locator('.score-barline-trigger[data-measure="5"][data-side="start"]').click();
  await page.locator('.score-key-options [data-fifths="1"]').click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await keys(), [0, { 2: -2, 4: 2, 5: 1 }]);
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.deepEqual(await keys(), [0, { 2: -2, 4: 2, 5: 1 }]);
}

async function checkRowMeasureTools(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  const sizes = () => page.evaluate(() => scoreEditor.score.rows.map((row) => row.length));
  const hover = async (row) => {
    const measure = page.locator('#scoreStage g.measure').nth(row * 4 + (await sizes())[row] - 1);
    await measure.scrollIntoViewIfNeeded();
    const box = await measure.locator('g.staff > path').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 5);
  };
  const tool = (row, action) => page.locator(`.score-row-tools[data-row="${row}"] [data-action="${action}"]`);
  const opacity = (row) => page.locator(`.score-row-tools[data-row="${row}"]`).evaluate((el) => getComputedStyle(el).opacity);
  assert.equal(await opacity(0), '0');
  await hover(0);
  assert.equal(await opacity(0), '1');
  assert.equal(await opacity(1), '0');
  // Renglon lleno: + deshabilitado con aviso, - habilitado.
  assert.equal(await tool(0, 'add').getAttribute('aria-disabled'), 'true');
  assert.equal(await tool(0, 'add').getAttribute('data-tooltip'), await page.evaluate(() => JSON.parse(document.getElementById('scoreStrings').textContent).noRoomForMeasure));
  assert.equal(await tool(0, 'remove').getAttribute('aria-disabled'), null);
  await tool(0, 'add').click({ force: true });
  assert.deepEqual(await sizes(), [4, 4, 4]);
  await tool(0, 'remove').click();
  assert.deepEqual(await sizes(), [3, 4, 4]);
  assert.equal(await page.locator('#scoreStage g.measure').count(), 11);
  await hover(0);
  assert.equal(await tool(0, 'add').getAttribute('aria-disabled'), null);
  await tool(0, 'add').click();
  assert.deepEqual(await sizes(), [4, 4, 4]);
  // Con un solo compas, - queda deshabilitado.
  for (let i = 0; i < 3; i += 1) {
    await hover(0);
    await tool(0, 'remove').click();
  }
  assert.deepEqual(await sizes(), [1, 4, 4]);
  await hover(0);
  assert.equal(await tool(0, 'remove').getAttribute('aria-disabled'), 'true');
  await tool(0, 'remove').click({ force: true });
  assert.deepEqual(await sizes(), [1, 4, 4]);
}

async function checkBarre(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  await page.evaluate(() => {
    scoreEditor.score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 32, at: 24 }, { d: 'q', n: 34, at: 48 }, { d: 'q', n: 35, at: 72 }];
    scoreEditor.render();
  });
  async function dropBarre(selector) {
    const from = await page.locator('[data-tool="barre"]').boundingBox();
    const point = await page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { x: (r.left + r.right) / 2, y: r.top - 20 };
    }, selector);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 6 });
    await page.mouse.up();
  }
  // Sobre una nota que no es la primera, la cejilla arranca ahi con un 1 en foco para escribir otro numero.
  await dropBarre('[id="e0-2"] .notehead');
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres), { 0: { at: 48, fret: 1 } });
  assert.equal(await page.evaluate(() => document.activeElement.className + ':' + document.activeElement.value), 'score-barre-number:1');
  await page.keyboard.type('7');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres), { 0: { at: 48, fret: 7 } });
  assert.equal(await page.locator('.score-barre-number').inputValue(), '7');
  // El campo del numero no tiene bordes.
  assert.equal(await page.locator('.score-barre-number').evaluate((el) => getComputedStyle(el).borderTopWidth + getComputedStyle(el).outlineStyle), '0pxnone');
  // Al pasar el mouse por la linea aparecen las asas; arrastrar la del fin la acorta hasta la nota anterior.
  const line = await page.locator('#scoreStage [id="m0"] g.bracketSpan path').boundingBox();
  await page.mouse.move(5, 5);
  assert.equal(await page.locator('.score-barre-grip[data-side="end"]').evaluate((el) => getComputedStyle(el).opacity), '0');
  await page.mouse.move(line.x + line.width / 2, line.y + line.height / 2);
  assert.equal(await page.locator('.score-barre-grip[data-side="end"]').evaluate((el) => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.score-barre-grip[data-side="end"]').evaluate((el) => getComputedStyle(el).color), 'rgb(217, 45, 32)');
  assert.equal(await page.locator('.score-barre-grip[data-side="end"] svg').count(), 1, 'asa con flecha de Lucide');
  const grip = await page.locator('.score-barre-grip[data-side="end"]').boundingBox();
  const lastNote = await page.evaluate(() => {
    const r = document.querySelector('[id="e0-3"] .notehead').getBoundingClientRect();
    return (r.left + r.right) / 2;
  });
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(lastNote - 4, grip.y + grip.height / 2, { steps: 6 });
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres[0]), { at: 48, to: 72, fret: 7 });
  // El fin tambien pasa al compas siguiente (misma fila) arrastrando el asa mas alla de la barra.
  await page.evaluate(() => {
    scoreEditor.score.rows[0][1] = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 32, at: 24 }];
    scoreEditor.render();
  });
  const wide = await page.locator('#scoreStage [id="m0"] g.bracketSpan path').boundingBox();
  await page.mouse.move(wide.x + wide.width / 2, wide.y + wide.height / 2);
  const endGrip = await page.locator('.score-barre-grip[data-side="end"]').boundingBox();
  const nextNote = await page.evaluate(() => {
    const r = document.querySelector('[id="e1-1"] .notehead').getBoundingClientRect();
    return (r.left + r.right) / 2;
  });
  await page.mouse.move(endGrip.x + endGrip.width / 2, endGrip.y + endGrip.height / 2);
  await page.mouse.down();
  await page.mouse.move(nextNote, endGrip.y + endGrip.height / 2, { steps: 10 });
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres[0]), { at: 48, span: 1, to: 24, fret: 7 });
  await page.keyboard.press('ControlOrMeta+z');
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres[0]), { at: 48, to: 72, fret: 7 });
  // El inicio se mueve hacia la izquierda hasta la primera nota.
  const current = await page.locator('#scoreStage [id="m0"] g.bracketSpan path').boundingBox();
  await page.mouse.move(current.x + 5, current.y + 2);
  const startGrip = await page.locator('.score-barre-grip[data-side="start"]').boundingBox();
  await page.mouse.move(startGrip.x + startGrip.width / 2, startGrip.y + startGrip.height / 2);
  await page.mouse.down();
  await page.mouse.move(60, startGrip.y + startGrip.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres[0]), { at: 0, to: 72, fret: 7 });
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres[0]), { at: 48, fret: 7 });
  // Fuera de una nota (compas vacio) arranca al comienzo del compas.
  await page.keyboard.press('Escape');
  await dropBarre('[id="m1"] g.staff');
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.barres[1]), { at: 0, fret: 1 });
  // Dejar el campo vacio quita la cejilla.
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => scoreEditor.score.barres[1]), undefined);
  assert.equal(await page.evaluate(() => scoreEditor.score.barres[0].fret), 7);
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

    const button = await page.locator('[data-shortcut="4"]').boundingBox();
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
    assert.deepEqual(await page.locator('.score-palette-key').allTextContents(), ['1', '2', '3', '4', '5', '6', 'q', 'w', 'e', 'r', 't', 'y', 'p', 's', 'b', 'c']);
    await page.keyboard.press('3');
    assert.equal(await page.locator('[data-shortcut="3"]').getAttribute('aria-pressed'), 'true');
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
    await page.keyboard.press('2');
    assert.notEqual(await page.locator('.score-hover-ghost svg').innerHTML(), eighthGlyph);
    assert.equal(await page.locator('.score-ghost').count(), 1, 'changing tools replaces the hover glyph');
    await page.keyboard.press('3');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score), beforeHover, 'hover does not edit the score');
    assert.equal(await page.locator('[data-shortcut="3"]').evaluate(el => getComputedStyle(el).color), 'rgb(216, 91, 112)', 'the active tool is drawn in the brand red');
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
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 0, 'a note placed with a tool active is not selected');
    await page.keyboard.press('Escape');
    const head = await page.locator('#scoreStage g.measure').nth(2).locator('g.note .notehead').first().boundingBox();
    await page.mouse.click(head.x + head.width / 2, head.y + head.height / 2);
    const beforeEdit = await page.evaluate(() => ({ ...scoreEditor.score.rows[0][2][0] }));
    await page.keyboard.press('2');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][2][0]), { ...beforeEdit, d: 's' });
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][2][0]), beforeEdit);
    await page.keyboard.press('Escape');
    await page.locator('[data-shortcut="e"]').click();
    await clickMeasure(3);
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][3][0].rest), true);
    await page.locator('#scoreTitle').fill('12345');
    assert.equal(await page.locator('[data-shortcut="e"]').getAttribute('aria-pressed'), 'true');
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
  const durations = ['f', 's', 'e', 'q', 'h', 'w'];
  const labels = keys[0] === 'p'
    ? ['Fusa', 'Semicorchea', 'Corchea', 'Negra', 'Blanca', 'Redonda', 'Silencio de fusa', 'Silencio de semicorchea', 'Silencio de corchea', 'Silencio de negra', 'Silencio de blanca', 'Silencio de redonda']
    : ['Thirty-second note', 'Sixteenth note', 'Eighth note', 'Quarter note', 'Half note', 'Whole note', 'Thirty-second rest', 'Sixteenth rest', 'Eighth rest', 'Quarter rest', 'Half rest', 'Whole rest'];
  assert.deepEqual(await page.locator('#scorePalette button').evaluateAll(buttons => buttons.slice(0, 12).map(button => button.getAttribute('aria-label'))), labels);
  const point = await page.locator('#scoreStage g.measure').first().evaluate(node => {
    const r = node.querySelector('g.staff > path').getBoundingClientRect();
    return { x: r.left + r.width * 0.25, y: r.top + 10 };
  });
  for (const [rest, shortcuts] of [[false, ['1', '2', '3', '4', '5', '6']], [true, ['q', 'w', 'e', 'r', 't', 'y']]]) {
    for (const [index, shortcut] of shortcuts.entries()) {
      await page.keyboard.press(shortcut);
      await page.mouse.click(point.x, point.y);
      const figure = await page.evaluate(() => scoreEditor.score.rows[0][0][0]);
      assert.equal(figure.d, durations[index], 'duration for ' + shortcut);
      assert.equal(!!figure.rest, rest, 'note/rest for ' + shortcut);
      await page.keyboard.press('Escape');
      await page.keyboard.press('ControlOrMeta+z');
    }
  }
  // Clicking a figure activates the same persistent tool as its keyboard shortcut.
  await page.locator('[data-shortcut="4"]').click();
  await page.locator('[data-shortcut="4"]').click();
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
  await page.keyboard.press('4');
  await page.keyboard.press('4');
  assert.equal(await page.locator('.score-palette-item[aria-pressed="true"]').count(), 0);
  await page.locator('[data-shortcut="4"]').click();
  assert.equal(await page.locator('[data-shortcut="4"]').getAttribute('aria-pressed'), 'true');
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
  await page.locator('[data-shortcut="3"]').click();
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
    measures[2].push({ n: 32, d: 'q', at: 72 });
    scoreEditor.render();
  });
  const note = page.locator('#e0-0 .notehead');
  await note.click();
  assert.equal(await page.evaluate(() => !!scoreEditor.score.rows[0][0][0].dot), false, 'single click only selects');
  await note.dblclick();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][0].map(ev => !!ev.dot)), [true, false], 'double click dots only the clicked note');
  assert.ok(await page.locator('#scoreStage g.dots').count(), 'dot is rendered');
  await note.dblclick();
  assert.deepEqual(await page.evaluate(() => scoreEditor.score.rows[0][0].map(ev => !!ev.dot)), [false, false], 'double click removes the dot');
  assert.equal(await page.locator('#scoreStage g.dots').count(), 0);
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].dot), true, 'dot toggle can be undone');
  // Hollow noteheads can have a staff line at their center; hit-testing uses coordinates.
  await page.locator('#e1-0 .notehead').dblclick({ force: true });
  assert.equal(await page.evaluate(() => !!scoreEditor.score.rows[0][1][0].dot), false, 'whole notes cannot be dotted');
  await page.locator('#e2-0 .notehead').dblclick({ force: true });
  assert.deepEqual(await page.evaluate(() => { const ev = scoreEditor.score.rows[0][2][0]; return [!!ev.dot, ev.at]; }), [true, 0], 'a lone figure is moved to the measure start to fit its dot');
  await page.reload();
  await page.waitForSelector('#scoreStage g.note');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].dot), true, 'dot is saved');
  // 6/8: bajo en blanca con una voz superior (negra con puntillo y negra). Al puntillar el bajo, lo que empieza con el se alinea
  // al inicio del compas, y quitar y volver a poner el puntillo sigue cabiendo porque las voces quedaron fijas.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  await page.evaluate(() => {
    ScoreModel.setMeter(scoreEditor.score, '6/8');
    scoreEditor.score.rows[0][0].splice(0, 3, { d: 'h', n: 25, at: 18 }, { d: 'q', n: 35, dot: true, at: 18 }, { d: 'q', n: 37, at: 48 });
    scoreEditor.render();
  });
  const bass = page.locator('#e0-0 .notehead');
  const state = () => page.evaluate(() => scoreEditor.score.rows[0][0].map((ev) => [!!ev.dot, ev.at]));
  await bass.dblclick({ force: true });
  assert.deepEqual(await state(), [[true, 0], [true, 0], [false, 48]], 'the dotted half moves to the bar start with the figures that started with it');
  await bass.dblclick({ force: true });
  assert.deepEqual((await state())[0], [false, 0]);
  await bass.dblclick({ force: true });
  assert.deepEqual((await state())[0], [true, 0], 'the dot fits again: the upper quarter stays in its own voice');
}

// Varias partituras: el titulo es la pestana activa y el + abre una partitura independiente.
async function checkTabs(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.ok(await page.evaluate(() => document.querySelector('.score-doc-tabs').compareDocumentPosition(document.querySelector('.score-toolbar')) & Node.DOCUMENT_POSITION_FOLLOWING), 'las pestanas van antes de la barra de herramientas');
  await page.locator('.score-doc-tab-input').fill('Uno');
  assert.equal(await page.locator('#scoreTitle').inputValue(), 'Uno');
  await page.locator('#scoreNewTab').click();
  assert.equal(await page.locator('.score-doc-tab').count(), 2);
  await page.locator('#scoreTitle').fill('Dos');
  assert.equal(await page.locator('.score-doc-tab-input').inputValue(), 'Dos');
  assert.equal(await page.locator('button.score-doc-tab').textContent(), 'Uno');
  await page.locator('button.score-doc-tab').click();
  assert.equal(await page.locator('#scoreTitle').inputValue(), 'Uno');
  await page.reload();
  await page.waitForSelector('#scoreStage g.measure');
  assert.equal(await page.locator('#scoreTitle').inputValue(), 'Uno');
  assert.equal(await page.locator('button.score-doc-tab').textContent(), 'Dos');
}

async function checkClear(page) {
  await page.locator('[data-shortcut="4"]').click();
  const point = await page.locator('#scoreStage g.measure').first().evaluate(node => {
    const r = node.querySelector('g.staff > path').getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + 10 };
  });
  await page.mouse.click(point.x, point.y);
  const filled = () => page.evaluate(() => scoreEditor.score.rows.flat(2).length);
  assert.ok(await filled() > 0, 'a note was placed');
  const [clear, download] = await Promise.all(['#scoreClear', '#scoreDownloadToggle'].map(id => page.locator(id).boundingBox()));
  assert.ok(clear.y < download.y, 'delete sits right above download');
  assert.equal(await page.locator('.score-side #scoreClear, .score-side #scoreDownloadToggle').count(), 0, 'actions are their own sidebar, apart from the barlines');
  assert.ok(download.y + download.height > page.viewportSize().height - 60, 'download sits at the bottom of the viewport');
  assert.ok(download.x > (await page.locator('#scoreStage').boundingBox()).x + 300, 'both live in the side menu');
  for (const id of ['#scoreClear', '#scoreDownloadToggle']) {
    await page.locator(id).hover();
    await page.waitForFunction(selector => getComputedStyle(document.querySelector(selector), '::after').opacity === '1', id);
    const tip = await page.locator(id).evaluate(el => ({ text: el.dataset.tooltip, opacity: getComputedStyle(el, '::after').opacity }));
    assert.ok(tip.text, id + ' has tooltip text');
    assert.equal(tip.opacity, '1', id + ' shows its tooltip on hover');
  }
  await page.locator('#scoreDownloadToggle').click();
  assert.equal(await page.locator('#scoreDownloadOptions button svg.lucide').count(), 2, 'each download option has a Lucide icon');
  assert.match(await page.locator('#scoreDownloadOptions').evaluate(el => getComputedStyle(el).fontFamily), /sans|Helvetica|Arial|system-ui/i, 'download popup uses the sans font');
  await page.locator('#scoreDownloadToggle').click();
  await page.mouse.move(0, 0);
  const stageBefore =await page.locator('#scoreStage').boundingBox();
  await page.locator('#scoreClear').click();
  await page.locator('.confirm-content').waitFor();
  const stageOpen = await page.locator('#scoreStage').boundingBox();
  assert.equal(stageOpen.x, stageBefore.x, 'opening the dialog does not shift the page');
  assert.equal(stageOpen.width, stageBefore.width);
  await page.keyboard.press('Escape');
  await page.locator('.confirm-content').waitFor({ state: 'detached' });
  assert.ok(await filled() > 0, 'cancel keeps the score');
  await page.locator('#scoreClear').click();
  await page.locator('.confirm-danger').click();
  assert.equal(await filled(), 0);
  console.log('Score editor clear: Radix confirm guards the delete.');
}

async function checkAppendAfterLast(page) {
  await page.evaluate(() => {
    scoreEditor.score.meter = '3/4';
    scoreEditor.score.rows[0][0] = [{ n: 34, d: 'e', at: 0 }, { n: 35, d: 'q', at: 12 }, { n: 34, d: 'e', at: 36 }];
    scoreEditor.render();
    return document.fonts.ready;
  });
  await page.waitForTimeout(300);
  const box = await page.locator('#m0 > g.staff > path').first().boundingBox();
  await page.keyboard.press('4');
  await page.mouse.click(box.x + box.width * 0.85, box.y + 20);
  const placed = await page.evaluate(() => scoreEditor.score.rows[0][0].map((ev) => ev.d + '@' + ev.at));
  assert.deepEqual(placed, ['e@0', 'q@12', 'e@36', 'q@48'], 'un clic a la derecha de la ultima figura la agrega despues, sin encimarla');
  await page.keyboard.press('Escape');
  // Una negra y una corchea en la misma columna: arrastrar la negra a la derecha de la corchea la pone despues.
  await page.evaluate(() => {
    scoreEditor.score.rows[0][0] = [{ n: 34, d: 'e', at: 0 }, { n: 36, d: 'q', at: 12 }, { n: 38, d: 'q', at: 36 }, { n: 34, d: 'e', at: 36 }];
    scoreEditor.render();
    return document.fonts.ready;
  });
  await page.waitForTimeout(300);
  const heads = await page.evaluate(() => [...document.querySelectorAll('#m0 .notehead')].map((n) => { const r = n.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; }));
  await page.mouse.move(heads[2][0], heads[2][1]);
  await page.mouse.down();
  await page.mouse.move(heads[2][0] + 5, heads[2][1], { steps: 3 });
  await page.mouse.move(heads[3][0] + 25, heads[2][1], { steps: 8 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => scoreEditor.score.rows[0][0].map((ev) => ev.d + ev.n + '@' + ev.at).sort());
  assert.deepEqual(dragged, ['e34@0', 'e34@36', 'q36@12', 'q38@48'], 'arrastrar la negra a la derecha de la corchea la pone despues');
}

async function checkStartAndLedgers(page) {
  await page.evaluate(() => { scoreEditor.score.rows[0][0] = []; scoreEditor.render(); return document.fonts.ready; });
  await page.waitForTimeout(300);
  const staff = await page.locator('#m0 > g.staff > path').first().boundingBox();
  const content = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#m0 g.clef, #m0 g.meterSig, #m0 g.keySig, .score-meter-trigger, .score-key-trigger')].map((g) => g.getBoundingClientRect().right)));
  await page.keyboard.press('5');
  // Apuntar apenas pasada la clave y el compas: la nota empieza con el compas, no corrida a la derecha.
  await page.mouse.click(content + 1, staff.y + 10);
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].at), 0, 'apuntar al inicio del compas coloca la nota en el tiempo 0');
  await page.keyboard.press('ControlOrMeta+z');
  // Fuera del pentagrama el marcador muestra las lineas adicionales que se irian sumando.
  const hover = async (dy) => { await page.mouse.move(content + 80, staff.y + dy); return page.locator('.score-marker-ledger').count(); };
  const space = await page.evaluate(() => { const l = [...document.querySelectorAll('#m0 > g.staff > path')].map((p) => p.getBoundingClientRect().top); return (l[4] - l[0]) / 4; });
  assert.equal(await hover(space * 2), 0, 'dentro del pentagrama no hay lineas adicionales');
  const below = await hover(space * 4 + space * 2);
  assert.ok(below >= 1, 'bajo el pentagrama aparecen lineas adicionales');
  assert.ok((await hover(space * 4 + space * 4)) > below, 'cuanto mas grave, mas lineas');
  assert.ok((await hover(-space * 3)) >= 1, 'sobre el pentagrama tambien');
  await page.keyboard.press('Escape');
}

async function run() {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    // El resto de pruebas sueltan justo bajo el puntero; el desplazamiento se prueba aparte.
    const newPage = async (options) => {
      const created = await browser.newPage(options);
      created.on('load', () => created.evaluate(() => { scoreEditor.ghostOffset = 0; }).catch(() => {}));
      return created;
    };
    const page = await newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = 'http://localhost:' + server.address().port + '/partitura';
    await page.goto(url);
    await page.waitForSelector('.score-clef-trigger');
    assert.equal(await page.locator('.score-clef-trigger').count(), 3);
    await page.evaluate(() => { scoreEditor.ghostOffset = 0; });

    // All options are visible; choosing one applies it immediately without closing the gallery.
    const box = await page.locator('#scoreStage g.clef').first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), true);
    assert.equal(await page.locator('#scoreClefPopup select').count(), 0);
    assert.equal(await page.locator('.score-clef-options button').count(), 5);
    assert.equal(await page.locator('.score-key-options button').count(), 15);
    assert.equal(await page.locator('.score-clef-options button svg g.clef').count(), 5);
    assert.equal(await page.locator('.score-key-options .score-key-name, .score-key-options svg > path').count(), 0, 'key options show only accidentals, without labels or staff lines');
    assert.equal(await page.locator('.score-key-options button').evaluateAll(buttons => buttons.every(button => button.getAttribute('aria-label') && button.dataset.tooltip)), true);
    assert.equal(await page.locator('.score-signature-option').evaluateAll(buttons => buttons.every(button => getComputedStyle(button).borderWidth === '0px')), true);
    assert.equal(await page.locator('#scoreClefPopup').evaluate(popup => getComputedStyle(popup).overflow), 'visible', 'tooltips can extend beyond the popup');
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
    // Con el desplazamiento activo la figura queda arriba a la izquierda del puntero y se suelta donde esta la figura.
    await page.evaluate(() => { scoreEditor.ghostOffset = 2; });
    await page.mouse.move(palette.x + palette.width / 2, palette.y + palette.height / 2);
    await page.mouse.down();
    await page.mouse.move(line.x + line.width * 0.6 + 2, line.y + line.height / 2 + 2, { steps: 8 });
    const ghost = await page.locator('.score-ghost svg path').first().boundingBox();
    assert.ok(ghost.x + ghost.width / 2 < line.x + line.width * 0.6 + 2 && ghost.y + ghost.height / 2 < line.y + line.height / 2 + 2, 'el puntero queda abajo a la derecha de la figura');
    await page.mouse.up();
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0].some((e) => e.n === 25)), true, 'se suelta donde esta la figura, no donde esta el puntero');
    await page.keyboard.press('ControlOrMeta+z');
    await page.evaluate(() => { scoreEditor.ghostOffset = 0; });
    const before = await page.evaluate(() => structuredClone(scoreEditor.score.rows));
    await page.locator('.score-clef-trigger').nth(1).click();
    // With a key signature the clef popup offers only clefs; the key signature has its own popup.
    assert.equal(await page.locator('.score-key-options').isVisible(), false);
    await page.locator('.score-clef-options [data-clef="alto"]').click();
    await page.keyboard.press('Escape');
    await page.locator('.score-key-trigger').nth(1).click();
    assert.equal(await page.locator('.score-clef-options').isVisible(), false);
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
    assert.equal(await page.locator('#scoreMeterPopup button svg').count(), 8);

    // Clicking the accidentals opens the same clef and key popup.
    await page.keyboard.press('Escape');
    await page.locator('.score-key-trigger').first().click();
    await page.locator('.score-key-options [data-fifths="2"]').click();
    await page.keyboard.press('Escape');
    await page.locator('.score-key-trigger').first().click();
    assert.equal(await page.locator('#scoreClefPopup').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.goto('http://localhost:' + server.address().port + '/en/sheet-music-editor');
    await page.waitForSelector('.score-clef-trigger');
    await page.locator('.score-clef-trigger').first().click();
    assert.equal(await page.getByRole('dialog', { name: 'Clef and key signature', exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.score-key-trigger').first().click();
    assert.equal(await page.getByRole('group', { name: 'Key signature', exact: true }).locator('button').count(), 15);
    assert.deepEqual(errors, []);
    const splitPage = await newPage({ reducedMotion: 'reduce' });
    await splitPage.goto(url);
    await splitPage.waitForSelector('#scoreStage g.measure');
    await checkInteriorDoubleBar(splitPage);
    await checkSplitKeepsRows(splitPage);
    await splitPage.close();
    const widthsPage = await newPage({ reducedMotion: 'reduce' });
    await widthsPage.goto(url);
    await widthsPage.waitForSelector('#scoreStage g.measure');
    await checkMeasureWidths(widthsPage);
    await checkBarResizeConstraints(widthsPage);
    await widthsPage.close();
    const dragPage = await newPage({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
    await dragPage.goto(url);
    await dragPage.waitForSelector('#scoreStage g.measure');
    await checkDrag(dragPage);
    await checkBarlines(dragPage);
    await checkBarre(dragPage);
    await checkKeyChanges(dragPage);
    await checkRowMeasureTools(dragPage);
    await dragPage.close();
    for (const [route, keys] of [
      ['/partitura', ['p', 's', 'b', 'c']],
      ['/en/sheet-music-editor', ['d', 's', 'f', 'n']],
    ]) {
      const modifierPage = await newPage({ reducedMotion: 'reduce' });
      await checkModifiers(modifierPage, 'http://localhost:' + server.address().port + route, keys);
      await modifierPage.close();
    }
    const doubleClickPage = await newPage({ reducedMotion: 'reduce' });
    await doubleClickPage.goto(url);
    await doubleClickPage.waitForSelector('#scoreStage g.measure');
    await checkDoubleClick(doubleClickPage);
    await doubleClickPage.close();
    const clearPage = await newPage({ reducedMotion: 'reduce' });
    await clearPage.goto(url);
    await clearPage.waitForSelector('#scoreStage g.measure');
    await checkClear(clearPage);
    await clearPage.close();
    const tabsPage = await newPage({ reducedMotion: 'reduce' });
    await tabsPage.goto(url);
    await tabsPage.waitForSelector('#scoreStage g.measure');
    await checkTabs(tabsPage);
    await tabsPage.close();
    const appendPage = await newPage({ reducedMotion: 'reduce' });
    await appendPage.goto(url);
    await appendPage.waitForSelector('#scoreStage g.measure');
    await checkAppendAfterLast(appendPage);
    await appendPage.close();
    const ledgerPage = await newPage({ reducedMotion: 'reduce' });
    await ledgerPage.goto(url);
    await ledgerPage.waitForSelector('#scoreStage g.measure');
    await checkStartAndLedgers(ledgerPage);
    await ledgerPage.close();
    console.log('score-editor e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
