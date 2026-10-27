/* Modelo de la pagina /partitura. Run: node --test test/score-model.unit.js */

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/site/score-model');

test('sanitize conserva las correcciones de tablatura y descarta datos invalidos', () => {
  const base = M.emptyScore();
  const tabs = { '0:0': [3, null, null, null, null, null], '1:24': [null, 99, 'x', null, 0, null], '99:0': [1, 1, 1, 1, 1, 1], malo: [1], '2:0': 'x' };
  const clean = M.sanitize({ ...base, showTabs: true, tabs });
  assert.equal(clean.showTabs, true);
  assert.deepEqual(clean.tabs, { '0:0': [3, null, null, null, null, null], '1:24': [null, null, null, null, 0, null] });
  assert.equal(M.sanitize({ ...base, showTabs: 'si' }).showTabs, undefined);
  assert.equal(M.sanitize({ ...base, tabs: [[3]] }).tabs, undefined);
  assert.equal(M.toMusicXml(clean), M.toMusicXml(M.sanitize(base)));
});

test('attacks da el tono real, junta los acordes y no repite las notas ligadas', () => {
  const score = M.emptyScore();
  // E4 escrito suena E3 (52) con la clave de guitarra; un sostenido sube un semitono hasta el fin del compas.
  score.rows[0][0] = [{ n: 37, d: 'q', at: 0 }, { n: 37, d: 'q', at: 24, acc: '#' }, { n: 37, d: 'q', at: 48 }, { n: 30, d: 'q', at: 48 }];
  assert.deepEqual(M.attacks(score).map((a) => [a.key, a.midis]), [['0:0', [52]], ['0:24', [53]], ['0:48', [53, 40]]]);
  score.rows[0][0] = [{ n: 37, d: 'q', at: 0, tie: true }, { n: 37, d: 'q', at: 24 }, { n: 39, d: 'q', at: 48 }];
  assert.deepEqual(M.attacks(score).map((a) => a.key), ['0:0', '0:48']);
});

test('la digitacion automatica usa cuerdas distintas para notas distintas seguidas', () => {
  const F = require('../src/site/score-fingering');
  assert.deepEqual(F.assign([[52]]), [[[3, 2]]]);
  const cells = F.assign([[64], [67], [64]]).map((option) => option[0]);
  assert.notEqual(cells[0][0], cells[1][0]);
  assert.deepEqual(F.assign([[64, 59, 55]]).map((option) => option.map((cell) => cell[1])), [[0, 0, 0]]);
  assert.deepEqual(F.assign([[], [900]]), [[], []]);
  assert.deepEqual(F.toColumn([[3, 2], [5, 0]]), [null, null, null, 2, null, 0]);
});

test('la partitura nueva tiene tres renglones de cuatro compases vacios', () => {
  const score = M.emptyScore();
  assert.equal(score.rows.length, 3);
  assert.ok(score.rows.every((row) => row.length === 4 && row.every((m) => m.length === 0)));
});

test('un compas de 4/4 admite hasta 96 divisiones', () => {
  const measure = [{ d: 'h', n: 30 }, { d: 'q', n: 31 }];
  assert.equal(M.measureLength(measure), 72);
  assert.ok(M.fits(measure, { d: 'q', n: 32 }));
  assert.ok(!M.fits(measure, { d: 'h', n: 32 }));
  assert.ok(M.fits(measure, { d: 'h', n: 32 }, 0));
});

test('el puntillo suma la mitad y no entra en redonda ni semicorchea', () => {
  assert.equal(M.length({ d: 'q', dot: true }), 36);
  assert.equal(M.length({ d: 'e', tp: 1 }), 8);
  assert.ok(!M.canDot([{ d: 'e', tp: 1, n: 30 }], 0));
  assert.ok(!M.canDot([{ d: 'w', n: 30 }], 0));
  assert.ok(!M.canDot([{ d: 's', n: 30 }], 0));
  assert.ok(M.canDot([{ d: 'q', n: 30 }], 0));
  assert.ok(M.canDot([{ d: 'h', n: 30 }, { d: 'h', n: 30 }], 0));
});

