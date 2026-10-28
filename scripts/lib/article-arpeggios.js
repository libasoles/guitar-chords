'use strict';

const path = require('path');
const { firstPositionForms } = require('./article-arpeggio-positions');
const { chordCard, CHORD_CARD_LOADER } = require('./chord-forms');
const { tabFigure, TAB_LOADER } = require('./article-carcassi');
const { modal } = require('./modal');

// Each position sounds four strings, including one bass. String 1 first.
// Include every chord tone; only SeventhNoFifth explicitly omits a tone.
const GROUPS = [
  ['Do', 'C', 'Major', ['C', 'C/E', 'C/G'], [
    [0, 1, 0, null, 3, null], [0, 1, 0, 2, null, null], [0, 1, 0, null, null, 3],
  ]],
  ['Do', 'C', 'Minor', ['Cm', 'Cm/Eb', 'Cm/G'], [
    [3, 4, 0, null, 3, null], [3, 1, 0, 1, null, null], [3, 4, 5, null, null, 3],
  ]],
  ['Do', 'C', 'Seventh', ['C7', 'C7/E', 'C7/G', 'C7/Bb'], [
    [0, 1, 3, null, 3, null], [0, 1, 3, 2, null, null],
    [0, 1, 3, null, null, 3], [0, 1, 3, null, 1, null],
  ]],
  ['Do', 'C', 'MinorSeventh', ['Cm7', 'Cm7/Eb', 'Cm7/G', 'Cm7/Bb'], [
    [3, 4, 3, null, 3, null],
    [3, 1, 3, 1, null, null],
    [6, 4, 5, null, null, 3],
    [3, 4, 5, null, null, 6],
  ]],
  ['Re', 'D', 'Major', ['D', 'D/F#', 'D/A'], [
    [2, 3, 2, 0, null, null], [2, 3, 2, null, null, 2], [2, 3, 2, null, 0, null],
  ]],
  ['Re', 'D', 'Minor', ['Dm', 'Dm/F', 'Dm/A'], [
    [1, 3, 2, 0, null, null], [1, 3, 2, 3, null, null], [1, 3, 2, null, 0, null],
  ]],
  ['Re', 'D', 'Seventh', ['D7', 'D7/F#', 'D7/A', 'D7/C'], [
    [2, 1, 2, 0, null, null], [5, 3, 5, 4, null, null],
    [2, 3, 5, null, 0, null], [2, 3, 2, null, 3, null],
  ]],
  ['Re', 'D', 'MinorSeventh', ['Dm7', 'Dm7/F', 'Dm7/A', 'Dm7/C'], [
    [1, 1, 2, 0, null, null],
    [5, 3, 5, 3, null, null],
    [null, 6, 5, 0, 0, null],
    [1, 3, 2, null, 3, null],
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
    [0, 3, 4, null, null, 3],
    [0, 3, 0, null, 2, null],
    [0, 0, 0, 0, null, null],
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
    [null, 4, 5, 3, null, 4],
    [1, 4, 1, null, 3, null],
    [1, 1, 1, 1, null, null],
  ]],
  ['Sol', 'G', 'Major', ['G', 'G/B', 'G/D'], [
    [3, 3, 4, null, null, 3], [3, 3, 0, null, 2, null], [3, 0, 0, 0, null, null],
  ]],
  ['Sol', 'G', 'Minor', ['Gm', 'Gm/Bb', 'Gm/D'], [
    [3, 3, 3, null, null, 3], [3, 3, 3, null, 1, null], [3, 3, 3, 0, null, null],
  ]],
  ['Sol', 'G', 'Seventh', ['G7', 'G7/B', 'G7/D'], [
    [1, 0, 0, null, null, 3], [1, 3, 0, null, 2, null], [1, 0, 0, 0, null, null],
  ]],
  ['Sol', 'G', 'MinorSeventh', ['Gm7', 'Gm7/Bb', 'Gm7/D', 'Gm7/F'], [
    [1, 3, 3, null, null, 3],
    [1, 3, 0, null, 1, null],
    [3, 6, 3, 0, null, null],
    [3, 3, 3, 3, null, null],
  ]],
  ['La', 'A', 'Major', ['A', 'A/C#', 'A/E'], [
    [0, 2, 2, null, 0, null], [0, 2, 2, null, 4, null], [0, 2, 2, null, null, 0],
  ]],
  ['La', 'A', 'Minor', ['Am', 'Am/C', 'Am/E'], [
    [0, 1, 2, null, 0, null], [0, 1, 2, null, 3, null], [0, 1, 2, null, null, 0],
  ]],
  ['La', 'A', 'Seventh', ['A7', 'A7', 'A7/C#', 'A7/E', 'A7/G'], [
    [0, 2, 0, null, 0, null], [3, 2, 0, null, 0, null], [5, 5, 0, null, 4, null],
    [5, 2, 0, null, null, 0], [0, 2, 2, null, null, 3],
  ]],
  ['La', 'A', 'MinorSeventh', ['Am7', 'Am7/C', 'Am7/E', 'Am7/G'], [
    [0, 1, 0, null, 0, null],
    [5, 5, 0, null, 3, null],
    [3, 1, 2, null, null, 0],
    [0, 1, 2, null, null, 3],
  ]],
  ['Si', 'B', 'Major', ['B', 'B/D#', 'B/F#'], [
    [2, 4, 4, null, 2, null], [2, 4, 4, 1, null, null], [2, 4, 4, null, null, 2],
  ]],
  ['Si', 'B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#'], [
    [2, 3, 4, null, 2, null], [2, 3, 4, 0, null, null], [2, 3, 4, null, null, 2],
  ]],
  ['Si', 'B', 'Seventh', ['B7', 'B7', 'B7/D#', 'B7/F#', 'B7/F#'], [
    [2, 4, 2, null, 2, null], [null, 4, 2, 4, 2, null], [2, 0, 2, 1, null, null], [5, 4, 4, null, null, 2],
    [null, 0, 2, 1, null, 2],
  ]],
  ['Si', 'B', 'MinorSeventh', ['Bm7', 'Bm7/D', 'Bm7/F#', 'Bm7/A'], [
    [2, 3, 2, null, 2, null],
    [2, 0, 2, 0, null, null],
    [5, 3, 4, null, null, 2],
    [2, 3, 4, null, 0, null],
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
    [0, 1, 2, null, null, 1], [0, 6, 5, null, 0, null],
    [1, 5, 2, null, 3, null], [1, 1, 2, null, null, 0],
  ]],
  ['Sol', 'G', 'MajorSeventh', ['Gmaj7', 'Gmaj7/B', 'Gmaj7/D', 'Gmaj7/F#'], [
    [2, 3, 4, null, null, 3], [2, 3, 0, null, 2, null],
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
  // Forms and inversions for the five accidental roots; exact fingers per form.
  ['Re♭', 'Db', 'Major', ['Db', 'Db/F', 'Db/Ab'], [
    [4, 6, 6, null, 4, null],
    [4, 6, 6, 3, null, null],
    [4, 6, 6, null, null, 4],
  ], ['122-1-', '2331--', '122--1']],
  ['Re♭', 'Db', 'Minor', ['Dbm', 'Dbm/Fb', 'Dbm/Ab'], [
    [4, 5, 6, null, 4, null],
    [0, 2, 1, null, null, 0],
    [4, 5, 6, null, null, 4],
  ], ['123-1-', '021--0', '123--1']],
  ['Re♭', 'Db', 'Seventh', ['Db7', 'Db7/F', 'Db7/Ab'], [
    [4, 6, 4, null, 4, null],
    [4, 2, 4, 3, null, null],
    [1, 2, 4, null, null, 4],
  ], ['121-1-', '3142--', '123--3']],
  ['Re♭', 'Db', 'MinorSeventh', ['Dbm7', 'Dbm7/Fb', 'Dbm7/Ab', 'Dbm7/Cb'], [
    [4, 5, 4, null, 4, null],
    [4, 2, 4, 2, null, null],
    [0, 2, 4, null, null, 4],
    [0, 2, 1, null, 2, null],
  ], ['121-1-', '2131--', '012--2', '021-3-']],
  ['Re♭', 'Db', 'MajorSeventh', ['Dbmaj7', 'Dbmaj7/F', 'Dbmaj7/Ab', 'Dbmaj7/C'], [
    [4, 6, 5, null, 4, null],
    [4, 2, 5, 3, null, null],
    [null, 2, 5, 3, null, 4],
    [4, 6, 6, null, 3, null],
  ], ['132-1-', '3142--', '-142-3', '233-1-']],
  ['Re♭', 'Db', 'Diminished', ['Dbdim', 'Dbdim/Fb', 'Dbdim/Abb'], [
    [3, 5, 6, null, 4, null],
    [0, 2, 0, null, null, 0],
    [3, 5, 6, 5, null, null],
  ], ['134-2-', '010--0', '1232--']],
  ['Mi♭', 'Eb', 'Major', ['Eb', 'Eb/G', 'Eb/Bb'], [
    [3, 4, 3, 1, null, null],
    [3, 4, 3, null, null, 3],
    [3, 4, 3, null, 1, null],
  ], ['2321--', '121--1', '232-1-']],
  ['Mi♭', 'Eb', 'Minor', ['Ebm', 'Ebm/Gb', 'Ebm/Bb'], [
    [2, 4, 3, 1, null, null],
    [2, 4, 3, 4, null, null],
    [2, 4, 3, null, 1, null],
  ], ['2431--', '1324--', '243-1-']],
  ['Mi♭', 'Eb', 'Seventh', ['Eb7', 'Eb7/G', 'Eb7/Bb', 'Eb7/Db'], [
    [3, 2, 3, 1, null, null],
    [6, 4, 6, 5, null, null],
    [null, 2, 0, 1, 1, null],
    [3, 4, 3, null, 4, null],
  ], ['3241--', '3142--', '-2011-', '121-3-']],
  ['Mi♭', 'Eb', 'MinorSeventh', ['Ebm7', 'Ebm7/Gb', 'Ebm7/Bb', 'Ebm7/Db'], [
    [2, 2, 3, 1, null, null],
    [6, 4, 6, 4, null, null],
    [9, 7, 8, null, null, 6],
    [2, 4, 3, null, 4, null],
  ], ['2231--', '2131--', '423--1', '132-4-']],
  ['Mi♭', 'Eb', 'MajorSeventh', ['Ebmaj7', 'Ebmaj7/G', 'Ebmaj7/Bb', 'Ebmaj7/D'], [
    [3, 3, 3, 1, null, null],
    [null, 3, 3, 1, null, 3],
    [null, 3, 0, 1, 1, null],
    [3, 4, 3, null, 5, null],
  ], ['2221--', '-221-3', '-2011-', '121-3-']],
  ['Mi♭', 'Eb', 'Diminished', ['Ebdim', 'Ebdim/Gb', 'Ebdim/Bbb'], [
    [2, 4, 2, 1, null, null],
    [2, 4, 2, 4, null, null],
    [2, 4, 2, null, null, 5],
  ], ['2321--', '1213--', '121--3']],
  ['Fa♯', 'F#', 'Major', ['F#', 'F#/A#', 'F#/C#'], [
    [2, 2, 3, 4, null, null],
    [2, 2, 3, null, 1, null],
    [2, 2, 3, null, 4, null],
  ], ['1123--', '223-1-', '112-3-']],
  ['Fa♯', 'F#', 'Minor', ['F#m', 'F#m/A', 'F#m/C#'], [
    [2, 2, 2, 4, null, null],
    [2, 2, 2, null, null, 5],
    [2, 2, 2, null, 4, null],
  ], ['1112--', '111--2', '111-2-']],
  ['Fa♯', 'F#', 'Seventh', ['F#7', 'F#7/A#', 'F#7/C#', 'F#7/E'], [
    [2, 5, 3, 4, null, null],
    [0, 7, 6, null, null, 6],
    [2, 5, 3, null, 4, null],
    [2, 5, 3, 2, null, null],
  ], ['1423--', '021--1', '142-3-', '1321--']],
  ['Fa♯', 'F#', 'MinorSeventh', ['F#m7', 'F#m7/A', 'F#m7/C#', 'F#m7/E'], [
    [5, 5, 6, 4, null, null],
    [0, 7, 6, null, null, 5],
    [2, 5, 2, null, 4, null],
    [2, 2, 2, null, null, 0],
  ], ['2231--', '032--1', '131-2-', '111--0']],
  ['Fa♯', 'F#', 'MajorSeventh', ['F#maj7', 'F#maj7/A#', 'F#maj7/C#', 'F#maj7/E#'], [
    [1, 2, 3, null, null, 2],
    [null, 6, 6, 4, null, 6],
    [null, 6, 3, 4, 4, null],
    [2, 2, 3, null, null, 1],
  ], ['123--2', '-231-4', '-3122-', '223--1']],
  ['Fa♯', 'F#', 'Diminished', ['F#dim', 'F#dim/A', 'F#dim/C'], [
    [2, 1, 2, 4, null, null],
    [2, 1, 2, null, 0, null],
    [2, 1, 2, null, 3, null],
  ], ['2134--', '213-0-', '213-4-']],
  ['La♭', 'Ab', 'Major', ['Ab', 'Ab/C', 'Ab/Eb'], [
    [4, 4, 5, null, null, 4],
    [4, 4, 1, null, 3, null],
    [4, 1, 1, 1, null, null],
  ], ['112--1', '331-2-', '2111--']],
  ['La♭', 'Ab', 'Minor', ['Abm', 'Abm/Cb', 'Abm/Eb'], [
    [4, 4, 4, null, null, 4],
    [4, 4, 4, null, 2, null],
    [4, 4, 4, 1, null, null],
  ], ['111--1', '222-1-', '2221--']],
  ['La♭', 'Ab', 'Seventh', ['Ab7', 'Ab7/C', 'Ab7/Eb'], [
    [2, 1, 1, null, null, 4],
    [2, 4, 1, null, 3, null],
    [2, 1, 1, 1, null, null],
  ], ['211--3', '241-3-', '2111--']],
  ['La♭', 'Ab', 'MinorSeventh', ['Abm7', 'Abm7/Cb', 'Abm7/Eb', 'Abm7/Gb'], [
    [2, 4, 4, null, null, 4],
    [2, 4, 1, null, 2, null],
    [2, 0, 1, 1, null, null],
    [4, 4, 4, 4, null, null],
  ], ['122--2', '241-3-', '2011--', '1111--']],
  ['La♭', 'Ab', 'MajorSeventh', ['Abmaj7', 'Abmaj7/C', 'Abmaj7/Eb', 'Abmaj7/G'], [
    [3, 4, 5, null, null, 4],
    [3, 4, 1, null, 3, null],
    [3, 1, 1, 1, null, null],
    [4, 4, 5, null, null, 3],
  ], ['123--2', '241-3-', '2111--', '223--1']],
  ['La♭', 'Ab', 'Diminished', ['Abdim', 'Abdim/Cb', 'Abdim/Ebb'], [
    [4, 3, 4, 6, null, null],
    [4, 3, 4, null, 2, null],
    [4, 3, 4, null, 5, null],
  ], ['2134--', '324-1-', '213-4-']],
  ['Si♭', 'Bb', 'Major', ['Bb', 'Bb/D', 'Bb/F'], [
    [1, 3, 3, null, 1, null],
    [1, 3, 3, 0, null, null],
    [1, 3, 3, null, null, 1],
  ], ['122-1-', '1220--', '122--1']],
  ['Si♭', 'Bb', 'Minor', ['Bbm', 'Bbm/Db', 'Bbm/F'], [
    [1, 2, 3, null, 1, null],
    [1, 2, 3, null, 4, null],
    [1, 2, 3, null, null, 1],
  ], ['123-1-', '123-4-', '123--1']],
  ['Si♭', 'Bb', 'Seventh', ['Bb7', 'Bb7', 'Bb7/D', 'Bb7/F', 'Bb7/Ab'], [
    [1, 3, 1, null, 1, null],
    [4, 3, 1, null, 1, null],
    [4, 6, 3, 0, null, null],
    [4, 3, 3, null, null, 1],
    [1, 3, 3, null, null, 4],
  ], ['121-1-', '321-1-', '2310--', '322--1', '122--3']],
  ['Si♭', 'Bb', 'MinorSeventh', ['Bbm7', 'Bbm7/Db', 'Bbm7/F', 'Bbm7/Ab'], [
    [1, 2, 1, null, 1, null],
    [4, 6, 3, null, 4, null],
    [4, 2, 3, null, null, 1],
    [1, 2, 3, null, null, 4],
  ], ['121-1-', '241-3-', '423--1', '123--4']],
  ['Si♭', 'Bb', 'MajorSeventh', ['Bbmaj7', 'Bbmaj7/D', 'Bbmaj7/F', 'Bbmaj7/A'], [
    [1, 3, 2, null, 1, null],
    [5, 6, 3, null, 5, null],
    [5, 3, 3, 3, null, null],
    [1, 3, 3, null, 0, null],
  ], ['132-1-', '241-3-', '2111--', '122-0-']],
  ['Si♭', 'Bb', 'Diminished', ['Bbdim', 'Bbdim/Db', 'Bbdim/Fb'], [
    [0, 2, 3, null, 1, null],
    [6, 5, 6, null, 4, null],
    [6, 5, 6, null, 7, null],
  ], ['023-1-', '324-1-', '213-4-']],
];

// Alternate upper voices on strings 2–4, with the bass on string 5 or 6.
// Each fingering belongs to its exact form (string 1 first), not just its name.
const MIDDLE_STRING_POSITIONS = [
  ['C', 'Major', ['C', 'C/E', 'C/G'], [
    [null, 1, 0, 2, 3, null], [null, 1, 0, 2, null, 0], [null, 1, 0, 2, null, 3],
  ], ['-1023-', '-102-0', '-102-3']],
  ['C', 'Minor', ['Cm', 'Cm/Eb', 'Cm/G'], [
    [null, 1, 0, 1, 3, null], [null, 4, 5, 5, 6, null], [null, 4, 5, 5, null, 3],
  ], ['-1024-', '-1234-', '-234-1']],
  ['D', 'Major', ['D', 'D/F#', 'D/A'], [
    [null, 3, 2, 4, 5, null], [null, 3, 2, 4, null, 2], [null, 3, 2, 4, 0, null],
  ], ['-2134-', '-214-1', '-2130-']],
  ['D', 'Minor', ['Dm', 'Dm/F', 'Dm/A'], [
    [null, 3, 2, 3, 5, null], [null, 3, 2, 3, null, 1], [null, 3, 2, 3, 0, null],
  ], ['-2134-', '-324-1', '-2130-']],
  ['E', 'Major', ['E', 'E/G#', 'E/B'], [
    [null, 0, 1, 2, null, 0], [null, 0, 1, 2, null, 4], [null, 0, 1, 2, 2, null],
  ], ['-012-0', '-012-4', '-0132-']],
  ['E', 'Minor', ['Em', 'Em/G', 'Em/B'], [
    [null, 0, 0, 2, null, 0], [null, 0, 0, 2, null, 3], [null, 0, 0, 2, 2, null],
  ], ['-002-0', '-002-3', '-0032-']],
  ['F', 'Major', ['F', 'F/A', 'F/C'], [
    [null, 1, 2, 3, null, 1], [null, 1, 2, 3, 0, null], [null, 1, 2, 3, 3, null],
  ], ['-123-1', '-1230-', '-1243-']],
  ['F', 'Minor', ['Fm', 'Fm/Ab', 'Fm/C'], [
    [null, 1, 1, 3, null, 1], [null, 1, 1, 3, null, 4], [null, 1, 1, 3, 3, null],
  ], ['-113-1', '-112-4', '-1143-']],
  ['G', 'Major', ['G', 'G/B', 'G/D'], [
    [null, 0, 0, 0, null, 3], [null, 0, 0, 0, 2, null], [null, 0, 0, 0, 5, null],
  ], ['-000-3', '-0002-', '-0004-']],
  ['G', 'Minor', ['Gm', 'Gm/Bb', 'Gm/D'], [
    [null, 3, 3, 5, null, 3], [null, 3, 3, 5, 1, null], [null, 3, 3, 5, 5, null],
  ], ['-113-1', '-2231-', '-1143-']],
  ['A', 'Major', ['A', 'A/C#', 'A/E'], [
    [null, 2, 2, 2, 0, null], [null, 2, 2, 2, 4, null], [null, 2, 2, 2, null, 0],
  ], ['-1110-', '-1113-', '-111-0']],
  ['A', 'Minor', ['Am', 'Am/C', 'Am/E'], [
    [null, 1, 2, 2, 0, null], [null, 1, 2, 2, 3, null], [null, 1, 2, 2, null, 0],
  ], ['-1320-', '-1324-', '-132-0']],
  ['B', 'Major', ['B', 'B/D#', 'B/F#'], [
    [null, 4, 4, 4, 2, null], [null, 4, 4, 4, 6, null], [null, 4, 4, 4, null, 2],
  ], ['-3331-', '-1113-', '-333-1']],
  ['B', 'Minor', ['Bm', 'Bm/D', 'Bm/F#'], [
    [null, 3, 4, 4, 2, null], [null, 3, 4, 4, 5, null], [null, 3, 4, 4, null, 2],
  ], ['-2341-', '-1324-', '-234-1']],
  ['C', 'Seventh', ['C7'], [[null, 5, 3, 5, 3, null]], ['-4131-']],
  ['D', 'Seventh', ['D7'], [[null, 1, 2, 4, 5, null]], ['-1234-']],
  ['E', 'Seventh', ['E7'], [[null, 0, 1, 0, null, 0]], ['-010-0']],
  ['F', 'Seventh', ['F7'], [[null, 1, 2, 1, null, 1]], ['-121-1']],
  ['G', 'Seventh', ['G7'], [[null, 3, 4, 3, null, 3]], ['-121-1']],
  ['A', 'Seventh', ['A7'], [[null, 2, 0, 2, 0, null]], ['-2010-']],
  ['B', 'Seventh', ['B7'], [[null, 4, 2, 4, 2, null]], ['-4131-']],
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
  Cm: '230-1-', 'Cm/Eb': '3102--', 'Cm/G': '123--1',
  C7: '014-3-', 'C7/E': '0142--', 'C7/G': '014--3', 'C7/Bb': '014-1-',
  Cm7: '121-1-', 'Cm7/Eb': '2131--', 'Cm7/G': '423--1', 'Cm7/Bb': '123--4',
  D: '2310--', 'D/F#': '131--1', 'D/A': '231-0-',
  Dm: '1320--', 'Dm/F': '1423--', 'Dm/A': '132-0-',
  D7: '3120--', 'D7/F#': '3142--', 'D7/A': '123-0-', 'D7/C': '121-3-',
  Dm7: '1120--', 'Dm7/F': '2131--', 'Dm7/A': '-2100-', 'Dm7/C': '132-4-',
  E: '001--0', 'E/G#': '001--4', 'E/B': '001-2-',
  Em: '000--0', 'Em/G': '000--3', 'Em/B': '000-2-',
  '3 0 0 x x 0': '300--0', '3 0 0 2 x x': '3002--',
  E7: '041--0', 'E7/B': '041-2-',
  Em7: '112--0', 'Em7/G': '012--1', 'Em7/B': '020-1-', 'Em7/D': '0000--',
  F: '1123--', 'F/A': '112-0-', 'F/C': '112-3-',
  Fm: '1113--', 'Fm/Ab': '111--4', 'Fm/C': '111-3-',
  F7: '1423--', 'F7/A': '142-0-', 'F7/C': '142-3-', 'F7/Eb': '1421--',
  Fm7: '2231--', 'Fm7/Ab': '-241-3', 'Fm7/C': '131-2-', 'Fm7/Eb': '1111--',
  G: '112--1', 'G/B': '220-1-', 'G/D': '3000--',
  Gm: '111--1', 'Gm/Bb': '333-1-', 'Gm/D': '1110--',
  G7: '100--3', 'G7/B': '140-2-', 'G7/D': '1000--',
  Gm7: '134--2', 'Gm7/Bb': '130-2-', 'Gm7/D': '1210--', 'Gm7/F': '1111--',
  A: '032-0-', 'A/C#': '021-4-', 'A/E': '032--0',
  Am: '012-0-', 'Am/C': '012-3-', 'Am/E': '012--0',
  A7: '020-0-', 'A7/C#': '220-1-', 'A7/E': '210--0', 'A7/G': '011--2',
  // Alternate A7 voicing with the seventh on string 1 and the fifth omitted.
  '3 2 0 x 0 x': '210-0-',
  Am7: '010-0-', 'Am7/C': '220-1-', 'Am7/E': '312--0', 'Am7/G': '012--3',
  B: '143-1-', 'B/D#': '2431--', 'B/F#': '134--1',
  Bm: '124-1-', 'Bm/D': '1240--', 'Bm/F#': '124--1',
  B7: '141-1-', 'B7/D#': '4031--', 'B7/F#': '322--1',
  // Alternate voicing of B7 with the fifth above the root.
  'x 4 2 4 2 x': '-4131-',
  // Alternate B7/F# voicing on the middle strings, with all four chord tones.
  'x 0 2 1 x 2': '-021-3',
  Bm7: '131-1-', 'Bm7/D': '1020--', 'Bm7/F#': '423--1', 'Bm7/A': '123-0-',
  Cmaj7: '000-3-', 'Cmaj7/E': '314--0', 'Cmaj7/G': '014--3', 'Cmaj7/B': '010-2-',
  Dmaj7: '1110--', 'Dmaj7/F#': '324--1', 'Dmaj7/A': '124-0-', 'Dmaj7/C#': '121-4-',
  Emaj7: '111--0', 'Emaj7/G#': '011--1', 'Emaj7/B': '041-2-', 'Emaj7/D#': '0011--',
  Fmaj7: '012--1', 'Fmaj7/A': '021-0-', 'Fmaj7/C': '142-3-', 'Fmaj7/E': '112--0',
  Gmaj7: '123--2', 'Gmaj7/B': '230-1-', 'Gmaj7/D': '1000--', 'Gmaj7/F#': '224--1',
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

function formKey(form) {
  return form.map((fret) => fret === null ? 'x' : fret).join(' ');
}

MIDDLE_STRING_POSITIONS.forEach(([root, quality, names, forms, fingerings]) => {
  const group = GROUPS.find(([, en, variant]) => en === root && variant === quality);
  // Keep all variants together in the existing quality tab and search index.
  group[5] = group[3].map((name, i) => FINGERINGS[formKey(group[4][i])] || FINGERINGS[name]);
  forms.forEach((form, i) => {
    if (group[4].some((existing) => formKey(existing) === formKey(form))) return;
    group[3].push(names[i]);
    group[4].push(form);
    group[5].push(fingerings[i]);
  });
});

function pitchClass(note) {
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (natural[note[0]] + [...note.slice(1)].reduce((sum, accidental) => sum + (accidental === '#' ? 1 : -1), 0) + 12) % 12;
}

const OPEN_PITCHES = [64, 59, 55, 50, 45, 40];
function soundingPitches(form) {
  return form.flatMap((fret, string) => fret === null ? [] : [OPEN_PITCHES[string] + fret]);
}

// Classify the exact sounding form after all variants have been added. Keep
// names, forms and fingerings together when moving or sorting positions.
GROUPS.forEach((group) => {
  group[5] ||= group[3].map((name, i) => FINGERINGS[formKey(group[4][i])] || FINGERINGS[name]);
});
GROUPS.filter(([, , quality]) => quality === 'Seventh').forEach((group) => {
  const root = pitchClass(group[1]);
  const withoutFifth = GROUPS.find(([, en, quality]) => en === group[1] && quality === 'SeventhNoFifth');
  for (let i = group[4].length - 1; i >= 0; i--) {
    if (soundingPitches(group[4][i]).some((pitch) => (pitch - root + 12) % 12 === 7)) continue;
    if (!withoutFifth[4].some((form) => formKey(form) === formKey(group[4][i]))) {
      for (const field of [3, 4, 5]) withoutFifth[field].push(group[field][i]);
    }
    for (const field of [3, 4, 5]) group[field].splice(i, 1);
  }
});
// Keep the curated positions, then complete first position for every quality.
GROUPS.forEach((group) => {
  const root = group[1] === 'Dim7' ? group[3][0].replace(/dim7$/, '') : group[1];
  const existing = new Set(group[4].map(formKey));
  for (const position of firstPositionForms(root, group[2])) {
    const key = formKey(position.form);
    if (existing.has(key)) continue;
    existing.add(key);
    group[3].push(position.name);
    group[4].push(position.form);
    group[5].push(position.fingering);
  }
});
GROUPS.forEach((group) => {
  if (group[1] === 'Dim7') return; // Symmetric sets have no single root.
  const root = pitchClass(group[1]);
  const positions = group[4].map((form, i) => ({
    name: group[3][i], form, fingering: group[5][i],
    bass: (Math.min(...soundingPitches(form)) - root + 12) % 12,
  })).sort((a, b) => a.bass - b.bass);
  group[3] = positions.map((position) => position.name);
  group[4] = positions.map((position) => position.form);
  group[5] = positions.map((position) => position.fingering);
});

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
        return fret === null ? null : { fret, bold: string === form.findLastIndex((fret) => fret !== null) };
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
      tabFigure(title, styledForms, locale, null, buttons, 6) +
      '<div class="arpeggio-diagrams" hidden data-chords="' + names.map((_, i) => 'arpeggio-chord-' + group + '-' + i).join(' ') + '"></div>';
  });
  const tabs = Array.from(orderedRoots(roots), function ([root, { title, note, variants }]) {
    const id = 'arpeggio-' + root;
    return '<section class="arpeggio-group" aria-label="' + title + '">' +
      '<div class="arpeggio-group-header"><button type="button" class="arpeggio-root" aria-pressed="false" id="' + id + '-root">' + title + '</button>' +
      '<div role="tablist" aria-labelledby="' + id + '-root">' + variants.map(function (variant, i) {
        return '<button type="button" role="tab" id="' + id + '-tab-' + i + '" aria-controls="' + id + '-panel-' + i +
          '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '">' + variant.title + '</button>';
      }).join('') + '</div>' + viewSwitch(title, strings) + '</div>' + (note ? '<p class="arpeggio-note">' + note + '</p>' : '') + variants.map(function (variant, i) {
        return '<div role="tabpanel" id="' + id + '-panel-' + i + '" aria-labelledby="' + id + '-tab-' + i +
          '" tabindex="0"' + (i === 0 ? '' : ' hidden') + '>' + variant.figure + '</div>';
      }).join('') + '</section>';
  });
  return '<p>' + strings.artArpeggiosIntro + '</p><h2 class="arpeggio-results-title" id="arpeggio-results-title" hidden>' + strings.artArpeggiosResults +
    '</h2><div class="arpeggio-no-results" id="arpeggio-no-results" role="status" hidden>' +
    '<div class="arpeggio-empty-tab"><div aria-hidden="true">' + tabFigure('', [new Array(6).fill(null)], locale) +
    '</div><div class="arpeggio-empty-label"><span>Oh no</span><p>' + strings.artArpeggiosNoResults +
    '</p></div></div></div><div class="sequence-forms">' + tabs.join('') + '</div>' + popovers.join('') + CHORD_CARD_LOADER + TAB_LOADER + POPOVER_LOADER + QUALITY_TABS_LOADER +
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
  var root = group.querySelector('.arpeggio-root');
  function updateView() {
    group.querySelectorAll('ascii-tabs').forEach(function(tab) {
      tab.setAttribute('notation', root.getAttribute('aria-pressed') === 'true' ? (tab.lang === 'es' ? 'solfege' : 'letters') : 'frets');
    });
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
  root.addEventListener('click', function() {
    root.setAttribute('aria-pressed', String(root.getAttribute('aria-pressed') !== 'true'));
    updateView();
  });
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
  var searchTimer;
  var searchVersion = 0;

  function fretOf(note) { return note !== null && typeof note === 'object' ? note.fret : note; }
  function active() { return query.some(function(fret) { return fret !== null; }); }

  function render() {
    var on = active();
    toggle.setAttribute('aria-label', on || open ? toggle.dataset.clear : toggle.dataset.search);
    toggle.setAttribute('aria-expanded', String(open));
    search.classList.toggle('is-active', on || open);
    popup.hidden = !open;
  }

  function yieldToInput() {
    return window.scheduler && window.scheduler.yield
      ? window.scheduler.yield()
      : new Promise(function(resolve) { setTimeout(resolve, 0); });
  }

  function scheduleFilter(immediate) {
    clearTimeout(searchTimer);
    var version = ++searchVersion;
    search.setAttribute('aria-busy', 'true');
    var frets = query.slice();
    if (immediate) filter(frets, version);
    else searchTimer = setTimeout(function() { filter(frets, version); }, 250);
  }

  async function filter(frets, version) {
    var on = frets.some(function(fret) { return fret !== null; });
    var found = false;
    for (var root of data.roots) {
      // Rendering a root can be expensive: let pending typing run between roots.
      if (on) await yieldToInput();
      if (version !== searchVersion) return;
      var section = document.getElementById(root.id + '-root').closest('.arpeggio-group');
      // Every query starts in tablature, including roots hidden by the filter.
      section.querySelector('.arpeggio-view-switch').setAttribute('aria-checked', 'true');
      var results = section.querySelector('.arpeggio-results');
      var matches = root.chords.filter(function(chord) {
        return frets.every(function(fret, s) { return fret === null || chord.form[s] === fret; });
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
      if (!on || !matches.length) {
        if (results) results.hidden = true;
        section.dispatchEvent(new Event('arpeggioresultschange'));
        continue;
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
        columns.push(chord.form.map(function(fret, s) { return fret === null ? null : { fret: fret, bold: s === chord.form.findLastIndex(function(fret) { return fret !== null; }) }; }));
      });
      section.dispatchEvent(new Event('arpeggioresultschange'));
      // Keep a readable font; the component wraps the matches into staves.
      results.style.setProperty('--chars', 23);
      var tab = results.querySelector('ascii-tabs');
      await customElements.whenDefined('ascii-tabs');
      if (version !== searchVersion) return;
      tab.setDocument({ value: tabs, annotations: annotations });
    }
    document.getElementById('arpeggio-results-title').hidden = !on;
    document.getElementById('arpeggio-no-results').hidden = !on || found;
    search.setAttribute('aria-busy', 'false');
  }

  // Focus is given by replaying a press on the first cell, which has no real pointer to capture.
  input.setPointerCapture = function() {};

  // A hidden ascii-tabs draws its cells only once it is shown and measured, a few frames after the popup opens.
  var focusRetries = 0;
  function focusFirstCell() {
    var cell = input.querySelector('.ascii-tabs-cell');
    if (!cell && focusRetries++ < 10) return requestAnimationFrame(focusFirstCell);
    focusRetries = 0;
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
    scheduleFilter(!active());
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
      scheduleFilter(true);
    } else {
      open = true;
    }
    render();
    if (open) customElements.whenDefined('ascii-tabs').then(function() { requestAnimationFrame(focusFirstCell); });
  });

  popup.querySelector('.arpeggio-search-clear').addEventListener('click', function() {
    query = [];
    resetInput();
    scheduleFilter(!active());
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
