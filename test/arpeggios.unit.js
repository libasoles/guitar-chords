'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { renderBody, GROUPS } = require('../scripts/lib/article-arpeggios');

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const OPEN = [64, 59, 55, 50, 45, 40];

function pitchClass(note) {
  const alteration = [...note.slice(1)].reduce((sum, accidental) => sum + (accidental === '#' ? 1 : -1), 0);
  return (PITCH[note[0]] + alteration + 12) % 12;
}

function sounding(form) {
  return form.map((fret, string) => fret === null ? null : OPEN[string] + fret).filter((pitch) => pitch !== null);
}

test('every catalogued form contains every advertised chord tone and the named bass', () => {
  const qualities = {
    Major: [0, 4, 7], Minor: [0, 3, 7], Seventh: [0, 4, 7, 10],
    MinorSeventh: [0, 3, 7, 10], MajorSeventh: [0, 4, 7, 11],
    Diminished: [0, 3, 6], SeventhNoFifth: [0, 4, 10],
  };
  const failures = [];
  for (const [, root, quality, names, forms] of GROUPS) {
    if (root === 'Dim7') continue; // Symmetric sets have their own exhaustive test below.
    forms.forEach((form, i) => {
      const pitches = sounding(form);
      const intervals = [...new Set(pitches.map((pitch) => (pitch - pitchClass(root) + 12) % 12))].sort((a, b) => a - b);
      if (JSON.stringify(intervals) !== JSON.stringify(qualities[quality])) {
        failures.push(names[i] + ' ' + JSON.stringify(form) + ': ' + intervals + ' expected ' + qualities[quality]);
      }
      assert.equal(pitches.length, 4, names[i] + ' sounds four strings');
      assert.equal(Math.min(...pitches) % 12, pitchClass(names[i].split('/')[1] || root), names[i] + ' bass');
    });
  }
  assert.deepEqual(failures, [], 'incomplete or foreign chord tones');
});

test('every form has fingering for its exact frets and silent strings', () => {
  for (const [, , , names, forms, fingerings] of GROUPS) {
    forms.forEach((form, i) => {
      form.forEach((fret, string) => assert.match(fingerings[i][string], fret === null ? /^-$/ : fret === 0 ? /^0$/ : /^[1-4]$/, names[i] + ' string ' + (string + 1)));
    });
  }
});

test('catalogue exhausts open strings through fret 4 on both treble layouts', () => {
  const qualities = {
    Major: [0, 4, 7], Minor: [0, 3, 7], Seventh: [0, 4, 7, 10],
    MinorSeventh: [0, 3, 7, 10], MajorSeventh: [0, 4, 7, 11],
    Diminished: [0, 3, 6], SeventhNoFifth: [0, 4, 10],
  };
  // Enumerate independently of the production generator, including invalid
  // chords. Every candidate satisfying the musical contract must be present.
  const candidates = [];
  for (const strings of [[0, 1, 2, 3], [0, 1, 2, 4], [0, 1, 2, 5], [1, 2, 3, 4], [1, 2, 3, 5]]) {
    for (let encoded = 0; encoded < 625; encoded++) {
      let value = encoded;
      const form = Array(6).fill(null);
      for (const string of strings) { form[string] = value % 5; value = Math.floor(value / 5); }
      candidates.push({ form, tones: [...new Set(sounding(form).map((pitch) => pitch % 12))].sort((a, b) => a - b) });
    }
  }
  for (const [, root, quality, names, forms] of GROUPS) {
    const symmetric = root === 'Dim7';
    const rootPitch = pitchClass(symmetric ? names[0].replace(/dim7$/, '') : root);
    const tones = (symmetric ? [0, 3, 6, 9] : qualities[quality]).map((interval) => (rootPitch + interval) % 12).sort((a, b) => a - b);
    const existing = new Set(forms.map(JSON.stringify));
    assert.equal(existing.size, forms.length, root + ' ' + quality + ' no duplicates');
    for (const candidate of candidates) {
      if (JSON.stringify(candidate.tones) !== JSON.stringify(tones)) continue;
      assert.ok(existing.has(JSON.stringify(candidate.form)), root + ' ' + quality + ' missing ' + JSON.stringify(candidate.form));
    }
  }
});

