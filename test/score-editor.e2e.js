/* Editor privado /partitura. Ejecutar despues de npm run build:site. */
'use strict';
const { clearScoreStorage } = require('./score-storage-helpers');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function checkUndoShortcuts(page) {
  const rowCount = () => page.evaluate(() => scoreEditor.score.rows.length);
  const initial = await rowCount();
  for (const [undo, redo] of [['Meta+z', 'Meta+Shift+z'], ['Control+z', 'Control+Shift+z'], ['Control+z', 'Control+y']]) {
    await page.locator('#scoreAddRow').click();
    assert.equal(await rowCount(), initial + 1);
    await page.keyboard.press(undo);
    assert.equal(await rowCount(), initial, undo + ' deshace la edicion');
    await page.keyboard.press(redo);
    assert.equal(await rowCount(), initial + 1, redo + ' la rehace');
    await page.keyboard.press(undo);
    assert.equal(await rowCount(), initial);
  }
  // Los campos conservan su propio historial de texto.
  await page.locator('#scoreAddRow').click();
  await page.locator('#scoreTitle').focus();
  await page.keyboard.press('Meta+z');
  assert.equal(await rowCount(), initial + 1, 'editar texto no deshace la partitura');
  await page.locator('#scoreStage').focus();
  await page.keyboard.press('Meta+z');
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

async function checkModifiers(page, url, keys) {
  await page.goto(url);
  await page.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
  assert.deepEqual((await page.locator('.score-palette-key').allTextContents()).slice(-4), keys);
  const labels = keys[0] === 'p'
    ? ['Fusa', 'Semicorchea', 'Corchea', 'Negra', 'Blanca', 'Redonda', 'Nota muerta', 'Silencio de fusa', 'Silencio de semicorchea', 'Silencio de corchea', 'Silencio de negra', 'Silencio de blanca', 'Silencio de redonda']
    : ['Thirty-second note', 'Sixteenth note', 'Eighth note', 'Quarter note', 'Half note', 'Whole note', 'Dead note', 'Thirty-second rest', 'Sixteenth rest', 'Eighth rest', 'Quarter rest', 'Half rest', 'Whole rest'];
  assert.deepEqual(await page.locator('#scorePalette button').evaluateAll(buttons => buttons.slice(0, 13).map(button => button.getAttribute('aria-label'))), labels);
}

async function checkTabs(page) {
  await clearScoreStorage(page);
  await page.reload();
  await page.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
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
  await page.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
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
  assert.equal(await page.locator('.score-side-actions #scoreClear, .score-side-actions #scoreDownloadToggle').count(), 2, 'actions stay grouped in the side menu');
  const tools = await page.locator('#scoreBarlines').boundingBox();
  assert.ok(clear.y >= tools.y + tools.height, 'actions sit below the expanded palette without covering its tools');
  assert.ok(download.x > (await page.locator('#scoreStage').boundingBox()).x + 300, 'both live in the side menu');
  for (const id of ['#scoreClear', '#scoreDownloadToggle']) {
    await page.locator(id).hover();
    await page.waitForFunction(selector => getComputedStyle(document.querySelector(selector), '::after').opacity === '1', id);
    const tip = await page.locator(id).evaluate(el => ({ text: el.dataset.tooltip, opacity: getComputedStyle(el, '::after').opacity }));
    assert.ok(tip.text, id + ' has tooltip text');
    assert.equal(tip.opacity, '1', id + ' shows its tooltip on hover');
  }
  await page.locator('#scoreDownloadToggle').click();
  assert.equal(await page.locator('#scoreDownloadOptions button svg.lucide').count(), 3, 'each download option has a Lucide icon');
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
  // Con mas de una partitura, borrar la primera la elimina por completo.
  await page.locator('#scoreNewTab').click();
  assert.equal(await page.locator('.score-doc-tab').count(), 2);
  await page.locator('button.score-doc-tab').first().click();
  await page.locator('#scoreClear').click();
  await page.locator('.confirm-danger').click();
  await page.locator('.confirm-content').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.score-doc-tab').count(), 1, 'borrar la primera con otras presentes la elimina');
  console.log('Score editor clear: Radix confirm guards the delete.');
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

async function checkRestWithTool(page) {
  await clearScoreStorage(page);
  await page.reload();
  await page.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
  await page.evaluate(() => {
    scoreEditor.score.rows[0][0] = [{ rest: true, d: 'q', at: 0 }];
    scoreEditor.render();
    return document.fonts.ready;
  });
  await page.waitForTimeout(200);
  const rest = () => page.locator('#e0-0').boundingBox();
  const box = await rest();
  // Con la corchea activa, un click sobre el silencio escribe la nota en vez de seleccionarlo.
  await page.keyboard.press('3');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const placed = await page.evaluate(() => scoreEditor.score.rows[0][0]);
  assert.equal(placed.filter((e) => !e.rest && e.d === 'e').length, 1, 'la corchea se escribe sobre el silencio');
  assert.equal(await page.evaluate(() => document.querySelector('.score-stage').classList.contains('has-tool')), true);
  assert.equal(await page.locator('#scoreStage .is-selected').count(), 0, 'el silencio no queda seleccionado');
  await page.keyboard.press('Escape');
  // Un silencio solo se puede bajar: conserva la altura donde se suelta.
  await page.evaluate(() => {
    scoreEditor.score.rows[0][0] = [{ rest: true, d: 'q', at: 0 }];
    scoreEditor.render();
  });
  await page.waitForTimeout(200);
  const start = await rest();
  const x = start.x + start.width / 2, y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 5 });
  await page.mouse.up();
  const lowered = await page.evaluate(() => scoreEditor.score.rows[0][0][0]);
  assert.ok(lowered.rest && Number.isInteger(lowered.n), 'el silencio guarda su altura');
  const end = await rest();
  assert.ok(end.y > start.y + 15, 'el silencio se dibuja mas abajo');
  // Con las flechas tambien.
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0][0].n), lowered.n + 1);
  // Un click en el lienzo lejos de los compases suelta la herramienta.
  await page.keyboard.press('3');
  const stage = await page.locator('#scoreStage').boundingBox();
  await page.mouse.click(stage.x + stage.width / 2, stage.y + stage.height - 3);
  assert.equal(await page.evaluate(() => document.querySelector('.score-stage').classList.contains('has-tool')), false, 'el lienzo vacio suelta la herramienta');
}

