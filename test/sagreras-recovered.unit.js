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
function notes(xml, number) {
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
    if (step) result.push([onset, duration, step + (alter === 1 ? '#' : alter === -1 ? 'b' : '') + octave]);
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
