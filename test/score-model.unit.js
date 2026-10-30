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
  // E5 escrito (n = 37) suena E4 (64) con la clave de guitarra; un sostenido sube un semitono hasta el fin del compas.
  score.rows[0][0] = [{ n: 37, d: 'q', at: 0 }, { n: 37, d: 'q', at: 24, acc: '#' }, { n: 37, d: 'q', at: 48 }, { n: 30, d: 'q', at: 48 }];
  assert.deepEqual(M.attacks(score).map((a) => [a.key, a.midis]), [['0:0', [64]], ['0:24', [65]], ['0:48', [65, 52]]]);
  // Un do escrito en el tercer espacio (n = 35) suena C4: segunda cuerda, traste 1; con el do grave, un acorde con digitacion.
  score.rows[0][0] = [{ n: 35, d: 'q', at: 0 }, { n: 28, d: 'q', at: 0 }];
  const F = require('../src/site/score-fingering');
  const midis = M.attacks(score).map((a) => a.midis);
  assert.deepEqual(midis, [[60, 48]]);
  assert.deepEqual(F.assign(midis)[0].map((cell) => cell.join(':')).sort(), ['1:1', '4:3']);
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
  assert.ok(M.canDot([{ d: 'h', n: 30 }], 0));
  assert.ok(!M.canDot([{ d: 'h', n: 30 }, { d: 'h', n: 30 }], 0), 'en orden, dos blancas ya llenan el 4/4');
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

test('una negra sola en medio de un compas vacio es un compas de una negra: el hueco de adelante no cuenta', () => {
  const measure = [];
  const spot = M.placement(measure, { d: 'q', n: 30 }, 48);
  assert.equal(spot.at, 48);
  M.insertAt(measure, { d: 'q', n: 30 }, spot.at);
  assert.equal(M.measureLength(measure), 24);
  assert.deepEqual(M.onsets(measure), [0]);
  assert.equal(M.measureLength([{ d: 'q', n: 30, at: 48 }]), 24);
  const score = M.emptyScore();
  score.rows[0][0] = measure;
  const first = M.toMusicXml(score).split('<measure ')[1];
  assert.match(first, /^[^]*?<step>E<\/step>[^]*<rest\/><duration>48<\/duration>/, 'la negra va primero; el relleno oculto queda al final');
  assert.deepEqual(M.sanitize(M.clone(score)).rows[0][0], [{ d: 'q', n: 30, at: 0 }]);
});

test('soltar sobre una nota conserva la duracion elegida y permite acordes de igual duracion', () => {
  const measure = [{ d: 'e', n: 30, at: 0 }];
  const spot = M.placement(measure, { d: 'q', n: 34 }, 0);
  assert.deepEqual(spot, { at: 0, d: 'q', dot: undefined });
  assert.equal(M.placement(measure, { d: 'q', n: 30 }, 0), null);
  M.insertAt(measure, { d: 'e', n: 34 }, 0);
  assert.match(M.toMusicXml({ rows: [[measure, [], [], []]] }), /<chord\/>/);
});

test('una figura soltada encima de otra en otro tiempo va despues en orden, si el compas la admite', () => {
  const measure = [{ d: 'h', n: 30, at: 0 }];
  assert.equal(M.placement(measure, { d: 'q', n: 31 }, 24).at, 24);
  M.insertAt(measure, { d: 'q', n: 31 }, 24);
  assert.deepEqual(M.onsets(measure), [0, 48]);
  assert.equal(M.voices(measure).length, 1);
  assert.equal(M.placement([{ d: 'w', n: 30, at: 0 }], { d: 'q', n: 31 }, 24), null, 'una redonda ya llena el 4/4');
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
  assert.ok(!M.canDot([{ d: 'q', n: 30 }, { d: 'e', n: 31 }], 0, score), 'la corchea sigue a la negra y ya no entra');
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
  assert.deepEqual(M.sanitize(score).rows[0][0], [{ d: 'e', n: 30, at: 0 }, { d: 'e', n: 34, at: 0 }], 'el acorde se conserva y pierde el hueco de adelante');
  assert.equal(M.placement([], { d: 'q', n: 30 }, 120, score).at, 120);
  assert.equal(M.setMeter(score, '4/4'), true);
  assert.deepEqual(M.onsets(score.rows[0][0]), [0, 0]);
});

test('cambiar a un compas mas corto no cuenta los huecos y rechaza lo que en orden no entra', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', dot: true, n: 34, at: 48 }, { d: 'h', n: 30, at: 48 }];
  assert.equal(M.setMeter(score, '6/8'), true);
  assert.deepEqual(M.onsets(score.rows[0][0]), [0, 0]);
  assert.ok(M.measureLength(score.rows[0][0]) <= 72);
  score.rows[0][0] = [{ d: 'h', n: 30 }, { d: 'q', n: 31 }, { d: 'q', n: 32 }];
  assert.equal(M.setMeter(score, '6/8'), false);
});

