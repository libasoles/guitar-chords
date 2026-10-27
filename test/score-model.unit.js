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
  assert.ok(M.canDot([{ d: 'h', n: 30 }, { d: 'h', n: 30 }], 0));
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

test('soltar sobre una nota conserva la duracion elegida y permite acordes de igual duracion', () => {
  const measure = [{ d: 'e', n: 30, at: 8 }];
  const spot = M.placement(measure, { d: 'q', n: 34 }, 8);
  assert.deepEqual(spot, { at: 8, d: 'q', dot: undefined });
  assert.equal(M.placement(measure, { d: 'q', n: 30 }, 8), null);
  M.insertAt(measure, { d: 'e', n: 34 }, 8);
  assert.match(M.toMusicXml({ rows: [[measure, [], [], []]] }), /<chord\/>/);
});

test('las figuras superpuestas conservan el tiempo elegido en voces independientes', () => {
  const measure = [{ d: 'h', n: 30, at: 0 }];
  assert.equal(M.placement(measure, { d: 'q', n: 31 }, 8).at, 8);
  assert.equal(M.placement([{ d: 'w', n: 30, at: 0 }], { d: 'q', n: 31 }, 8).at, 8);
});

test('los compases convencionales se guardan y exportan con su duracion exacta', () => {
  const capacities = { '2/4': 16, '3/4': 24, '4/4': 32, '2/2': 32, '3/8': 12, '6/8': 24, '9/8': 36, '12/8': 48 };
  for (const [meter, capacity] of Object.entries(capacities)) {
    const score = M.emptyScore();
    score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }];
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
  assert.ok(M.canDot([{ d: 'q', n: 30 }, { d: 'e', n: 31 }], 0, score));
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

test('el compas elegido limita la colocacion libre y conserva los acordes', () => {
  const score = M.emptyScore();
  M.setMeter(score, '3/8');
  assert.equal(M.placement([], { d: 'h', n: 30 }, 0, score), null);
  assert.equal(M.placement([], { d: 'e', n: 30 }, 24, score).at, 8);
  M.setMeter(score, '12/8');
  const chord = [{ d: 'e', n: 30, at: 40 }, { d: 'e', n: 34, at: 40 }];
  score.rows[0][0] = chord;
  assert.deepEqual(M.sanitize(score), score);
  assert.equal(M.placement([], { d: 'q', n: 30 }, 40, score).at, 40);
  assert.equal(M.setMeter(score, '4/4'), false);
});

test('la polifonia sobrevive al guardado y exporta tiempos, duraciones y voces independientes', () => {
  const score = M.emptyScore();
  const measure = score.rows[0][0];
  for (const ev of [
    { d: 'w', n: 24, at: 0 },
    { d: 'q', n: 34, at: 0 },
    { d: 'q', n: 36, at: 0 },
    { d: 'q', n: 35, at: 8 },
    { d: 'h', n: 33, at: 16 },
    { d: 'e', rest: true, at: 12 },
  ]) {
    const spot = M.placement(measure, ev, ev.at, score);
    assert.ok(spot);
    assert.equal(spot.at, ev.at);
    assert.equal(spot.d, ev.d);
    M.insertAt(measure, ev, spot.at);
  }
  assert.deepEqual(M.sanitize(JSON.parse(JSON.stringify(score))), score);
  const first = M.toMusicXml(score).split('<measure ')[1];
  let cursor = 0;
  let previous = 0;
  const notes = new Map();
  for (const match of first.matchAll(/<(note|backup)\b([^>]*)>([^]*?)<\/\1>/g)) {
    const [, tag, attrs, body] = match;
    const duration = Number(body.match(/<duration>(\d+)<\/duration>/)[1]);
    if (tag === 'backup') { cursor -= duration; continue; }
    const chord = body.includes('<chord/>');
    const at = chord ? previous : cursor;
    if (!chord) { previous = cursor; cursor += duration; }
    const id = attrs.match(/id="e0-(\d+)"/);
    if (id) notes.set(Number(id[1]), { at, duration, voice: body.match(/<voice>(\d+)<\/voice>/)[1] });
  }
  assert.equal(notes.size, measure.length);
  measure.forEach((ev, i) => {
    assert.equal(notes.get(i).at, ev.at);
    assert.equal(notes.get(i).duration, M.length(ev));
  });
  assert.notEqual(notes.get(0).voice, notes.get(1).voice);
  assert.equal(notes.get(1).voice, notes.get(2).voice);
  assert.equal(cursor, M.capacity(score));
});

test('un puntillo respeta el limite del compas aunque admita otras voces', () => {
  assert.equal(M.canDot([{ d: 'h', n: 30, at: 16 }], 0), false);
});


test('las barras de corcheas se calculan dentro de cada voz', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [
    { d: 'w', n: 24, at: 0 },
    { d: 'e', n: 34, at: 0 },
    { d: 'e', n: 35, at: 4 },
    { d: 'e', n: 36, at: 8 },
    { d: 'e', n: 37, at: 12 },
  ];
  const first = M.toMusicXml(score).split('<measure ')[1];
  assert.deepEqual([...first.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]), ['begin', 'end', 'begin', 'end']);
});

