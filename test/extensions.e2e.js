/* Real MV3 extension E2E. Run npm run build:ext first; no web server or
   extension API stubs are involved. Profiles are isolated and portable. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { chromePath } = require('../scripts/lib/chrome-path');

const DIST = path.join(__dirname, '..', 'dist', 'extensions');

async function installedExtensions(context) {
  const manager = await context.newPage();
  try {
    await manager.goto('chrome://extensions');
    return await manager.evaluate(() => new Promise(resolve =>
      chrome.developerPrivate.getExtensionsInfo({ includeDisabled: false }, resolve)));
  } finally {
    await manager.close();
  }
}

async function withExtensions(locale, run) {
  const directories = ['tabs', 'chords'].map(id => path.join(DIST, id));
  for (const directory of directories) await fs.access(path.join(directory, 'manifest.json'));
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'guitar-extensions-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: chromePath(), channel: 'chromium', headless: true,
      locale, viewport: { width: 780, height: 580 },
      args: [`--lang=${locale}`, `--disable-extensions-except=${directories.join(',')}`, `--load-extension=${directories.join(',')}`],
    });
    const installed = await installedExtensions(context);
    const urls = {};
    for (const [id, name] of [['tabs', 'Guitar Tabs'], ['chords', 'Guitar Chords']]) {
      const extension = installed.find(item => item.name === name);
      assert.ok(extension, `${name} is loaded by Chromium`);
      urls[id] = `chrome-extension://${extension.id}/popup.html`;
    }
    await context.setOffline(true);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = [];
    const network = [];
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    });
    await run(context, urls);
    assert.deepEqual(errors, [], 'no runtime, loading or CSP errors');
    assert.deepEqual(network, [], 'all execution resources are packaged locally');
  } finally {
    if (context) await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
}

async function openEditor(context, url) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => customElements.get('ascii-tabs'));
  return page;
}

const value = page => page.locator('ascii-tabs').evaluate(editor => editor.value);
const cell = (page, c, s) => page.locator(`.ascii-tabs-sheet`).first().locator(`.ascii-tabs-cell[data-c="${c}"][data-s="${s}"]`);

async function editing(page) {
  await cell(page, 0, 0).click();
  await page.keyboard.type('3');
  await page.keyboard.press('ArrowRight');
  assert.deepEqual((await value(page))[0], [[3, null, null, null, null, null]], 'keyboard writes frets');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Alt+0');
  assert.deepEqual((await value(page))[0], [[3, 0, 0, 0, 0, 0]], 'fill keeps existing frets');
  await page.keyboard.press('Alt+ArrowRight');
  assert.deepEqual((await value(page))[0], [[3, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0]], 'duplicate copies a column');
  await page.keyboard.press('b');
  assert.equal(await cell(page, 1, 0).locator('.ascii-tabs-fret').evaluate(el => getComputedStyle(el).fontWeight), '400', 'bold shortcut changes the note weight');
  await page.keyboard.press('b');
  assert.equal(await cell(page, 1, 0).locator('.ascii-tabs-fret').evaluate(el => getComputedStyle(el).fontWeight), '700');
  return value(page);
}

async function groupsAndClipboard(page) {
  // The component's documented value property supplies a compact exercise.
  // All selection, movement, clipboard and edits then use the rendered UI.
  await page.locator('ascii-tabs').evaluate(editor => {
    editor.value = [[[3, null, null, null, null, null], [null, 12, null, null, null, null], [7, null, null, null, null, null]]];
  });
  const start = await cell(page, 0, 2).boundingBox();
  const end = await cell(page, 1, 0).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width, end.y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator('.ascii-tabs-selected').count(), 2, 'rectangle selects notes');
  await page.keyboard.press('Alt+ArrowRight');
  const duplicated = [[3, null, null, null, null, null], [null, 12, null, null, null, null], [3, null, null, null, null, null], [null, 12, null, null, null, null]];
  assert.deepEqual(await value(page), [duplicated], 'group duplication keeps relative string positions');
  await page.keyboard.press('ControlOrMeta+c');
  await page.waitForFunction(async () => (await navigator.clipboard.readText()).includes('12'));
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied.split('\n').length, 6, 'selection is copied as six-string ASCII');

  const from = await cell(page, 2, 0).boundingBox();
  const to = await cell(page, 3, 1).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  assert.equal(await page.locator('.ascii-tabs-drag-preview .ascii-tabs-fret').count(), 2);
  await page.mouse.up();
  assert.deepEqual(await value(page), [[duplicated[0], duplicated[1], [null, null, null, null, null, null], [null, 3, null, null, null, null], [null, null, 12, null, null, null]]], 'drag moves selected notes together');
  await page.keyboard.press('Delete');
  await cell(page, 2, 0).click();
  await page.keyboard.press('ControlOrMeta+v');
  await page.waitForFunction(() => document.querySelectorAll('.ascii-tabs-selected').length === 2);
  assert.deepEqual(await value(page), [duplicated], 'paste restores the copied group at the cursor');
  await page.keyboard.press('Escape');
  await page.locator('.ascii-tabs-copy').first().click();
  await page.waitForFunction(() => document.querySelector('.ascii-tabs-copy').classList.contains('ascii-tabs-done'));
  const whole = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(whole.split('\n').length, 6);
  assert.ok(whole.includes('3') && whole.includes('12'), 'toolbar copies the whole tab as ASCII');
  return value(page);
}

async function displayOptions(page, language) {
  const es = language === 'es';
  assert.equal(await page.locator('html').getAttribute('lang'), language);
  assert.equal(await page.evaluate(() => chrome.i18n.getUILanguage().toLowerCase().startsWith('es')), es, 'locale comes from the real browser API');
  const menu = page.getByRole('button', { name: es ? 'Opciones de visualización' : 'Display options' });
  const notes = page.getByRole('checkbox', { name: es ? /Mostrar notas/ : /Show note names/ });
  const labels = page.getByRole('checkbox', { name: es ? /Etiquetas de cuerdas/ : /String labels/ });
  await page.locator('ascii-tabs').evaluate(editor => { editor.value = [[[0, null, null, null, null, null]]]; });
  await menu.click();
  await notes.check();
  assert.equal(await cell(page, 0, 0).locator('.ascii-tabs-fret').textContent(), es ? 'mi' : 'E');
  await labels.check();
  assert.deepEqual(await page.locator('.ascii-tabs-label').allTextContents(), ['e|', 'B|', 'G|', 'D|', 'A|', 'E|']);
  await page.keyboard.press('Escape');
  assert.equal(await notes.isVisible(), false);
  assert.equal(await menu.evaluate(el => el === document.activeElement), true);
  await menu.click();
  await notes.uncheck();
  await labels.uncheck();
  await page.locator('h1').click();
  assert.equal(await notes.isVisible(), false, 'outside click closes options');
  const tutorial = page.locator('details.tab-tutorial');
  assert.equal(await tutorial.getAttribute('open'), null);
  await tutorial.locator('summary').click();
  assert.equal(await tutorial.locator('.tab-demo').count(), 4);
  assert.ok(await tutorial.locator('.tab-demo').first().isVisible());
  await tutorial.locator('summary').click();
}

async function layoutAndTools(page) {
  assert.deepEqual(await page.locator('body').evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })), { width: 780, height: 580 }, 'popup has the specified dimensions');
  const slider = page.locator('.ascii-tabs-spacing-input');
  await slider.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('ascii-tabs').evaluate(editor => editor.spacing), 3, 'keyboard adjusts spacing');
  const before = (await value(page)).length;
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  assert.equal((await value(page)).length, before + 1, 'toolbar adds a tab');
  await page.getByRole('button', { name: 'Delete tab', exact: true }).last().click();
  assert.equal((await value(page)).length, before, 'toolbar removes a tab');
  await page.locator('ascii-tabs').evaluate(editor => {
    editor.value = [Array.from({ length: 100 }, () => [3, null, null, null, null, null]), [], [], [], [], []];
  });
  const sheet = page.locator('.ascii-tabs-tab').first();
  assert.ok(await sheet.evaluate(el => el.scrollWidth > el.clientWidth), 'long tabs overflow horizontally');
  await sheet.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  assert.ok(await sheet.evaluate(el => el.scrollLeft > 0), 'long tabs scroll horizontally');
  await page.locator('.ascii-tabs-copy').first().scrollIntoViewIfNeeded();
  const copy = await page.locator('.ascii-tabs-copy').first().boundingBox();
  assert.ok(copy.x >= 0 && copy.x + copy.width <= 780, 'sheet controls remain on screen after horizontal scroll');
  await page.getByRole('button', { name: 'New tab', exact: true }).scrollIntoViewIfNeeded();
  assert.ok(await page.locator('body').evaluate(el => el.scrollTop > 0), 'multiple tabs scroll vertically');
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  assert.equal((await value(page)).length, 7, 'controls remain usable at the bottom');
}

async function chords(context, url) {
  let page = await context.newPage();
  await page.goto(url);
  await page.locator('#q').fill('Cmaj7');
  const card = page.locator('#results .card').filter({ has: page.locator('.name', { hasText: /^Cmaj7$/ }) }).first();
  assert.equal(await card.locator('.name').textContent(), 'Cmaj7', 'chord search still returns the requested chord');
  assert.ok(await card.locator('svg').count() > 0);
  await card.locator('.pin-button').click();
  assert.deepEqual(await page.locator('.pinned-name').allTextContents(), ['Cmaj7']);
  await page.locator('#notation-spanish').click();
  assert.deepEqual(await page.locator('.pinned-name').allTextContents(), ['Domaj7']);
  await page.close();
  page = await context.newPage();
  await page.goto(url);
  assert.deepEqual(await page.locator('.pinned-name').allTextContents(), ['Domaj7'], 'pinned chords and notation survive reopening');
  await page.locator('.pinned-remove').click();
  assert.equal(await page.locator('.pinned-card').count(), 0);
}

async function run() {
  await withExtensions('en-US', async (context, urls) => {
    const page = await openEditor(context, urls.tabs);
    assert.deepEqual(await value(page), [[], [], []], 'first opening has three empty tabs');
    await displayOptions(page, 'en');
    await page.reload();
    await editing(page);
    const saved = await groupsAndClipboard(page);
    await page.close();
    const reopened = await openEditor(context, urls.tabs);
    assert.deepEqual(await value(reopened), saved, 'closing and reopening on the same profile preserves edits');
    await layoutAndTools(reopened);
    await chords(context, urls.chords);
  });
  await withExtensions('es-AR', async (context, urls) => {
    const page = await openEditor(context, urls.tabs);
    await displayOptions(page, 'es');
  });
  await withExtensions('fr-FR', async (context, urls) => {
    const page = await openEditor(context, urls.tabs);
    await displayOptions(page, 'en');
  });
  console.log('OK: real MV3 popups support editing, real clipboard, persistence, locales, options, tutorial and scrolling offline; chord search and pins survive reopening.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
