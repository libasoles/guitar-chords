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
        [2, 2], [2, 3], [2, 5], [2, 7], [2, 8], [2, 10], [2, 12],
        [3, 2], [3, 4], [3, 6], [3, 7], [3, 9], [3, 11], [3, 12],
        [4, 'x'],
        [5, 'x'],
        [6, 'o'],
      ],
    },
    2: {
      frets: 12,
      fingers: [
        [1, 2], [1, 3], [1, 5], [1, 7], [1, 9], [1, 10], [1, 12],
        [2, 'x'],
        [3, 2], [3, 4], [3, 6], [3, 7], [3, 9], [3, 11], [3, 12],
        [4, 'x'],
        [5, 'x'],
        [6, 'o'],
      ],
    },
    3: {
      frets: 15,
      fingers: [
        [1, 2], [1, 3], [1, 5], [1, 7], [1, 9], [1, 10], [1, 12], [1, 14],
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

  // svguitar's horizontal orientation mis-renders the open-string ('o')
  // marker as a zero-radius "ghost" circle (class contains "fret-NaN") sitting
  // at x=0 instead of next to the nut — its cy is correct, only cx/r/style are
  // wrong. Reposition it using the geometry of the (correctly rendered) 'x'
  // silent-string markers, which are short diagonal line pairs near the nut.
  function fixOpenStringMarker(svg) {
    var ghost = svg.querySelector('circle.finger-circle[class*="fret-NaN"]');
    if (!ghost) return;

    var xs = [];
    svg.querySelectorAll('line').forEach(function (line) {
      var x1 = parseFloat(line.getAttribute('x1'));
      var y1 = parseFloat(line.getAttribute('y1'));
      var x2 = parseFloat(line.getAttribute('x2'));
      var y2 = parseFloat(line.getAttribute('y2'));
      if (Math.abs(x2 - x1) < 60 && Math.abs(y2 - y1) < 60) {
        xs.push(x1, x2);
      }
    });
    if (!xs.length) return;

    var headerX = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    var radius = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / 2;

    ghost.setAttribute('cx', String(headerX));
    ghost.setAttribute('r', String(radius));
    ghost.setAttribute('fill', 'none');
    ghost.setAttribute('stroke', '#1a1a1a');
    ghost.setAttribute('stroke-width', '2');
  }

  document.querySelectorAll('.picking-diagram').forEach(function (el) {
    var pattern = PATTERNS[el.getAttribute('data-pattern')];
    if (!pattern || !window.svguitar) return;

    new svguitar.SVGuitarChord(el)
      .configure(Object.assign({}, CONFIG_BASE, { frets: pattern.frets }))
      .chord({ fingers: pattern.fingers, barres: [] })
      .draw();

    var svg = el.querySelector('svg');
    if (svg) fixOpenStringMarker(svg);
  });
})();
