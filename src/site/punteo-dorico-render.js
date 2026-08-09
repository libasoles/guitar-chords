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

  function leftHalfCirclePath(x, cy, r) {
    return [
      'M', x, cy - r,
      'A', r, r, 0, 0, 0, x, cy + r,
      'Z',
    ].join(' ');
  }

  // svguitar's horizontal open-string markers do not match the intended
  // lesson artwork. Replace them with filled semicircles attached to the nut.
  function fixOpenStringMarker(svg) {
    var opens = svg.querySelectorAll('circle.open-string');
    if (!opens.length) return;

    var nut = svg.querySelector('line.top-fret');
    if (!nut) return;

    opens.forEach(function (open) {
      var cy = parseFloat(open.getAttribute('cy') || '0');
      var r = parseFloat(open.getAttribute('r') || '0');
      if (!cy || !r) return;

      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      var nutX = parseFloat(nut.getAttribute('x1') || '0');
      path.setAttribute('d', leftHalfCirclePath(nutX, cy, r));
      path.setAttribute('fill', '#1a1a1a');
      path.setAttribute('stroke', 'none');
      path.setAttribute('class', 'open-string-half');
      open.replaceWith(path);
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
