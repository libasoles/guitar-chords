'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { playwrightExecutablePath } = require('../scripts/lib/chrome-path');
const { serveStatic } = require('../scripts/lib/static-server');

(async function () {
  const server = await serveStatic(path.join(__dirname, '..', 'dist/site'), 0);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: playwrightExecutablePath() });
    const page = await browser.newPage();
    const base = 'http://localhost:' + server.address().port;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const locale of ['', '/en']) {
      await page.goto(base + locale + '/punteo-escala-mayor-terceras-sextas-decimas');
      await page.waitForSelector('.picking-note');
      assert.equal(await page.locator('.picking-diagram svg').count(), 4);
      assert.deepEqual(await page.locator('.picking-diagram').evaluateAll(els => els.map(el => el.dataset.pattern)), ['3', '1', '2', '4']);
      assert.equal(await page.locator('.metronome-widget, .picking-tips').count(), 0);
      const notes = () => page.locator('.picking-diagram').evaluateAll(els => els.map(el => Array.from(el.querySelectorAll('.picking-note'), note => {
        const match = note.getAttribute('class').match(/finger-string-(\d+)-fret-(\d+|NaN)/);
        return [6 - Number(match[1]), match[2] === 'NaN' ? 0 : Number(match[2]) + 1];
      })));
      const openPc = { 1: 0, 2: 7, 3: 3, 4: 10, 5: 5, 6: 0 };
      const major = [0, 2, 4, 5, 7, 9, 11];
      const tonics = () => page.locator('.picking-diagram').evaluateAll(els => els.map(el => el.querySelectorAll('.picking-note-tonic').length));
      for (let offset = 0; offset <= 11; offset++) {
        await page.locator('#picking-transpose').evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('input')); }, String(offset));
        const current = await notes();
        const expectedTonics = current.map(pattern => {
          const byString = {};
          pattern.forEach(([string, fret]) => {
            const fromTonic = (openPc[string] + fret - offset + 12) % 12;
            assert.ok(major.includes(fromTonic));
            (byString[string] = byString[string] || []).push(fret);
          });
          // The neck is filled across octaves: every scale tone from the open
          // string up to fret 19 is drawn.
          Object.entries(byString).forEach(([string, frets]) => {
            const expected = [];
            for (let fret = 0; fret <= 19; fret++) {
              if (major.includes((openPc[string] + fret - offset + 12) % 12)) expected.push(fret);
            }
            assert.deepEqual(frets.sort((a, b) => a - b), expected, 'filled neck at offset ' + offset);
          });
          return pattern.filter(([string, fret]) => (openPc[string] + fret - offset + 12) % 12 === 0).length;
        });
        assert.deepEqual(await tonics(), expectedTonics);
        expectedTonics.forEach(count => assert.ok(count > 0));
        const connections = await page.locator('.picking-diagram').evaluateAll(els => els.map(el => {
          const svg = el.querySelector('svg');
          const notes = Array.from(svg.querySelectorAll('.picking-note'));
          const pitch = note => {
            const match = note.getAttribute('class').match(/finger-string-(\d+)-fret-(\d+|NaN)/);
            const string = 6 - Number(match[1]);
            return { 1: 24, 2: 19, 3: 15, 4: 10, 5: 5, 6: 0 }[string] + (match[2] === 'NaN' ? 0 : Number(match[2]) + 1);
          };
          return Array.from(svg.querySelectorAll('.picking-pair-connector'), line => {
            const from = notes.find(n => n.getAttribute('cx') === line.getAttribute('x1') && n.getAttribute('cy') === line.getAttribute('y1'));
            const to = notes.find(n => n.getAttribute('cx') === line.getAttribute('x2') && n.getAttribute('cy') === line.getAttribute('y2'));
            return Math.abs(pitch(from) - pitch(to));
          });
        }));
        connections.forEach((intervals, i) => {
          assert.ok(intervals.length > 0);
          intervals.forEach(interval => assert.ok(([ [3,4], [3,4], [8,9], [15,16] ][i]).includes(interval)));
          // Edge notes whose partner falls off the neck have no connector.
          assert.ok(intervals.length * 2 <= current[i].length && intervals.length * 2 >= current[i].length - 6);
        });
        const shade = await page.locator('.picking-diagram').evaluateAll(els => els.map(el => {
          const rect = el.querySelector('.picking-upper-frets');
          const marker = el.querySelector('.position-marker-fret-12');
          return rect && Number(rect.getAttribute('x')) > Number(marker.getAttribute('cx'));
        }));
        assert.deepEqual(shade, [true, true, true, true]);
      }
      await page.locator('#picking-transpose').focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#picking-key').textContent(), locale ? 'F major' : 'Fa mayor');
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      assert.ok(await page.locator('.picking-diagram-scroll').first().evaluate(el => el.scrollWidth > el.clientWidth));
    }
    for (const locale of ['', '/en']) {
      for (const mode of ['dorico', 'jonico', 'frigio', 'lidio', 'mixolidio', 'eolico', 'locrio']) {
        await page.goto(base + locale + '/punteo-' + mode + '-sexta-cuerda-al-aire');
        assert.equal(await page.locator('.picking-diagram svg').count(), 3);
        assert.equal(await page.locator('.metronome-widget').count(), 1);
        const labelNumbers = await page.locator('.picking-figure').evaluateAll(figures => figures.map(figure => {
          const caption = figure.querySelector('figcaption').textContent;
          const alt = figure.querySelector('.picking-diagram').getAttribute('aria-label');
          return [Number(caption.match(/(?:Patrón|Pattern) (\d+)/)[1]), Number(alt.match(/(?:patrón|pattern) (\d+)/)[1])];
        }));
        assert.deepEqual(labelNumbers, [[1, 1], [2, 2], [3, 3]], locale + '/' + mode);
      }
    }
    assert.deepEqual(errors, []);
    console.log('Picking intervals E2E passed');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
