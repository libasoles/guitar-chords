/* Seleccion multiple en /partitura: menu contextual, marco y arrastre en grupo. Ejecutar despues de npm run build:site. */
'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

async function seed(page, measures) {
  await page.evaluate((data) => {
    const all = ScoreModel.measures(scoreEditor.score);
    all.forEach((m) => { m.length = 0; });
    data.forEach((events, mi) => all[mi].push(...events));
    scoreEditor.render();
  }, measures);
  await page.waitForSelector('#scoreStage g.note');
  await page.locator('#scoreStage').focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300); // El ResizeObserver completa el dibujo antes de clickear las notas.
}

async function center(page, id) {
  const box = await page.locator('[id="' + id + '"] .notehead').first().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function shiftSelect(page, ids) {
  await page.keyboard.down('Shift');
  for (const id of ids) {
    const p = await center(page, id);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.up('Shift');
}

const actions = (page) => page.locator('.score-selection-action').evaluateAll((nodes) => nodes.map((n) => n.dataset.action));
const events = (page, mi) => page.evaluate((m) => ScoreModel.measures(scoreEditor.score)[m], mi);

async function run() {
  const server = await serveStatic(path.join(__dirname, '..', 'dist', 'site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = 'http://localhost:' + server.address().port + '/partitura';
    await page.goto(url);
    await page.waitForSelector('#scoreStage g.measure');

    // Partituras guardadas con 8 divisiones por negra se reescalan; el hueco antes de la primera figura no cuenta.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('scoreEditor.v1', JSON.stringify({ rows: [[[], [], [{ d: 'q', n: 30, at: 0 }, { d: 'e', n: 31, at: 8 }], []]] }));
    });
    await page.reload();
    await page.waitForSelector('#scoreStage g.note');
    assert.equal((await events(page, 2))[1].at, 24);

    // Clickear fuera del pentagrama deselecciona, incluso sobre los campos del titulo.
    await seed(page, [[{ d: 'e', n: 30, at: 0 }, { d: 'e', n: 31, at: 12 }]]);
    const picked = await center(page, 'e0-0');
    await page.mouse.click(picked.x, picked.y);
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 1);
    await page.locator('#scoreTitle').click();
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 0, 'el titulo deselecciona una sola figura');
    for (const target of ['.score-title', '#scoreTitle', '#scoreAuthor', '.site-header']) {
      await shiftSelect(page, ['e0-0', 'e0-1']);
      assert.equal(await page.locator('#scoreStage .is-selected').count(), 2);
      const box = await page.locator(target).boundingBox();
      await page.locator(target).click({ position: { x: box.width - 2, y: 2 } });
      assert.equal(await page.locator('#scoreStage .is-selected').count(), 0, target + ' deselecciona las figuras');
      assert.equal(await page.locator('.score-selection-menu').count(), 0, 'se oculta el menu de seleccion');
    }

    // Tres corcheas seguidas: tresillo.
    await seed(page, [[
      { d: 'e', n: 30, at: 0 }, { d: 'e', n: 31, at: 12 }, { d: 'e', n: 32, at: 24 }, { d: 'q', n: 33, at: 72 },
    ], [{ d: 'q', n: 33, at: 0 }]]);
    await shiftSelect(page, ['e0-0', 'e0-1']);
    assert.deepEqual(await actions(page), ['unbeam']);
    await shiftSelect(page, ['e0-2']);
    assert.deepEqual(await actions(page), ['triplet', 'beam', 'unbeam']);
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 3);
    const menu = await page.locator('.score-selection-menu').boundingBox();
    const head = await page.locator('[id="e0-0"] .notehead').boundingBox();
    assert.ok(menu.y + menu.height <= head.y, 'el menu aparece sobre las notas ' + JSON.stringify([menu, head]));
    await page.locator('[data-action="triplet"]').click();
    assert.deepEqual((await events(page, 0)).slice(0, 3).map((ev) => [ev.tp, ev.at]), [[1, 0], [1, 8], [1, 16]]);
    assert.ok(await page.locator('#scoreStage g.tuplet').count(), 'se dibuja el tresillo');
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 3, 'la seleccion sigue despues de aplicar');
    assert.ok((await actions(page)).includes('untriplet'));

    // Mover el grupo seleccionado arrastrando una de sus notas.
    const before = (await events(page, 0)).map((ev) => [ev.n, ev.at]);
    const from = await center(page, 'e0-1');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 14, { steps: 4 });
    assert.equal(await page.locator('.score-selection-menu').count(), 0, 'el menu se oculta al arrastrar');
    await page.mouse.up();
    const after = (await events(page, 0)).map((ev) => [ev.n, ev.at]);
    assert.ok(after[0][0] > before[0][0], 'las tres notas suben');
    assert.deepEqual(after.slice(0, 3).map(([n]) => n - after[0][0]), [0, 1, 2]);
    assert.deepEqual(after.slice(0, 3).map(([, at]) => at), [0, 8, 16], 'conservan su separacion en el tiempo');
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 3, 'el grupo sigue seleccionado');
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual((await events(page, 0)).map((ev) => [ev.n, ev.at]), before);
    assert.equal(await page.locator('.score-selection-menu').count(), 0, 'deshacer limpia la seleccion');
    await shiftSelect(page, ['e0-0', 'e0-1', 'e0-2']);
    await page.locator('[data-action="untriplet"]').click();
    assert.deepEqual((await events(page, 0)).slice(0, 3).map((ev) => [ev.tp, ev.at]), [[undefined, 0], [undefined, 12], [undefined, 24]]);

    // Arrastrar el grupo a otro compas.
    await seed(page, [[{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 31, at: 24 }], []]);
    await shiftSelect(page, ['e0-0', 'e0-1']);
    const grab = await center(page, 'e0-0');
    const staff = await page.locator('#scoreStage g.measure').nth(1).locator('g.staff > path').first().boundingBox();
    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await page.mouse.move(staff.x + 20, grab.y, { steps: 8 });
    await page.mouse.up();
    assert.equal((await events(page, 0)).length, 0);
    assert.equal((await events(page, 1)).length, 2);

    // Agarrar una nota intermedia no impide llevar el grupo al inicio de un compas vacio.
    await seed(page, [[{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 31, at: 24 }], []]);
    await shiftSelect(page, ['e0-0', 'e0-1']);
    const middle = await center(page, 'e0-1');
    const emptyStaff = await page.locator('#scoreStage g.measure').nth(1).locator('g.staff > path').first().boundingBox();
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.down();
    await page.mouse.move(emptyStaff.x + 20, middle.y, { steps: 8 });
    await page.mouse.up();
    assert.equal((await events(page, 0)).length, 0, 'se mueve el grupo agarrado desde la segunda nota');
    assert.deepEqual((await events(page, 1)).map(ev => [ev.n, ev.at]), [[30, 0], [31, 24]]);
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 2);
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal((await events(page, 0)).length, 2, 'deshacer devuelve todo el grupo');
    assert.equal((await events(page, 1)).length, 0);

    // El limite derecho tambien se calcula para el grupo entero.
    await shiftSelect(page, ['e0-0', 'e0-1']);
    const first = await center(page, 'e0-0');
    const rightStaff = await page.locator('#scoreStage g.measure').nth(1).locator('g.staff > path').first().boundingBox();
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    await page.mouse.move(rightStaff.x + rightStaff.width - 2, first.y, { steps: 8 });
    await page.mouse.up();
    assert.equal((await events(page, 0)).length, 0);
    assert.deepEqual((await events(page, 1)).map(ev => [ev.n, ev.at]), [[30, 0], [31, 24]]);

    // Como en la captura: la seleccion ocupa dos compases y conserva su distribucion.
    const phrase = Array.from({ length: 6 }, (_, i) => ({ d: 'e', n: 30 + i, at: i * 12 }));
    await seed(page, [phrase, [{ d: 'q', n: 36, at: 0 }], [], []]);
    await shiftSelect(page, [...phrase.map((_, i) => 'e0-' + i), 'e1-0']);
    const phraseHead = await center(page, 'e0-3');
    const phraseStaff = await page.locator('#scoreStage g.measure').nth(2).locator('g.staff > path').first().boundingBox();
    await page.mouse.move(phraseHead.x, phraseHead.y);
    await page.mouse.down();
    await page.mouse.move(phraseStaff.x + 20, phraseHead.y, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual(await events(page, 0), []);
    assert.deepEqual(await events(page, 1), []);
    assert.deepEqual((await events(page, 2)).map(ev => [ev.n, ev.at]), phrase.map(ev => [ev.n, ev.at]));
    assert.deepEqual((await events(page, 3)).map(ev => [ev.n, ev.at]), [[36, 0]]);
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 7);

    // Marco de seleccion.
    await seed(page, [[{ d: 'e', n: 30, at: 0 }, { d: 'e', n: 31, at: 12 }, { d: 'q', n: 32, at: 48 }], []]);
    const a = await page.locator('[id="e0-0"] .notehead').boundingBox();
    const b = await page.locator('[id="e0-1"] .notehead').boundingBox();
    await page.mouse.move(a.x - 8, a.y - 40);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width + 8, b.y + b.height + 8, { steps: 6 });
    assert.equal(await page.locator('.score-marquee').count(), 1);
    await page.mouse.up();
    assert.equal(await page.locator('.score-marquee').count(), 0);
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 2);
    assert.deepEqual(await actions(page), ['unbeam']);
    // Dos corcheas de pulsos distintos: barrar; despues, separar.
    // El silencio de corchea las corre al contratiempo: sin el empezarian en 0, en el mismo pulso.
    await seed(page, [[{ d: 'e', rest: true, at: 0 }, { d: 'e', n: 30, at: 12 }, { d: 'e', n: 31, at: 24 }], []]);
    await shiftSelect(page, ['e0-1', 'e0-2']);
    assert.deepEqual(await actions(page), ['beam']);
    await page.locator('[data-action="beam"]').click();
    assert.ok(await page.locator('#scoreStage g.beam').count());
    assert.deepEqual(await actions(page), ['unbeam']);
    await page.locator('[data-action="unbeam"]').click();
    assert.equal(await page.locator('#scoreStage g.beam').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.score-selection-menu').count(), 0);

    // Ligadura entre el final de un compas y el comienzo del siguiente; teclado Shift+Flecha.
    await seed(page, [[{ d: 'h', n: 30, at: 0 }, { d: 'h', n: 32, at: 48 }], [{ d: 'q', n: 32, at: 0 }]]);
    const last = await center(page, 'e0-1');
    await page.mouse.click(last.x, last.y);
    await page.keyboard.press('Shift+ArrowRight');
    assert.deepEqual(await actions(page), ['link']);
    await page.locator('[data-action="link"]').click();
    assert.equal((await events(page, 0))[1].tie, true);
    assert.ok(await page.locator('#scoreStage g.tie').count(), 'se dibuja la ligadura');
    assert.deepEqual(await actions(page), ['unlink']);
    await page.locator('[data-action="unlink"]').click();
    assert.equal(await page.locator('#scoreStage g.tie').count(), 0);

    // Suprimir y subir/bajar actuan sobre todo el grupo.
    await seed(page, [[{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 31, at: 24 }, { d: 'q', n: 32, at: 48 }], []]);
    await shiftSelect(page, ['e0-0', 'e0-1']);
    await page.locator('#scoreStage').focus();
    await page.keyboard.press('ArrowUp');
    assert.deepEqual((await events(page, 0)).map((ev) => ev.n), [31, 32, 32]);
    await page.keyboard.press('Delete');
    assert.deepEqual((await events(page, 0)).map((ev) => ev.n), [32]);

    // Copiar una seleccion de dos compases, elegir destino y pegar con el teclado.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page, [[{ d: 'e', n: 30, at: 0 }, { d: 'e', n: 31, at: 12 }], [{ d: 'q', n: 32, at: 0 }], [], []]);
    await page.evaluate(() => {
      scoreEditor.score.showTabs = true;
      scoreEditor.score.tabs = { '0:0': [null, null, null, null, 7, null], '0:12': [null, null, null, null, 8, null] };
      scoreEditor.render();
    });
    await page.waitForSelector('#scoreStage ascii-tabs');
    const original = [await events(page, 0), await events(page, 1)];
    await shiftSelect(page, ['e0-0', 'e0-1', 'e1-0']);
    await page.keyboard.press('ControlOrMeta+c');
    const selectBar = async mi => {
      await page.locator('#scoreStage g.measure').nth(mi).scrollIntoViewIfNeeded();
      const lines = await page.locator('#scoreStage g.measure').nth(mi).locator('g.staff > path').evaluateAll(nodes => nodes.slice(0, 5).map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
      await page.mouse.click(lines[0].x + lines[0].width / 2, (lines[1].y + lines[2].y) / 2);
    };
    const clipboard = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    assert.equal(clipboard.tabs.length, 3, 'copia TAB corregida y automatica visible');
    const expectedTabs = Object.fromEntries(clipboard.tabs.map(entry => {
      const note = entry.notes[0];
      return [(note.mi + 2) + ':' + clipboard.measures[note.mi][note.i].at, entry.column];
    }));
    assert.deepEqual(expectedTabs['2:0'], [null, null, null, null, 7, null]);
    await selectBar(2);
    assert.equal(await page.locator('.score-barline-trigger[aria-pressed="true"]').count(), 2, 'ambas barras indican el compas elegido');
    assert.equal(await page.locator('.is-bar-selected').count(), 2);
    assert.equal(await page.locator('.score-barline-remove').count(), 2, 'cada barra ofrece su X');
    await page.keyboard.press('ControlOrMeta+v');
    await page.waitForFunction(() => ScoreModel.measures(scoreEditor.score)[3].length === 1);
    assert.deepEqual(await events(page, 2), original[0]);
    assert.deepEqual(await events(page, 3), original[1]);
    const pastedTabs = await page.evaluate(() => scoreEditor.score.tabs);
    for (const [key, column] of Object.entries(expectedTabs)) assert.deepEqual(pastedTabs[key], column, key);
    assert.deepEqual([await events(page, 0), await events(page, 1)], original, 'el origen queda intacto');
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 3, 'las notas pegadas quedan seleccionadas');
    assert.equal(await page.locator('.score-barline-remove').count(), 0);
    assert.equal(await page.locator('.is-bar-selected').count(), 0);
    await page.keyboard.press('ControlOrMeta+z');
    assert.deepEqual(await events(page, 2), []);
    assert.deepEqual(await events(page, 3), []);
    assert.equal(await page.evaluate(() => scoreEditor.score.tabs['2:0']), undefined, 'deshacer elimina la TAB pegada');
    assert.deepEqual(await page.evaluate(() => scoreEditor.score.tabs['0:0']), expectedTabs['2:0']);
    // El portapapeles sigue disponible y se crean compases si el grupo supera el final.
    await selectBar(11);
    await page.keyboard.press('ControlOrMeta+v');
    await page.waitForFunction(() => ScoreModel.measures(scoreEditor.score).length > 12);
    assert.deepEqual(await events(page, 11), original[0]);
    assert.deepEqual(await events(page, 12), original[1]);
    assert.equal(await page.locator('#scoreStage .is-selected').count(), 3);
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal(await page.evaluate(() => ScoreModel.measures(scoreEditor.score).length), 12);
    // Esc y un click fuera cancelan el destino del pegado.
    await selectBar(2);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.score-barline-remove').count(), 0);
    await selectBar(2);
    await page.locator('#scoreTitle').click();
    assert.equal(await page.locator('.is-bar-selected').count(), 0);
    await page.locator('#scoreTitle').fill('Titulo de prueba');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    assert.equal(await page.locator('#scoreTitle').inputValue(), 'Titulo de prueba', 'copiar y pegar texto sigue siendo nativo');

    // Entre documentos: el destino empieza con TAB apagada y sin armadura.
    for (const fifths of [0, 1]) {
      const fret = fifths ? 7 : 6;
      const expected = [null, fret, null, null, null, null];
      await page.evaluate(({ fifths, expected }) => {
        Object.assign(scoreEditor.score, ScoreModel.emptyScore(), { fifths, showTabs: true, tabs: { '0:0': expected } });
        delete scoreEditor.score.keys;
        delete scoreEditor.score.clefs;
        scoreEditor.score.rows[0][0] = [{ d: 'q', n: 38, at: 0 }];
        scoreEditor.render();
      }, { fifths, expected });
      const visibleFret = page.locator('#scoreStage .ascii-tabs-cell[data-s="1"] .ascii-tabs-fret').first();
      await visibleFret.waitFor();
      assert.equal(await visibleFret.textContent(), String(fret));
      await page.locator('#e0-0 .notehead').first().click();
      await page.keyboard.press('ControlOrMeta+c');
      await page.locator('#scoreNewTab').click();
      assert.equal(await page.locator('#scoreTabToggle').getAttribute('aria-pressed'), 'false');
      await selectBar(0);
      await page.keyboard.press('ControlOrMeta+v');
      await page.waitForFunction(() => scoreEditor.score.rows[0][0].length === 1);
      assert.deepEqual(await page.evaluate(() => scoreEditor.score.tabs), { '0:0': expected }, 'TAB guardada aunque este oculta');
      await page.locator('#scoreTabToggle').click();
      assert.deepEqual(await page.evaluate(() => scoreEditor.score.tabs), { '0:0': expected }, 'mostrar TAB conserva la digitacion');
      await visibleFret.waitFor();
      assert.equal(await visibleFret.textContent(), String(fret), 'se muestra el traste original');
      assert.equal(await page.evaluate(() => ScoreModel.attacks(scoreEditor.score)[0].midis[0]), 59 + fret);
      await page.reload();
      await page.waitForSelector('#scoreStage ascii-tabs');
      assert.deepEqual(await page.evaluate(() => scoreEditor.score.tabs), { '0:0': expected }, 'se conserva al recargar');
    }

    assert.deepEqual(errors, []);
    console.log('score-selection e2e: OK');
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
