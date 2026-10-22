'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../lib/chrome-path');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const source = path.resolve(process.env.FOLKLORE_LAB || path.join(root, 'lab'));
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'folklore-browser-'));
  let server;
  let browser;
  try {
    for (const folder of ['folklore-arpegios', 'folklore-por-ritmo']) {
      await fs.cp(path.join(source, folder), path.join(temp, folder), { recursive: true });
    }
    const python = process.env.FOLKLORE_PYTHON || path.join(root, '.venv-carcassi/bin/python');
    server = spawn(python, [path.join(__dirname, 'server.py'), '--lab', temp, '--port', '0']);
    const base = await new Promise((resolve, reject) => {
      let output = '';
      server.stdout.on('data', data => {
        output += data;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolve(match[0]);
      });
      server.on('error', reject);
      server.on('exit', code => reject(new Error(`Server exited: ${code}`)));
      server.stderr.on('data', data => process.stderr.write(data));
    });
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => document.querySelectorAll('.exercise').length === 10 && !document.querySelector('#collection').disabled);
    assert.equal(await page.locator('#collection option').count(), 7);
    const note = page.locator('.exercise').first().locator('g.note[role=button]').first();
    const noteId = await note.getAttribute('data-id');
    const before = await page.locator('.exercise').first().locator('g.note[data-id^=n] g.notehead use').evaluateAll(elements => elements.map(el => el.getAttribute('transform')));
    await note.focus();
    await page.keyboard.press('Enter');
    await page.locator('#fret').fill('12');
    await page.getByRole('button', { name: 'Guardar nota' }).click();
    await page.waitForFunction(() => !document.querySelector('dialog').open);
    const after = await page.locator('.exercise').first().locator('g.note[data-id^=n] g.notehead use').evaluateAll(elements => elements.map(el => el.getAttribute('transform')));
    assert.notDeepEqual(before, after);
    const x = values => values.map(value => value.match(/translate\(([-\d.]+)/)?.[1]);
    assert.deepEqual(x(before), x(after));
    assert.match(await page.locator('.exercise').first().locator(`[data-id="${noteId}"]`).getAttribute('aria-label'), /traste 12/);
    assert.match(await page.locator('.exercise').first().locator(`[data-id="${noteId}"]`).textContent(), /12/);
    const download = await page.request.get(`${base}/api/musicxml/arpegios/1`);
    assert.equal(download.status(), 200);
    assert.match(await download.text(), /<fret>12<\/fret>/);
    await page.selectOption('#collection', 'chamame');
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.equal(await page.locator('.exercise').count(), 10);
    assert.match(await page.locator('.exercise h2').first().textContent(), /Tres pasos/);
    await page.selectOption('#collection', 'arpegios');
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.match(await page.locator('.exercise').first().locator(`[data-id="${noteId}"]`).getAttribute('aria-label'), /traste 12/);
    assert.match(await page.locator('.exercise').first().locator(`[data-id="${noteId}"]`).textContent(), /12/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('PASS: dropdown, 10 exercises, keyboard editing, pitch, fixed X, export, persistence, mobile');
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null && server.signalCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
    await fs.rm(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