test('la polifonia sobrevive al guardado y exporta tiempos, duraciones y voces independientes', () => {
  const score = M.emptyScore();
  const measure = score.rows[0][0];
  for (const ev of [
    { d: 'h', n: 24, at: 0 },
    { d: 'q', n: 34, at: 0 },
    { d: 'q', n: 36, at: 0 },
    { d: 'q', n: 35, at: 24 },
    { d: 'h', n: 33, at: 48 },
    { d: 'h', rest: true, at: 48 },
  ]) {
    const spot = M.placement(measure, ev, ev.at, score);
    assert.ok(spot);
    assert.equal(spot.at, ev.at);
    assert.equal(spot.d, ev.d);
    M.insertAt(measure, ev, spot.at);
  }
  M.settle(measure);
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
  assert.equal(notes.get(5).voice, notes.get(0).voice, 'el silencio sin voz va a la voz que no tiene nada en ese lugar');
  assert.equal(cursor, M.capacity(score));
});

test('el puntillo cuenta el compas en orden: donde cayo la figura no importa', () => {
  assert.equal(M.canDot([{ d: 'h', n: 30, at: 72 }], 0), true);
  assert.equal(M.canDot([{ d: 'q', n: 31, at: 0 }, { d: 'h', n: 30, at: 72 }], 1), true);
  assert.equal(M.canDot([{ d: 'h', n: 31, at: 0 }, { d: 'h', n: 30, at: 72 }], 1), false);
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

test('una figura nueva con el mismo at que otra de distinta duracion abre una voz y empieza junto con ella', () => {
  const measure = [{ d: 'h', n: 30 }, { d: 'h', n: 31 }];
  M.insertAt(measure, { d: 'q', n: 34 }, 48);
  assert.deepEqual(M.onsets(measure), [0, 48, 48]);
  assert.equal(M.voices(measure).length, 2);
  assert.equal(M.measureLength(measure), 96);
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
  score.rows[0][0] = [{ d: 'w', n: 30, at: 0 }, { d: 'q', n: 34, at: 0 }, { d: 'q', n: 35, at: 24 }];
  M.setBarre(score, 0, 48, 2);
  const xml = M.toMusicXml(score);
  assert.equal((xml.match(/<words>C 2<\/words>/g) || []).length, 1);
});

test('una partitura vieja con figuras sin voz superpuestas por su at no pierde ninguna al cargar', () => {
  // Antes una negra soltada sobre una redonda abria otra voz por su posicion; contadas en orden no entrarian.
  const old = { rows: [[[{ d: 'w', n: 30, at: 0 }, { d: 'q', n: 34, at: 24 }, { d: 'q', n: 35, at: 48 }]]] };
  const measure = M.sanitize(old).rows[0][0];
  assert.equal(measure.length, 3);
  assert.deepEqual(measure.map((ev) => ev.v), [1, 2, 2], 'las voces de entonces quedan guardadas');
  assert.ok(M.measureLength(measure) <= 96);
});


test('los datos guardados con 8 divisiones por negra se reescalan al cargar', () => {
  const old = { rows: [[[{ d: 'q', n: 30, at: 8 }, { d: 'e', n: 31, at: 16 }]]] };
  assert.deepEqual(M.sanitize(old, 8).rows[0][0], [{ d: 'q', n: 30, at: 0 }, { d: 'e', n: 31, at: 24 }]);
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
  assert.ok(M.selectionActions(gap, refs(0, 1, 2)).includes('triplet'), 'un hueco en at no separa: en orden van seguidas');
  const four = triplets(30, 31, 32, 33);
  assert.ok(!M.selectionActions(four, refs(0, 1, 2, 3)).includes('triplet'));
  const across = triplets(30, 31, 32);
  across.rows[0][1] = [{ d: 'e', n: 30, at: 0 }];
  assert.ok(!M.selectionActions(across, [{ mi: 0, i: 1 }, { mi: 0, i: 2 }, { mi: 1, i: 0 }]).includes('triplet'));
});

test('deshacer un tresillo corre la nota que sigue y no lo hace si ya no entra', () => {
  const score = triplets(30, 31, 32);
  M.applySelection(score, refs(0, 1, 2), 'triplet');
  score.rows[0][0].push({ d: 'q', n: 30, at: 24 });
  assert.equal(M.applySelection(score, refs(0, 1, 2), 'untriplet'), true);
  assert.deepEqual(M.onsets(score.rows[0][0]), [0, 12, 24, 36]);
  const full = triplets(30, 31, 32);
  M.applySelection(full, refs(0, 1, 2), 'triplet');
  full.rows[0][0].push({ d: 'h', n: 30, at: 24 }, { d: 'e', n: 30, at: 72 }, { d: 'e', n: 30, at: 84 });
  const before = M.clone(full);
  assert.equal(M.applySelection(full, refs(0, 1, 2), 'untriplet'), false);
  assert.deepEqual(M.onsets(full.rows[0][0]), M.onsets(before.rows[0][0]));
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
  // El silencio de corchea del comienzo hace que las corcheas caigan a contratiempo (sin el, empezarian en 0).
  score.rows[0][0] = [{ d: 'e', rest: true, at: 0 }, { d: 'e', n: 30, at: 12 }, { d: 'e', n: 31, at: 24 }, { d: 'e', n: 32, at: 36 }];
  const beams = () => [...M.toMusicXml(score).split('<measure ')[1].matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]);
  assert.deepEqual(beams(), ['begin', 'end']);
  assert.deepEqual(M.selectionActions(score, refs(1, 2)), ['beam']);
  assert.deepEqual(M.selectionActions(score, refs(2, 3)), ['unbeam']);
  assert.deepEqual(M.selectionActions(score, refs(1, 2, 3)), ['triplet', 'beam', 'unbeam']);
  M.applySelection(score, refs(1, 2), 'beam');
  assert.deepEqual(beams(), ['begin', 'continue', 'end']);
  assert.deepEqual(M.sanitize(M.clone(score)), score);
  M.applySelection(score, refs(2, 3), 'unbeam');
  assert.deepEqual(beams(), ['begin', 'end']);
  M.applySelection(score, refs(1, 2), 'unbeam');
  M.applySelection(score, refs(1, 2), 'beam');
  assert.equal(score.rows[0][0][1].beam, 'join');
  M.applySelection(score, refs(1, 2), 'unbeam');
  assert.equal(score.rows[0][0][1].beam, undefined);
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

test('un cambio de clave rige desde su compas y no toca los anteriores', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'w', n: 31 }];
  assert.ok(M.setClef(score, 4, 'bass'));
  assert.deepEqual(score.clefs, { 4: 'bass' });
  assert.equal(score.clef, 'guitar');
  assert.deepEqual([0, 3, 4, 11].map((mi) => M.clefAt(score, mi)), ['guitar', 'guitar', 'bass', 'bass']);
  assert.equal(M.bottomLine(score, 3), 30);
  assert.equal(M.bottomLine(score, 4), 25);
  const xml = M.toMusicXml(score);
  assert.deepEqual([...xml.matchAll(/<sign>(\w)<\/sign>/g)].map((m) => m[1]), ['G', 'F']);
  assert.deepEqual(M.sanitize(score).clefs, { 4: 'bass' });
  assert.ok(M.setClef(score, 4, 'guitar'));
  assert.equal(score.clefs, undefined);
  assert.ok(M.setClef(score, 0, 'treble'));
  assert.equal(score.clef, 'treble');
  assert.ok(!M.setClef(score, 12, 'bass'));
  assert.ok(!M.setClef(score, 1, 'nope'));
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


test('doble barra interior divide el compas en el tiempo indicado y conserva la duracion', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ n: 30, d: 'q', at: 0 }, { n: 32, d: 'q', at: 24 }];
  assert.equal(M.setBarline(score, 0, 'double', 24), true);
  assert.equal(M.measures(score).length, 13);
  assert.deepEqual(M.measures(score).slice(0, 2), [[{ n: 30, d: 'q', at: 0 }], [{ n: 32, d: 'q', at: 0 }]]);
  assert.equal(M.capacity(score, 0), 24);
  assert.equal(M.capacity(score, 1), 72);
  assert.equal(M.capacity(score, 2), 96);
  assert.deepEqual(M.sanitize(score), score);
  const xml = M.toMusicXml(score);
  const first = xml.match(/<measure[^>]*>[\s\S]*?<\/measure>/)[0];
  assert.ok(first.includes('implicit="yes"'));
  assert.ok(!first.includes('print-object="no"><rest'), 'no rellena el compas corto hasta 4/4');
});


