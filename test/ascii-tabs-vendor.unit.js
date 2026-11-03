const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The browser module is ESM; this consumer uses CommonJS for its Node tooling.
const source = fs.readFileSync(path.join(__dirname, '../vendor/ascii-tabs.js'), 'utf8');
const vendor = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('vendored String bars replace the label separator and preserve ASCII round trips', async () => {
  const { format, parse } = await vendor;
  const tab = [[3, null, null, null, null, null], [null, 12, null, null, null, null], [null, null, null, null, null, 5]];
  for (const labels of ['numbers', 'notes', 'none']) {
    const prefix = labels === 'none' ? '|' : labels === 'notes' ? 'e|' : '1|';
    const ascii = format(tab, { labels, stringBars: true, width: 9 });
    assert.ok(ascii.startsWith(prefix));
    assert.deepEqual(parse(ascii), tab);
    for (const line of ascii.split('\n').filter(Boolean)) assert.ok(line.length <= 9);
    const plain = format(tab, { labels });
    assert.ok(!plain.includes('|'));
    assert.deepEqual(parse(plain), tab);
    const annotated = format(tab, { labels, stringBars: true, annotations: [{ column: 0, text: 'Dm' }] }).split('\n');
    assert.equal(annotated[0].indexOf('Dm'), annotated[1].indexOf('3'));
  }
});