test('generated fingerings never use a finger on different frets or barre across an open string', () => {
  const { firstPositionForms } = require('../scripts/lib/article-arpeggio-positions');
  for (const [, root, quality, names] of GROUPS) {
    const generatorRoot = root === 'Dim7' ? names[0].replace(/dim7$/, '') : root;
    for (const position of firstPositionForms(generatorRoot, quality)) {
      for (const finger of '1234') {
        const strings = [...position.fingering].flatMap((value, string) => value === finger ? [string] : []);
        if (!strings.length) continue;
        const fret = position.form[strings[0]];
        assert.ok(fret >= 1 && fret <= 4, position.name);
        assert.ok(strings.every((string) => position.form[string] === fret), position.name + ' same finger, same fret');
        assert.ok(position.form.slice(strings[0], strings.at(-1) + 1).every((value) => value === null || value >= fret), position.name + ' playable barre');
      }
    }
  }
});

for (const locale of ['es', 'en']) {
  test('requested middle-string forms appear with correct names, blocks and diagrams in ' + locale, () => {
    const html = renderBody(locale, require('../src/i18n/strings.' + locale + '.json'));
    const search = JSON.parse(html.match(/id="arpeggio-search-data">([^<]+)/)[1]);
    for (const [root, quality, name, form] of [
      ['B', 'MinorSeventh', 'Bm7/F#', [null, 0, 2, 0, null, 2]],
      ['E', 'SeventhNoFifth', 'E7', [null, 3, 1, 2, null, 0]],
      ['E', 'Seventh', 'E7/B', [null, 3, 1, 2, 2, null]],
    ]) {
      const group = GROUPS.find((group) => group[1] === root && group[2] === quality);
      const index = group[4].findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(form));
      assert.ok(index >= 0, name);
      assert.equal(group[3][index], name);
      const chord = search.roots.find((item) => item.id === 'arpeggio-' + root).chords.find((item) => item.name === name && JSON.stringify(item.form) === JSON.stringify(form));
      assert.ok(chord, name + ' indexed');
      const popup = html.split('id="' + chord.popover + '"')[1].split('</div></div>')[0];
      const diagram = JSON.parse(popup.match(/data-chord="([^"]+)"/)[1].replaceAll('&quot;', '"'));
      assert.deepEqual(diagram.fingers.map(([, fret]) => fret === 'x' ? null : fret === 'o' ? 0 : fret), form);
    }
  });
}

for (const locale of ['es', 'en']) {
  test('accidental roots offer every chord quality in tabs, diagrams and search in ' + locale, () => {
    const strings = require('../src/i18n/strings.' + locale + '.json');
    const html = renderBody(locale, strings);
    const search = JSON.parse(html.match(/id="arpeggio-search-data">([^<]+)/)[1]);
    const qualities = {
      Major: [0, 4, 7], Minor: [0, 3, 7], Seventh: [0, 4, 7, 10],
      MinorSeventh: [0, 3, 7, 10], MajorSeventh: [0, 4, 7, 11], Diminished: [0, 3, 6],
    };
    for (const root of ['Db', 'Eb', 'F#', 'Ab', 'Bb']) {
      const section = html.split('<section').find((part) => part.includes('id="arpeggio-' + root + '-root"')).split('</section>')[0];
      const indexed = search.roots.find((item) => item.id === 'arpeggio-' + root).chords;
      const annotations = [...section.matchAll(/data-annotations="([^"]+)"/g)].flatMap((match) =>
        JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&amp;', '&')).flat());
      for (const [quality, tones] of Object.entries(qualities)) {
        assert.ok(section.includes('>' + strings['artArpeggios' + quality] + '</button>'), root + ' ' + quality + ' tab');
        const group = GROUPS.find(([, name, variant]) => name === root && variant === quality);
        assert.ok(group, root + ' ' + quality + ' forms');
        const [, , , names, forms, fingerings] = group;
        assert.ok(forms.length >= (quality === 'Seventh' ? 2 : 3), root + ' ' + quality + ' positions');
        for (let i = 0; i < forms.length; i++) {
          const form = forms[i];
          const pitches = sounding(form);
          assert.equal(pitches.length, 4, names[i]);
          for (const pitch of pitches) assert.ok(tones.includes((pitch - pitchClass(root) + 12) % 12), names[i] + ' chord tones');
          assert.equal(Math.min(...pitches) % 12, pitchClass(names[i].split('/')[1] || root), names[i] + ' bass');
          const fretted = form.filter((fret) => fret > 0);
          assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, names[i] + ' fits within four frets');
          form.forEach((fret, string) => assert.match(fingerings[i][string], fret === null ? /^-$/ : fret === 0 ? /^0$/ : /^[1-4]$/, names[i] + ' fingering'));
          const chord = indexed.find((chord) => chord.name === names[i] && JSON.stringify(chord.form) === JSON.stringify(form));
          assert.ok(chord, names[i] + ' indexed');
          assert.ok(annotations.some((annotation) => annotation.text === names[i] && annotation.html.includes('popovertarget="' + chord.popover + '"')), names[i] + ' tab annotation');
          const popup = html.split('id="' + chord.popover + '"')[1].split('</div></div>')[0];
          const diagram = JSON.parse(popup.match(/data-chord="([^"]+)"/)[1].replaceAll('&quot;', '"'));
          assert.deepEqual(diagram.fingers.map(([, fret]) => fret === 'x' ? null : fret === 'o' ? 0 : fret), form);
        }
      }
    }
  });
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
    const columns = JSON.parse(panel.match(/data-value='([^']+)'/)[1]).flat();
    const forms = columns.filter((column) => column.some((note) => note !== null))
      .map((column) => column.map((note) => note === null ? null : note.fret));
    for (const form of [[5, 4, 4, null, null, 2], [null, 0, 2, 1, null, 2]]) {
      assert.ok(forms.some((candidate) => JSON.stringify(candidate) === JSON.stringify(form)), 'B7/F# includes ' + JSON.stringify(form));
      const index = forms.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(form));
      const annotations = JSON.parse(panel.match(/data-annotations="([^"]+)"/)[1].replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&amp;', '&')).flat();
      const annotation = annotations[index];
      assert.equal(annotation.text, 'B7/F#');
      const id = annotation.html.match(/popovertarget="([^"]+)"/)[1];
      const modal = html.split('id="' + id + '"')[1].split('</div></div>')[0];
      const chord = JSON.parse(modal.match(/data-chord="([^"]+)"/)[1].replaceAll('&quot;', '"'));
      assert.deepEqual(chord.fingers.map(([, fret]) => fret === 'x' ? null : fret === 'o' ? 0 : fret), form);
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

