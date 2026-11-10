const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CHORDS } = require('../src/shared/chords-db');
const { pagePath, allRedirects } = require('../scripts/lib/slugs');
let groups;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/site/ninth-guide.js'), 'utf8'), {
  window: { DimGuidePage: { render: (value) => { groups = value; } } },
});
const formulas = [
  [0, 2, 4, 7, 11], [0, 2, 3, 7, 10], [0, 2, 4, 7, 10],
  [0, 1, 4, 7, 10], [0, 2, 3, 6, 9], [0, 2, 4, 7], [0, 2, 3, 7],
];
const tuning = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };

test('seven ninth families cover all twelve roots with playable, harmonically correct voicings', () => {
  assert.equal(groups.length, 7);
  groups.forEach((group, family) => {
    assert.equal(group.chords.length, 12);
    group.chords.forEach((ref, root) => {
      const chord = typeof ref === 'string' ? CHORDS.find((c) => c.name === ref) : ref;
      assert.ok(chord, String(ref));
      const sounding = new Set();
      for (let string = 6; string >= 1; string--) {
        const finger = chord.fingers.find((f) => f[0] === string);
        if (finger?.[1] === 'x') continue;
        let fret = finger?.[1] === 'o' ? 0 : finger?.[1];
        for (const barre of chord.barres || []) {
          if (string <= barre.fromString && string >= barre.toString) fret = Math.max(fret || 0, barre.fret);
        }
        assert.ok(Number.isInteger(fret) && fret >= 0 && fret <= 24, chord.name);
        sounding.add((tuning[string] + fret - root + 12) % 12);
      }
      const allowed = formulas[family];
      // The perfect fifth is optional; all defining tones must sound.
      const required = allowed.filter((degree) => degree !== 7);
      assert.ok([...sounding].every((degree) => allowed.includes(degree)), `${chord.name}: unexpected notes ${[...sounding]}`);
      assert.ok(required.every((degree) => sounding.has(degree)), `${chord.name}: missing tones ${[...sounding]}`);
      assert.ok((chord.position || 1) >= 1, chord.name);
    });
  });
});

test('new ninth routes are translated and do not introduce legacy redirects', () => {
  assert.equal(pagePath('acordes-de-novena', 'es'), '/acordes-de-novena');
  assert.equal(pagePath('acordes-de-novena', 'en'), '/en/ninth-chords');
  assert.equal(pagePath('acordes-de-novena', 'pt'), '/pt/acordes-de-nona');
  assert.ok(!allRedirects().some((r) => /ninth|novena|nona/.test(r.file)));
});