test('agregar una voz conserva los tiempos de figuras antiguas sin at explicito', () => {
  const measure = [{ d: 'h', n: 30 }, { d: 'h', n: 31 }];
  M.insertAt(measure, { d: 'q', n: 34 }, 8);
  assert.deepEqual(M.onsets(measure), [0, 8, 16]);
});


test('el título se conserva al guardar y se escapa al exportar MusicXML', () => {
  const score = Object.assign(M.emptyScore(), { title: 'Vals <lento> & alegre' });
  const restored = M.sanitize(JSON.parse(JSON.stringify(score)));
  assert.equal(restored.title, score.title);
  assert.match(M.toMusicXml(restored), /<work-title>Vals &lt;lento&gt; &amp; alegre<\/work-title>/);
  assert.equal(M.sanitize(Object.assign(M.emptyScore(), { title: 42 })).title, undefined);
  assert.equal(M.sanitize(Object.assign(M.emptyScore(), { title: '' })).title, '');
});

test('las claves conservan la altura sonora y la armadura al guardar y exportar', () => {
  const expected = {
    guitar: ['G', 2, 30], treble: ['G', 2, 37], bass: ['F', 4, 25],
    alto: ['C', 3, 31], tenor: ['C', 4, 29],
  };
  for (const [clef, [sign, line, bottom]] of Object.entries(expected)) {
    const score = M.emptyScore();
    score.clef = clef;
    score.fifths = -3;
    score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }];
    assert.deepEqual(M.sanitize(JSON.parse(JSON.stringify(score))), score);
    assert.equal(M.bottomLine(score), bottom);
    const xml = M.toMusicXml(score);
    assert.ok(xml.includes(`<clef><sign>${sign}</sign><line>${line}</line>`));
    assert.match(xml, /<fifths>-3<\/fifths>/);
    assert.match(xml, /<step>E<\/step><alter>-1<\/alter><octave>3<\/octave>/);
    assert.equal(xml.includes('<clef-octave-change>-1</clef-octave-change>'), clef === 'guitar');
  }
});

test('las armaduras aplican sus alteraciones y los becuadros duran un compas', () => {
  const score = M.emptyScore();
  score.fifths = 2;
  score.rows[0][0] = [
    { d: 'q', n: 31 }, { d: 'q', n: 31, acc: 'n' },
    { d: 'q', n: 31 }, { d: 'q', n: 38 },
  ];
  score.rows[0][1] = [{ d: 'q', n: 31 }];
  const xml = M.toMusicXml(score);
  const notes = [...xml.matchAll(/<note id="e\d+-\d+">([^]*?)<\/note>/g)].map((m) => m[1]);
  assert.deepEqual(notes.map((n) => n.includes('<alter>1</alter>')), [true, false, false, true, true]);
  assert.match(notes[1], /<accidental>natural<\/accidental>/);
  for (let fifths = -7; fifths <= 7; fifths++) {
    score.fifths = fifths;
    const alteredSteps = Array.from({ length: 7 }, (_, i) => M.keyAlter(28 + i, score));
    assert.equal(alteredSteps.filter(Boolean).length, Math.abs(fifths));
    assert.ok(alteredSteps.every((a) => a === 0 || a === Math.sign(fifths)));
  }
});

test('las partituras anteriores conservan sol de guitarra sin armadura y se descartan opciones invalidas', () => {
  for (const options of [{}, { clef: 'invalid', fifths: 8 }, { clef: 'toString', fifths: '2' }]) {
    const score = M.sanitize({ ...options, rows: [] });
    assert.equal(score.clef, 'guitar');
    assert.equal(score.fifths, 0);
  }
});

