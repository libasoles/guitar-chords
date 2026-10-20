'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { renderBody, GROUPS } = require('../scripts/lib/article-arpeggios');

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const OPEN = [64, 59, 55, 50, 45, 40];

function pitchClass(note) {
  return (PITCH[note[0]] + (note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0) + 12) % 12;
}

function sounding(form) {
  return form.map((fret, string) => fret === null ? null : OPEN[string] + fret).filter((pitch) => pitch !== null);
}

test('diminished positions use only the chord tones and are named by their bass', () => {
  for (const [, , quality, names, forms] of GROUPS.filter(([, , quality]) => quality === 'Diminished')) {
    names.forEach((name, i) => {
      const [chord, bass = chord.replace(/dim$/, '')] = name.split('/');
      const root = pitchClass(chord.replace(/dim$/, ''));
      const pitches = sounding(forms[i]);
      assert.equal(pitches.length, 4, name + ' sounds four strings');
      pitches.forEach((pitch) => assert.ok([0, 3, 6].includes((pitch - root + 12) % 12), name + ' only has dim triad tones'));
      assert.equal(Math.min(...pitches) % 12, pitchClass(bass), name + ' bass');
    });
  }
});

test('diminished seventh positions hold all four tones of their set and are named by their bass', () => {
  const sets = GROUPS.filter(([, en]) => en === 'Dim7');
  assert.equal(sets.length, 3);
  for (const [, , , names, forms] of sets) {
    const root = pitchClass(names[0].replace(/dim7$/, ''));
    names.forEach((name, i) => {
      const pitches = sounding(forms[i]);
      assert.equal(pitches.length, 4, name + ' sounds four strings');
      assert.deepEqual([...new Set(pitches.map((pitch) => (pitch - root + 12) % 12))].sort((a, b) => a - b), [0, 3, 6, 9], name + ' tones');
      assert.equal(Math.min(...pitches) % 12, pitchClass(name.replace(/dim7$/, '')), name + ' bass');
    });
  }
});

for (const locale of ['es', 'en']) {
  test('arpeggios keep both B7/F# voicings with their exact diagrams in ' + locale, () => {
    const html = renderBody(locale, require('../src/i18n/strings.' + locale + '.json'));
    const panel = html.split('id="arpeggio-B-panel-2"')[1].split('</figure>')[0];
    const columns = JSON.parse(panel.match(/data-value='([^']+)'/)[1])[0];
    const forms = columns.filter((column) => column.some((note) => note !== null))
      .map((column) => column.map((note) => note === null ? null : note.fret));
    for (const form of [[2, 4, 2, null, null, 2], [null, 4, 2, 4, null, 2]]) {
      assert.ok(forms.some((candidate) => JSON.stringify(candidate) === JSON.stringify(form)), 'B7/F# includes ' + JSON.stringify(form));
      const index = forms.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(form));
      const annotations = JSON.parse(panel.match(/data-annotations="([^"]+)"/)[1].replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&amp;', '&'))[0];
      const annotation = annotations[index];
      assert.equal(annotation.text, 'B7/F#');
      const id = annotation.html.match(/popovertarget="([^"]+)"/)[1];
      const modal = html.split('id="' + id + '"')[1].split('</div></div>')[0];
      const chord = JSON.parse(modal.match(/data-chord="([^"]+)"/)[1].replaceAll('&quot;', '"'));
      assert.deepEqual(chord.fingers.map(([, fret]) => fret === 'x' ? null : fret), form);
      chord.fingers.forEach(([, fret, finger]) => {
        if (typeof fret === 'number' && fret > 0) assert.ok(finger >= 1 && finger <= 4, 'fretted notes have a finger');
      });
    }
  });

  test('arpeggios include the added minor and seventh variants in ' + locale, () => {
    const strings = require('../src/i18n/strings.' + locale + '.json');
    const html = renderBody(locale, strings);
    for (const [root, quality, names] of [
      ['F', 'Minor', ['Fm', 'Fm/Ab', 'Fm/C']],
      ['F', 'Seventh', ['F7', 'F7/A', 'F7/C', 'F7/Eb']],
      ['G', 'Minor', ['Gm', 'Gm/Bb', 'Gm/D']],
      ['A', 'Seventh', ['A7', 'A7/C#', 'A7/E', 'A7/G']],
      ['B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#']],
      ['C', 'MajorSeventh', ['Cmaj7', 'Cmaj7/E', 'Cmaj7/G', 'Cmaj7/B']],
    ]) {
      const section = html.split('<section').find((part) => part.includes('id="arpeggio-' + root + '-root"'))?.split('</section>')[0];
      assert.ok(section, root + ' group exists');
      assert.ok(section.includes('>' + strings['artArpeggios' + quality] + '</button>'), root + ' ' + quality + ' tab exists');
      // The names are ascii-tabs annotations, serialised in the data-annotations attribute.
      for (const name of names) assert.ok(section.includes('&quot;text&quot;:&quot;' + name + '&quot;'), name + ' position exists');
    }
  });
}
