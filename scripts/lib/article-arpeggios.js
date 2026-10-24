'use strict';

const path = require('path');
const { chordCard, CHORD_CARD_LOADER } = require('./chord-forms');
const { tabFigure, TAB_LOADER } = require('./article-carcassi');
const { modal } = require('./modal');

// Each position sounds four strings, including one bass. String 1 first.
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
  ['Do', 'C', 'MinorSeventh', ['Cm7', 'Cm7/Eb', 'Cm7/G', 'Cm7/Bb'], [
    [3, 4, 3, null, 3, null],
    [3, 4, 3, 1, null, null],
    [3, 4, 3, null, null, 3],
    [3, 4, 3, null, 1, null],
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
  ['Re', 'D', 'MinorSeventh', ['Dm7', 'Dm7/F', 'Dm7/A', 'Dm7/C'], [
    [1, 1, 2, 0, null, null],
    [1, 1, 2, 3, null, null],
    [1, 1, 2, null, 0, null],
    [1, 1, 2, null, 3, null],
  ]],
  ['Mi', 'E', 'Major', ['E', 'E/G#', 'E/B'], [
    [0, 0, 1, null, null, 0], [0, 0, 1, null, null, 4], [0, 0, 1, null, 2, null],
  ]],
  ['Mi', 'E', 'Minor', ['Em', 'Em', 'Em', 'Em/G', 'Em/B'], [
    [0, 0, 0, null, null, 0], [3, 0, 0, null, null, 0],
    [3, 0, 0, 2, null, null],
    [0, 0, 0, null, null, 3], [0, 0, 0, null, 2, null],
  ]],
  ['Mi', 'E', 'Seventh', ['E7', 'E7/B'], [
    [0, 3, 1, null, null, 0], [0, 3, 1, null, 2, null],
  ]],
  ['Mi', 'E', 'MinorSeventh', ['Em7', 'Em7/G', 'Em7/B', 'Em7/D'], [
    [3, 3, 4, null, null, 0],
    [3, 3, 4, null, null, 3],
    [3, 3, 4, null, 2, null],
    [3, 3, 4, 0, null, null],
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
  ['Fa', 'F', 'MinorSeventh', ['Fm7', 'Fm7/Ab', 'Fm7/C', 'Fm7/Eb'], [
    [4, 4, 5, 3, null, null],
    [4, 4, 5, null, null, 4],
    [4, 4, 5, null, 3, null],
    [4, 4, 5, 1, null, null],
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
  ['Sol', 'G', 'MinorSeventh', ['Gm7', 'Gm7/Bb', 'Gm7/D', 'Gm7/F'], [
    [1, 3, 3, null, null, 3],
    [1, 3, 3, null, 1, null],
    [1, 3, 3, 0, null, null],
    [1, 3, 3, 3, null, null],
  ]],
  ['La', 'A', 'Major', ['A', 'A/C#', 'A/E'], [
    [0, 2, 2, null, 0, null], [0, 2, 2, null, 4, null], [0, 2, 2, null, null, 0],
  ]],
  ['La', 'A', 'Minor', ['Am', 'Am/C', 'Am/E'], [
    [0, 1, 2, null, 0, null], [0, 1, 2, null, 3, null], [0, 1, 2, null, null, 0],
  ]],
  ['La', 'A', 'Seventh', ['A7', 'A7', 'A7/C#', 'A7/E', 'A7/G'], [
    [0, 2, 0, null, 0, null], [3, 2, 0, null, 0, null], [0, 2, 0, null, 4, null],
    [0, 2, 0, null, null, 0], [0, 2, 0, null, null, 3],
  ]],
  ['La', 'A', 'MinorSeventh', ['Am7', 'Am7/C', 'Am7/E', 'Am7/G'], [
    [0, 1, 0, null, 0, null],
    [0, 1, 0, null, 3, null],
    [0, 1, 0, null, null, 0],
    [0, 1, 0, null, null, 3],
  ]],
  ['Si', 'B', 'Major', ['B', 'B/D#', 'B/F#'], [
    [2, 4, 4, null, 2, null], [2, 4, 4, 1, null, null], [2, 4, 4, null, null, 2],
  ]],
  ['Si', 'B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#'], [
    [2, 3, 4, null, 2, null], [2, 3, 4, 0, null, null], [2, 3, 4, null, null, 2],
  ]],
  ['Si', 'B', 'Seventh', ['B7', 'B7', 'B7/D#', 'B7/F#', 'B7/F#'], [
    [2, 4, 2, null, 2, null], [null, 4, 2, 4, 2, null], [2, 0, 2, 1, null, null], [2, 4, 2, null, null, 2],
    [null, 4, 2, 4, null, 2],
  ]],
  ['Si', 'B', 'MinorSeventh', ['Bm7', 'Bm7/D', 'Bm7/F#', 'Bm7/A'], [
    [2, 3, 2, null, 2, null],
    [2, 0, 2, 0, null, null],
    [2, 3, 2, null, null, 2],
    [2, 3, 2, null, 0, null],
  ]],
  ['Do', 'C', 'MajorSeventh', ['Cmaj7', 'Cmaj7/E', 'Cmaj7/G', 'Cmaj7/B'], [
    [0, 0, 0, null, 3, null], [3, 1, 4, null, null, 0],
    [0, 1, 4, null, null, 3], [0, 1, 0, null, 2, null],
  ]],
  ['Re', 'D', 'MajorSeventh', ['Dmaj7', 'Dmaj7/F#', 'Dmaj7/A', 'Dmaj7/C#'], [
    [2, 2, 2, 0, null, null], [5, 3, 6, null, null, 2],
    [2, 3, 6, null, 0, null], [2, 3, 2, null, 4, null],
  ]],
  ['Mi', 'E', 'MajorSeventh', ['Emaj7', 'Emaj7/G#', 'Emaj7/B', 'Emaj7/D#'], [
    [4, 4, 4, null, null, 0], [0, 4, 4, null, null, 4],
    [0, 4, 1, null, 2, null], [0, 0, 1, 1, null, null],
  ]],
  ['Fa', 'F', 'MajorSeventh', ['Fmaj7', 'Fmaj7/A', 'Fmaj7/C', 'Fmaj7/E'], [
    [0, 1, 2, null, null, 1], [0, 1, 5, null, 0, null],
    [1, 5, 2, null, 3, null], [1, 1, 2, null, null, 0],
  ]],
  ['Sol', 'G', 'MajorSeventh', ['Gmaj7', 'Gmaj7/B', 'Gmaj7/D', 'Gmaj7/F#'], [
    [2, 0, 0, null, null, 3], [2, 3, 0, null, 2, null],
    [2, 0, 0, 0, null, null], [3, 3, 4, null, null, 2],
  ]],
  ['La', 'A', 'MajorSeventh', ['Amaj7', 'Amaj7/C#', 'Amaj7/E', 'Amaj7/G#'], [
    [0, 2, 1, null, 0, null], [4, 5, 2, null, 4, null],
    [4, 2, 2, null, null, 0], [0, 2, 2, null, null, 4],
  ]],
  ['Si', 'B', 'MajorSeventh', ['Bmaj7', 'Bmaj7/D#', 'Bmaj7/F#', 'Bmaj7/A#'], [
    [2, 4, 3, null, 2, null], [2, 0, 3, 1, null, null],
    [6, 4, 4, null, null, 2], [2, 4, 4, null, 1, null],
  ]],
  ['Do', 'C', 'Diminished', ['Cdim', 'Cdim/Eb', 'Cdim/Gb'], [
    [2, 4, 5, null, 3, null], [2, 4, 5, null, 6, null], [2, 4, 5, 4, null, null],
  ]],
  ['Re', 'D', 'Diminished', ['Ddim', 'Ddim/F', 'Ddim/Ab'], [
    [1, 3, 1, 0, null, null], [1, 3, 1, 3, null, null], [1, 3, 1, null, null, 4],
  ]],
  ['Mi', 'E', 'Diminished', ['Edim', 'Edim/G', 'Edim/Bb'], [
    [3, 5, 3, 2, null, null], [3, 5, 3, null, null, 3], [3, 5, 3, null, null, 6],
  ]],
  ['Fa', 'F', 'Diminished', ['Fdim', 'Fdim/Ab', 'Fdim/B'], [
    [1, 0, 1, 3, null, null], [1, 0, 1, null, null, 4], [1, 0, 1, null, 2, null],
  ]],
  ['Sol', 'G', 'Diminished', ['Gdim', 'Gdim/Bb', 'Gdim/Db'], [
    [3, 2, 3, 5, null, null], [3, 2, 3, null, 1, null], [3, 2, 3, null, 4, null],
  ]],
  ['La', 'A', 'Diminished', ['Adim', 'Adim/C', 'Adim/Eb'], [
    [5, 4, 5, null, 0, null], [5, 4, 5, null, 3, null], [5, 4, 5, null, 6, null],
  ]],
  ['Si', 'B', 'Diminished', ['Bdim', 'Bdim/D', 'Bdim/F'], [
    [1, 3, 4, null, 2, null], [1, 3, 4, 0, null, null], [1, 3, 4, 3, null, null],
  ]],
  // A diminished seventh is symmetric: each chord has four equivalent names, so the positions are grouped by
  // their notes instead of by key, and named by their bass.
  ['dim7', 'Dim7', 'Dim7C', ['Cdim7', 'Ebdim7', 'Gbdim7', 'Adim7'], [
    [2, 4, 2, null, 3, null], [2, 1, 2, 1, null, null], [5, 4, 5, 4, null, null], [2, 4, 5, null, 0, null],
  ]],
  ['dim7', 'Dim7', 'Dim7Db', ['C#dim7', 'Edim7', 'Gdim7', 'Bbdim7'], [
    [3, 5, 3, null, 4, null], [3, 2, 3, 2, null, null], [0, 2, 3, null, null, 3], [0, 2, 0, null, 1, null],
  ]],
  ['dim7', 'Dim7', 'Dim7D', ['Ddim7', 'Fdim7', 'Abdim7', 'Bdim7'], [
    [1, 0, 1, 0, null, null], [4, 3, 4, 3, null, null], [1, 3, 4, null, null, 4], [1, 3, 1, null, 2, null],
  ]],
];

// Root, major third and minor seventh only; the three treble strings hold
// all three tones, doubled by one bass on strings 4–6. String 1 first.
const SEVENTH_NO_FIFTH = [
  ['Do', 'C', ['C7', 'C7/E', 'C7/Bb'], [
    [0, 1, 3, null, 3, null], [0, 1, 3, null, null, 0], [0, 1, 3, null, 1, null],
  ], ['014-3-', '014--0', '014-1-']],
  ['Re♭', 'Db', ['Db7', 'Db7/F', 'Db7/Cb'], [
    [1, 2, 4, null, 4, null], [1, 2, 4, null, null, 1], [1, 2, 4, null, 2, null],
  ], ['124-3-', '124--1', '124-3-']],
  ['Re', 'D', ['D7', 'D7/F#', 'D7/C'], [
    [2, 3, 5, 0, null, null], [2, 3, 5, null, null, 2], [2, 3, 5, null, 3, null],
  ], ['1240--', '124--1', '124-3-']],
  ['Mi♭', 'Eb', ['Eb7', 'Eb7/G', 'Eb7/Db'], [
    [3, 4, 6, null, 6, null], [3, 4, 6, null, null, 3], [3, 4, 6, null, 4, null],
  ], ['124-3-', '124--1', '124-3-']],
  ['Mi', 'E', ['E7', 'E7/G#', 'E7/D'], [
    [0, 3, 1, null, null, 0], [0, 3, 1, null, null, 4], [0, 3, 1, 0, null, null],
  ], ['031--0', '031--4', '0310--']],
  ['Fa', 'F', ['F7', 'F7/A', 'F7/Eb'], [
    [1, 4, 2, null, null, 1], [1, 4, 2, null, 0, null], [1, 4, 2, 1, null, null],
  ], ['142--1', '142-0-', '1421--']],
  ['Fa♯', 'F#', ['F#7', 'F#7/A#', 'F#7/E'], [
    [2, 5, 3, null, null, 2], [2, 5, 3, null, 1, null], [2, 5, 3, null, null, 0],
  ], ['142--1', '243-1-', '142--0']],
  ['Sol', 'G', ['G7', 'G7/B', 'G7/F'], [
    [1, 0, 0, null, null, 3], [1, 0, 0, null, 2, null], [1, 0, 0, null, null, 1],
  ], ['100--3', '100-2-', '100--2']],
  ['La♭', 'Ab', ['Ab7', 'Ab7/C', 'Ab7/Gb'], [
    [2, 1, 1, null, null, 4], [2, 1, 1, null, 3, null], [2, 1, 1, null, null, 2],
  ], ['211--4', '211-3-', '211--3']],
  ['La', 'A', ['A7', 'A7/C#', 'A7/G'], [
    [3, 2, 2, null, 0, null], [3, 2, 2, null, 4, null], [3, 2, 2, null, null, 3],
  ], ['211-0-', '211-3-', '211--3']],
  ['Si♭', 'Bb', ['Bb7', 'Bb7/D', 'Bb7/Ab'], [
    [4, 3, 3, null, 1, null], [4, 3, 3, 0, null, null], [4, 3, 3, null, null, 4],
  ], ['423-1-', '2110--', '211--3']],
  ['Si', 'B', ['B7', 'B7/D#', 'B7/A'], [
    [5, 4, 4, null, 2, null], [5, 4, 4, null, 6, null], [5, 4, 4, null, 0, null],
  ], ['423-1-', '211-3-', '211-0-']],
];
SEVENTH_NO_FIFTH.forEach(([es, en, names, forms, fingerings]) => {
  GROUPS.push([es, en, 'SeventhNoFifth', names, forms, fingerings]);
});

// The tab labels of the diminished seventh groups: the notes they share.
const DIM7_LABELS = { Dim7C: 'C · Eb · Gb · A', Dim7Db: 'C# · E · G · Bb', Dim7D: 'D · F · Ab · B' };

function qualityLabel(quality, strings) {
  return DIM7_LABELS[quality] || strings['artArpeggios' + quality];
}

// Suggested left-hand fingers, string 1 first: 0 = open, - = silent.
// Repeated 1s indicate a barre; each diagram uses the exact four-string form.
const FINGERINGS = {
  C: '010-3-', 'C/E': '0102--', 'C/G': '010--3',
  Cm: '230-1-', 'Cm/Eb': '2301--', 'Cm/G': '230--1',
  C7: '014-3-', 'C7/E': '0142--', 'C7/G': '014--3', 'C7/Bb': '014-1-',
  Cm7: '121-1-', 'Cm7/Eb': '3431--', 'Cm7/G': '121--1', 'Cm7/Bb': '343-1-',
  D: '2310--', 'D/F#': '131--1', 'D/A': '231-0-',
  Dm: '1320--', 'Dm/F': '1423--', 'Dm/A': '132-0-',
  D7: '3120--', 'D7/F#': '3124--', 'D7/A': '312-0-', 'D7/C': '312-4-',
  Dm7: '1120--', 'Dm7/F': '1123--', 'Dm7/A': '112-0-', 'Dm7/C': '112-3-',
  E: '001--0', 'E/G#': '001--4', 'E/B': '001-2-',
  Em: '3002-0', 'Em/G': '000--3', 'Em/B': '000-2-',
  E7: '041--0', 'E7/B': '041-2-',
  Em7: '112--0', 'Em7/G': '112--1', 'Em7/B': '224-1-', 'Em7/D': '1120--',
  F: '1123--', 'F/A': '112-0-', 'F/C': '112-3-',
  Fm: '1113--', 'Fm/Ab': '111--4', 'Fm/C': '111-3-',
  F7: '1423--', 'F7/A': '142-0-', 'F7/C': '142-3-', 'F7/Eb': '1421--',
  Fm7: '2231--', 'Fm7/Ab': '112--1', 'Fm7/C': '223-1-', 'Fm7/Eb': '3341--',
  G: '300--2', 'G/B': '300-1-', 'G/D': '3000--',
  Gm: '111--1', 'Gm/Bb': '333-1-', 'Gm/D': '1110--',
  G7: '100--3', 'G7/B': '140-2-', 'G7/D': '1000--',
  Gm7: '134--2', 'Gm7/Bb': '134-1-', 'Gm7/D': '1340--', 'Gm7/F': '1333--',
  A: '032-0-', 'A/C#': '021-4-', 'A/E': '032--0',
  Am: '012-0-', 'Am/C': '012-3-', 'Am/E': '012--0',
  A7: '020-0-', 'A7/C#': '010-4-', 'A7/E': '020--0', 'A7/G': '010--3',
  // Alternate A7 voicing with the seventh on string 1 and the fifth omitted.
  '3 2 0 x 0 x': '210-0-',
  Am7: '010-0-', 'Am7/C': '010-3-', 'Am7/E': '010--0', 'Am7/G': '010--3',
  B: '143-1-', 'B/D#': '2431--', 'B/F#': '134--1',
  Bm: '124-1-', 'Bm/D': '1240--', 'Bm/F#': '124--1',
  B7: '141-1-', 'B7/D#': '4031--', 'B7/F#': '141--1',
  // Alternate voicing of B7 with the fifth above the root.
  'x 4 2 4 2 x': '-4131-',
  // Alternate voicing of B7/F#: no root, with the fifth doubled.
  'x 4 2 4 x 2': '-413-1',
  Bm7: '131-1-', 'Bm7/D': '1020--', 'Bm7/F#': '131--1', 'Bm7/A': '131-0-',
  Cmaj7: '000-3-', 'Cmaj7/E': '314--0', 'Cmaj7/G': '014--3', 'Cmaj7/B': '010-2-',
  Dmaj7: '1110--', 'Dmaj7/F#': '324--1', 'Dmaj7/A': '124-0-', 'Dmaj7/C#': '121-4-',
  Emaj7: '111--0', 'Emaj7/G#': '011--1', 'Emaj7/B': '041-2-', 'Emaj7/D#': '0011--',
  Fmaj7: '012--1', 'Fmaj7/A': '014-0-', 'Fmaj7/C': '142-3-', 'Fmaj7/E': '112--0',
  Gmaj7: '100--2', 'Gmaj7/B': '230-1-', 'Gmaj7/D': '1000--', 'Gmaj7/F#': '224--1',
  Amaj7: '021-0-', 'Amaj7/C#': '341-3-', 'Amaj7/E': '411--0', 'Amaj7/G#': '011--3',
  Bmaj7: '143-1-', 'Bmaj7/D#': '2031--', 'Bmaj7/F#': '422--1', 'Bmaj7/A#': '234-1-',
  Cdim: '134-2-', 'Cdim/Eb': '123-4-', 'Cdim/Gb': '1243--',
  Ddim: '1310--', 'Ddim/F': '1314--', 'Ddim/Ab': '131--4',
  Edim: '2421--', 'Edim/G': '131--1', 'Edim/Bb': '131--4',
  Fdim: '1013--', 'Fdim/Ab': '101--4', 'Fdim/B': '101-2-',
  Gdim: '2134--', 'Gdim/Bb': '324-1-', 'Gdim/Db': '213-4-',
  Adim: '314-0-', 'Adim/C': '324-1-', 'Adim/Eb': '213-4-',
  Bdim: '134-2-', 'Bdim/D': '1340--', 'Bdim/F': '1243--',
  Cdim7: '141-3-', Ebdim7: '3141--', Gbdim7: '3141--', Adim7: '123-0-',
  'C#dim7': '131-2-', Edim7: '3141--', Gdim7: '012--3', Bbdim7: '020-1-',
  Ddim7: '1020--', Fdim7: '3141--', Abdim7: '123--4', Bdim7: '131-2-',
};

// Spell chord tones by thirds, then label the exact sounding string positions.
function stringNotes(name, form) {
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const letters = 'CDEFGAB';
  const [, root, accidental, quality] = name.match(/^([A-G])([#b]?)([^/]*)/);
  const rootPitch = natural[root] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const intervals = quality === 'dim7' ? [0, 3, 6, 9] : quality === 'dim' ? [0, 3, 6] :
    quality === 'm7' ? [0, 3, 7, 10] : quality === 'm' ? [0, 3, 7] :
    quality === 'maj7' ? [0, 4, 7, 11] : quality === '7' ? [0, 4, 7, 10] : [0, 4, 7];
  const spellings = new Map(intervals.map(function (interval, i) {
    const pitch = (rootPitch + interval + 12) % 12;
    const letter = letters[(letters.indexOf(root) + 2 * i) % 7];
    const delta = (pitch - natural[letter] + 18) % 12 - 6;
    return [pitch, letter + (delta < 0 ? '♭'.repeat(-delta) : '♯'.repeat(delta))];
  }));
  const open = [4, 11, 7, 2, 9, 4];
  return form.map((fret, string) => fret === null ? '' : spellings.get((open[string] + fret) % 12));
}

function chordPopover(id, name, form, strings, exactFingering) {
  const fingering = exactFingering || FINGERINGS[form.map((fret) => fret === null ? 'x' : fret).join(' ')] || FINGERINGS[name];
  const fingers = form.map(function (fret, string) {
    return [string + 1, fret === null ? 'x' : fret === 0 ? 'o' : fret, fret > 0 ? Number(fingering[string]) || undefined : undefined];
  });
  const label = strings.artChordDiagramLabel + ' ' + name;
  return modal({
    id, label, closeLabel: strings.artArpeggiosClose, className: 'chord-popover arpeggio-popover',
    content: chordCard({ name, fingers, barres: [], position: 1, stringNotes: stringNotes(name, form) }, label),
  });
}

const ROOT_ORDER = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Dim7'];

function orderedRoots(roots) {
  return [...roots].sort(([a], [b]) => ROOT_ORDER.indexOf(a) - ROOT_ORDER.indexOf(b));
}

function renderBody(locale, strings) {
  const popovers = [];
  const roots = new Map();
  GROUPS.forEach(function ([es, en, quality, names, forms, fingerings], group) {
    const title = (locale === 'es' ? es : en) + ' ' + qualityLabel(quality, strings);
    // The names sit above the white sheet, one per chord column, as buttons.
    const buttons = names.map(function (name, i) {
      const id = 'arpeggio-chord-' + group + '-' + i;
      popovers.push(chordPopover(id, name, forms[i], strings, fingerings && fingerings[i]));
      // Forms sit on every other Column: a blank Column separates the chords.
      return { column: 2 * i, text: name, html: '<button type="button" class="arpeggio-chord" popovertarget="' + id + '" aria-label="' + strings.artArpeggiosShowFingering + ' ' + name + '">' + name + '</button>' };
    });
    const styledForms = forms.map(function (form) {
      return form.map(function (fret, string) {
        return fret === null ? null : { fret, bold: string >= 3 };
      });
    });
    if (!roots.has(en)) roots.set(en, { title: en === 'Dim7' ? strings.artArpeggiosDim7Title : locale === 'es' ? es : en, note: en === 'Dim7' ? strings.artArpeggiosDim7Note : '', variants: [] });
    const tabQuality = quality === 'SeventhNoFifth' ? 'Seventh' : quality;
    const variants = roots.get(en).variants;
    let variant = variants.find((item) => item.quality === tabQuality);
    if (!variant) {
      variant = { quality: tabQuality, title: qualityLabel(tabQuality, strings), figure: '' };
      variants.push(variant);
    }
    variant.figure += (quality === 'SeventhNoFifth' ? '<h3 class="arpeggio-block-label">' + qualityLabel(quality, strings) + '</h3>' : '') +
      tabFigure(title, styledForms, locale, null, buttons) +
      '<div class="arpeggio-diagrams" hidden data-chords="' + names.map((_, i) => 'arpeggio-chord-' + group + '-' + i).join(' ') + '"></div>';
  });
  const tabs = Array.from(orderedRoots(roots), function ([root, { title, note, variants }]) {
    const id = 'arpeggio-' + root;
    return '<section class="arpeggio-group" aria-label="' + title + '">' +
      '<div class="arpeggio-group-header"><span class="arpeggio-root" id="' + id + '-root">' + title + '</span>' +
      '<div role="tablist" aria-labelledby="' + id + '-root">' + variants.map(function (variant, i) {
        return '<button type="button" role="tab" id="' + id + '-tab-' + i + '" aria-controls="' + id + '-panel-' + i +
          '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '">' + variant.title + '</button>';
      }).join('') + '</div>' + viewSwitch(title, strings) + '</div>' + (note ? '<p class="arpeggio-note">' + note + '</p>' : '') + variants.map(function (variant, i) {
        return '<div role="tabpanel" id="' + id + '-panel-' + i + '" aria-labelledby="' + id + '-tab-' + i +
          '" tabindex="0"' + (i === 0 ? '' : ' hidden') + '>' + variant.figure + '</div>';
      }).join('') + '</section>';
  });
  return '<p>' + strings.artArpeggiosIntro + '</p><h2 class="arpeggio-results-title" id="arpeggio-results-title" hidden>' + strings.artArpeggiosResults +
    '</h2><p class="arpeggio-no-results" id="arpeggio-no-results" role="status" hidden>' + strings.artArpeggiosNoResults +
    '</p><div class="sequence-forms">' + tabs.join('') + '</div>' + popovers.join('') + CHORD_CARD_LOADER + TAB_LOADER + POPOVER_LOADER + QUALITY_TABS_LOADER +
    searchIndex(locale, strings) + SEARCH_LOADER;
}

// Every chord form per root, in page order, for the note search.
function searchIndex(locale, strings) {
  const roots = new Map();
  GROUPS.forEach(function ([es, en, , names, forms], group) {
    if (!roots.has(en)) roots.set(en, { id: 'arpeggio-' + en, chords: [] });
    names.forEach(function (name, i) {
      roots.get(en).chords.push({ name, form: forms[i], popover: 'arpeggio-chord-' + group + '-' + i });
    });
  });
  const data = { locale, showFingering: strings.artArpeggiosShowFingering, roots: orderedRoots(roots).map(([, root]) => root) };
  return '<script type="application/json" id="arpeggio-search-data">' + JSON.stringify(data).replace(/</g, '\\u003c') + '</script>';
}

// lucide "search" and "x".
const SEARCH_ICON = '<svg class="icon-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>';
const CLEAR_ICON = '<svg class="icon-clear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

// Beside the page title: the trigger and the narrow popup with a one-column tab to write notes in.
function searchControl(strings) {
  return '<div class="arpeggio-search">' +
    '<button type="button" class="arpeggio-search-toggle" aria-label="' + strings.artArpeggiosSearch + '" aria-expanded="false" data-search="' +
    strings.artArpeggiosSearch + '" data-clear="' + strings.artArpeggiosClearSearch + '">' + SEARCH_ICON + CLEAR_ICON + '</button>' +
    '<div class="arpeggio-search-popup" role="dialog" aria-label="' + strings.artArpeggiosSearch + '" hidden>' +
    '<ascii-tabs class="article-tab" theme="light" labels="notes" spacing="3"><ascii-tabs-sheet></ascii-tabs-sheet></ascii-tabs>' +
    '<div class="arpeggio-search-footer"><button type="button" class="arpeggio-search-clear">' + strings.artArpeggiosClearNotes + '</button></div></div></div>';
}

// Lucide toggle-right and toggle-left: checked means tablature is visible.
function viewSwitch(title, strings) {
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const track = '<rect width="22" height="14" x="1" y="5" rx="7"/>';
  const on = svg + '<circle cx="16" cy="12" r="3"/>' + track + '</svg>';
  const off = svg + '<circle cx="8" cy="12" r="3"/>' + track + '</svg>';
  return '<button type="button" role="switch" aria-checked="true" class="arpeggio-view-switch tooltip" aria-label="' +
    strings.artArpeggiosTabView + ': ' + title + '" data-tooltip="' + strings.artArpeggiosToggleView + '">' +
    '<span class="arpeggio-view-tabs">' + on + '</span><span class="arpeggio-view-diagrams">' + off + '</span></button>';
}

// Keep native popover dismissal and focus behavior, positioning against the actual
// invoker (the search can create a second button for the same chord).
const POPOVER_LOADER = `<script>
(function() {
  var trigger;
  function position(popup) {
    if (!trigger || !trigger.isConnected) return;
    var rect = trigger.getBoundingClientRect();
    var box = popup.getBoundingClientRect();
    var padding = 16;
    var gap = 10;
    var left = rect.left + (rect.width - box.width) / 2;
    var top = rect.bottom + gap;
    if (top + box.height > innerHeight - padding) top = rect.top - gap - box.height;
    popup.style.left = Math.max(padding, Math.min(left, innerWidth - box.width - padding)) + 'px';
    popup.style.top = Math.max(padding, Math.min(top, innerHeight - box.height - padding)) + 'px';
  }
  document.addEventListener('click', function(event) {
    var button = event.target.closest('.arpeggio-chord');
    if (button) trigger = button;
  }, true);
  document.querySelectorAll('.arpeggio-popover').forEach(function(popup) {
    popup.addEventListener('toggle', function(event) {
      if (event.newState !== 'open') return;
      window.ChordCard.renderAll(popup);
      position(popup);
    });
  });
  function reposition() {
    var popup = document.querySelector('.arpeggio-popover:popover-open');
    if (popup) position(popup);
  }
  window.addEventListener('resize', reposition);
  document.addEventListener('scroll', reposition, true);
})();
</script>`;

// Each root keeps its own selection. Arrow keys follow the horizontal tab pattern.
const QUALITY_TABS_LOADER = `<script>
document.querySelectorAll('.arpeggio-group').forEach(function(group) {
  var tabs = Array.from(group.querySelectorAll('[role="tab"]'));
  var viewSwitch = group.querySelector('.arpeggio-view-switch');
  function updateView() {
    var diagrams = viewSwitch.getAttribute('aria-checked') === 'false';
    group.classList.toggle('is-diagrams', diagrams);
    var container = group.classList.contains('is-filtering') ? group.querySelector('.arpeggio-results') : group.querySelector('[role="tabpanel"]:not([hidden])');
    if (!container || group.hidden) return;
    container.querySelectorAll('.arpeggio-diagrams').forEach(function(row) {
      row.hidden = !diagrams;
      if (!diagrams || row.dataset.rendered) return;
      row.replaceChildren();
      (row.dataset.chords || '').split(' ').filter(Boolean).forEach(function(id) {
        var source = document.getElementById(id).querySelector('[data-chord-card]');
        var slot = document.createElement('div');
        slot.setAttribute('data-chord-card', '');
        slot.dataset.chord = source.dataset.chord;
        slot.setAttribute('role', 'img');
        slot.setAttribute('aria-label', source.getAttribute('aria-label'));
        row.appendChild(slot);
        window.ChordCard.render(slot);
      });
      row.dataset.rendered = '1';
    });
  }
  viewSwitch.addEventListener('click', function() {
    viewSwitch.setAttribute('aria-checked', String(viewSwitch.getAttribute('aria-checked') !== 'true'));
    updateView();
  });
  group.addEventListener('arpeggioresultschange', updateView);
  function select(tab) {
    tabs.forEach(function(item) {
      var selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    updateView();
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

// Typed frets (string -> fret) keep, per root, every chord that has them all. Matches replace the quality tabs
// with a single tab per root.
const SEARCH_LOADER = `<script>
(function() {
  var search = document.querySelector('.arpeggio-search');
  var toggle = search.querySelector('.arpeggio-search-toggle');
  var popup = search.querySelector('.arpeggio-search-popup');
  var input = popup.querySelector('ascii-tabs');
  var data = JSON.parse(document.getElementById('arpeggio-search-data').textContent);
  var EMPTY = [[null, null, null, null, null, null]];
  var query = [];
  var open = false;

  function fretOf(note) { return note !== null && typeof note === 'object' ? note.fret : note; }
  function active() { return query.some(function(fret) { return fret !== null; }); }

  function render() {
    var on = active();
    toggle.setAttribute('aria-label', on || open ? toggle.dataset.clear : toggle.dataset.search);
    toggle.setAttribute('aria-expanded', String(open));
    search.classList.toggle('is-active', on || open);
    popup.hidden = !open;
  }

  function filter() {
    var on = active();
    var found = false;
    data.roots.forEach(function(root) {
      var section = document.getElementById(root.id + '-root').closest('.arpeggio-group');
      // Every query starts in tablature, including roots hidden by the filter.
      section.querySelector('.arpeggio-view-switch').setAttribute('aria-checked', 'true');
      var results = section.querySelector('.arpeggio-results');
      var matches = root.chords.filter(function(chord) {
        return query.every(function(fret, s) { return fret === null || chord.form[s] === fret; });
      });
      section.classList.toggle('is-filtering', on);
      section.hidden = on && !matches.length;
      if (matches.length) found = true;
      if (!results && on) {
        results = document.createElement('figure');
        results.className = 'form tab-figure arpeggio-results';
        results.innerHTML = '<ascii-tabs class="article-tab" readonly theme="light" labels="notes" spacing="3" variant="flat" lang="' + data.locale + '"><ascii-tabs-sheet></ascii-tabs-sheet></ascii-tabs>';
        section.appendChild(results);
      }
      if (!on) {
        if (results) results.hidden = true;
        section.dispatchEvent(new Event('arpeggioresultschange'));
        return;
      }
      results.hidden = false;
      var row = results.querySelector('.arpeggio-diagrams');
      if (!row) {
        row = document.createElement('div');
        row.className = 'arpeggio-diagrams';
        row.hidden = true;
        results.appendChild(row);
      }
      row.dataset.chords = matches.map(function(chord) { return chord.popover; }).join(' ');
      delete row.dataset.rendered;
      var tabs = [];
      var annotations = [];
      matches.forEach(function(chord, i) {
        if (i % 6 === 0) { tabs.push([]); annotations.push([]); }
        var columns = tabs[tabs.length - 1];
        if (columns.length) columns.push([null, null, null, null, null, null]);
        annotations[annotations.length - 1].push({ column: columns.length, text: chord.name, html: '<button type="button" class="arpeggio-chord" popovertarget="' + chord.popover + '" aria-label="' + data.showFingering + ' ' + chord.name + '">' + chord.name + '</button>' });
        columns.push(chord.form.map(function(fret, s) { return fret === null ? null : { fret: fret, bold: s >= 3 }; }));
      });
      section.dispatchEvent(new Event('arpeggioresultschange'));
      // Keep a readable font; the component wraps the matches into staves.
      results.style.setProperty('--chars', 23);
      var tab = results.querySelector('ascii-tabs');
      customElements.whenDefined('ascii-tabs').then(function() {
        tab.setDocument({ value: tabs, annotations: annotations });
      });
    });
    document.getElementById('arpeggio-results-title').hidden = !on;
    document.getElementById('arpeggio-no-results').hidden = !on || found;
  }

  // Focus is given by replaying a press on the first cell, which has no real pointer to capture.
  input.setPointerCapture = function() {};

  function focusFirstCell() {
    var cell = input.querySelector('.ascii-tabs-cell');
    if (cell) cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }));
  }

  function resetInput() {
    input.setDocument({ value: [EMPTY.map(function(column) { return column.slice(); })] });
  }

  customElements.whenDefined('ascii-tabs').then(resetInput);

  // One column only: sideways keys never reach the tab, and Enter confirms the search.
  input.addEventListener('keydown', function(event) {
    if (['ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].indexOf(event.key) === -1) return;
    event.stopPropagation();
    if (event.key === 'Enter') { event.preventDefault(); open = false; render(); toggle.focus(); }
    else if (event.key !== 'Tab') event.preventDefault();
  }, true);

  input.addEventListener('change', function(event) {
    var tab = event.detail.value[0] || [];
    query = (tab[0] || EMPTY[0]).map(function(note) { return note === null ? null : fretOf(note); });
    filter();
    render();
    if (tab.length > 1) {
      input.setDocument({ value: [[(tab[0] || EMPTY[0]).slice()]] });
      focusFirstCell();
    }
  });

  toggle.addEventListener('click', function() {
    if (active() || open) {
      query = [];
      open = false;
      resetInput();
      filter();
    } else {
      open = true;
    }
    render();
    if (open) customElements.whenDefined('ascii-tabs').then(function() { requestAnimationFrame(focusFirstCell); });
  });

  popup.querySelector('.arpeggio-search-clear').addEventListener('click', function() {
    query = [];
    resetInput();
    filter();
    render();
    requestAnimationFrame(focusFirstCell);
  });

  document.addEventListener('pointerdown', function(event) {
    // The path is fixed at dispatch: the tab re-renders its cells, so the target may be detached by now.
    if (open && !event.composedPath().includes(search)) { open = false; render(); }
  });
})();
</script>`;

function cardImage() {
  return {
    src: path.join(__dirname, '../../src/site/articles/arpeggios/preview.svg'),
    name: 'preview.svg',
    url: '/assets/articles/arpeggios/preview.svg',
  };
}

module.exports = { renderBody, cardImage, searchControl, GROUPS };