test('el corte liga una nota que lo atraviesa y conserva las alteraciones y las voces', () => {
  const score = M.emptyScore();
  // La negra aguda entra en el tiempo 2 de su voz porque la precede un silencio de negra.
  score.rows[0][0] = [{ n: 30, d: 'h', at: 0, acc: '#', v: 2 }, { d: 'q', rest: true, at: 0, v: 1 }, { n: 32, d: 'q', at: 24, v: 1 }];
  M.setBarline(score, 0, 'double', 12);
  assert.equal(M.capacity(score, 0), 12);
  assert.equal(M.capacity(score, 1), 84);
  assert.deepEqual(M.measures(score)[0], [{ n: 30, d: 'e', at: 0, acc: '#', tie: true, v: 2 }, { d: 'e', rest: true, at: 0, v: 1 }]);
  assert.deepEqual(M.measures(score)[1], [{ n: 30, d: 'q', dot: true, at: 0, acc: '#', v: 2 }, { d: 'e', rest: true, at: 0, v: 1 }, { n: 32, d: 'q', at: 12, v: 1 }]);
  assert.equal(M.attacks(score).length, 2, 'la nota ligada no se vuelve a atacar');
  assert.ok(M.toMusicXml(score).includes('<backup><duration>84</duration></backup>'));
  assert.deepEqual(M.sanitize(score), score);
  assert.equal(M.placement([], { n: 35, d: 'q' }, 0, score, 0), null, 'no cabe una negra en el compas de corchea');
});

