(function () {
  'use strict';

  // Strings numbered 1 (high e) to 6 (low E), matching svguitar/chords-db
  // convention. String 6 is always 'o' — the open low-E pedal note — and
  // strings not part of a pattern are 'x' (not played).
  var PATTERNS = {
    1: {
      frets: 12,
      fingers: [
        [1, 'x'],
        [2, 'o'], [2, 2], [2, 3], [2, 5], [2, 7], [2, 8], [2, 10], [2, 12],
        [3, 'o'], [3, 2], [3, 4], [3, 6], [3, 7], [3, 9], [3, 11], [3, 12],
        [4, 'x'],
        [5, 'x'],
        [6, 'o'],
      ],
    },
    2: {
      frets: 12,
      fingers: [
        [1, 'o'], [1, 2], [1, 3], [1, 5], [1, 7], [1, 9], [1, 10], [1, 12],
        [2, 'x'],
        [3, 'o'], [3, 2], [3, 4], [3, 6], [3, 7], [3, 9], [3, 11], [3, 12],
        [4, 'x'],
        [5, 'x'],
        [6, 'o'],
      ],
    },
    3: {
      frets: 15,
      fingers: [
        [1, 'o'], [1, 2], [1, 3], [1, 5], [1, 7], [1, 9], [1, 10], [1, 12], [1, 14],
        [2, 2], [2, 3], [2, 5], [2, 7], [2, 8], [2, 10], [2, 12], [2, 14], [2, 15],
        [3, 'x'],
        [4, 'x'],
        [5, 'x'],
        [6, 'o'],
      ],
    },
  };

  var CONFIG_BASE = {
    strings: 6,
    orientation: 'horizontal',
    position: 1,
    noPosition: true,
    color: '#1a1a1a',
    backgroundColor: 'transparent',
    fingerSize: 0.55,
    fingerTextSize: 0,
    fingerStrokeWidth: 0,
    strokeWidth: 2,
    nutWidth: 6,
    sidePadding: 0.08,
    fretSize: 1.3,
    emptyStringIndicatorSize: 0.5,
    showFretMarkers: false,
  };

  // In horizontal orientation the vendored svguitar draws an open string ("o")
  // as a regular finger circle at cx=0 — half of it falls outside the viewBox,
  // so it reads as a half-disk sitting left of the muted-string X's. Move those
  // circles into the X column so both marker types line up whole and centered.
  //
  // Neither marker carries a usable class here (open strings only differ by the
  // NaN fret their non-numeric "o" produces, and the X's are plain <line>s), so
  // both are matched by shape: X's are the only diagonal lines in the diagram.
  function fixStringMarkers(svg) {
    var centers = [];
    svg.querySelectorAll('line').forEach(function (line) {
      var x1 = parseFloat(line.getAttribute('x1'));
      var y1 = parseFloat(line.getAttribute('y1'));
      var x2 = parseFloat(line.getAttribute('x2'));
      var y2 = parseFloat(line.getAttribute('y2'));
      if (x1 !== x2 && y1 !== y2) centers.push((x1 + x2) / 2);
    });
    if (!centers.length) return;

    var markerX = centers.reduce(function (a, b) { return a + b; }, 0) / centers.length;
    svg.querySelectorAll('circle[class*="finger-fret-NaN"]').forEach(function (open) {
      open.setAttribute('cx', markerX);
    });
  }

  document.querySelectorAll('.picking-diagram').forEach(function (el) {
    var pattern = PATTERNS[el.getAttribute('data-pattern')];
    if (!pattern || !window.svguitar) return;

    new svguitar.SVGuitarChord(el)
      .configure(Object.assign({}, CONFIG_BASE, { frets: pattern.frets }))
      .chord({ fingers: pattern.fingers, barres: [] })
      .draw();

    var svg = el.querySelector('svg');
    if (svg) fixStringMarkers(svg);
  });
})();
