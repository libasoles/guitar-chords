'use strict';

const path = require('path');
const { chordCard, CHORD_CARD_LOADER } = require('./chord-forms');
const { tabFigure, TAB_LOADER } = require('./article-carcassi');
const { modal } = require('./modal');

// Each position sounds three treble strings and one bass. String 1 first.
const GROUPS = [
  ['Do', 'C', 'Major', ['C', 'C/E', 'C/G'], [
    [0, 1, 0, null, 3, null], [0, 1, 0, 2, null, null], [0, 1, 0, null, null, 3],
  ]],
  ['Do', 'C', 'Minor', ['Cm', 'Cm/Eb', 'Cm/G'], [
    [3, 4, 0, null, 3, null], [3, 4, 0, 1, null, null], [3, 4, 0, null, null, 3],
  ]],
  ['Do', 'C', 'Seventh', ['C7', 'C7/E', 'C7/G', 'C7/Bb'], [
    [0, 1, 3, null, 3, null], [0, 1, 3, 2, null, null],
    [0, 1, 3, null, null, 3], [0, 1, 3, null, 1, null],
  ]],
  ['Re', 'D', 'Major', ['D', 'D/F#', 'D/A'], [
    [2, 3, 2, 0, null, null], [2, 3, 2, null, null, 2], [2, 3, 2, null, 0, null],
  ]],
  ['Re', 'D', 'Minor', ['Dm', 'Dm/F', 'Dm/A'], [
    [1, 3, 2, 0, null, null], [1, 3, 2, 3, null, null], [1, 3, 2, null, 0, null],
  ]],
  ['Re', 'D', 'Seventh', ['D7', 'D7/F#', 'D7/A', 'D7/C'], [
    [2, 1, 2, 0, null, null], [2, 1, 2, 4, null, null],
    [2, 1, 2, null, 0, null], [2, 1, 2, null, 3, null],
  ]],
  ['Mi', 'E', 'Major', ['E', 'E/G#', 'E/B'], [
    [0, 0, 1, null, null, 0], [0, 0, 1, null, null, 4], [0, 0, 1, null, 2, null],
  ]],
  ['Mi', 'E', 'Minor', ['Em', 'Em', 'Em/G', 'Em/B'], [
    [0, 0, 0, null, null, 0], [3, 0, 0, null, null, 0],
    [0, 0, 0, null, null, 3], [0, 0, 0, null, 2, null],
  ]],
  ['Mi', 'E', 'Seventh', ['E7', 'E7/B'], [
    [0, 0, 1, null, null, 0], [0, 3, 1, null, 2, null],
  ]],
  ['Fa', 'F', 'Major', ['F', 'F/A', 'F/C'], [
    [1, 1, 2, 3, null, null], [1, 1, 2, null, 0, null], [1, 1, 2, null, 3, null],
  ]],
  ['Fa', 'F', 'Minor', ['Fm', 'Fm/Ab', 'Fm/C'], [
    [1, 1, 1, 3, null, null], [1, 1, 1, null, null, 4], [1, 1, 1, null, 3, null],
  ]],
  ['Fa', 'F', 'Seventh', ['F7', 'F7/A', 'F7/C', 'F7/Eb'], [
    [1, 4, 2, 3, null, null], [1, 4, 2, null, 0, null],
    [1, 4, 2, null, 3, null], [1, 4, 2, 1, null, null],
  ]],
  ['Sol', 'G', 'Major', ['G', 'G/B', 'G/D'], [
    [3, 0, 0, null, null, 3], [3, 0, 0, null, 2, null], [3, 0, 0, 0, null, null],
  ]],
  ['Sol', 'G', 'Minor', ['Gm', 'Gm/Bb', 'Gm/D'], [
    [3, 3, 3, null, null, 3], [3, 3, 3, null, 1, null], [3, 3, 3, 0, null, null],
  ]],
  ['Sol', 'G', 'Seventh', ['G7', 'G7/B', 'G7/D'], [
    [1, 0, 0, null, null, 3], [1, 3, 0, null, 2, null], [1, 0, 0, 0, null, null],
  ]],
  ['La', 'A', 'Major', ['A', 'A/C#', 'A/E'], [
    [0, 2, 2, null, 0, null], [0, 2, 2, null, 4, null], [0, 2, 2, null, null, 0],
  ]],
  ['La', 'A', 'Minor', ['Am', 'Am/C', 'Am/E'], [
    [0, 1, 2, null, 0, null], [0, 1, 2, null, 3, null], [0, 1, 2, null, null, 0],
  ]],
  ['La', 'A', 'Seventh', ['A7', 'A7/C#', 'A7/E', 'A7/G'], [
    [0, 2, 0, null, 0, null], [0, 2, 0, null, 4, null],
    [0, 2, 0, null, null, 0], [0, 2, 0, null, null, 3],
  ]],
  ['Si', 'B', 'Major', ['B', 'B/D#', 'B/F#'], [
    [2, 4, 4, null, 2, null], [2, 4, 4, 1, null, null], [2, 4, 4, null, null, 2],
  ]],
  ['Si', 'B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#'], [
    [2, 3, 4, null, 2, null], [2, 3, 4, 0, null, null], [2, 3, 4, null, null, 2],
  ]],
  ['Si', 'B', 'Seventh', ['B7', 'B7/D#', 'B7/F#'], [
    [2, 0, 2, null, 2, null], [2, 0, 2, 1, null, null], [2, 0, 2, null, null, 2],
  ]],
];

