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

  // svguitar's horizontal orientation leaves open-string markers clipped
  // against the left edge. Reposition the actual open-string circles using the
  // geometry of the correctly rendered 'x' silent-string markers near the nut.
  function fixOpenStringMarker(svg) {
    var opens = svg.querySelectorAll('circle.open-string');
    if (!opens.length) return;

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

    opens.forEach(function (open) {
      var currentCx = parseFloat(open.getAttribute('cx') || '0');
      var currentRadius = parseFloat(open.getAttribute('r') || String(radius));
      if (currentCx > currentRadius) return;

      open.setAttribute('cx', String(headerX));
      open.setAttribute('r', String(radius));
      open.setAttribute('fill', 'none');
      open.setAttribute('stroke', '#1a1a1a');
      open.setAttribute('stroke-width', '2');
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
    if (svg) fixOpenStringMarker(svg);
  });
})();
