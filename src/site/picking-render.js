(function () {
  'use strict';

  // Strings numbered 1 (high e) to 6 (low E), matching svguitar/chords-db
  // convention. String 6 is always 'o' — the open low-E pedal note — and
  // strings not part of a pattern are 'x' (not played).
  //
  // Patterns are generated from the mode's interval set rather than
  // hardcoded per-mode fret lists: for a string whose open note sits
  // `openSemitone` semitones above E, a fret `f` lands on a scale tone when
  // (openSemitone + f) mod 12 is one of the mode's semitone offsets from E
  // (the pedal note). This reproduces the original hand-picked Dorian
  // fret lists exactly, so the same formula is trusted for the other modes.
  var SCALES = {
    dorian: [0, 2, 3, 5, 7, 9, 10],
    ionian: [0, 2, 4, 5, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
  };

  var OPEN_SEMITONE = { 1: 0, 2: 7, 3: 3, 4: 10, 5: 5, 6: 0 };

  function scaleFrets(scale, openSemitone, maxFret, skipOpen) {
    var out = [];
    for (var f = skipOpen ? 1 : 0; f <= maxFret; f++) {
      if (scale.indexOf((openSemitone + f) % 12) !== -1) out.push(f);
    }
    return out;
  }

  function toFingers(stringNum, frets) {
    return frets.map(function (f) { return [stringNum, f === 0 ? 'o' : f]; });
  }

  function buildPatterns(mode) {
    var scale = SCALES[mode] || SCALES.dorian;
    return {
      1: {
        frets: 12,
        fingers: [].concat(
          [[1, 'x']],
          toFingers(2, scaleFrets(scale, OPEN_SEMITONE[2], 12, false)),
          toFingers(3, scaleFrets(scale, OPEN_SEMITONE[3], 12, false)),
          [[4, 'x'], [5, 'x'], [6, 'o']]
        ),
      },
      2: {
        frets: 12,
        fingers: [].concat(
          toFingers(1, scaleFrets(scale, OPEN_SEMITONE[1], 12, false)),
          [[2, 'x']],
          toFingers(3, scaleFrets(scale, OPEN_SEMITONE[3], 12, false)),
          [[4, 'x'], [5, 'x'], [6, 'o']]
        ),
      },
      3: {
        frets: 15,
        fingers: [].concat(
          toFingers(1, scaleFrets(scale, OPEN_SEMITONE[1], 14, false)),
          toFingers(2, scaleFrets(scale, OPEN_SEMITONE[2], 15, true)),
          [[3, 'x'], [4, 'x'], [5, 'x'], [6, 'o']]
        ),
      },
    };
  }

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

  var mode = (document.body && document.body.getAttribute('data-picking-mode')) || 'dorian';
  var PATTERNS = buildPatterns(mode);

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