async function checkPrependRest(page) {
  await page.evaluate(() => {
    scoreEditor.ghostOffset = 0;
    scoreEditor.score.rows[0][0] = [28, 30, 32, 33, 32].map((n, i) => ({ n, d: 'e', at: i * 12 }));
    scoreEditor.render();
    return document.fonts.ready;
  });
  await page.waitForTimeout(200); // ResizeObserver termina el dibujo antes de medir.
  await page.keyboard.press('e'); // Silencio de corchea.
  const head = await page.locator('#e0-0 .notehead').boundingBox();
  const staff = await page.locator('#m0 > g.staff > path').first().boundingBox();
  await page.mouse.click(head.x - 12, staff.y + 55);
  const measure = await page.evaluate(() => scoreEditor.score.rows[0][0]);
  assert.equal(measure[0].rest, true, 'el silencio se antepone a las notas');
  assert.deepEqual(measure.slice(1).map(ev => ev.at), [12, 24, 36, 48, 60], 'las cinco notas se desplazan una corchea');
  assert.equal(new Set(measure.map(ev => ev.v || 1)).size, 1, 'el silencio sigue en la misma voz');
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0].length), 5);
}

async function checkDownloadFilenames(page, url) {
  await page.goto(url);
  await page.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
  for (const [title, author, expected] of [
    ['Zamba del río', '', 'Zamba del río'],
    ['Zamba del río', 'Cuchi Leguizamón', 'Zamba del río - Cuchi Leguizamón'],
    ['  Zamba del río  ', '   ', 'Zamba del río'],
    ['   ', '  Cuchi Leguizamón  ', 'partitura - Cuchi Leguizamón'],
    ['', '', 'partitura'],
  ]) {
    await page.locator('#scoreTitle').fill(title);
    await page.locator('#scoreAuthor').fill(author);
    for (const [button, extension] of [['Xml', 'musicxml'], ['Pdf', 'pdf']]) {
      await page.locator('#scoreDownloadToggle').click();
      const pending = page.waitForEvent('download');
      await page.locator('#scoreDownload' + button).click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), expected + '.' + extension);
      await download.delete();
      await page.waitForFunction(() => !document.getElementById('scoreDownloadPdf').disabled);
    }
  }
}