// Suggested left-hand fingers, string 1 first: 0 = open, - = silent.
// Repeated 1s indicate a barre; each diagram uses the exact four-string form.
const FINGERINGS = {
  C: '010-3-', 'C/E': '0102--', 'C/G': '010--3',
  Cm: '230-1-', 'Cm/Eb': '2301--', 'Cm/G': '230--1',
  C7: '014-3-', 'C7/E': '0142--', 'C7/G': '014--3', 'C7/Bb': '014-1-',
  D: '2310--', 'D/F#': '131--1', 'D/A': '231-0-',
  Dm: '1320--', 'Dm/F': '1423--', 'Dm/A': '132-0-',
  D7: '3120--', 'D7/F#': '3124--', 'D7/A': '312-0-', 'D7/C': '312-4-',
  E: '001--0', 'E/G#': '001--4', 'E/B': '001-2-',
  Em: '300--0', 'Em/G': '000--3', 'Em/B': '000-2-',
  E7: '001--0', 'E7/B': '041-2-',
  F: '1123--', 'F/A': '112-0-', 'F/C': '112-3-',
  Fm: '1113--', 'Fm/Ab': '111--4', 'Fm/C': '111-3-',
  F7: '1423--', 'F7/A': '142-0-', 'F7/C': '142-3-', 'F7/Eb': '1421--',
  G: '300--2', 'G/B': '300-1-', 'G/D': '3000--',
  Gm: '111--1', 'Gm/Bb': '333-1-', 'Gm/D': '1110--',
  G7: '100--3', 'G7/B': '140-2-', 'G7/D': '1000--',
  A: '032-0-', 'A/C#': '021-4-', 'A/E': '032--0',
  Am: '012-0-', 'Am/C': '012-3-', 'Am/E': '012--0',
  A7: '020-0-', 'A7/C#': '010-4-', 'A7/E': '020--0', 'A7/G': '010--3',
  B: '143-1-', 'B/D#': '2431--', 'B/F#': '134--1',
  Bm: '124-1-', 'Bm/D': '1240--', 'Bm/F#': '124--1',
  B7: '403-2-', 'B7/D#': '4031--', 'B7/F#': '403--2',
};

function chordPopover(id, name, form, strings) {
  const fingers = form.map(function (fret, string) {
    return [string + 1, fret === null ? 'x' : fret === 0 ? 'o' : fret, fret > 0 ? Number(FINGERINGS[name][string]) || undefined : undefined];
  });
  const label = strings.artChordDiagramLabel + ' ' + name;
  return modal({
    id, label, closeLabel: strings.artArpeggiosClose, className: 'chord-popover',
    content: chordCard({ name, fingers, barres: [], position: 1 }, label),
  });
}

function renderBody(locale, strings) {
  const popovers = [];
  const roots = new Map();
  GROUPS.forEach(function ([es, en, quality, names, forms], group) {
    const title = (locale === 'es' ? es : en) + ' ' + strings['artArpeggios' + quality];
    // The names sit above the white sheet, one per chord column, as buttons.
    const buttons = names.map(function (name, i) {
      const id = 'arpeggio-chord-' + group + '-' + i;
      popovers.push(chordPopover(id, name, forms[i], strings));
      return '<button type="button" class="arpeggio-chord" popovertarget="' + id + '" aria-label="' + strings.artArpeggiosShowFingering + ' ' + name + '">' + name + '</button>';
    });
    const styledForms = forms.map(function (form) {
      return form.map(function (fret, string) {
        return fret === null ? null : { fret, bold: string >= 3 };
      });
    });
    if (!roots.has(en)) roots.set(en, { title: locale === 'es' ? es : en, variants: [] });
    roots.get(en).variants.push({ title: strings['artArpeggios' + quality], figure: tabFigure(title, styledForms, locale, buttons, null, true) });
  });
  const tabs = Array.from(roots, function ([root, { title, variants }]) {
    const id = 'arpeggio-' + root;
    return '<section class="arpeggio-group" aria-label="' + title + '">' +
      '<div class="arpeggio-group-header"><span class="arpeggio-root" id="' + id + '-root">' + title + '</span>' +
      '<div role="tablist" aria-labelledby="' + id + '-root">' + variants.map(function (variant, i) {
        return '<button type="button" role="tab" id="' + id + '-tab-' + i + '" aria-controls="' + id + '-panel-' + i +
          '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '">' + variant.title + '</button>';
      }).join('') + '</div></div>' + variants.map(function (variant, i) {
        return '<div role="tabpanel" id="' + id + '-panel-' + i + '" aria-labelledby="' + id + '-tab-' + i +
          '" tabindex="0"' + (i === 0 ? '' : ' hidden') + '>' + variant.figure + '</div>';
      }).join('') + '</section>';
  });
  return '<p>' + strings.artArpeggiosIntro + '</p><div class="sequence-forms">' +
    tabs.join('') + '</div>' + popovers.join('') + CHORD_CARD_LOADER + TAB_LOADER + QUALITY_TABS_LOADER;
}

// Each root keeps its own selection. Arrow keys follow the horizontal tab pattern.
const QUALITY_TABS_LOADER = `<script>
document.querySelectorAll('.arpeggio-group').forEach(function(group) {
  var tabs = Array.from(group.querySelectorAll('[role="tab"]'));
  function select(tab) {
    tabs.forEach(function(item) {
      var selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
  }
  tabs.forEach(function(tab, index) {
    tab.addEventListener('click', function() { select(tab); });
    tab.addEventListener('keydown', function(event) {
      var next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(tabs[next]);
      tabs[next].focus();
    });
  });
});
</script>`;

function cardImage() {
  return {
    src: path.join(__dirname, '../../src/site/articles/arpeggios/preview.svg'),
    name: 'preview.svg',
    url: '/assets/articles/arpeggios/preview.svg',
  };
}

module.exports = { renderBody, cardImage };
