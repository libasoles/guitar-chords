/* E2E test for the pages built on ascii-tabs: the tab editor and the read-only
   sixths exercise. Serves dist/site, so run `npm run build:site` first. */
'use strict';

const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');
const { pagePath } = require('../scripts/lib/slugs');

const DIST_SITE = path.join(__dirname, '..', 'dist', 'site');

async function run() {
  const server = await serveStatic(DIST_SITE, 0);
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
  const page = await browser.newPage();
  try {
    // A first visit starts with three empty Tabs, like the previous editor.
    await page.goto(base + '/crear-tablaturas-de-guitarra');
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const fresh = await page.evaluate(() => document.querySelector('ascii-tabs').value);
    assert.deepStrictEqual(fresh, [[], [], []]);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('tabEditor.tabs')), null);

    // Titles and annotations are consumer-persisted metadata. In particular,
    // an annotation on an empty trailing column must survive note-only storage.
    const title = page.locator('.ascii-tabs-title').first();
    const textEditor = page.locator('.ascii-tabs-text-editor');
    await title.focus();
    await page.keyboard.press('Enter');
    await textEditor.fill('Estudio');
    await textEditor.press('Shift+Enter');
    await textEditor.press('End');
    await textEditor.press('Enter');
    assert.strictEqual(await title.textContent(), 'Estudio\n');
    await page.locator('.ascii-tabs-annotation-slot[data-t="0"][data-c="3"]').click();
    await textEditor.fill('Am <intro>');
    await textEditor.press('Enter');
    const annotatedDocument = await page.locator('ascii-tabs').evaluate(el => ({
      value: el.value, annotations: el.annotations, tabTitles: el.tabTitles,
    }));
    assert.strictEqual(annotatedDocument.value[0].length, 4);
    assert.deepStrictEqual(annotatedDocument.annotations[0], [{ column: 3, text: 'Am <intro>' }]);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('ascii-tabs')?.tabTitles?.[0] === 'Estudio\n');
    assert.deepStrictEqual(await page.locator('ascii-tabs').evaluate(el => ({
      value: el.value, annotations: el.annotations, tabTitles: el.tabTitles,
    })), annotatedDocument);
    assert.strictEqual(await page.locator('.ascii-tabs-annotation').textContent(), 'Am <intro>');
    assert.strictEqual(await page.locator('.ascii-tabs-annotation intro').count(), 0);

    // Touch-sized layout, cancel, blur-to-save and tab deletion all retain the
    // matching metadata, including after its tab index changes.
    await page.setViewportSize({ width: 390, height: 844 });
    await title.click();
    await textEditor.fill('Cancelado');
    await textEditor.press('Escape');
    assert.strictEqual(await title.textContent(), 'Estudio\n');
    await page.locator('.ascii-tabs-title').nth(1).click();
    await textEditor.fill('Segunda');
    await page.locator('h1').click();
    assert.strictEqual(await page.locator('.ascii-tabs-title').nth(1).textContent(), 'Segunda');
    await page.locator('.ascii-tabs-delete').first().click();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('ascii-tabs')?.tabTitles?.[0] === 'Segunda');
    assert.deepStrictEqual(await page.locator('ascii-tabs').evaluate(el => el.annotations), [[], []]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);

    // A chord name in a column annotation becomes a button that opens that
    // chord's fingering; the typed text is what gets stored and edited.
    await page.locator('.ascii-tabs-annotation-slot[data-t="0"][data-c="1"]').click();
    await textEditor.fill('Am');
    await textEditor.press('Enter');
    const chordButton = page.locator('.ascii-tabs-annotation .tab-chord');
    assert.strictEqual(await chordButton.textContent(), 'Am');
    await chordButton.click();
    await page.waitForFunction(() => document.querySelector('.chord-popover:popover-open [data-rendered]'));
    assert.strictEqual(await page.locator('.chord-popover:popover-open .name').textContent(), 'Am');
    assert.strictEqual(await textEditor.count(), 0);
    assert.strictEqual(await page.locator('.chord-popover-edit').count(), 0);
    assert.deepStrictEqual(await page.locator('.chord-popover .tuning').allTextContents(), ['', 'A', 'E', 'A', 'C', 'E']);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(() => {
        const anchor = document.querySelector('.tab-chord').getBoundingClientRect();
        const popup = document.querySelector('.chord-popover:popover-open').getBoundingClientRect();
        return Math.abs(popup.y - (anchor.bottom + 10)) < 1;
      });
      const anchor = await chordButton.boundingBox();
      const popup = await page.locator('.chord-popover:popover-open').boundingBox();
      assert.ok(popup.x >= 15 && popup.x + popup.width <= width - 15, 'popup stays within the viewport');
      assert.ok(Math.abs(popup.y - (anchor.y + anchor.height + 10)) < 1, 'popup anchors below its trigger');
      assert.ok(await page.locator('.chord-popover .finder-card').evaluate(el => el.getBoundingClientRect().width <= 180));
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.tab-chord') === document.activeElement);
    await page.setViewportSize({ width: 1280, height: 720 });
    await chordButton.dblclick();
    assert.strictEqual(await textEditor.inputValue(), 'Am');
    await textEditor.press('Escape');
    assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tabEditor.document')).annotations[0]), [{ column: 1, text: 'Am' }]);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.ascii-tabs-annotation .tab-chord'));
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);

    // Chord recognition accepts the case variants used by the finder while
    // retaining the distinction between major- and minor-seventh aliases.
    for (const [typed, canonical, stringNotes] of [
      ['A7', 'A7'], ['Dmaj7', 'Dmaj7'], ['DMaj7', 'Dmaj7'],
      ['E7', 'E7'], ['A', 'A'], ['dMAJ7', 'Dmaj7'],
      ['DM7', 'Dmaj7'], ['Dm7', 'Dm7'], ['dm7', 'Dm7'],
      ['F', 'F', ['F', 'C', 'F', 'A', 'C', 'F']],
    ]) {
      await page.locator('.ascii-tabs-annotation-slot[data-t="0"][data-c="1"]').click();
      await textEditor.fill(typed);
      await textEditor.press('Enter');
      const button = page.locator('.ascii-tabs-annotation .tab-chord');
      assert.strictEqual(await button.count(), 1, typed + ' is recognized as a chord');
      assert.strictEqual(await button.textContent(), typed);
      await button.click();
      await page.waitForFunction(() => document.querySelector('.chord-popover:popover-open [data-rendered]'));
      assert.strictEqual(await page.locator('.chord-popover:popover-open .name').textContent(), canonical);
      if (stringNotes) assert.deepStrictEqual(await page.locator('.chord-popover .tuning').allTextContents(), stringNotes);
      await page.keyboard.press('Escape');
      await button.dblclick();
      assert.strictEqual(await textEditor.inputValue(), typed);
      await textEditor.fill('');
      await textEditor.press('Enter');
    }

    // An annotation reserves horizontal space in its column, even when the
    // next column has notes without an annotation of its own.
    await page.locator('ascii-tabs').evaluate(el => {
      el.setDocument({ value: [[[0, 2, 2, 2, 0, null], [2, 1, 2, 1, null, null], [0, 0, 1, 0, 2, 0]]], annotations: [[]] });
    });
    const columnTwo = page.locator('.ascii-tabs-cell[data-t="0"][data-c="2"][data-s="0"]');
    const originalColumn = await columnTwo.boundingBox();
    await page.locator('.ascii-tabs-annotation-slot[data-t="0"][data-c="1"]').click();
    await textEditor.fill('Ddim7');
    await textEditor.press('Enter');
    const columnSpace = await page.evaluate(() => {
      const annotation = document.querySelector('.ascii-tabs-annotation').getBoundingClientRect();
      const next = document.querySelector('.ascii-tabs-cell[data-t="0"][data-c="2"][data-s="0"] .ascii-tabs-fret').getBoundingClientRect();
      return { right: annotation.right, next: next.left };
    });
    assert.ok(columnSpace.right < columnSpace.next, 'Ddim7 fits before the next column');
    const copiedAnnotation = await page.evaluate(async () => {
      const clipboard = navigator.clipboard;
      const original = clipboard.writeText;
      let copied;
      clipboard.writeText = async text => { copied = text; };
      try { await document.querySelector('ascii-tabs').copy(0); }
      finally { clipboard.writeText = original; }
      return copied;
    });
    const [annotationLine, firstString] = copiedAnnotation.split('\n');
    assert.ok(annotationLine.indexOf('Ddim7') + 'Ddim7'.length < firstString.lastIndexOf('0'), 'ASCII copy preserves the annotation spacing');
    await page.locator('.tab-chord').click();
    await page.keyboard.press('Escape');
    await page.locator('.tab-chord').dblclick();
    await textEditor.fill('Anotación larga');
    await textEditor.press('Enter');
    const widerColumn = await columnTwo.boundingBox();
    assert.ok(widerColumn.x > columnSpace.next, 'plain text also widens its column');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.ascii-tabs-annotation')?.textContent === 'Anotación larga');
    assert.ok(Math.abs((await columnTwo.boundingBox()).x - widerColumn.x) < 1, 'spacing survives reload');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.ascii-tabs-annotation').click();
    await textEditor.fill('Una anotación muy larga que debe ajustarse al ancho disponible sin desbordar la tablatura');
    await textEditor.press('Enter');
    const mobile = await page.evaluate(() => {
      const annotation = document.querySelector('.ascii-tabs-annotation');
      const band = annotation.closest('.ascii-tabs-annotations');
      const first = document.querySelector('.ascii-tabs-cell[data-c="1"][data-s="0"]');
      const next = document.querySelector('.ascii-tabs-cell[data-c="2"][data-s="0"]');
      return {
        right: annotation.getBoundingClientRect().right,
        limit: band.getBoundingClientRect().right,
        wraps: first.closest('.ascii-tabs-staff') !== next.closest('.ascii-tabs-staff'),
      };
    });
    assert.ok(mobile.right <= mobile.limit + 1, 'long annotation stays within the staff');
    assert.ok(mobile.wraps, 'expanded columns wrap onto another staff');
    await page.locator('.ascii-tabs-annotation').click();
    await textEditor.fill('');
    await textEditor.press('Enter');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(x => Math.abs(document.querySelector('.ascii-tabs-cell[data-c="2"][data-s="0"]').getBoundingClientRect().x - x) < 1, originalColumn.x);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);

    // The reusable editor also works under an extension-style policy that
    // permits only local scripts: defaults, display controls and tutorial
    // opening cannot depend on inline executable scripts.
    const restricted = await browser.newPage();
    await restricted.route('**/crear-tablaturas-de-guitarra?*', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: {
        ...response.headers(), 'content-security-policy': "script-src 'self'",
      } });
    });
    await restricted.goto(base + '/crear-tablaturas-de-guitarra?tutorial');
    await restricted.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    assert.deepStrictEqual(await restricted.locator('ascii-tabs').evaluate(el => el.value), [[], [], []]);
    assert.strictEqual(await restricted.locator('.tab-tutorial').evaluate(el => el.open), true);
    await restricted.getByRole('button', { name: 'Opciones de visualización' }).click();
    await restricted.getByRole('checkbox', { name: 'Mostrar notas' }).check();
    assert.strictEqual(await restricted.locator('ascii-tabs').evaluate(el => el.notation), 'solfege');
    await restricted.close();

    // Legacy notes still load, even if the full document is unreadable.
    await page.evaluate(() => {
      localStorage.setItem('tabEditor.tabs', JSON.stringify([[['', '', '', '', '3', ''], ['0', '', '', '2', '', '']]]));
      localStorage.setItem('tabEditor.document', '{');
    });
    const legacyStored = await page.evaluate(() => localStorage.getItem('tabEditor.tabs'));
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('tabEditor.tabs')), legacyStored);
    const editor = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      return {
        value: el.value,
        readonly: el.readonly,
        tools: el.tools,
        toolsAttribute: el.getAttribute('tools'),
        toolsDirection: getComputedStyle(el.querySelector('.ascii-tabs-tools')).flexDirection,
        hint: el.querySelector('.ascii-tabs-hint').textContent,
        spacing: el.spacing,
        hintFontSize: getComputedStyle(el.querySelector('.ascii-tabs-hint')).fontSize,
        spacingFontSize: getComputedStyle(el.querySelector('.ascii-tabs-spacing')).fontSize,
        hintTop: el.querySelector('.ascii-tabs-hint').getBoundingClientRect().top,
        spacingTop: el.querySelector('.ascii-tabs-spacing').getBoundingClientRect().top,
      };
    });
    assert.deepStrictEqual(editor.value, [[[null, null, null, null, 3, null], [0, null, null, 2, null, null]]]);
    assert.strictEqual(editor.readonly, false);
    assert.strictEqual(editor.tools, 'side');
    assert.strictEqual(editor.toolsAttribute, null);
    assert.strictEqual(editor.toolsDirection, 'column');
    assert.strictEqual(editor.hint, 'Hacé clic en una cuerda y escribí el número de traste.');
    assert.strictEqual(editor.spacing, 2);
    assert.strictEqual(editor.hintFontSize, editor.spacingFontSize);
    assert.strictEqual(editor.hintTop, editor.spacingTop);

    // Display switches are independent, reversible, and preserve saved frets.
    const originalTabs = await page.evaluate(() => document.querySelector('ascii-tabs').value);
    const originalStorage = await page.evaluate(() => localStorage.getItem('tabEditor.tabs'));
    const noteNames = page.getByRole('checkbox', { name: 'Mostrar notas' });
    const letterLabels = page.getByRole('checkbox', { name: 'Etiquetas de cuerdas' });
    const firstFret = page.locator('.ascii-tabs-cell[data-c="0"][data-s="4"] .ascii-tabs-fret');
    const labels = () => page.locator('.ascii-tabs-label').allTextContents();
    assert.strictEqual(await firstFret.textContent(), '3');
    const displayMenu = page.getByRole('button', { name: 'Opciones de visualización' });
    assert.strictEqual(await noteNames.isVisible(), false);
    await displayMenu.focus();
    await page.keyboard.press('Enter');
    await noteNames.check();
    assert.strictEqual(await firstFret.textContent(), 'do');
    assert.deepStrictEqual(await labels(), ['1 ', '2 ', '3 ', '4 ', '5 ', '6 ']);
    await letterLabels.check();
    assert.deepStrictEqual(await labels(), ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']);
    assert.strictEqual(await firstFret.textContent(), 'do');
    await noteNames.uncheck();
    assert.strictEqual(await firstFret.textContent(), '3');
    assert.deepStrictEqual(await labels(), ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']);
    await letterLabels.uncheck();
    assert.deepStrictEqual(await labels(), ['1 ', '2 ', '3 ', '4 ', '5 ', '6 ']);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), originalTabs);
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('tabEditor.tabs')), originalStorage);

    await page.keyboard.press('Escape');
    assert.strictEqual(await noteNames.isVisible(), false);
    assert.ok(await displayMenu.evaluate(el => el === document.activeElement));

    // The "how to use" dropdown at the foot starts closed and holds one
    // looping demo per gesture, each with the keys to press.
    const tutorial = await page.evaluate(() => {
      const details = document.querySelector('details.tab-tutorial');
      return {
        open: details.open,
        demos: details.querySelectorAll('.tab-demo').length,
        keys: details.querySelectorAll('.tab-demo__key').length,
        titles: [...details.querySelectorAll('.tab-demo h3')].map(h => h.textContent),
      };
    });
    assert.strictEqual(tutorial.open, false);
    assert.strictEqual(tutorial.demos, 6);
    assert.strictEqual(tutorial.keys, 8);
    assert.deepStrictEqual(tutorial.titles, ['Arrastrar y soltar', 'Duplicar una columna', 'Agregar ceros', 'Negritas', 'Título de la tablatura', 'Anotar una columna']);

    // The editor has one shared spacing slider. It changes every current Tab
    // and remains the setting for Tabs added afterwards.
    const sharedSpacing = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      const slider = el.querySelector('.ascii-tabs-spacing-input');
      slider.value = '5';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      el.addTab();
      return {
        sliders: el.querySelectorAll('.ascii-tabs-spacing-input').length,
        spacing: el.spacing,
        sheetCount: el.querySelectorAll('.ascii-tabs-sheet').length,
        sliderValue: slider.value,
      };
    });
    assert.deepStrictEqual(sharedSpacing, {
      sliders: 1,
      spacing: 5,
      sheetCount: 2,
      sliderValue: '5',
    });

    // On phones the sheet actions move above the Tab, in a horizontal row.
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTools = await page.evaluate(() => {
      const sheet = document.querySelector('.ascii-tabs-sheet');
      const tools = sheet.querySelector('.ascii-tabs-tools');
      return {
        direction: getComputedStyle(tools).flexDirection,
        sheetDirection: getComputedStyle(sheet).flexDirection,
        sliderDisplay: getComputedStyle(document.querySelector('.ascii-tabs-spacing')).display,
        toolsTop: tools.getBoundingClientRect().top,
        tabTop: sheet.querySelector('.ascii-tabs-tab').getBoundingClientRect().top,
      };
    });
    assert.strictEqual(mobileTools.direction, 'row');
    assert.strictEqual(mobileTools.sheetDirection, 'column');
    assert.strictEqual(mobileTools.sliderDisplay, 'none');
    assert.ok(mobileTools.toolsTop < mobileTools.tabTop);
    await displayMenu.click();
    assert.ok(await noteNames.isVisible());
    assert.ok(await letterLabels.isVisible());
    const menuLayout = await page.evaluate(() => {
      const title = document.querySelector('h1').getBoundingClientRect();
      const button = document.querySelector('.tab-editor-menu summary').getBoundingClientRect();
      const panel = document.querySelector('.tab-editor-options').getBoundingClientRect();
      return { titleRight: title.right, buttonLeft: button.left, panelLeft: panel.left, panelRight: panel.right, viewport: innerWidth };
    });
    assert.ok(menuLayout.buttonLeft > menuLayout.titleRight);
    assert.ok(menuLayout.panelLeft >= 0 && menuLayout.panelRight <= menuLayout.viewport);
    await page.locator('h1').click();
    assert.strictEqual(await noteNames.isVisible(), false);

    // ascii-tabs 0.2.0 duplicates the whole column, including empty strings,
    // with either shortcut. The cursor advances and storage receives one edit.
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const modifier of ['Meta', 'Alt']) {
      const original = [0, null, 12, null, 5, 24];
      await page.evaluate((column) => {
        const el = document.querySelector('ascii-tabs');
        el.value = [[column, [9, 9, 9, 9, 9, 9]]];
        window.tabChanges = [];
        el.addEventListener('change', (event) => window.tabChanges.push(event.detail.value));
      }, original);
      await page.locator('.ascii-tabs-cell[data-c="0"][data-s="2"]').click();
      await page.keyboard.press(modifier + '+ArrowRight');
      const duplicated = await page.evaluate(() => {
        const el = document.querySelector('ascii-tabs');
        const cursor = el.querySelector('.ascii-tabs-cur');
        return {
          value: el.value,
          cursor: [cursor.dataset.c, cursor.dataset.s],
          changes: window.tabChanges,
          saved: JSON.parse(localStorage.getItem('tabEditor.tabs')),
        };
      });
      assert.deepStrictEqual(duplicated.value, [[original, original]]);
      assert.deepStrictEqual(duplicated.cursor, ['1', '2']);
      assert.deepStrictEqual(duplicated.changes, [[[original, original]]]);
      assert.deepStrictEqual(duplicated.saved, [[['0', '', '12', '', '5', '24'], ['0', '', '12', '', '5', '24']]]);

      // Editing the duplicate leaves the source column untouched.
      await page.keyboard.press('Delete');
      const edited = await page.evaluate(() => document.querySelector('ascii-tabs').value);
      assert.strictEqual(edited[0][0][2], 12);
      assert.strictEqual(edited[0][1][2], null);
      await page.reload();
      await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
      assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), edited);
    }

    // ascii-tabs 0.3.0 fills empty strings with zeros without replacing frets
    // or moving the cursor. Repeating it on a full column is a no-op.
    for (const modifier of ['Meta', 'Alt']) {
      await page.evaluate(() => {
        const el = document.querySelector('ascii-tabs');
        el.value = [[[null, 12, null, 0, null, 24]]];
        window.tabChanges = [];
        el.addEventListener('change', (event) => window.tabChanges.push(event.detail.value));
      });
      await page.locator('.ascii-tabs-cell[data-c="0"][data-s="2"]').click();
      await page.keyboard.press(modifier + '+0');
      await page.keyboard.press(modifier + '+0');
      const filled = await page.evaluate(() => {
        const el = document.querySelector('ascii-tabs');
        const cursor = el.querySelector('.ascii-tabs-cur');
        return { value: el.value, cursor: [cursor.dataset.c, cursor.dataset.s], changes: window.tabChanges };
      });
      assert.deepStrictEqual(filled.value, [[[0, 12, 0, 0, 0, 24]]]);
      assert.deepStrictEqual(filled.cursor, ['0', '2']);
      assert.deepStrictEqual(filled.changes, [filled.value]);
      await page.reload();
      await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
      assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), filled.value);
    }

    // Duplicating the last column grows the Tab; an unmodified arrow only moves.
    await page.evaluate(() => {
      document.querySelector('ascii-tabs').value = [[[3, null, null, null, null, null]]];
    });
    await page.locator('.ascii-tabs-cell[data-c="0"][data-s="0"]').click();
    await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value[0].length), 1);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Alt+ArrowRight');
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [
      [[3, null, null, null, null, null], [3, null, null, null, null, null]],
    ]);

    // v0.4.0 selects notes with a rectangle and duplicates only that group.
    await page.evaluate(() => {
      document.querySelector('ascii-tabs').value = [
        [[3, null, null, null, null, null], [null, 12, null, null, null, null], [7, null, null, null, null, null]],
      ];
    });
    const cell = (c, s) => page.locator(`.ascii-tabs-cell[data-c="${c}"][data-s="${s}"]`);
    const start = await cell(0, 2).boundingBox();
    const end = await cell(1, 0).boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(end.x + end.width, end.y, { steps: 8 });
    // v0.4.1 keeps the selection rectangle behind frets so notes stay legible.
    const selectionLayers = await page.evaluate(() => ({
      marquee: Number(getComputedStyle(document.querySelector('.ascii-tabs-marquee')).zIndex),
      fret: Number(getComputedStyle(document.querySelector('.ascii-tabs-fret')).zIndex),
    }));
    assert.ok(selectionLayers.fret > selectionLayers.marquee);
    await page.mouse.up();
    assert.strictEqual(await page.locator('.ascii-tabs-marquee').count(), 0);
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 2);
    await page.keyboard.press('Alt+ArrowRight');
    const grouped = [
      [3, null, null, null, null, null], [null, 12, null, null, null, null],
      [3, null, null, null, null, null], [null, 12, null, null, null, null],
    ];
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [grouped]);
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 2);

    // Copy the selection as ASCII and move it down one string and right one
    // column. Relative positions survive and the originals stay untouched.
    const copied = await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      document.querySelector('.ascii-tabs-input').dispatchEvent(new ClipboardEvent('copy', { clipboardData, cancelable: true }));
      return clipboardData.getData('text/plain');
    });
    assert.strictEqual(copied.split('\n').length, 6);
    assert.ok(copied.includes('12'));
    const from = await cell(2, 0).boundingBox();
    const to = await cell(3, 1).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    // The entire selected group follows the pointer in a visual preview.
    assert.strictEqual(await page.locator('.ascii-tabs-drag-preview .ascii-tabs-fret').count(), 2);
    assert.strictEqual(await page.locator('.ascii-tabs-drag-preview').getAttribute('aria-hidden'), 'true');
    await page.mouse.up();
    assert.strictEqual(await page.locator('.ascii-tabs-drag-preview').count(), 0);
    const moved = [
      grouped[0], grouped[1], [null, null, null, null, null, null],
      [null, 3, null, null, null, null], [null, null, 12, null, null, null],
    ];
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [moved]);
    await page.keyboard.press('Delete');
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 0);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value[0].slice(0, 2)), grouped.slice(0, 2));

    // Paste at the current column preserves string positions and saves the
    // result. Escape dismisses the selection without changing the notes.
    await cell(2, 0).click();
    await page.evaluate((text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      document.querySelector('.ascii-tabs-input').dispatchEvent(new ClipboardEvent('paste', { clipboardData, cancelable: true }));
    }, copied);
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 2);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [grouped]);
    await page.keyboard.press('Escape');
    assert.strictEqual(await page.locator('.ascii-tabs-selected').count(), 0);
    await page.reload();
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    assert.deepStrictEqual(await page.evaluate(() => document.querySelector('ascii-tabs').value), [grouped]);

    // The sixths exercise shows its three Tabs read-only, with no controls.
    await page.goto(base + '/ejercicio-de-sextas');
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const sixths = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      return {
        tabs: el.value.length,
        first: el.value[0][0],
        readonly: el.readonly,
        spacing: el.spacing,
        buttons: el.querySelectorAll('button').length,
      };
    });
    assert.strictEqual(sixths.tabs, 3);
    assert.deepStrictEqual(sixths.first, [null, null, null, null, 3, 0]);
    assert.strictEqual(sixths.readonly, true);
    assert.strictEqual(sixths.spacing, 3);
    assert.strictEqual(sixths.buttons, 0);

    // The English pages run the same component with the English UI.
    await page.evaluate(() => localStorage.clear());
    await page.goto(base + pagePath('crear-tablaturas-de-guitarra', 'en'));
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const en = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      return { tabs: el.value.length, readonly: el.readonly, hint: el.querySelector('.ascii-tabs-hint').textContent };
    });
    assert.strictEqual(en.tabs, 3);
    assert.strictEqual(en.readonly, false);
    assert.ok(/click/i.test(en.hint), 'English hint: ' + en.hint);
    await page.evaluate(() => {
      document.querySelector('ascii-tabs').value = [[[0, null, null, null, null, null]]];
    });
    await page.getByRole('button', { name: 'Display options' }).click();
    await page.getByRole('checkbox', { name: 'Show note names' }).check();
    assert.strictEqual(await page.locator('.ascii-tabs-cell[data-c="0"][data-s="0"] .ascii-tabs-fret').textContent(), 'E');
    await page.getByRole('checkbox', { name: 'String labels as letters' }).check();
    assert.deepStrictEqual(await labels(), ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']);
    await page.goto(base + pagePath('ejercicio-de-sextas', 'en'));
    await page.waitForFunction(() => customElements.get('ascii-tabs') !== undefined);
    const enSixths = await page.evaluate(() => {
      const el = document.querySelector('ascii-tabs');
      return { tabs: el.value.length, readonly: el.readonly, buttons: el.querySelectorAll('button').length };
    });
    assert.deepStrictEqual(enSixths, { tabs: 3, readonly: true, buttons: 0 });

    console.log('OK: tab editor saves edits, supports shortcuts, group selection/movement and ASCII copy/paste; sixths exercise is read-only with no controls.');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