async function run() {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    for (const route of ['/partitura', '/en/sheet-music-editor']) {
      const downloadPage = await browser.newPage();
      await checkDownloadFilenames(downloadPage, 'http://localhost:' + server.address().port + route);
      await downloadPage.close();
    }
    // El resto de pruebas sueltan justo bajo el puntero; el desplazamiento se prueba aparte.
    const newPage = async (options) => {
      const created = await browser.newPage(options);
      // IndexedDB restoration can finish after load. Configure the API at the
      // moment the editor installs it, including after reloads.
      await created.addInitScript(() => {
        Object.defineProperty(window, 'scoreEditor', {
          configurable: true,
          set(editor) {
            editor.ghostOffset = 0;
            Object.defineProperty(window, 'scoreEditor', { value: editor, writable: true, configurable: true, enumerable: true });
          },
        });
      });
      return created;
    };
    const page = await newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = 'http://localhost:' + server.address().port + '/partitura';
    await page.goto(url);
    await page.waitForSelector('.score-clef-trigger');
    // The host enables playback; the engine puts the button in a gutter left of the staff, which must stay on screen.
    const play = await page.locator('#scorePlayback').boundingBox();
    assert.ok(play && play.x >= 0 && play.width > 0, 'el boton de reproduccion esta visible dentro de la pagina');
    assert.equal(await page.locator('#scoreSettingsToggle').count(), 0, 'Ajustes no se monta solo por habilitar la reproduccion');
    await checkUndoShortcuts(page);
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
    assert.equal(await page.evaluate(() => scoreEditor.score.rows[0][0].find((ev) => !ev.rest).n), 25, 'una nota sola en un compas vacio supone silencios antes');
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

    await page.goto('http://localhost:' + server.address().port + '/en/sheet-music-editor');
    await page.waitForSelector('.score-clef-trigger');
    await page.locator('.score-clef-trigger').first().click();
    assert.equal(await page.getByRole('dialog', { name: 'Clef and key signature', exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.score-key-trigger').first().click();
    const keyButtons = page.getByRole('group', { name: 'Key signature', exact: true }).locator('button');
    await keyButtons.first().waitFor();
    assert.equal(await keyButtons.count(), 15);
    assert.deepEqual(errors, []);
    const widthsPage = await newPage({ reducedMotion: 'reduce' });
    await widthsPage.goto(url);
    await widthsPage.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    await checkBarResizeConstraints(widthsPage);
    await widthsPage.close();
    for (const [route, keys] of [
      ['/partitura', ['p', 's', 'b', 'c']],
      ['/en/sheet-music-editor', ['d', 's', 'f', 'n']],
    ]) {
      const modifierPage = await newPage({ reducedMotion: 'reduce' });
      await checkModifiers(modifierPage, 'http://localhost:' + server.address().port + route, keys);
      await modifierPage.close();
    }
    const clearPage = await newPage({ reducedMotion: 'reduce' });
    await clearPage.goto(url);
    await clearPage.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    await checkClear(clearPage);
    await clearPage.close();
    const tabsPage = await newPage({ reducedMotion: 'reduce' });
    await tabsPage.goto(url);
    await tabsPage.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    await checkTabs(tabsPage);
    await tabsPage.close();
    const ledgerPage = await newPage({ reducedMotion: 'reduce' });
    await ledgerPage.goto(url);
    await ledgerPage.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    await checkStartAndLedgers(ledgerPage);
    await ledgerPage.close();
    const restPage = await newPage({ reducedMotion: 'reduce' });
    await restPage.goto(url);
    await restPage.waitForSelector('#scoreStage:not([aria-busy]) g.measure');
    await checkRestWithTool(restPage);
    await checkPrependRest(restPage);
    await restPage.close();
    console.log('score-editor e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
