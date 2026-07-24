/* circle-fifths-minor.js — Data for the minor variant of the "chords and their
   notes" page. The 12 minor chords in the same circle-of-fifths order as the
   major page (ascending by perfect fifths from E♭m to A♭m/G♯m). Each name must
   match a `name` in window.CHORDS exactly. Passing thirdSemitones = 3 tells the
   renderer to tally the minor third instead of the major third. Labels arrive
   via window.CIRCLE_LABELS, set inline in the page. */
(function () {
  'use strict';

  var NAMES = [
    'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm', 'Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m'
  ];

  var LABELS = window.CIRCLE_LABELS || { root: '1ª', third: '3ª', fifth: '5ª', times: 'veces' };

  window.CircleFifthsPage.render('circleGrid', NAMES, LABELS, { thirdSemitones: 3 });
})();