test('el corte desplaza marcas, tablaturas y duraciones, y se puede repetir', () => {
  const score = M.emptyScore();
  score.barlines = { 0: { end: true }, 2: { double: true } };
  score.keys = { 2: 2 };
  score.clefs = { 2: 'bass' };
  score.tabs = { '0:48': [1, null, null, null, null, null], '2:0': [2, null, null, null, null, null] };
  score.barres = { 0: { at: 48, fret: 3 } };
  M.setBarline(score, 0, 'double', 24);
  assert.deepEqual(score.barlines, { 0: { double: true }, 1: { end: true }, 3: { double: true } });
  assert.deepEqual(score.keys, { 3: 2 });
  assert.deepEqual(score.clefs, { 3: 'bass' });
  assert.deepEqual(Object.keys(score.tabs), ['1:24', '3:0']);
  assert.deepEqual(score.barres, { 1: { at: 24, fret: 3 } });
  M.setBarline(score, 1, 'double', 24);
  assert.deepEqual(score.measureDurations, { 0: 24, 1: 24, 2: 48 });
  assert.equal(M.measures(score).length, 14);
  assert.deepEqual(M.sanitize(score).measureDurations, score.measureDurations);
});

test('una barra doble en el borde sigue cambiando la barra sin dividir', () => {
  const score = M.emptyScore();
  M.setBarline(score, 0, 'double', 96);
  assert.equal(M.measures(score).length, 12);
  assert.equal(score.measureDurations, undefined);
  assert.deepEqual(score.barlines, { 0: { double: true } });
});


test('los anchos visuales se conservan al guardar, dividir y desplazar compases', () => {
  const score = M.emptyScore();
  score.measureWidths = { 0: 0.4, 1: 0.2, 2: 0.2, 3: 0.2 };
  assert.deepEqual(M.sanitize(score).measureWidths, score.measureWidths);
  M.setBarline(score, 0, 'double', 24);
  assert.ok(Math.abs(score.measureWidths[0] - 0.1) < 1e-12);
  assert.deepEqual({ ...score.measureWidths, 0: 0.1 }, { 0: 0.1, 1: 0.3, 2: 0.2, 3: 0.2, 4: 0.2 });
  assert.deepEqual(M.sanitize(score).measureWidths, score.measureWidths);
  const clean = M.sanitize({ ...score, measureWidths: { 0: -1, 1: Infinity, 2: '0.2', 3: 0, 4: 0.4, 99: 0.3 } });
  assert.deepEqual(clean.measureWidths, { 4: 0.4 });
});

test('dividir un compas conserva su continuacion y los compases vecinos en el mismo renglon', () => {
  const score = M.emptyScore();
  score.rows[2] = [[], []];
  score.rows[0][3] = [{ n: 30, d: 'h', at: 0 }, { d: 'q', rest: true, at: 48 }, { n: 32, d: 'q', at: 72 }];
  score.rows[1][0] = [{ n: 35, d: 'q', at: 0 }];
  const following = M.clone(score).rows.slice(1);
  M.setBarline(score, 3, 'double', 48);
  assert.deepEqual(score.rows.map(row => row.length), [5, 4, 2]);
  assert.deepEqual(score.rows.slice(1), following);
  assert.deepEqual(score.rows[0][4], [{ d: 'q', rest: true, at: 0 }, { n: 32, d: 'q', at: 24 }]);
  assert.deepEqual(M.sanitize(M.clone(score)), score, 'recargar no trunca el quinto compas');
  M.setBarline(score, 4, 'double', 24);
  assert.deepEqual(score.rows.map(row => row.length), [6, 4, 2]);
  assert.deepEqual(M.sanitize(M.clone(score)), score, 'se conservan divisiones repetidas');
});

// Las voces se numeran de arriba (1) a abajo; un silencio se acomoda segun las notas que suenan a la vez.
function threeFour() {
  const score = M.emptyScore();
  score.meter = '3/4';
  return { score, measure: M.measures(score)[0] };
}

function putRest(score, measure, d, at, n) {
  const placed = M.placeRest(measure, { d, rest: true }, at, n, score, 0);
  if (placed.measure) measure.splice(0, measure.length, ...placed.measure);
  return placed;
}

test('anteponer un silencio desplaza las voces juntas y rechaza un compas sin espacio', () => {
  const { score, measure } = threeFour();
  measure.push({ d: 'q', n: 36, at: 0, v: 1 }, { d: 'e', n: 28, at: 0, v: 2 }, { d: 'e', n: 29, at: 12, v: 2 });
  const before = M.clone(measure);
  const placed = M.placeRest(measure, { d: 'e', rest: true }, 0, 36, score, 0, true);
  assert.equal(placed.index, 0);
  assert.deepEqual(placed.measure.map(ev => ev.at), [0, 12, 12, 24]);
  assert.deepEqual(placed.measure.map(ev => ev.v), [1, 1, 2, 2]);
  assert.deepEqual(measure, before, 'la propuesta no modifica el original');
  assert.deepEqual(M.placeRest(measure, { d: 'h', rest: true, dot: true }, 0, 36, score, 0, true), { full: true });
  assert.deepEqual(measure, before, 'rechazar la insercion conserva todas las notas');
});

