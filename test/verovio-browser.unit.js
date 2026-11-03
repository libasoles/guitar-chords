'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitVerovio } = require('../scripts/lib/verovio-browser');
const { renderEmptyStaff } = require('../scripts/lib/score-initial-staff');

test('the pinned runtime splits into valid WASM and a small loader', () => {
  const input = fs.readFileSync(path.join(__dirname, '../vendor/verovio-toolkit-wasm.js'), 'utf8');
  const { source, wasm } = splitVerovio(input);
  assert.ok(WebAssembly.validate(wasm));
  assert.ok(wasm.length > 4_000_000);
  assert.ok(Buffer.byteLength(source) < 200_000);
  assert.ok(!source.includes("return binaryDecode('"));
  assert.ok(source.includes('instantiateStreaming'));
  assert.ok(source.includes('document.currentScript.src'));
  assert.throws(() => splitVerovio('unsupported build'), /embedded WASM changed/);
});

test('the build renders the real empty score for static hosting', async () => {
  const svg = await renderEmptyStaff();
  assert.match(svg, /<svg/);
  assert.equal((svg.match(/class="measure"/g) || []).length, 12);
  assert.equal((svg.match(/class="staff"/g) || []).length, 12);
  assert.equal((svg.match(/class="system"/g) || []).length, 3);
  assert.ok(!svg.includes('<script'));
  assert.equal(await renderEmptyStaff(), svg);
});