test('popup note labels match every exact voicing and leave silent strings empty', () => {
  const html = renderBody('es', require('../src/i18n/strings.es.json'));
  const chords = [...html.matchAll(/data-chord="([^"]+)"/g)].map((match) => JSON.parse(match[1].replaceAll('&quot;', '"')));
  assert.equal(chords.length, GROUPS.reduce((count, group) => count + group[3].length, 0));
  for (const chord of chords) {
    assert.equal(chord.stringNotes.length, 6);
    chord.fingers.forEach(([string, fret]) => {
      const note = chord.stringNotes[string - 1];
      if (fret === 'x') { assert.equal(note, ''); return; }
      assert.match(note, /^[A-G][♯♭]*$/, chord.name);
      const alteration = [...note.slice(1)].reduce((sum, accidental) => sum + (accidental === '♯' ? 1 : -1), 0);
      assert.equal((PITCH[note[0]] + alteration + 12) % 12, (OPEN[string - 1] + (fret === 'o' ? 0 : fret)) % 12, chord.name + ' string ' + string);
    });
  }
  assert.deepEqual(chords.find((chord) => chord.name === 'Cm').stringNotes, ['G', 'E♭', 'G', '', 'C', '']);
  assert.deepEqual(chords.find((chord) => chord.name === 'D/F#').stringNotes, ['F♯', 'D', 'A', '', '', 'F♯']);
});


test('dominant sevenths without fifths cover all 12 roots and all three bass tones', () => {
  const groups = GROUPS.filter(([, , quality]) => quality === 'SeventhNoFifth');
  assert.equal(groups.length, 12);
  assert.equal(new Set(groups.map(([, root]) => pitchClass(root))).size, 12);
  for (const [, rootName, , names, forms, fingerings] of groups) {
    const root = pitchClass(rootName);
    const basses = [];
    forms.forEach((form, i) => {
      const pitches = sounding(form);
      assert.equal(pitches.length, 4);
      const treble = form[0] === null ? 1 : 0;
      assert.ok(form.slice(treble, treble + 3).every((fret) => fret !== null), 'three consecutive treble strings');
      assert.equal(form.slice(treble + 3).filter((fret) => fret !== null).length, 1, 'one bass string');
      const intervals = (notes) => [...new Set(notes.map((pitch) => (pitch - root + 12) % 12))].sort((a, b) => a - b);
      assert.deepEqual(intervals(pitches), [0, 4, 10], names[i] + ' contains root, major third and minor seventh only');
      const bass = Math.min(...pitches) % 12;
      assert.equal(bass, pitchClass(names[i].split('/')[1] || rootName));
      basses.push((bass - root + 12) % 12);
      form.forEach((fret, string) => {
        if (fret > 0) assert.match(fingerings[i][string], /^[1-4]$/, names[i] + ' has fingering');
      });
    });
    assert.deepEqual([...new Set(basses)].sort((a, b) => a - b), [0, 4, 10]);
    assert.equal(new Set(forms.map(JSON.stringify)).size, forms.length, rootName + ' has no duplicate forms');
  }
});