test('cada voz tiene su propio silencio y su propia longitud en un compas de 3/4', () => {
  const { score, measure } = threeFour();
  // Voz grave: corchea y silencio de negra, dos veces.
  [[0, 'e', false], [12, 'q', true], [36, 'e', false], [48, 'q', true]].forEach(([at, d, rest]) => {
    measure.push(rest ? { d, rest: true, at, v: 1 } : { d, n: 30, at, v: 1 });
  });
  // Voz aguda: silencios de corchea y negra, dos veces, clickeados arriba de la voz grave.
  [[0, 'e'], [12, 'q'], [36, 'e'], [48, 'q']].forEach(([at, d]) => {
    assert.ok(putRest(score, measure, d, at, 40).measure);
  });
  assert.equal(measure.length, 8);
  assert.equal(M.measureLength(measure), M.capacity(score, 0));
  const lanes = M.voices(measure);
  assert.equal(lanes.length, 2);
  assert.ok(lanes.every((lane) => lane.groups.length === 4));
  assert.ok(lanes[0].groups.every((g) => g.rest), 'los silencios agudos son la voz 1');
  assert.ok(measure.filter((o) => !o.rest).every((o) => o.v === 2), 'las notas bajan a la voz 2');
  assert.deepEqual(M.sanitize(score).rows[0][0].map((e) => e.v), measure.map((e) => e.v));
});

test('un silencio clickeado abajo de la nota abre una voz mas grave y la nota no cambia', () => {
  const { score, measure } = threeFour();
  measure.push({ d: 'q', n: 34, at: 0, v: 1 });
  putRest(score, measure, 'q', 0, 28);
  assert.equal(M.voices(measure).length, 2);
  assert.equal(measure.find((o) => !o.rest).v, 1);
  assert.equal(measure.find((o) => o.rest).v, 2);
});

test('un silencio usa la voz libre mas cercana antes de abrir otra', () => {
  const { score, measure } = threeFour();
  // El silencio de la voz 1 empieza junto con la segunda negra de la voz 2 (mismo at), en el tiempo 2.
  measure.push({ d: 'q', n: 34, at: 0, v: 2 }, { d: 'q', n: 34, at: 24, v: 2 }, { d: 'q', rest: true, at: 24, v: 1 });
  assert.deepEqual(M.onsets(measure), [0, 24, 24]);
  // En el tiempo 0 la voz 1 esta libre: un silencio arriba de la nota la usa y la nota sigue en la 2.
  putRest(score, measure, 'q', 0, 40);
  assert.equal(measure.find((o) => o.rest && o.at === 0).v, 1);
  assert.ok(measure.filter((o) => !o.rest).every((o) => o.v === 2));
  assert.equal(M.voices(measure).length, 2);
});

test('un silencio nunca queda a la altura de una nota que suena a la vez', () => {
  const { score, measure } = threeFour();
  measure.push({ d: 'q', n: 32, at: 0, v: 1 });
  assert.equal(putRest(score, measure, 'q', 0, 33).measure.find((o) => o.rest).n, 38);
  const second = threeFour();
  second.measure.push({ d: 'q', n: 32, at: 0, v: 1 });
  assert.equal(putRest(second.score, second.measure, 'q', 0, 31).measure ? second.measure.find((o) => o.rest).n : 0, 26);
});

test('el silencio con altura propia se exporta con display-step y se conserva al guardar', () => {
  const { score, measure } = threeFour();
  measure.push({ d: 'q', n: 32, at: 0, v: 1 }, { d: 'q', rest: true, n: 25, at: 0, v: 2 });
  assert.match(M.toMusicXml(score), /<rest><display-step>G<\/display-step><display-octave>2<\/display-octave><\/rest>/);
  assert.equal(M.sanitize(M.clone(score)).rows[0][0][1].n, 25);
});

test('con las 4 voces ocupadas en ese tiempo un silencio avisa de la voz del click y no toca el compas', () => {
  const { score, measure } = threeFour();
  [1, 2, 3, 4].forEach((v) => measure.push({ d: 'q', n: 40 - v * 3, at: 0, v }));
  const before = JSON.stringify(measure);
  const placed = M.placeRest(measure, { d: 'q', rest: true }, 0, 20, score, 0);
  assert.equal(placed.measure, undefined);
  assert.equal(placed.voice, 4);
  assert.equal(JSON.stringify(measure), before);
});

