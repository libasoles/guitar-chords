/* v7-guide.js — Renders the tonic/V7 two-column list on the "chords and their
   V7" page. Pairs walk the circle of fifths starting at C; each tonic name
   and each V7 name must match a `name` in window.CHORDS exactly (chords-db.js
   already prefers the open, no-barre voicing wherever one exists). */
(function () {
  'use strict';

  var PAIRS = [
    ['C', 'G7'],
    ['G', 'D7'],
    ['D', 'A7'],
    ['A', 'E7'],
    ['E', 'B7'],
    ['B', 'F♯7'],
    ['F♯', 'D♭7'],
    ['D♭', 'A♭7'],
    ['A♭', 'E♭7'],
    ['E♭', 'B♭7'],
    ['B♭', 'F7'],
    ['F', 'C7']
  ];

  window.V7GuidePage.render('v7Grid', PAIRS);
})();
