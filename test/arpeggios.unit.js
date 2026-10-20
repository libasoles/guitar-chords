'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { renderBody } = require('../scripts/lib/article-arpeggios');

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