test('sanitize descarta figuras invalidas y completa los renglones', () => {
  const score = M.sanitize({ rows: [[[{ d: 'x', n: 30 }, { d: 'q', n: 30 }, { d: 'q' }, { d: 'q', rest: true }]]] });
  assert.equal(score.rows.length, 3);
  assert.deepEqual(score.rows[0][0], [{ d: 'q', n: 30, at: 0 }, { d: 'q', rest: true, at: 24 }]);
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

test('cada compas del MusicXML suma 96 divisiones, con silencios ocultos de relleno', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', dot: true, n: 30 }, { d: 's', n: 31 }];
  const xml = M.toMusicXml(score);
  const first = xml.split('<measure ')[1];
  const total = [...first.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(total, 96);
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
  const spot = M.placement(measure, { d: 'q', n: 30 }, 48);
  assert.equal(spot.at, 48);
  M.insertAt(measure, { d: 'q', n: 30 }, spot.at);
  const score = M.emptyScore();
  score.rows[0][0] = measure;
  const first = M.toMusicXml(score).split('<measure ')[1];
  assert.match(first, /<rest\/><duration>48<\/duration>[^]*<step>E<\/step>/);
});

test('soltar sobre una nota conserva la duracion elegida y permite acordes de igual duracion', () => {
  const measure = [{ d: 'e', n: 30, at: 24 }];
  const spot = M.placement(measure, { d: 'q', n: 34 }, 24);
  assert.deepEqual(spot, { at: 24, d: 'q', dot: undefined });
  assert.equal(M.placement(measure, { d: 'q', n: 30 }, 24), null);
  M.insertAt(measure, { d: 'e', n: 34 }, 24);
  assert.match(M.toMusicXml({ rows: [[measure, [], [], []]] }), /<chord\/>/);
});

test('las figuras superpuestas conservan el tiempo elegido en voces independientes', () => {
  const measure = [{ d: 'h', n: 30, at: 0 }];
  assert.equal(M.placement(measure, { d: 'q', n: 31 }, 24).at, 24);
  assert.equal(M.placement([{ d: 'w', n: 30, at: 0 }], { d: 'q', n: 31 }, 24).at, 24);
});

test('los compases convencionales se guardan y exportan con su duracion exacta', () => {
  const capacities = { '2/4': 48, '3/4': 72, '4/4': 96, '2/2': 96, '3/8': 36, '6/8': 72, '9/8': 108, '12/8': 144 };
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
  assert.equal(M.placement([], { d: 'e', n: 30 }, 72, score).at, 24);
  M.setMeter(score, '12/8');
  const chord = [{ d: 'e', n: 30, at: 120 }, { d: 'e', n: 34, at: 120 }];
  score.rows[0][0] = chord;
  assert.deepEqual(M.sanitize(score), score);
  assert.equal(M.placement([], { d: 'q', n: 30 }, 120, score).at, 120);
  assert.equal(M.setMeter(score, '4/4'), false);
});

test('la polifonia sobrevive al guardado y exporta tiempos, duraciones y voces independientes', () => {
  const score = M.emptyScore();
  const measure = score.rows[0][0];
  for (const ev of [
    { d: 'w', n: 24, at: 0 },
    { d: 'q', n: 34, at: 0 },
    { d: 'q', n: 36, at: 0 },
    { d: 'q', n: 35, at: 24 },
    { d: 'h', n: 33, at: 48 },
    { d: 'e', rest: true, at: 36 },
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
  assert.equal(M.canDot([{ d: 'h', n: 30, at: 72 }], 0), false);
});


test('las barras de corcheas se calculan dentro de cada voz', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [
    { d: 'w', n: 24, at: 0 },
    { d: 'e', n: 34, at: 0 },
    { d: 'e', n: 35, at: 12 },
    { d: 'e', n: 36, at: 24 },
    { d: 'e', n: 37, at: 36 },
  ];
  const first = M.toMusicXml(score).split('<measure ')[1];
  assert.deepEqual([...first.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]), ['begin', 'end', 'begin', 'end']);
});

test('agregar una voz conserva los tiempos de figuras antiguas sin at explicito', () => {
  const measure = [{ d: 'h', n: 30 }, { d: 'h', n: 31 }];
  M.insertAt(measure, { d: 'q', n: 34 }, 24);
  assert.deepEqual(M.onsets(measure), [0, 24, 48]);
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
    { d: 'q', n: 31, at: 24 },
    { d: 'h', n: 31, at: 48, acc: '#' },
  ];
  const xml = M.toMusicXml(score);
  const bodies = new Map([...xml.matchAll(/<note id="(e0-\d+)">([^]*?)<\/note>/g)].map((m) => [m[1], m[2]]));
  assert.ok(!bodies.get('e0-0').includes('<alter>'));
  assert.ok(!bodies.get('e0-2').includes('<alter>'));
  assert.match(bodies.get('e0-3'), /<alter>1<\/alter>/);
  assert.match(xml, /<backup>/);
});


test('la clave de guitarra muestra el 8 y conserva la posicion de las notas', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30 }];
  const xml = M.toMusicXml(score);
  assert.match(xml, /<clef><sign>G<\/sign><line>2<\/line><clef-octave-change>-1<\/clef-octave-change><\/clef>/);
  assert.match(xml, /<step>E<\/step><octave>3<\/octave>/);
  score.clef = 'treble';
  assert.doesNotMatch(M.toMusicXml(score), /clef-octave-change/);
});


