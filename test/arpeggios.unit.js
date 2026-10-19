'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { renderBody } = require('../scripts/lib/article-arpeggios');

for (const locale of ['es', 'en']) {
  test('arpeggios include F minor, F seventh and G minor in ' + locale, () => {
    const strings = require('../src/i18n/strings.' + locale + '.json');
    const html = renderBody(locale, strings);
    for (const [root, quality, names] of [
      ['F', 'Minor', ['Fm', 'Fm/Ab', 'Fm/C']],
      ['F', 'Seventh', ['F7', 'F7/A', 'F7/C', 'F7/Eb']],
      ['G', 'Minor', ['Gm', 'Gm/Bb', 'Gm/D']],
    ]) {
      const section = html.split('<section').find((part) => part.includes('id="arpeggio-' + root + '-root"'))?.split('</section>')[0];
      assert.ok(section, root + ' group exists');
      assert.ok(section.includes('>' + strings['artArpeggios' + quality] + '</button>'), root + ' ' + quality + ' tab exists');
      for (const name of names) assert.ok(section.includes('>' + name + '</button>'), name + ' position exists');
    }
  });
}
