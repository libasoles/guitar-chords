'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { renderBody } = require('../scripts/lib/article-arpeggios');

for (const locale of ['es', 'en']) {
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