test('las barras sobreviven al guardado y se exportan en el lado correcto', () => {
  let score = M.emptyScore();
  M.setBarline(score, 0, 'start');
  M.setBarline(score, 3, 'end');
  M.setBarline(score, 11, 'double');
  score = M.sanitize(M.clone(score));
  const xml = M.toMusicXml(score);
  assert.match(xml.split('<measure ')[1], /<barline location="left"><repeat direction="forward"\/><\/barline>/);
  assert.match(xml.split('<measure ')[4], /<barline location="right"><repeat direction="backward"\/><\/barline>/);
  assert.match(xml.split('<measure ')[12], /<bar-style>light-light<\/bar-style>/);
  M.setBarline(score, 0, 'end');
  assert.deepEqual(score.barlines[0], { start: true, end: true });
  M.setBarline(score, 0, 'double');
  assert.deepEqual(score.barlines[0], { double: true });
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
  M.setBarline(restored, 1, 'double');
  assert.deepEqual(restored.barlines[1], { double: true });
  assert.equal(M.removeBarline(restored, -1, 'end'), false);
  assert.equal(M.removeBarline(restored, 12, 'start'), false);
  assert.equal(M.removeBarline(restored, 0, 'invalid'), false);
});

test('las cejillas se guardan por compas, se sanean y se exportan como C n con linea punteada', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 32, at: 24 }, { d: 'q', n: 34, at: 48 }];
  assert.equal(M.setBarre(score, 0, 48, 1), true);
  assert.deepEqual(score.barres, { 0: { at: 48, fret: 1 } });
  assert.equal(M.setBarre(score, 0, 96, 1), false, 'no empieza fuera del compas');
  assert.equal(M.setBarre(score, 0, 0, 0), false);
  assert.equal(M.setBarre(score, 0, 0, 25), false);
  assert.equal(M.setBarre(score, 12, 0, 1), false);
  M.setBarre(score, 0, 48, 7);
  const restored = M.sanitize(M.clone(score));
  assert.deepEqual(restored.barres, { 0: { at: 48, fret: 7 } });
  const xml = M.toMusicXml(restored);
  assert.match(xml, /<words>C 7<\/words>/);
  assert.equal((xml.match(/<bracket type="start"/g) || []).length, 1);
  assert.equal((xml.match(/<bracket type="stop"/g) || []).length, 1);
  assert.ok(xml.indexOf('<words>') < xml.indexOf('<bracket type="stop"'));
  const invalid = { rows: [[[], [], [], []]], barres: { 0: { at: -1, fret: 1 }, 1: { at: 0, fret: 99 }, x: { at: 0, fret: 1 } } };
  assert.equal(M.sanitize(invalid).barres, undefined);
  assert.equal(M.removeBarre(restored, 0), true);
  assert.equal(restored.barres, undefined);
  assert.equal(M.removeBarre(restored, 0), false);
  assert.doesNotMatch(M.toMusicXml(restored), /<words>/);
});

