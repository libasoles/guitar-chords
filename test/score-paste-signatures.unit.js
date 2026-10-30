const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');
const fragment = () => {
  const s = M.emptyScore();
  s.meter = '6/8'; s.fifths = -2;
  s.keys = { 2: 3 };
  s.rows[0][2] = [{ d: 'q', n: 37, at: 0 }];
  return JSON.parse(JSON.stringify(M.copySelection(s, [{ mi: 2, i: 0 }])));
};
test('pegar crea o reemplaza armadura y tiempo en el primer compas de destino', () => {
  for (const mi of [0, 2]) {
    const s = M.emptyScore(); s.keys = { 2: -1 }; s.meters = { 2: '3/4' };
    assert.ok(M.pasteSelection(s, fragment(), mi));
    assert.equal(M.keyAt(s, mi), 3);
    assert.equal(M.meterAt(s, mi), '6/8');
    assert.equal(M.capacity(s, mi), 72);
    if (mi) { assert.equal(M.keyAt(s, mi - 1), 0); assert.equal(M.meterAt(s, mi - 1), '4/4'); }
    const saved = M.sanitize(JSON.parse(JSON.stringify(s)));
    assert.equal(M.meterAt(saved, mi), '6/8');
    assert.match(M.toMusicXml(saved).split(`<measure number="${mi + 1}"`)[1].split('</measure>')[0], /<time><beats>6<\/beats><beat-type>8<\/beat-type><\/time>/);
  }
});
test('pegar sin contexto conserva armadura y tiempo del destino', () => {
  const s = M.emptyScore();
  assert.ok(M.pasteSelection(s, fragment(), 2, { preserveSignatures: false }));
  assert.equal(M.keyAt(s, 2), 0); assert.equal(s.meters, undefined);
});
test('los cambios internos del fragmento y los compases largos sobreviven al guardado', () => {
  const s = M.emptyScore(); s.meter = '6/8'; s.meters = { 1: '4/4' }; s.keys = { 1: -3 };
  s.rows[0][0] = [{ d: 'q', n: 37 }]; s.rows[0][1] = [{ d: 'w', n: 35 }];
  const f = JSON.parse(JSON.stringify(M.copySelection(s, [{ mi: 0, i: 0 }, { mi: 1, i: 0 }])));
  const d = M.emptyScore();
  assert.ok(M.pasteSelection(d, f, 2));
  assert.equal(M.meterAt(d, 2), '6/8'); assert.equal(M.meterAt(d, 3), '4/4'); assert.equal(M.keyAt(d, 3), -3);
  assert.equal(M.sanitize(d).rows[0][3][0].d, 'w');
});
test('un pegado rechazado no modifica las firmas', () => {
  const s = M.emptyScore(); s.rows[0][2] = [{ d: 'w', n: 30 }];
  const before = M.clone(s);
  assert.equal(M.pasteSelection(s, fragment(), 2), null); assert.deepEqual(s, before);
});

test('el pegado deja intactos los cambios posteriores del destino', () => {
  const s = M.emptyScore(); s.keys = { 4: 3, 5: -1 }; s.meters = { 4: '6/8', 5: '2/4' };
  assert.ok(M.pasteSelection(s, fragment(), 2));
  assert.equal(M.keyAt(s, 3), 0); assert.equal(M.keyAt(s, 4), 3); assert.equal(M.keyAt(s, 5), -1);
  assert.equal(M.meterAt(s, 3), '4/4'); assert.equal(M.meterAt(s, 4), '6/8'); assert.equal(M.meterAt(s, 5), '2/4');
});
test('agregar y quitar compases desplaza los cambios de tiempo', () => {
  const s = M.emptyScore(); s.rows[0].pop(); s.meters = { 3: '6/8' };
  assert.ok(M.addMeasure(s, 0)); assert.equal(s.meters[4], '6/8');
  assert.ok(M.removeMeasure(s, 0)); assert.equal(s.meters[3], '6/8');
});

test('cambiar la armadura al pegar conserva las alturas existentes en el compas', () => {
  const s = M.emptyScore();
  s.rows[0][2] = [{ d: 'q', n: 38, at: 0 }];
  const before = M.attacks(s)[0].midis[0];
  assert.ok(M.pasteSelection(s, fragment(), 2));
  assert.ok(M.attacks(s)[0].midis.includes(before));
  assert.equal(s.rows[0][2].find(ev => ev.n === 38).acc, 'n');
});

test('pasting onto the measure it was copied from follows the existing figures', () => {
  const s = M.emptyScore(); s.meter = '6/8';
  s.rows[0][0] = [{ d: 'q', n: 35, dot: true, v: 1, at: 0 }, { d: 'q', n: 32, dot: true, v: 2, at: 0 }];
  const fragment = M.copySelection(s, [{ mi: 0, i: 0 }, { mi: 0, i: 1 }]);
  assert.ok(M.pasteSelection(s, fragment, 0));
  assert.deepEqual(M.measures(s)[0].map((ev) => ev.at), [0, 0, 36, 36]);
  assert.equal(M.measureLength(M.measures(s)[0]), M.capacity(s, 0));
  assert.equal(M.pasteSelection(s, fragment, 0), null);
});
