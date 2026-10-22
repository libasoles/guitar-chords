const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Vals 2, compás 17: el re sostenido sigue al acorde de sol', () => {
  for (const file of [
    'scripts/carcassi-valses/corrected/waltz-02.musicxml',
    'downloads/carcassi-valses/Waltz 2 in C Major - Matteo Carcassi.musicxml',
  ]) {
    const xml = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const bar = xml.match(/<measure\b[^>]*number="17"[^>]*>([\s\S]*?)<\/measure>/)[1];
    const notes = [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)]
      .map((m) => m[1]).filter((n) => !/<staff>2<\/staff>/.test(n));
    for (const note of notes) assert.match(note, /<voice>1<\/voice>/, file);
    assert.equal(notes.length, 4, file);
    const attacks = [];
    for (const note of notes) {
      const pitch = note.match(/<step>(.*?)<\/step>/)[1]
        + (/<alter>1<\/alter>/.test(note) ? '#' : '')
        + note.match(/<octave>(.*?)<\/octave>/)[1];
      if (/<chord\s*\//.test(note)) attacks.at(-1).push(pitch);
      else attacks.push([pitch]);
      assert.match(note, attacks.length === 1 ? /<type>quarter<\/type>/ : /<type>eighth<\/type>/, file);
    }
    assert.deepEqual(attacks, [['G3', 'G4', 'D5'], ['D#5']], file);
    if (file.startsWith('downloads/')) {
      const tabs = [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)]
        .map((m) => m[1]).filter((n) => /<staff>2<\/staff>/.test(n));
      const shapes = [];
      for (const note of tabs) {
        if (!/<chord\s*\//.test(note)) shapes.push(Array(6).fill(null));
        shapes.at(-1)[Number(note.match(/<string>(.*?)<\/string>/)[1]) - 1]
          = Number(note.match(/<fret>(.*?)<\/fret>/)[1]);
      }
      assert.deepEqual(shapes, [[null, 3, 0, null, null, 3], [null, 4, null, null, null, null]], file);
    }
  }
});

test('Vals 5, compás 16: mi en primera cuerda al aire mantiene la posición', () => {
  const xml = fs.readFileSync(path.join(__dirname, '../downloads/carcassi-valses/Waltz 5 in D Major - Matteo Carcassi.musicxml'), 'utf8');
  const bar = xml.match(/<measure\b[^>]*number="16"[^>]*>([\s\S]*?)<\/measure>/)[1];
  const notes = [...bar.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)]
    .map((m) => m[1]).filter((n) => /<staff>2<\/staff>/.test(n) && /<pitch>/.test(n));
  const melody = notes.filter((n) => /<voice>1<\/voice>/.test(n) && !/<chord\s*\//.test(n));
  assert.deepEqual(melody.map((n) => [
    Number(n.match(/<string>(.*?)<\/string>/)[1]),
    Number(n.match(/<fret>(.*?)<\/fret>/)[1]),
  ]), [[1, 0], [1, 2], [1, 0], [2, 3], [3, 4]]);
});