for (const locale of ['es', 'en']) {
  test('no-fifth blocks share the seventh tab and appear in search in ' + locale, () => {
    const strings = require('../src/i18n/strings.' + locale + '.json');
    const html = renderBody(locale, strings);
    const search = JSON.parse(html.match(/id="arpeggio-search-data">([^<]+)/)[1]);
    for (const [, root, , names, forms] of GROUPS.filter(([, , quality]) => quality === 'SeventhNoFifth')) {
      const section = html.split('<section').find((part) => part.includes('id="arpeggio-' + root + '-root"')).split('</section>')[0];
      assert.ok(!section.includes('>' + strings.artArpeggiosSeventhNoFifth + '</button>'), 'no separate tab');
      const panel = section.split('<div role="tabpanel"').find((part) => part.includes('arpeggio-block-label'));
      assert.ok(panel.includes('>' + strings.artArpeggiosSeventhNoFifth + '</h3>'));
      const tabId = panel.match(/aria-labelledby="([^"]+)"/)[1];
      assert.ok(section.includes('id="' + tabId + '"'));
      assert.match(section.split('id="' + tabId + '"')[1].split('</button>')[0], />7$/);
      const indexed = search.roots.find((item) => item.id === 'arpeggio-' + root).chords;
      forms.forEach((form, i) => assert.ok(indexed.some((chord) => chord.name === names[i] && JSON.stringify(chord.form) === JSON.stringify(form))));
    }
  });
}


test('middle-string voicings cover major, minor and dominant chords with the named bass', () => {
  for (const rootName of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
    for (const quality of ['Major', 'Minor', 'Seventh']) {
      const [, , , names, forms, fingerings] = GROUPS.find(([, root, variant]) => root === rootName && variant === quality);
      const variants = forms.map((form, i) => ({ form, name: names[i], fingering: fingerings[i] }))
        .filter(({ form, name }) => form[0] === null && (quality !== 'Seventh' || name === rootName + '7'));
      assert.ok(variants.length >= (quality === 'Seventh' ? 1 : 3), rootName + ' ' + quality);
      for (const { form, name, fingering } of variants) {
        assert.ok(form.slice(1, 4).every((fret) => fret !== null));
        assert.equal(form.slice(4).filter((fret) => fret !== null).length, 1);
        const pitches = sounding(form);
        const intervals = [...new Set(pitches.map((pitch) => (pitch - pitchClass(rootName) + 12) % 12))].sort((a, b) => a - b);
        assert.deepEqual(intervals, quality === 'Minor' ? [0, 3, 7] : quality === 'Seventh' ? [0, 4, 7, 10] : [0, 4, 7], name);
        assert.equal(Math.min(...pitches) % 12, pitchClass(name.split('/')[1] || rootName), name + ' bass');
        form.forEach((fret, string) => {
          assert.match(fingering[string], fret === null ? /^-$/ : fret === 0 ? /^0$/ : /^[1-4]$/, name + ' string ' + (string + 1));
        });
      }
    }
  }
});

