/* v7-minor.js — Renders the tonic/V7 two-column list for minor chords.
   The V7 of a minor key sits a perfect fifth above the root, same interval as
   for major keys (e.g. Am -> E7, the harmonic-minor dominant of A minor).
   Pairs walk the circle of fifths starting at Am; each name must match a
   `name` in window.CHORDS (or window.V7_CHORD_OVERRIDES) exactly. */
(function () {
  'use strict';

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
    ['Cm', 'G7'],
    ['Gm', 'D7'],
    ['Dm', 'A7']
  ];

  window.V7GuidePage.render('v7Grid', PAIRS);
})();
