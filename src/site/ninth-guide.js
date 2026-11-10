/* Ninth-chord catalogue. Database voicings stay shared with the finder;
   diminished sevenths with an added ninth use a movable five-note shape. */
(function () {
  'use strict';
  var roots = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  var families = [
    ['major', 'maj9'], ['minor', 'm9'], ['dominant', '9'],
    ['flat', '7♭9'], ['diminished', 'dim7(add9)'],
    ['add', 'add9'], ['minorAdd', 'm(add9)'],
  ];
  var groups = families.map(function (family) {
    return {
      gridId: 'ninthGrid-' + family[0],
      chromatic: true,
      chords: roots.map(function (root, pitch) {
        if (family[0] !== 'diminished') return root + family[1];
        // C shape: x 3 1 2 3 2 = C E♭ B𝄫 D G♭ (1 ♭3 𝄫7 9 ♭5).
        // Transpose upward so every note stays fretted, including B.
        var shift = pitch;
        return {
          name: root + family[1], position: 1 + shift,
          fingers: [[6, 'x'], [5, 3 + shift, '3'], [4, 1 + shift, '1'],
            [3, 2 + shift, '2'], [2, 3 + shift, '4'], [1, 2 + shift, '2']],
          barres: [{ fromString: 3, toString: 1, fret: 2 + shift }],
        };
      }),
    };
  });
  window.DimGuidePage.render(groups);
})();