for (const locale of ['es', 'en']) {
  test('middle-string G appears in tabs, diagrams and search with only its bass emphasized in ' + locale, () => {
    const html = renderBody(locale, require('../src/i18n/strings.' + locale + '.json'));
    const search = JSON.parse(html.match(/id="arpeggio-search-data">([^<]+)/)[1]);
    const form = [null, 0, 0, 0, null, 3];
    const chord = search.roots.find((root) => root.id === 'arpeggio-G').chords
      .find((chord) => chord.name === 'G' && JSON.stringify(chord.form) === JSON.stringify(form));
    assert.ok(chord);
    const panel = html.split('id="arpeggio-G-panel-0"')[1].split('</figure>')[0];
    const columns = JSON.parse(panel.match(/data-value='([^']+)'/)[1]).flat();
    const column = columns.find((column) => JSON.stringify(column.map((note) => note === null ? null : note.fret)) === JSON.stringify(form));
    assert.ok(column);
    assert.deepEqual(column.map((note) => note?.bold || false), [false, false, false, false, false, true]);
    const popup = html.split('id="' + chord.popover + '"')[1].split('</div></div>')[0];
    const diagram = JSON.parse(popup.match(/data-chord="([^"]+)"/)[1].replaceAll('&quot;', '"'));
    assert.deepEqual(diagram.fingers.map(([, fret]) => fret === 'x' ? null : fret === 'o' ? 0 : fret), form);
    assert.deepEqual(diagram.stringNotes, ['', 'B', 'G', 'D', '', 'G']);
  });
}

test('standard dominant seventh blocks never contain voicings without the fifth', () => {
  for (const [, root, quality, names, forms] of GROUPS) {
    if (quality !== 'Seventh') continue;
    forms.forEach((form, i) => assert.ok(
      sounding(form).some((pitch) => (pitch - pitchClass(root) + 12) % 12 === 7),
      root + ': ' + names[i] + ' ' + JSON.stringify(form) + ' belongs only in the no-fifth block',
    ));
  }
});

test('every quality groups root positions before inversions across all keys', () => {
  for (const [, root, quality, names] of GROUPS) {
    if (root === 'Dim7') continue;
    const bassOrder = names.map((name) => name.includes('/') ? (pitchClass(name.split('/')[1]) - pitchClass(root) + 12) % 12 : 0);
    assert.deepEqual(bassOrder, [...bassOrder].sort((a, b) => a - b), root + ' ' + quality + ': ' + names.join(', '));
  }
});

for (const locale of ['es', 'en']) {
  test('G7 without D appears only once, below the no-fifth heading in ' + locale, () => {
    const html = renderBody(locale, require('../src/i18n/strings.' + locale + '.json'));
    const section = html.split('<section').find((part) => part.includes('id="arpeggio-G-root"')).split('</section>')[0];
    const figures = [...section.matchAll(/data-value='([^']+)'/g)]
      .map((match) => JSON.parse(match[1]).flat().map((column) => column.map((note) => note === null ? null : note.fret)));
    const form = [1, 0, 0, null, null, 3];
    assert.equal(figures.flat().filter((candidate) => JSON.stringify(candidate) === JSON.stringify(form)).length, 1);
    const [, , , names, forms] = GROUPS.find(([, root, quality]) => root === 'G' && quality === 'Seventh');
    for (const name of ['G7', 'G7/B', 'G7/D']) assert.ok(names.includes(name));
    assert.deepEqual(forms[0], [null, 3, 4, 3, null, 3]);
    const lowerBlock = section.split('arpeggio-block-label')[1];
    const lowerForms = JSON.parse(lowerBlock.match(/data-value='([^']+)'/)[1]).flat();
    assert.ok(lowerForms.some((column) => JSON.stringify(column.map((note) => note === null ? null : note.fret)) === JSON.stringify(form)));
  });
}

for (const locale of ['es', 'en']) {
  test('default arpeggios split into staves of at most six chords in ' + locale, () => {
    const html = renderBody(locale, require('../src/i18n/strings.' + locale + '.json'));
    const tabs = [...html.matchAll(/<ascii-tabs[^>]*data-annotations="([^"]+)"[^>]*data-value='([^']+)'/g)];
    assert.equal(tabs.length, GROUPS.length);
    tabs.forEach((match) => {
      const annotations = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&amp;', '&'));
      const group = GROUPS[Number(annotations[0][0].html.match(/arpeggio-chord-(\d+)-/)[1])];
      const staves = JSON.parse(match[2]);
      const forms = staves.map((staff) => staff.filter((column) => column.some((note) => note !== null)));
      assert.ok(forms.every((staff) => staff.length <= 6), group[1] + ' ' + group[2]);
      assert.deepEqual(forms.flat().map((form) => form.map((note) => note === null ? null : note.fret)), group[4]);
      assert.deepEqual(annotations.flat().map((entry) => entry.text), group[3]);
      annotations.forEach((row, i) => row.forEach((entry, j) => {
        assert.equal(entry.column, j * 2);
        assert.ok(staves[i][entry.column].some((note) => note !== null));
      }));
    });
  });
}