test('una cejilla puede terminar antes del final del compas y el fin se ajusta al cambiar el metro', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 32, at: 24 }, { d: 'q', n: 34, at: 48 }, { d: 'q', n: 35, at: 72 }];
  assert.equal(M.setBarre(score, 0, 24, 3, 72), true);
  assert.deepEqual(score.barres[0], { at: 24, to: 72, fret: 3 });
  assert.equal(M.setBarre(score, 0, 24, 3, 24), false);
  assert.equal(M.setBarre(score, 0, 24, 3, 120), false);
  assert.deepEqual(M.sanitize(M.clone(score)).barres[0], { at: 24, to: 72, fret: 3 });
  const xml = M.toMusicXml(score);
  const order = ['<words>C 3', 'type="start"', 'type="stop"'].map((s) => xml.indexOf(s));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2]);
  assert.ok(xml.indexOf('type="stop"') < xml.lastIndexOf('<note id="e0-3"'), 'termina antes de la ultima nota');
  M.setBarre(score, 0, 24, 3);
  assert.deepEqual(score.barres[0], { at: 24, fret: 3 }, 'llegar al final del compas no se guarda');
  M.setBarre(score, 0, 24, 3, 72);
  score.rows[0][0].pop();
  assert.equal(M.setMeter(score, '3/4'), true);
  assert.deepEqual(score.barres[0], { at: 24, fret: 3 });
});

test('una cejilla puede seguir por compases de la misma fila y cierra en el ultimo', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 32, at: 24 }];
  score.rows[0][1] = [{ d: 'q', n: 34, at: 0 }, { d: 'q', n: 35, at: 24 }];
  assert.equal(M.setBarre(score, 0, 0, 4, 48, 1), true);
  assert.deepEqual(score.barres[0], { at: 0, fret: 4, span: 1, to: 48 });
  assert.equal(M.setBarre(score, 0, 0, 4, 48, 4), false, 'no pasa a la fila siguiente');
  assert.equal(M.setBarre(score, 1, 0, 2), false, 'no se solapa con otra cejilla');
  assert.equal(M.setBarre(score, 3, 0, 2, 48, 1), false, 'no cruza de fila');
  assert.deepEqual(M.sanitize(M.clone(score)).barres, score.barres);
  const xml = M.toMusicXml(score);
  const second = xml.split('<measure ')[2];
  assert.equal((xml.match(/type="start"/g) || []).length, 1);
  assert.equal((xml.match(/type="stop"/g) || []).length, 1);
  assert.match(second, /type="stop"/);
});

test('una cejilla que empieza dentro de una nota larga de otra voz se escribe una vez', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'w', n: 30, at: 0 }, { d: 'q', n: 34, at: 24 }, { d: 'q', n: 35, at: 48 }];
  M.setBarre(score, 0, 48, 2);
  const xml = M.toMusicXml(score);
  assert.equal((xml.match(/<words>C 2<\/words>/g) || []).length, 1);
});


test('los datos guardados con 8 divisiones por negra se reescalan al cargar', () => {
  const old = { rows: [[[{ d: 'q', n: 30, at: 8 }, { d: 'e', n: 31, at: 16 }]]] };
  assert.deepEqual(M.sanitize(old, 8).rows[0][0], [{ d: 'q', n: 30, at: 24 }, { d: 'e', n: 31, at: 48 }]);
});

function triplets(...names) {
  const score = M.emptyScore();
  score.rows[0][0] = names.map((n, k) => ({ d: 'e', n, at: k * 12 }));
  return score;
}
const refs = (...indices) => indices.map((i) => ({ mi: 0, i }));

test('tres corcheas seguidas ofrecen tresillo y lo aplican compactando sus lugares', () => {
  const score = triplets(30, 31, 32);
  assert.ok(M.selectionActions(score, refs(0, 1, 2)).includes('triplet'));
  assert.ok(!M.selectionActions(score, refs(0, 1)).includes('triplet'));
  assert.ok(M.applySelection(score, refs(0, 1, 2), 'triplet'));
  assert.deepEqual(score.rows[0][0], [{ d: 'e', n: 30, at: 0, tp: 1 }, { d: 'e', n: 31, at: 8, tp: 1 }, { d: 'e', n: 32, at: 16, tp: 1 }]);
  assert.deepEqual(M.sanitize(M.clone(score)), score);
  const xml = M.toMusicXml(score).split('<measure ')[1];
  assert.equal((xml.match(/<time-modification>/g) || []).length, 3);
  assert.match(xml, /<tuplet type="start"\/>/);
  assert.match(xml, /<tuplet type="stop"\/>/);
  assert.deepEqual([...xml.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]), ['begin', 'continue', 'end']);
  const total = [...xml.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(total, 96);
  assert.deepEqual(M.selectionActions(score, refs(0, 1, 2)), ['untriplet', 'unbeam']);
});