test('un silencio cabe aunque las figuras guarden una voz vieja con carriles vacios', () => {
  const { score, measure } = threeFour();
  // Dos corcheas en la voz 4 (quedo de arrastres anteriores): en realidad solo hay una voz con notas.
  measure.push({ d: 'e', n: 30, at: 0, v: 4 }, { d: 'e', n: 30, at: 12, v: 4 });
  const placed = M.placeRest(measure, { d: 'q', rest: true }, 0, 20, score, 0);
  assert.ok(placed.measure, 'no deberia avisar voz completa');
  assert.ok(placed.measure.every((o) => o.v <= 2));
});

test('al mover una nota, las demas conservan su lugar en el orden hasta que entra la movida', () => {
  const measure = [{ d: 'q', n: 30, at: 0 }, { d: 'q', n: 31, at: 24 }, { d: 'q', n: 32, at: 48 }];
  const [moved] = measure.splice(1, 1);
  assert.ok(M.placement(measure, Object.assign({}, moved, { n: 33 }), 24), 'no la confunde con la negra que sigue');
  M.insertNote(measure, Object.assign({}, moved, { n: 33 }), 24);
  assert.deepEqual(measure.map((ev) => [ev.n, ev.at]), [[30, 0], [33, 24], [32, 48]]);
  const group = [{ d: 'e', n: 30, at: 0 }, { d: 'q', n: 31, at: 12 }];
  M.insertMany(group, [[{ d: 'e', n: 33, at: 0 }, 36], [{ d: 'e', n: 34, at: 0 }, 48]]);
  assert.deepEqual(group.map((ev) => [ev.n, ev.at]), [[30, 0], [31, 12], [33, 36], [34, 48]]);
});

test('una nota agregada a un acorde toma la voz del acorde', () => {
  const { measure } = threeFour();
  measure.push({ d: 'q', n: 30, at: 0, v: 2 });
  M.insertNote(measure, { d: 'q', n: 33 }, 0);
  assert.deepEqual(measure.map((o) => o.v), [2, 2]);
  assert.equal(M.voices(measure).filter((lane) => lane.groups.length).length, 1);
});

test('un acorde de cinco notas es una sola voz y no se parte al agregar un silencio', () => {
  const { score, measure } = threeFour();
  [28, 30, 32, 34, 36].forEach((n) => measure.push({ d: 'q', n, at: 0, v: 1 }));
  putRest(score, measure, 'q', 0, 20);
  const lanes = M.voices(measure);
  assert.equal(lanes.length, 2);
  assert.equal(measure.filter((o) => !o.rest).every((o) => o.v === 1), true);
  assert.equal(lanes[0].groups[0].indices.length, 5);
});


test('el puntillo se cuenta en orden: la figura sigue donde empieza y lo que viene despues se corre', () => {
  assert.equal(M.dotStart([{ d: 'h', n: 30, at: 48 }], 0), 0, 'una blanca sola empieza en 0, caiga donde caiga');
  assert.equal(M.dotStart([{ d: 'h', n: 30, at: 48 }, { d: 'h', n: 33, at: 48 }], 0), 0);
  assert.equal(M.dotStart([{ d: 'h', n: 30, at: 24 }], 0), 0);
  assert.equal(M.dotStart([{ d: 'q', n: 31, at: 0 }, { d: 'h', n: 30, at: 48 }], 1), 24);
  assert.equal(M.dotStart([{ d: 'q', n: 31, at: 0 }, { d: 'q', n: 31, at: 24 }, { d: 'h', n: 30, at: 48 }], 2), null);
  const plan = M.dotPlan([{ d: 'q', n: 31, at: 0 }, { d: 'q', n: 30, at: 24 }, { d: 'q', n: 32, at: 48 }], 0);
  assert.deepEqual(plan, { start: 0, moves: [] });
});

test('en 6/8 el puntillo de una voz no depende de donde cayeron las figuras de la otra', () => {
  const score = M.emptyScore();
  M.setMeter(score, '6/8');
  // Voz 1: blanca y negra (72, llena); voz 2: negra con puntillo.
  const measure = [{ d: 'h', n: 25, at: 24, v: 1 }, { d: 'q', n: 34, dot: true, at: 24, v: 2 }, { d: 'q', n: 37, at: 48, v: 1 }];
  assert.equal(M.dotStart(measure, 0, score), null, 'la blanca con puntillo y la negra ya no entran en su voz');
  const loose = [{ d: 'h', n: 25, at: 24 }, { d: 'q', n: 34, dot: true, at: 24 }, { d: 'q', n: 37, at: 48 }];
  // Sin voz guardada: la blanca grave es la voz 2 y las negras agudas la voz 1, en orden: 0 y 36.
  assert.deepEqual(M.onsets(loose), [0, 0, 36]);
  assert.deepEqual(M.dotPlan(loose, 2, score), { start: 36, moves: [] });
  const three = [{ d: 'h', n: 29, at: 0, v: 1, dot: true }, { d: 'q', n: 35, dot: true, at: 0, v: 2 }, { d: 'q', n: 38, at: 48, v: 3 }];
  assert.equal(M.dotStart(three, 2, score), 0, 'la voz 3 empieza con esa negra: no hay hueco antes');
});

