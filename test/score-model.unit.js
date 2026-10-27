/* Modelo de la pagina /partitura. Run: node --test test/score-model.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');

test('la partitura nueva tiene tres renglones de cuatro compases vacios', () => {
  const score = M.emptyScore();
  assert.equal(score.rows.length, 3);
  assert.ok(score.rows.every((row) => row.length === 4 && row.every((m) => m.length === 0)));
});

test('un compas de 4/4 admite hasta 32 divisiones', () => {
  const measure = [{ d: 'h', n: 30 }, { d: 'q', n: 31 }];
  assert.equal(M.measureLength(measure), 24);
  assert.ok(M.fits(measure, { d: 'q', n: 32 }));
  assert.ok(!M.fits(measure, { d: 'h', n: 32 }));
  assert.ok(M.fits(measure, { d: 'h', n: 32 }, 0));
});

test('el puntillo suma la mitad y no entra en redonda ni semicorchea', () => {
  assert.equal(M.length({ d: 'q', dot: true }), 12);
  assert.ok(!M.canDot([{ d: 'w', n: 30 }], 0));
  assert.ok(!M.canDot([{ d: 's', n: 30 }], 0));
  assert.ok(M.canDot([{ d: 'q', n: 30 }], 0));
  assert.ok(!M.canDot([{ d: 'h', n: 30 }, { d: 'h', n: 30 }], 0));
});

test('sanitize descarta figuras invalidas y completa los renglones', () => {
  const score = M.sanitize({ rows: [[[{ d: 'x', n: 30 }, { d: 'q', n: 30 }, { d: 'q' }, { d: 'q', rest: true }]]] });
  assert.equal(score.rows.length, 3);
  assert.deepEqual(score.rows[0][0], [{ d: 'q', n: 30, at: 0 }, { d: 'q', rest: true, at: 8 }]);
  assert.deepEqual(M.sanitize(null), M.emptyScore());
});

test('el MusicXML baja una octava y marca un renglon por cada cuatro compases', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30 }, { d: 'q', n: 34, acc: '#' }];
  const xml = M.toMusicXml(score);
  assert.match(xml, /<step>E<\/step><octave>3<\/octave>/);
  assert.match(xml, /<step>B<\/step><alter>1<\/alter><octave>3<\/octave>/);
  assert.match(xml, /<accidental>sharp<\/accidental>/);
  assert.equal((xml.match(/<print new-system="yes"\/>/g) || []).length, 3);
  assert.equal((xml.match(/<measure /g) || []).length, 12);
  assert.match(xml, /<clef-octave-change>-1<\/clef-octave-change>/);
});

test('cada compas del MusicXML suma 32 divisiones, con silencios ocultos de relleno', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', dot: true, n: 30 }, { d: 's', n: 31 }];
  const xml = M.toMusicXml(score);
  const first = xml.split('<measure ')[1];
  const total = [...first.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(total, 32);
  assert.match(first, /print-object="no"/);
});

test('las corcheas del mismo pulso se ligan y las de pulsos distintos no', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'e', n: 30 }, { d: 'e', n: 31 }, { d: 'e', n: 32 }, { d: 'e', n: 33 }];
  const first = M.toMusicXml(score).split('<measure ')[1];
  const beams = [...first.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]);
  assert.deepEqual(beams, ['begin', 'end', 'begin', 'end']);
});

test('una figura soltada en medio de un compas vacio conserva su lugar y el MusicXML deja el hueco', () => {
  const measure = [];
  const spot = M.placement(measure, { d: 'q', n: 30 }, 16);
  assert.equal(spot.at, 16);
  M.insertAt(measure, { d: 'q', n: 30 }, spot.at);
  const score = M.emptyScore();
  score.rows[0][0] = measure;
  const first = M.toMusicXml(score).split('<measure ')[1];
  assert.match(first, /<rest\/><duration>16<\/duration>[^]*<step>E<\/step>/);
});

test('soltar sobre la columna de una nota hace un acorde con su duracion', () => {
  const measure = [{ d: 'e', n: 30, at: 8 }];
  const spot = M.placement(measure, { d: 'q', n: 34 }, 8);
  assert.deepEqual(spot, { at: 8, d: 'e', dot: undefined });
  assert.equal(M.placement(measure, { d: 'q', n: 30 }, 8), null);
  M.insertAt(measure, { d: 'e', n: 34 }, 8);
  assert.match(M.toMusicXml({ rows: [[measure, [], [], []]] }), /<chord\/>/);
});

test('una figura que pisa a otra se corre al hueco libre mas cercano', () => {
  const measure = [{ d: 'h', n: 30, at: 0 }];
  assert.equal(M.placement(measure, { d: 'q', n: 31 }, 8).at, 16);
  assert.equal(M.placement([{ d: 'w', n: 30, at: 0 }], { d: 'q', n: 31 }, 8), null);
});