test('seis corcheas hacen dos tresillos y se pueden deshacer', () => {
  const score = triplets(30, 31, 32, 33, 34, 35);
  assert.ok(M.applySelection(score, refs(0, 1, 2, 3, 4, 5), 'triplet'));
  assert.deepEqual(score.rows[0][0].map((ev) => ev.tp), [1, 1, 1, 2, 2, 2]);
  assert.deepEqual(M.onsets(score.rows[0][0]), [0, 8, 16, 24, 32, 40]);
  assert.ok(M.applySelection(score, refs(0, 1, 2, 3, 4, 5), 'untriplet'));
  assert.deepEqual(score.rows[0][0], triplets(30, 31, 32, 33, 34, 35).rows[0][0]);
});

test('no hay tresillo con duraciones mezcladas, con huecos ni fuera de a tres', () => {
  const mixed = triplets(30, 31, 32);
  mixed.rows[0][0][1].d = 'q';
  assert.deepEqual(M.selectionActions(mixed, refs(0, 1, 2)), []);
  const gap = triplets(30, 31, 32);
  gap.rows[0][0][2].at = 36;
  assert.deepEqual(M.selectionActions(gap, refs(0, 1, 2)), []);
  const four = triplets(30, 31, 32, 33);
  assert.ok(!M.selectionActions(four, refs(0, 1, 2, 3)).includes('triplet'));
  const across = triplets(30, 31, 32);
  across.rows[0][1] = [{ d: 'e', n: 30, at: 0 }];
  assert.ok(!M.selectionActions(across, [{ mi: 0, i: 1 }, { mi: 0, i: 2 }, { mi: 1, i: 0 }]).includes('triplet'));
});

test('deshacer un tresillo no pisa la nota que sigue', () => {
  const score = triplets(30, 31, 32);
  M.applySelection(score, refs(0, 1, 2), 'triplet');
  score.rows[0][0].push({ d: 'q', n: 30, at: 24 });
  assert.equal(M.applySelection(score, refs(0, 1, 2), 'untriplet'), false);
});

test('una nota al final de un compas y otra al comienzo del siguiente se ligan', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'h', n: 30, at: 0 }, { d: 'h', n: 32, at: 48 }];
  score.rows[0][1] = [{ d: 'q', n: 32, at: 0 }, { d: 'q', n: 33, at: 24 }];
  const pair = [{ mi: 0, i: 1 }, { mi: 1, i: 0 }];
  assert.deepEqual(M.selectionActions(score, pair), ['link']);
  assert.deepEqual(M.selectionActions(score, [{ mi: 0, i: 0 }, { mi: 1, i: 0 }]), []);
  assert.deepEqual(M.selectionActions(score, [{ mi: 0, i: 1 }, { mi: 1, i: 1 }]), []);
  assert.ok(M.applySelection(score, pair, 'link'));
  assert.equal(score.rows[0][0][1].tie, true);
  const xml = M.toMusicXml(M.sanitize(M.clone(score)));
  assert.equal((xml.match(/<tie type="start"\/>/g) || []).length, 1);
  assert.equal((xml.match(/<tied type="stop"\/>/g) || []).length, 1);
  assert.deepEqual(M.selectionActions(score, pair), ['unlink']);
  assert.ok(M.applySelection(score, pair, 'unlink'));
  assert.equal(score.rows[0][0][1].tie, undefined);
});

test('con alturas distintas la ligadura es de expresion y se pierde si deja de ser valida', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'w', n: 30, at: 0 }];
  score.rows[0][1] = [{ d: 'w', n: 32, at: 0 }];
  M.applySelection(score, [{ mi: 0, i: 0 }, { mi: 1, i: 0 }], 'link');
  assert.equal(score.rows[0][0][0].slur, true);
  assert.match(M.toMusicXml(score), /<slur type="start" number="1"\/>[^]*<slur type="stop" number="1"\/>/);
  score.rows[0][1] = [];
  assert.deepEqual(M.links(score), []);
  assert.doesNotMatch(M.toMusicXml(score), /<slur/);
});