test('mergeVoices recalcula las voces por registro y une la tercera voz a la mas cercana en altura', () => {
  const dotted = (n, at, x = {}) => Object.assign({ d: 'q', n, at, dot: true }, x);
  const first = [{ d: 'h', n: 25, at: 0, dot: true }, dotted(37, 0), dotted(35, 18)];
  assert.equal(M.mergeVoices(first, 72), false, 'ya son dos voces');
  assert.deepEqual(first.map((ev) => [ev.at, ev.v]), [[0, 2], [0, 1], [36, 1]]);
  const pinned = [dotted(35, 0, { v: 2 }), { d: 'h', n: 29, at: 0, v: 1, dot: true }, dotted(38, 36, { v: 3 })];
  M.mergeVoices(pinned, 72);
  assert.deepEqual(pinned.map((ev) => ev.v), [1, 2, 1], 'las v guardadas se descartan: la aguda es la 1');
  const three = [dotted(37, 0), { d: 'e', n: 31, at: 0 }, { d: 'h', n: 25, at: 0, dot: true }];
  assert.equal(M.voices(three).length, 3);
  assert.equal(M.mergeVoices(three, 96), true);
  assert.deepEqual(three.map((ev) => [ev.at, ev.v]), [[0, 1], [0, 2], [12, 2]]);
  const full = [dotted(37, 0), { d: 'e', n: 31, at: 0 }, { d: 'h', n: 25, at: 0, dot: true }];
  const copy = JSON.parse(JSON.stringify(full));
  assert.equal(M.mergeVoices(full, 72), false, 'si la voz unida no cabe en el compas, no se toca');
  assert.deepEqual(full, copy);
});

// Compas real que antes salia con 3 voces: las posiciones escalonadas (36, 42, 54) eran solo de dibujo.
function realMeasure() {
  return [
    { d: 'e', n: 33, at: 12, v: 1 },
    { d: 'q', at: 12, v: 2, rest: true },
    { d: 'q', n: 35, at: 36 },
    { d: 'q', n: 28, at: 42 },
    { d: 'e', n: 32, at: 54 },
    { d: 'q', n: 35, at: 72 },
    { d: 'q', n: 28, at: 72 },
  ];
}

test('las voces salen del registro y del orden, no de at: el compas real tiene 2 voces de 72', () => {
  const score = M.emptyScore();
  score.rows[0][0] = realMeasure();
  assert.equal(M.voices(score.rows[0][0]).length, 2);
  assert.equal(M.voicesText(score), 'voz 1: corchea, negra, corchea, negra\nvoz 2: silencio de negra, negra, negra');
  assert.equal(M.measureLength(score.rows[0][0]), 72, 'el hueco de adelante (at 12) no cuenta');
  // La corchea Sol termina junto con el primer Do grave, en el tiempo 2; el par final suena junto, una nota por voz.
  assert.deepEqual(M.onsets(score.rows[0][0]), [0, 0, 12, 24, 36, 48, 48]);
  const lanes = M.voices(score.rows[0][0]).map((voice) => voice.groups.map((g) => g.indices));
  assert.deepEqual(lanes, [[[0], [2], [4], [5]], [[1], [3], [6]]]);
  // Se conserva al guardar (at pasa a ser el inicio musical y cada figura guarda su voz) y fix() no lo cambia.
  const saved = M.sanitize(M.clone(score));
  assert.equal(M.voicesText(saved), M.voicesText(score));
  assert.deepEqual(saved.rows[0][0].map((ev) => [ev.at, ev.v]), [[0, 1], [0, 2], [12, 1], [24, 2], [36, 1], [48, 1], [48, 2]]);
  const fixed = realMeasure();
  assert.equal(M.mergeVoices(fixed, 96), false);
  assert.deepEqual(fixed.map((ev) => ev.v), [1, 2, 1, 2, 1, 1, 2]);
  // En el MusicXML no hace falta ningun silencio oculto antes de las 72 divisiones de cada voz.
  const first = M.toMusicXml(score).split('<measure ')[1];
  const voices = first.split('<backup>');
  assert.equal(voices.length, 2);
  voices.forEach((part) => {
    const hidden = [...part.matchAll(/<note print-object="no"><rest\/><duration>(\d+)<\/duration>/g)].map((m) => +m[1]);
    assert.deepEqual(hidden, [24], 'solo el relleno del final del compas');
  });
});

test('en 6/8 dos voces que empiezan juntas con figuras con puntillo siguen igual', () => {
  const score = M.emptyScore();
  M.setMeter(score, '6/8');
  score.rows[0][0] = [{ d: 'h', dot: true, n: 25, at: 0, v: 2 }, { d: 'q', dot: true, n: 37, at: 0, v: 1 }, { d: 'q', dot: true, n: 35, at: 36, v: 1 }];
  assert.deepEqual(M.onsets(score.rows[0][0]), [0, 0, 36]);
  assert.equal(M.measureLength(score.rows[0][0]), 72);
  assert.equal(M.voicesText(score), 'voz 1: negra con puntillo, negra con puntillo\nvoz 2: blanca con puntillo');
  assert.deepEqual(M.sanitize(M.clone(score)), score);
});

