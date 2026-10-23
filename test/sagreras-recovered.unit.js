const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function scores(number) {
  const root = path.join(__dirname, '..');
  return [path.join(root, `scripts/sagreras/sources/${number}.musicxml`),
    path.join(root, `downloads/sagreras-lecciones/Lesson ${number} - Julio Salvador Sagreras.musicxml`)]
    .map((file) => fs.readFileSync(file, 'utf8'));
}

// Posiciones en negras, independientemente de las divisiones y voces del exportador.
function notes(xml, number, details = false) {
  const divisions = Number(xml.match(/<divisions>(\d+)<\/divisions>/)[1]);
  const measure = xml.match(new RegExp(`<measure\\b[^>]*number="${number}"[^>]*>([\\s\\S]*?)<\\/measure>`))[1];
  let cursor = 0;
  let previous = 0;
  const result = [];
  for (const token of measure.matchAll(/<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const body = token[2];
    const duration = Number(body.match(/<duration>(\d+)<\/duration>/)[1]) / divisions;
    if (token[1] === 'backup') { cursor -= duration; continue; }
    if (token[1] === 'forward') { cursor += duration; continue; }
    const chord = /<chord\s*\//.test(body);
    const onset = chord ? previous : cursor;
    if (!chord) { previous = cursor; cursor += duration; }
    if (/<staff>2<\/staff>/.test(body)) continue;
    const step = body.match(/<step>([A-G])<\/step>/)?.[1];
    const octave = body.match(/<octave>(\d)<\/octave>/)?.[1];
    const alter = Number(body.match(/<alter>(-?\d+)<\/alter>/)?.[1] || 0);
    const pitch = step ? step + (alter === 1 ? '#' : alter === -1 ? 'b' : '') + octave : 'R';
    if (details) result.push({ onset, duration, pitch, voice: body.match(/<voice>(\d+)<\/voice>/)?.[1],
      type: body.match(/<type>([^<]+)<\/type>/)?.[1], dots: (body.match(/<dot\s*\//g) || []).length,
      hidden: /print-object="no"/.test(token[0]), start: /<tie\b[^>]*type="start"/.test(body),
      stop: /<tie\b[^>]*type="stop"/.test(body) });
    else if (step) result.push([onset, duration, pitch]);
  }
  return result;
}

test('Sagreras 54: las blancas del compas 7 no alargan el arpegio ni retrasan la melodia', () => {
  for (const xml of scores(54)) {
    const events = notes(xml, 7);
    assert.deepEqual(events.filter((e) => e[2] === 'E4'), [[0, 2, 'E4'], [2, 2, 'E4']]);
    assert.deepEqual(events.filter((e) => e[2] === 'E5'), [[1, 1, 'E5'], [3, 1, 'E5']]);
    const arpeggio = events.filter((e) => e[2] === 'G#4' || e[2] === 'B4');
    assert.equal(arpeggio.length, 12);
    assert.ok(arpeggio.every((e) => e[1] === 0.25));
    assert.deepEqual(arpeggio.map((e) => e[0]).sort((a, b) => a - b),
      [0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2.25, 2.5, 2.75, 3.25, 3.5, 3.75]);
  }
});

test('Sagreras 67: los seis compases con silencio central conservan el bajo y tres voces de cuatro tiempos', () => {
  const basses = { 1: 'C4', 6: 'D4', 7: 'D4', 9: 'C4', 12: 'C4', 14: 'D4' };
  for (const xml of scores(67)) {
    for (const [number, pitch] of Object.entries(basses)) {
      const events = notes(xml, number, true);
      assert.equal(new Set(events.map((e) => e.voice)).size, 3, `compas ${number}`);
      assert.equal(Math.max(...events.map((e) => e.onset + e.duration)), 4, `compas ${number}`);
      const bass = events.filter((e) => e.pitch === pitch);
      assert.deepEqual(bass.map((e) => [e.onset, e.duration, e.type]), [[0, 4, 'whole']], `bajo ${number}`);
      const upper = events.filter((e) => e.voice === '1');
      assert.deepEqual(upper.map((e) => [e.onset, e.duration]), [0, 1, 2, 3].map((o) => [o, 1]));
      assert.equal(upper[0].pitch, 'R');
      const middle = events.filter((e) => e.voice === '2');
      assert.deepEqual(middle.map((e) => [e.onset, e.duration]), Array.from({ length: 16 }, (_, i) => [i / 4, 0.25]));
      assert.deepEqual(middle.filter((e) => e.pitch === 'R').map((e) => e.onset), [0, 1, 2, 3]);
    }
  }
});

test('Sagreras 68: la voz de silencios no alarga el compas 15 ni duplica ataques del bajo', () => {
  for (const xml of scores(68)) {
    const events = notes(xml, 15, true);
    assert.equal(new Set(events.map((e) => e.voice)).size, 2);
    assert.equal(Math.max(...events.map((e) => e.onset + e.duration)), 2);
    assert.deepEqual(events.filter((e) => e.pitch === 'R').map((e) => [e.onset, e.duration]), [[0, 1], [1, 1]]);
    assert.deepEqual(notes(xml, 15), [[0, 1, 'Bb4'], [0, 1, 'C#5'], [0, 1, 'G5'],
      [1, 1, 'A4'], [1, 1, 'C5'], [1, 1, 'F#5']]);
    for (const number of [2, 3, 10, 11]) {
      const bass = notes(xml, number).filter((e) => e[2] === 'G3');
      assert.ok(bass.length > 0);
      assert.ok(bass.every((e) => e[0] === 1.5 && e[1] === 0.5));
    }
  }
});

test('Sagreras 69: cada altura de los acordes ligados conserva su propia ligadura', () => {
  const pitches = { 7: ['A4', 'C5'], 10: ['A4', 'C5', 'E5'], 14: ['G4', 'C5', 'G5'] };
  for (const xml of scores(69)) {
    for (const [number, chord] of Object.entries(pitches)) {
      const events = notes(xml, number, true);
      for (const pitch of chord) {
        const pair = events.filter((e) => e.pitch === pitch && (e.onset === 0.5 || e.onset === 1));
        assert.deepEqual(pair.map((e) => [e.onset, e.duration, e.start, e.stop]),
          [[0.5, 0.5, true, false], [1, 0.5, false, true]], `compas ${number}: ${pitch}`);
      }
    }
  }
});

test('Sagreras 70: conserva los 16 compases y ambos cierres completos', () => {
  const sorted = (events) => events.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  for (const xml of scores(70)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    for (const number of [8, 16]) {
      assert.deepEqual(sorted(notes(xml, number)), sorted([[0, 1, 'E4'], [0, 1, 'G4'],
        [0, 1, 'B4'], [0, 1, 'E5'], [1, 1, 'E3']]), `cierre ${number}`);
    }
    const eighth = xml.match(/<measure\b[^>]*number="8"[^>]*>([\s\S]*?)<\/measure>/)[1];
    assert.match(eighth, /<bar-style>light-light<\/bar-style>/);
    for (const number of [7, 15]) {
      const events = notes(xml, number, true);
      for (const pitch of ['G4', 'B4', 'G5']) {
        assert.ok(events.some((e) => e.pitch === pitch && e.onset === 0.5 && e.start));
        assert.ok(events.some((e) => e.pitch === pitch && e.onset === 1 && e.stop));
      }
    }
  }
});

test('Sagreras 71: anacrusa de corchea y noveno compas con cuatro blancas de un solo puntillo', () => {
  for (const xml of scores(71)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 17);
    const pickupNumber = /<measure\b[^>]*number="0"/.test(xml) ? 0 : 1;
    assert.deepEqual(notes(xml, pickupNumber), [[0, 0.5, 'D4']]);
    const ninth = notes(xml, pickupNumber + 8, true);
    assert.deepEqual(ninth.map((e) => [e.onset, e.duration, e.pitch, e.type, e.dots]),
      [[0, 3, 'A4', 'half', 1], [0, 3, 'B4', 'half', 1],
        [0, 3, 'F#5', 'half', 1], [0, 3, 'B3', 'half', 1]]);
    const last = notes(xml, pickupNumber + 16);
    assert.ok(last.some((e) => e[0] === 2 && e[1] === 1 && e[2] === 'G3'));
  }
});

test('Sagreras 72: melodia, bajo y corcheas intermedias se superponen en seis compases', () => {
  for (const xml of scores(72)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 24);
    for (const number of [2, 6, 15, 18, 22, 23]) {
      const events = notes(xml, number, true);
      assert.equal(new Set(events.map((e) => e.voice)).size, 3, `compas ${number}`);
      assert.equal(Math.max(...events.map((e) => e.onset + e.duration)), 4, `compas ${number}`);
      const middle = events.filter((e) => e.voice === '3');
      assert.deepEqual(middle.map((e) => [e.onset, e.duration]), Array.from({ length: 8 }, (_, i) => [i / 2, 0.5]));
      assert.deepEqual(middle.filter((e) => e.pitch === 'R').map((e) => e.onset), number === 15 ? [0, 1, 2, 3] : [0, 2]);
      const melody = events.filter((e) => e.voice === '1');
      const bass = events.filter((e) => e.voice === '2');
      const onsets = number === 15 ? [0, 1, 2, 3] : [0, 2];
      for (const voice of [melody, bass]) {
        assert.deepEqual(voice.map((e) => [e.onset, e.duration]), onsets.map((o) => [o, number === 15 ? 1 : 2]));
      }
      assert.deepEqual(bass.map((e) => e.pitch), number === 15 ? ['C4', 'D4', 'E4', 'D4'] : ['D4', number === 23 ? 'B3' : 'E4']);
    }
  }
});

test('Sagreras 74: el silencio intermedio no retrasa las blancas del compas 12', () => {
  for (const xml of scores(74)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    const events = notes(xml, 12, true);
    assert.equal(new Set(events.map((e) => e.voice)).size, 3);
    for (const pitch of ['A5', 'A3']) {
      assert.deepEqual(events.filter((e) => e.pitch === pitch).map((e) => [e.onset, e.duration]), [[0, 2]]);
    }
    const middle = events.filter((e) => e.voice === '3');
    assert.deepEqual(middle.map((e) => [e.onset, e.duration, e.pitch]),
      [[0, 0.5, 'R'], [0.5, 0.5, 'C5'], [0.5, 0.5, 'E5'], [1, 1, 'C5'], [1, 1, 'E5']]);
  }
});

test('Sagreras 74: las tres alturas de cada acorde conservan sus ligaduras', () => {
  const chords = { 3: ['G#4', 'B4', 'F5'], 13: ['A4', 'D5', 'F5'], 14: ['A4', 'C5', 'E5'] };
  for (const xml of scores(74)) {
    for (const [number, pitches] of Object.entries(chords)) {
      const events = notes(xml, number, true);
      for (const pitch of pitches) {
        const pair = events.filter((e) => e.pitch === pitch && [0.5, 1].includes(e.onset));
        assert.deepEqual(pair.map((e) => [e.onset, e.duration, e.start, e.stop]),
          [[0.5, 0.5, true, false], [1, 0.5, false, true]], `compas ${number}: ${pitch}`);
      }
    }
  }
});

test('Sagreras recuperadas: ninguna voz publicada desborda el compas', () => {
  for (const number of [67, 68, 69, 70, 71, 72, 74, 82]) {
    const beats = number === 67 || number === 72 ? 4 : number === 71 ? 3 : 2;
    for (const xml of scores(number)) {
      const numbers = [...xml.matchAll(/<measure\b[^>]*number="(\d+)"/g)].map((m) => m[1]);
      for (const [i, measure] of numbers.entries()) {
        const events = notes(xml, measure, true);
        const length = Math.max(...events.map((e) => e.onset + e.duration));
        assert.equal(length, number === 71 && i === 0 ? 0.5 : beats, `leccion ${number}, compas ${measure}`);
      }
    }
  }
});

test('Sagreras 56: conserva el cierre del primer sistema y la polifonia del segundo', () => {
  for (const xml of scores(56)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    assert.deepEqual(notes(xml, 8), [[0, 3, 'G4'], [0, 3, 'G3']]);
    const tenth = notes(xml, 10);
    assert.deepEqual(tenth.filter((e) => e[2] === 'E5' || e[2] === 'E4'),
      [[0, 3, 'E5'], [0, 3, 'E4']]);
    for (const pitch of ['G4', 'C5']) {
      assert.deepEqual(tenth.filter((e) => e[2] === pitch), [[1, 1, pitch], [2, 1, pitch]]);
    }
  }
});

test('Sagreras 57: las notas sostenidas no desplazan los ataques de la voz intermedia', () => {
  const expected = {
    2: [[0, 2, 'E5'], [2, 1, 'D5'], [1, 1, 'G4'], [0, 3, 'F4']],
    4: [[0, 2, 'F5'], [2, 1, 'E5'], [1, 1, 'G4'], [0, 2, 'D4'], [2, 1, 'C4']],
    10: [[0, 3, 'G5'], [1, 1, 'G4'], [1, 1, 'C5'], [2, 1, 'G4'], [2, 1, 'C5'], [0, 3, 'E4']],
  };
  const sorted = (events) => [...events].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  for (const xml of scores(57)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    for (const [number, events] of Object.entries(expected)) {
      assert.deepEqual(sorted(notes(xml, number)), sorted(events), `compas ${number}`);
    }
  }
});


test('Sagreras 66: la armadura de sol mayor rige desde el compas 9', () => {
  for (const xml of scores(66)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    const keys = [...xml.matchAll(/<measure\b[^>]*number="(\d+)"[^>]*>([\s\S]*?)<\/measure>/g)]
      .flatMap((m) => [...m[2].matchAll(/<key\b[^>]*>[\s\S]*?<fifths>(-?\d+)<\/fifths>[\s\S]*?<\/key>/g)]
        .map((key) => [Number(m[1]), Number(key[1])]));
    // El exportador tambien incluye la armadura del pentagrama TAB.
    assert.deepEqual([...new Map(keys).entries()], [[1, 0], [9, 1]]);
    assert.ok(notes(xml, 10).some((e) => e[2] === 'F#5'));
    assert.ok(!notes(xml, 10).some((e) => e[2] === 'F5'));
    for (let number = 1; number <= 16; number++) {
      const events = notes(xml, number, true);
      assert.equal(Math.max(...events.map((e) => e.onset + e.duration)), 3, `compas ${number}`);
    }
  }
});

test('Sagreras 83: la armadura de la mayor rige desde el compas 9', () => {
  for (const xml of scores(83)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    const keys = [...xml.matchAll(/<measure\b[^>]*number="(\d+)"[^>]*>([\s\S]*?)<\/measure>/g)]
      .flatMap((m) => [...m[2].matchAll(/<key\b[^>]*>[\s\S]*?<fifths>(-?\d+)<\/fifths>[\s\S]*?<\/key>/g)]
        .map((key) => [Number(m[1]), Number(key[1])]));
    // El exportador tambien incluye la armadura del pentagrama TAB.
    assert.deepEqual([...new Map(keys).entries()], [[1, 2], [9, 3]]);
    assert.ok(notes(xml, 9).some((e) => e[2] === 'G#5'));
    assert.ok(!notes(xml, 9).some((e) => e[2] === 'G5'));
    for (let number = 1; number <= 16; number++) {
      const events = notes(xml, number, true);
      assert.equal(Math.max(...events.map((e) => e.onset + e.duration)), 3, `compas ${number}`);
    }
  }
});

test('Sagreras 82: los compases 3, 4, 11 y 12 conservan tres voces de dos tiempos', () => {
  for (const xml of scores(82)) {
    for (const number of [3, 4, 11, 12]) {
      const events = notes(xml, number, true);
      assert.equal(new Set(events.map((e) => e.voice)).size, 3, `compas ${number}`);
      assert.equal(Math.max(...events.map((e) => e.onset + e.duration)), 2);
      const melody = events.filter((e) => e.voice === '1');
      assert.deepEqual(melody.map((e) => [e.onset, e.duration, e.pitch]),
        number === 3 || number === 11
          ? [[0, 0.5, 'B5'], [0.5, 0.5, 'A5'], [1, 0.5, 'A5'], [1.5, 0.5, 'G#5']]
          : [[0, 2, 'A5']]);
      assert.deepEqual(events.filter((e) => e.pitch === 'F#4').map((e) => [e.onset, e.duration]), [[0, 2]]);
      const middle = events.filter((e) => e.pitch === 'R' || e.pitch === 'B4' || e.pitch === 'D#5');
      assert.deepEqual(middle.map((e) => [e.onset, e.duration, e.pitch]), [[0, 1, 'R'], [1, 1, 'B4'], [1, 1, 'D#5']]);
      assert.equal(new Set(middle.map((e) => e.voice)).size, 1);
    }
  }
});

test('Sagreras 85: melodia, bajos y corcheas conservan tres voces en 3 y 11', () => {
  for (const xml of scores(85)) {
    assert.equal((xml.match(/<measure\b/g) || []).length, 16);
    for (const number of [3, 11]) {
      const events = notes(xml, number, true);
      assert.equal(new Set(events.map((e) => e.voice)).size, 3);
      assert.deepEqual(events.filter((e) => e.voice === '1').map((e) => [e.onset, e.duration, e.pitch]),
        [[0, 1.5, 'F5'], [1.5, 1.5, 'A5']]);
      assert.deepEqual(events.filter((e) => e.voice === '2').map((e) => [e.onset, e.duration, e.pitch]),
        [[0, 1.5, 'D4'], [1.5, 1.5, 'F4']]);
      assert.deepEqual(events.filter((e) => e.voice === '3').map((e) => [e.onset, e.duration, e.pitch]),
        ['R', 'G4', 'B4', 'R', 'G4', 'B4'].map((p, i) => [i / 2, 0.5, p]));
    }
    for (let number = 1; number <= 16; number++) {
      assert.equal(Math.max(...notes(xml, number, true).map((e) => e.onset + e.duration)), 3, `compas ${number}`);
    }
  }
});