test('las alteraciones siguen el tiempo del compas al exportar voces por separado', () => {
  const score = M.emptyScore();
  score.fifths = 1;
  score.rows[0][0] = [
    { d: 'q', n: 31, at: 0, acc: 'n' },
    { d: 'w', n: 28, at: 0 },
    { d: 'q', n: 31, at: 8 },
    { d: 'h', n: 31, at: 16, acc: '#' },
  ];
  const xml = M.toMusicXml(score);
  const bodies = new Map([...xml.matchAll(/<note id="(e0-\d+)">([^]*?)<\/note>/g)].map((m) => [m[1], m[2]]));
  assert.ok(!bodies.get('e0-0').includes('<alter>'));
  assert.ok(!bodies.get('e0-2').includes('<alter>'));
  assert.match(bodies.get('e0-3'), /<alter>1<\/alter>/);
  assert.match(xml, /<backup>/);
});


test('la clave de guitarra se dibuja sin el 8 y conserva la posicion de las notas', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30 }];
  const xml = M.toMusicXml(score, { plainGuitarClef: true });
  assert.match(xml, /<clef><sign>G<\/sign><line>2<\/line><\/clef>/);
  assert.match(xml, /<step>E<\/step><octave>4<\/octave>/);
  assert.match(M.toMusicXml(score), /<step>E<\/step><octave>3<\/octave>/);
  score.clef = 'treble';
  assert.equal(M.toMusicXml(score, { plainGuitarClef: true }), M.toMusicXml(score));
});


test('las barras sobreviven al guardado y se exportan en el lado correcto', () => {
  let score = M.emptyScore();
  M.setBarline(score, 0, 'start');
  M.setBarline(score, 3, 'end');
  M.setBarline(score, 11, 'single');
  score = M.sanitize(M.clone(score));
  const xml = M.toMusicXml(score);
  assert.match(xml.split('<measure ')[1], /<barline location="left"><repeat direction="forward"\/><\/barline>/);
  assert.match(xml.split('<measure ')[4], /<barline location="right"><repeat direction="backward"\/><\/barline>/);
  assert.match(xml.split('<measure ')[12], /<bar-style>regular<\/bar-style>/);
  M.setBarline(score, 0, 'end');
  assert.deepEqual(score.barlines[0], { start: true, end: true });
  M.setBarline(score, 0, 'single');
  assert.deepEqual(score.barlines[0], { single: true });
  assert.equal(M.setBarline(score, 12, 'end'), false);
  assert.equal(M.setBarline(score, -1, 'start'), false);
  assert.equal(M.setBarline(score, 0, 'invalid'), false);
});

test('sanitize descarta barras invalidas y compases que no existen', () => {
  const score = M.emptyScore();
  score.barlines = { '-1': { start: true }, 0: null, 1: { end: 'true' }, 2: { start: true }, 12: { end: true } };
  assert.deepEqual(M.sanitize(score).barlines, { 2: { start: true, end: false } });
});


test('eliminar barras conserva el otro extremo y sobrevive al guardado', () => {
  const score = M.emptyScore();
  M.setBarline(score, 0, 'start');
  M.setBarline(score, 0, 'end');
  M.removeBarline(score, 0, 'end');
  assert.deepEqual(score.barlines[0], { start: true, hidden: true });
  assert.match(M.toMusicXml(M.sanitize(M.clone(score))), /<repeat direction="forward"/);
  M.setBarline(score, 0, 'end');
  M.removeBarline(score, 0, 'start');
  assert.deepEqual(score.barlines[0], { end: true });
  M.removeBarline(score, 0, 'end');
  assert.deepEqual(score.barlines[0], { hidden: true });
  M.removeBarline(score, 1, 'end'); // tambien se puede quitar una barra simple por defecto
  const restored = M.sanitize(M.clone(score));
  assert.deepEqual(restored.barlines, score.barlines);
  assert.equal((M.toMusicXml(restored).match(/<bar-style>none<\/bar-style>/g) || []).length, 2);
  M.setBarline(restored, 0, 'end');
  assert.deepEqual(restored.barlines[0], { end: true });
  M.setBarline(restored, 1, 'single');
  assert.deepEqual(restored.barlines[1], { single: true });
  assert.equal(M.removeBarline(restored, -1, 'end'), false);
  assert.equal(M.removeBarline(restored, 12, 'start'), false);
  assert.equal(M.removeBarline(restored, 0, 'invalid'), false);
});
