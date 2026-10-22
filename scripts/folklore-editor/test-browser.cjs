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
    assert.equal(await page.locator('header').innerText(), 'Lab');
    assert.equal(await page.locator('dialog').count(), 0);
    const first = page.locator('.exercise').first();
    const measure = first.locator('.measure-view').first();
    const cell = measure.locator('.ascii-tabs-cell[data-c="1"][data-s="2"]');
    const heads = () => first.locator('g.note[data-id^=n] g.notehead use').evaluateAll(elements => elements.map(el => el.getAttribute('transform')));
    const before = await heads();
    await cell.click();
    await page.keyboard.type('12');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    const after = await heads();
    assert.notDeepEqual(before, after);
    const x = values => values.map(value => value.match(/translate\(([-\d.]+)/)?.[1]);
    assert.deepEqual(x(before), x(after));
    assert.equal(await cell.locator('.ascii-tabs-fret').textContent(), '12');
    // The editable columns share the score's actual horizontal anchors.
    const delta = await measure.evaluate(node => {
      const head = node.querySelector('[data-id="n0-agudo-0-0"] .notehead').getBoundingClientRect();
      const fret = node.querySelector('.ascii-tabs-cell[data-c="1"][data-s="2"] .ascii-tabs-fret').getBoundingClientRect();
      return Math.abs(head.x + head.width / 2 - fret.x - fret.width / 2);
    });
    assert.ok(delta < 2, `TAB alignment: ${delta}px`);
    const download = await page.request.get(`${base}/api/musicxml/arpegios/1`);
    assert.equal(download.status(), 200);
    assert.match(await download.text(), /<fret>12<\/fret>/);
    // Drag a whole measure, while keeping the source exercise intact.
    const track = page.locator('#track');
    await measure.locator('.measure-notation').dragTo(track, { sourcePosition: { x: 20, y: 20 } });
    assert.equal(await track.locator('.track-item').count(), 1);
    assert.equal(await first.locator('.measure-view').count(), 8);
    assert.equal(await track.locator('ascii-tabs').evaluate(tabs => tabs.readonly), true);
    assert.equal(await track.locator('ascii-tabs').evaluate(tabs => tabs.value[0][1][2]), 12);
    await cell.click();
    await page.keyboard.type('2');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.equal(await track.locator('ascii-tabs').evaluate(tabs => tabs.value[0][1][2]), 12, 'track keeps a copy');
    // Invalid deletions revert without changing the note's rhythm or voice.
    await cell.click();
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.match(await measure.locator('.measure-error').textContent(), /cantidad de notas/);
    assert.equal(await cell.locator('.ascii-tabs-fret').textContent(), '2');
    // Moving a note to another string keeps its attack and note identity.
    const destination = measure.locator('.ascii-tabs-cell[data-c="1"][data-s="3"]');
    await destination.scrollIntoViewIfNeeded();
    await cell.click();
    const from = await cell.boundingBox();
    const to = await destination.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.equal(await measure.locator('ascii-tabs').evaluate(tabs => tabs.value[0][1][2]), null);
    assert.equal(await measure.locator('ascii-tabs').evaluate(tabs => tabs.value[0][1][3]), 2);
    assert.deepEqual(x(await heads()), x(before));
    const staffYs = await first.locator('.measure-row').first().locator('.measure-notation g.staff > path:first-child').evaluateAll(lines => lines.map(line => line.getBoundingClientRect().y));
    assert.ok(Math.max(...staffYs) - Math.min(...staffYs) < 1, 'staff lines align across measures');
    // Reorder by dragging, with buttons also available for keyboard/touch.
    await first.locator('.measure-view').nth(1).getByRole('button', { name: 'Agregar al track' }).click();
    await track.locator('.track-item').nth(1).locator('.measure-notation').dragTo(track.locator('.track-item').first());
    assert.equal(await track.locator('.measure-view').first().getAttribute('data-bar'), '2');
    assert.equal(await track.locator('.measure-view').nth(1).getAttribute('data-bar'), '1');
    await page.selectOption('#collection', 'chamame');
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.equal(await page.locator('.exercise').count(), 10);
    assert.match(await page.locator('.exercise h2').first().textContent(), /Tres pasos/);
    const trackBox = await track.boundingBox();
    await page.locator('.exercise .measure-notation').first().dragTo(track, { targetPosition: { x: trackBox.width - 10, y: 15 } });
    assert.equal(await track.locator('.track-item').count(), 3);
    assert.match(await track.locator('.track-source').last().textContent(), /Chamamé/);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#collection').disabled);
    assert.equal(await track.locator('.track-item').count(), 3);
    assert.equal(await page.locator('.exercise').first().locator('ascii-tabs').first().evaluate(tabs => tabs.value[0][1][3]), 2);
    await track.getByRole('button', { name: 'Mover a la derecha' }).first().click();
    assert.equal(await track.locator('.measure-view').first().getAttribute('data-bar'), '1');
    await track.getByRole('button', { name: 'Quitar compás' }).last().click();
    assert.equal(await track.locator('.track-item').count(), 2);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(node => node.id); return ids.length === new Set(ids).size; }), true, 'all SVG IDs are unique');
    assert.deepEqual(errors, []);
    console.log('PASS: ascii-tabs editing, fixed X, alignment, validation, drag/drop, track reorder, cross-set copies, persistence, mobile');
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