test('el barrado manual une corcheas de pulsos distintos y separa las unidas', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'e', n: 30, at: 12 }, { d: 'e', n: 31, at: 24 }, { d: 'e', n: 32, at: 36 }];
  const beams = () => [...M.toMusicXml(score).split('<measure ')[1].matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]);
  assert.deepEqual(beams(), ['begin', 'end']);
  assert.deepEqual(M.selectionActions(score, refs(0, 1)), ['beam']);
  assert.deepEqual(M.selectionActions(score, refs(1, 2)), ['unbeam']);
  assert.deepEqual(M.selectionActions(score, refs(0, 1, 2)), ['triplet', 'beam', 'unbeam']);
  M.applySelection(score, refs(0, 1), 'beam');
  assert.deepEqual(beams(), ['begin', 'continue', 'end']);
  assert.deepEqual(M.sanitize(M.clone(score)), score);
  M.applySelection(score, refs(1, 2), 'unbeam');
  assert.deepEqual(beams(), ['begin', 'end']);
  M.applySelection(score, refs(0, 1), 'unbeam');
  M.applySelection(score, refs(0, 1), 'beam');
  assert.equal(score.rows[0][0][0].beam, 'join');
  M.applySelection(score, refs(0, 1), 'unbeam');
  assert.equal(score.rows[0][0][0].beam, undefined);
  assert.deepEqual(beams(), [], 'la separacion anterior de las dos ultimas sigue vigente');
});

test('no se barran silencios, negras ni figuras separadas', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'e', n: 30, at: 0 }, { d: 'q', n: 31, at: 12 }, { d: 'e', n: 32, at: 36 }, { d: 'e', rest: true, at: 48 }];
  assert.deepEqual(M.selectionActions(score, refs(0, 1)), []);
  assert.deepEqual(M.selectionActions(score, refs(0, 2)), []);
  assert.deepEqual(M.selectionActions(score, refs(2, 3)), []);
});

test('sequence ordena las figuras por lectura', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 31, at: 24 }];
  score.rows[0][1] = [{ d: 'q', n: 30, at: 0 }];
  assert.deepEqual(M.sequence(score), [{ mi: 0, i: 0 }, { mi: 0, i: 1 }, { mi: 1, i: 0 }]);
});

test('la fusa dura 3 divisiones, no admite puntillo, se coloca de a 3 y se escribe como 32nd', () => {
  assert.equal(M.length({ d: 'f', n: 30 }), 3);
  assert.ok(!M.canDot([{ d: 'f', n: 30 }], 0));
  assert.equal(M.gridOf([{ d: 'f' }]), 3);
  assert.equal(M.gridOf([{ d: 'f' }, { d: 'e', tp: 1 }]), 1);
  assert.equal(M.gridOf([{ d: 'q' }]), M.GRID);
  const measure = [{ d: 'f', n: 30 }, { d: 'f', n: 31 }, { d: 'f', rest: true }, { d: 'f', n: 32 }];
  const xml = M.toMusicXml({ rows: [[measure, [], [], []]] });
  assert.equal([...xml.matchAll(/<type>32nd<\/type>/g)].length, 4);
  assert.equal(M.sanitize({ rows: [[[{ d: 'f', n: 30, dot: true }]]] }).rows[0][0][0].dot, undefined);
});

test('las fusas se unen con una tercera barra', () => {
  const measure = [{ d: 'f', n: 30 }, { d: 'f', n: 31 }, { d: 's', n: 32 }, { d: 's', n: 33 }, { d: 'e', n: 34 }];
  const first = M.toMusicXml({ rows: [[measure, [], [], []]] }).split('<measure ')[1];
  const level = (n) => [...first.matchAll(new RegExp(`<beam number="${n}">([\\w ]+)</beam>`, 'g'))].map((m) => m[1]);
  assert.deepEqual(level(3), ['begin', 'end']);
  assert.deepEqual(level(2), ['begin', 'continue', 'continue', 'end']);
});