test('la segunda negra se corre pegada a la primera para llevar puntillo en 6/8', () => {
  const score = M.emptyScore();
  M.setMeter(score, '6/8');
  const measure = [{ d: 'q', n: 31, dot: true, at: 0 }, { d: 'q', n: 30, at: 48 }];
  assert.equal(M.dotStart(measure, 1, score), 36);
});

test('el MusicXML con varias voces manda las plicas agudas hacia arriba y la mas grave hacia abajo', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'q', n: 37, at: 0, v: 1 }, { d: 'q', n: 28, at: 0, v: 2 }];
  assert.deepEqual(M.toMusicXml(score).match(/<stem>\w+<\/stem>/g), ['<stem>up</stem>', '<stem>down</stem>']);
  score.rows[0][0] = [{ d: 'q', n: 37, at: 0 }];
  assert.doesNotMatch(M.toMusicXml(score), /<stem>/);
});

test('voicesText nombra las figuras de cada compas por voz', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ n: 37, d: 'q' }, { n: 37, d: 'q' }, { n: 37, d: 'h', at: 48 }];
  score.rows[0][1] = [{ n: 37, d: 'e' }, { n: 37, d: 'e' }, { n: 37, d: 'e' }, { n: 37, d: 'e' }, { n: 37, d: 'h', at: 48 }];
  score.rows[0][2] = [0, 8, 16].map((at) => ({ n: 37, d: 'e', tp: 1, at })).concat([24, 32, 40].map((at) => ({ n: 37, d: 'e', tp: 2, at })), [{ n: 37, d: 's', at: 48 }, { rest: true, d: 'e', at: 54 }, { n: 37, d: 'f', at: 66 }]);
  score.rows[0][3] = [{ n: 37, d: 'e', beam: 'join' }, { n: 37, d: 'e', beam: 'join' }, { n: 37, d: 'e' }, { rest: true, d: 'e', n: 35, at: 36 }, { n: 37, d: 'h', at: 48 }];
  assert.equal(M.voicesText(score), 'voz 1: negra, negra, blanca | doble corchea, doble corchea, blanca | tresillo de corcheas, tresillo de corcheas, semicorchea, silencio de corchea, fusa | triple corchea, silencio de corchea, blanca');
  assert.equal(M.voicesText(M.emptyScore()), '');
});

test('copiar y pegar conserva figuras, compases intermedios y datos musicales', () => {
  const score = M.emptyScore();
  const phrase = [{ d: 'e', n: 30, at: 0, tp: 1, beam: 'join', acc: '#' }, { d: 'e', n: 31, at: 8, tp: 1 }, { d: 'e', rest: true, at: 16, tp: 1 }];
  score.rows[0][0] = phrase;
  score.rows[0][2] = [{ d: 'q', n: 33, at: 0, dot: true }];
  const before = M.clone(score);
  const fragment = M.copySelection(score, [{ mi: 2, i: 0 }, { mi: 0, i: 2 }, { mi: 0, i: 0 }, { mi: 0, i: 1 }]);
  const refs = M.pasteSelection(score, fragment, 11);
  assert.deepEqual(M.measures(score).slice(11, 14), [phrase, [], before.rows[0][2]]);
  assert.deepEqual(refs, [{ mi: 11, i: 0 }, { mi: 11, i: 1 }, { mi: 11, i: 2 }, { mi: 13, i: 0 }]);
  assert.deepEqual(score.rows[0], before.rows[0], 'copiar conserva el origen');
  M.measures(score)[11][0].n++;
  assert.equal(fragment.measures[0][0].n, 30, 'cada pegado es independiente');
});

test('pegar sin espacio falla completo, sin crear renglones ni cambiar compases', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [{ d: 'w', n: 30, v: 1 }];
  score.rows[0][1] = [{ d: 'q', n: 32 }];
  score.measureDurations = { 11: 48 };
  const before = M.clone(score);
  const fragment = M.copySelection(score, [{ mi: 0, i: 0 }, { mi: 1, i: 0 }]);
  assert.equal(M.pasteSelection(score, fragment, 11), null);
  assert.deepEqual(score, before);
  assert.equal(M.pasteSelection(score, { ...fragment, measures: [[{ d: 'invalid' }]] }, 1), null);
  assert.deepEqual(score, before);
});

test('pegar distingue los tresillos copiados de los existentes', () => {
  const score = M.emptyScore();
  score.rows[0][0] = [0, 1, 2].map(i => ({ d: 'e', n: 30 + i, at: i * 8, tp: 1 }));
  const fragment = M.copySelection(score, [0, 1, 2].map(i => ({ mi: 0, i })));
  fragment.measures[0].forEach(ev => { ev.n += 7; });
  assert.equal(M.pasteSelection(score, fragment, 0).length, 3);
  assert.deepEqual([...new Set(score.rows[0][0].map(ev => ev.tp))], [1, 2]);
});
