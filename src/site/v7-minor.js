/* v7-minor.js — Renders the tonic/V7 two-column list for minor chords.
   The V7 of a minor key sits a perfect fifth above the root, same interval as
   for major keys (e.g. Am -> E7, the harmonic-minor dominant of A minor).
   Pairs walk the circle of fifths starting at Am; each name must match a
   `name` in window.CHORDS (or window.V7_CHORD_OVERRIDES) exactly. */
(function () {
  'use strict';

  // Cm sits at fret 3 (barred, A-shape). chords-db's default G7 is the open
  // first-position voicing, a big jump down the neck. This barred G7 (E-shape
  // dom7, the same shape as F7/B♭7's overrides) keeps the hand near fret 3-5.
  var G7_NEAR_CM = {
    name: 'G7', families: ['dom7'], aliases: [],
    notes: 'G D F B D G', position: 3, barres: [{ fromString: 6, toString: 1, fret: 3 }],
    fingers: [[5, 5, '3'], [3, 4, '2']]
  };

  var PAIRS = [
    ['Am', 'E7'],
    ['Em', 'B7'],
    ['Bm', 'F♯7'],
    ['F♯m', 'D♭7'],
    ['C♯m', 'A♭7'],
    ['G♯m', 'E♭7'],
    ['E♭m', 'B♭7'],
    ['B♭m', 'F7'],
    ['Fm', 'C7'],
    ['Cm', G7_NEAR_CM],
    ['Gm', 'D7'],
    ['Dm', 'A7']
  ];

  window.V7GuidePage.render('v7Grid', PAIRS);
})();
