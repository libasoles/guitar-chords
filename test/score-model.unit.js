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
  assert.deepEqual(score.rows[0][0], [{ d: 'q', n: 30 }, { d: 'q', rest: true }]);
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

test('los compases convencionales se guardan y exportan con su duracion exacta', () => {
  const capacities = { '2/4': 16, '3/4': 24, '4/4': 32, '2/2': 32, '3/8': 12, '6/8': 24, '9/8': 36, '12/8': 48 };
  for (const [meter, capacity] of Object.entries(capacities)) {
    const score = M.emptyScore();
    score.rows[0][0] = [{ d: 'q', n: 30 }];
    assert.ok(M.setMeter(score, meter));
    assert.deepEqual(M.sanitize(JSON.parse(JSON.stringify(score))), score);
    assert.equal(M.capacity(score), capacity);
    const [beats, unit] = meter.split('/');
    const xml = M.toMusicXml(score);
    assert.ok(xml.includes(`<time><beats>${beats}</beats><beat-type>${unit}</beat-type></time>`));
    for (const measure of xml.split('<measure ').slice(1)) {
      const total = [...measure.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, m) => sum + Number(m[1]), 0);
      assert.equal(total, capacity, meter);
    }
  }
});

test('la capacidad del compas elegido limita figuras y puntillos', () => {
  const score = M.emptyScore();
  M.setMeter(score, '3/8');
  assert.ok(M.fits([{ d: 'q', n: 30 }], { d: 'e', n: 31 }, undefined, score));
  assert.ok(!M.fits([{ d: 'q', n: 30 }], { d: 'q', n: 31 }, undefined, score));
  assert.ok(M.canDot([{ d: 'q', n: 30 }], 0, score));
  assert.ok(!M.canDot([{ d: 'q', n: 30 }, { d: 'e', n: 31 }], 0, score));
  assert.ok(M.fits([{ d: 'q', n: 30 }], { d: 'q', n: 31 }, 0, score));
});

test('cambiar de compas conserva las notas y rechaza cambios que las recortarian', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'w', n: 30 }];
  const before = M.clone(score);
  assert.equal(M.setMeter(score, '3/4'), false);
  assert.deepEqual(score, before);
  assert.equal(M.setMeter(score, '7/3'), false);
  assert.deepEqual(score, before);
  assert.ok(M.setMeter(score, '12/8'));
  assert.deepEqual(score.rows, before.rows);
});

test('partituras viejas o con compas invalido siguen en 4/4', () => {
  assert.equal(M.sanitize({ rows: [] }).meter, '4/4');
  assert.equal(M.sanitize({ meter: 'bogus', rows: [] }).meter, '4/4');
});

test('en 6/8 las corcheas se agrupan de tres en tres', () => {
  const score = M.emptyScore();
  M.setMeter(score, '6/8');
  score.rows[0][0] = Array.from({ length: 6 }, (_, i) => ({ d: 'e', n: 30 + i }));
  const first = M.toMusicXml(score).split('<measure ')[1];
  const beams = [...first.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]);
  assert.deepEqual(beams, ['begin', 'continue', 'end', 'begin', 'continue', 'end']);
});