test('un cambio de armadura rige desde su compas y no toca los anteriores', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'w', n: 31 }];
  score.rows[1][0] = [{ d: 'w', n: 31 }];
  score.rows[2][0] = [{ d: 'w', n: 31 }];
  assert.ok(M.setKey(score, 4, 2));
  assert.deepEqual(score.keys, { 4: 2 });
  assert.equal(score.fifths, 0);
  assert.deepEqual([0, 3, 4, 7, 8, 11].map((mi) => M.keyAt(score, mi)), [0, 0, 2, 2, 2, 2]);
  assert.ok(M.setKey(score, 8, -1));
  assert.deepEqual([4, 7, 8].map((mi) => M.keyAt(score, mi)), [2, 2, -1]);
  const xml = M.toMusicXml(score);
  assert.deepEqual([...xml.matchAll(/<fifths>(-?\d+)<\/fifths>/g)].map((m) => m[1]), ['0', '2', '-1']);
  const notes = [...xml.matchAll(/<note id="e\d+-\d+">([^]*?)<\/note>/g)].map((m) => m[1]);
  assert.deepEqual(notes.map((n) => n.includes('<alter>')), [false, true, false]);
  assert.equal(M.keyAlter(31, score, 8), 0);
  assert.equal(M.keyAlter(31, score, 4), 1);
  // Repetir la armadura anterior quita el cambio.
  assert.ok(M.setKey(score, 8, 2));
  assert.deepEqual(score.keys, { 4: 2 });
  assert.ok(M.setKey(score, 4, 0));
  assert.equal(score.keys, undefined);
  assert.ok(!M.setKey(score, 12, 1));
  assert.ok(!M.setKey(score, 1, 8));
});

test('los cambios de armadura se conservan al sanear y se descartan los invalidos', () => {
  const base = M.emptyScore();
  const data = { ...base, fifths: 1, keys: { 0: 3, 4: 1, 5: 2, 6: 9, 7: '2', x: 1, 99: 1, 8: -2 } };
  assert.deepEqual(M.sanitize(data).keys, { 5: 2, 8: -2 });
  assert.equal(M.sanitize({ ...base }).keys, undefined);
});

test('agregar y quitar compases de un renglon corre las barras, armaduras y cejillas siguientes', () => {
  const score = M.emptyScore();
  assert.ok(M.removeMeasure(score, 0));
  assert.deepEqual(score.rows.map((row) => row.length), [3, 4, 4]);
  assert.deepEqual(M.rowStarts(score), [0, 3, 7]);
  assert.deepEqual(M.rowOf(score, 3), { row: 1, first: 3, last: 6 });
  score.barlines = { 2: { double: true }, 5: { double: true } };
  score.keys = { 4: 2 };
  assert.ok(M.setBarre(score, 3, 0, 2, undefined, 2));
  assert.ok(M.addMeasure(score, 0));
  assert.ok(!M.addMeasure(score, 0));
  assert.deepEqual(score.barlines, { 2: { double: true }, 6: { double: true } });
  assert.deepEqual(score.keys, { 5: 2 });
  assert.deepEqual(Object.keys(score.barres), ['4']);
  assert.ok(M.removeMeasure(score, 0));
  assert.deepEqual(score.barlines, { 2: { double: true }, 5: { double: true } });
  assert.deepEqual(Object.keys(score.barres), ['3']);
});

test('quitar el ultimo compas de un renglon descarta su barra y recorta la cejilla que lo cruza', () => {
  const score = M.emptyScore();
  score.barlines = { 3: { double: true } };
  assert.ok(M.setBarre(score, 1, 0, 2, 12, 2));
  assert.ok(M.removeMeasure(score, 0));
  assert.equal(score.barlines, undefined);
  assert.deepEqual(score.barres[1], { at: 0, fret: 2, span: 1 });
  assert.ok(M.removeMeasure(score, 0));
  assert.ok(M.removeMeasure(score, 0));
  assert.ok(!M.removeMeasure(score, 0));
  assert.equal(score.rows[0].length, 1);
});

test('una cejilla no cruza al renglon siguiente cuando los renglones tienen distinto largo', () => {
  const score = M.emptyScore();
  M.removeMeasure(score, 0);
  assert.ok(!M.setBarre(score, 2, 0, 2, 12, 1));
  assert.ok(M.setBarre(score, 3, 0, 2, 12, 1));
});

test('sanear conserva el largo de cada renglon y el exportado empieza un sistema por renglon', () => {
  const score = M.emptyScore();
  M.removeMeasure(score, 1);
  const clean = M.sanitize(JSON.parse(JSON.stringify(score)));
  assert.deepEqual(clean.rows.map((row) => row.length), [4, 3, 4]);
  assert.equal(M.toMusicXml(clean).split('new-system').length - 1, 3);
  assert.deepEqual(M.sanitize({ rows: [[], [[]]] }).rows.map((row) => row.length), [4, 1, 4]);
});
