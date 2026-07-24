/* circle-fifths.js — Data for the "circle of fifths" page. The 12 major chords
   in circle-of-fifths order, ascending by perfect fifths from E♭ to A♭. Each
   name must match a `name` in window.CHORDS exactly. The per-locale labels for
   the three interval counts arrive via window.CIRCLE_LABELS, set inline in the
   page (see the v7-guide.html-style template). */
(function () {
  'use strict';

  var NAMES = [
    'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭'
  ];

  var LABELS = window.CIRCLE_LABELS || { root: '1ª', third: '3ª', fifth: '5ª', times: 'veces' };

  window.CircleFifthsPage.render('circleGrid', NAMES, LABELS);
})();
