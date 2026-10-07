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
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
  };

  var OPEN_SEMITONE = { 1: 0, 2: 7, 3: 3, 4: 10, 5: 5, 6: 0 };

  // Absolute semitone offsets from the open low E (string 6), i.e. the real
  // pitch distance between strings in standard tuning — unlike OPEN_SEMITONE
  // these aren't reduced mod 12, so they preserve which string sits in which
  // octave. Needed to work out true diatonic intervals between two strings
  // (see degreeStep below).
  var ABS_OPEN = { 1: 24, 2: 19, 3: 15, 4: 10, 5: 5, 6: 0 };

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

  // Maps an absolute pitch to a continuous "diatonic step" number: each
  // successive scale tone (within or across octaves) is one step apart, so
  // subtracting two of these gives how many scale degrees apart two notes
  // are — 2 steps is a diatonic 3rd, 5 steps is a diatonic 6th. Only ever
  // called with pitches that land on the scale.
  function degreeStep(scale, absPitch) {
    var pc = ((absPitch % 12) + 12) % 12;
    var idx = scale.indexOf(pc);
    if (idx === -1) return null;
    var octave = (absPitch - pc) / 12;
    return octave * 7 + idx;
  }

  // Pairs each note on the upper (higher-pitched) string with the note on
  // the lower string that sits exactly `intervalSteps` diatonic steps below
  // it (2 for a 3rd, 5 for a 6th) — the note it's harmonizing with in these
  // parallel-interval patterns. Not every note has a partner within the
  // diagram's fret range; those are simply left unpaired.
  function pairNotes(scale, upperString, upperFrets, lowerString, lowerFrets, intervalSteps) {
    var lowerStepToFret = {};
    lowerFrets.forEach(function (f) {
      lowerStepToFret[degreeStep(scale, ABS_OPEN[lowerString] + f)] = f;
    });
    var pairs = {};
    upperFrets.forEach(function (f) {
      var step = degreeStep(scale, ABS_OPEN[upperString] + f);
      var lowerFret = lowerStepToFret[step - intervalSteps];
      if (lowerFret !== undefined) {
        pairs[upperString + ':' + f] = lowerString + ':' + lowerFret;
        pairs[lowerString + ':' + lowerFret] = upperString + ':' + f;
      }
    });
    return pairs;
  }

  function buildPatterns(mode) {
    var scale = SCALES[mode] || SCALES.dorian;

    var p1Upper = scaleFrets(scale, OPEN_SEMITONE[2], 12, false);
    var p1Lower = scaleFrets(scale, OPEN_SEMITONE[3], 12, false);
    var p2Upper = scaleFrets(scale, OPEN_SEMITONE[1], 12, false);
    var p2Lower = scaleFrets(scale, OPEN_SEMITONE[3], 12, false);
    var p3Upper = scaleFrets(scale, OPEN_SEMITONE[1], 14, false);
    var p3Lower = scaleFrets(scale, OPEN_SEMITONE[2], 15, true);

    return {
      1: {
        frets: 12,
        fingers: [].concat(
          [[1, 'x']],
          toFingers(2, p1Upper),
          toFingers(3, p1Lower),
          [[4, 'x'], [5, 'x'], [6, 'o']]
        ),
        // Pattern 1 moves in parallel 3rds between strings 2 and 3.
        pairs: pairNotes(scale, 2, p1Upper, 3, p1Lower, 2),
      },
      2: {
        frets: 12,
        fingers: [].concat(
          toFingers(1, p2Upper),
          [[2, 'x']],
          toFingers(3, p2Lower),
          [[4, 'x'], [5, 'x'], [6, 'o']]
        ),
        // Pattern 2 skips a string, so strings 1 and 3 move in parallel 6ths.
        pairs: pairNotes(scale, 1, p2Upper, 3, p2Lower, 5),
      },
      3: {
        frets: 15,
        fingers: [].concat(
          toFingers(1, p3Upper),
          toFingers(2, p3Lower),
          [[3, 'x'], [4, 'x'], [5, 'x'], [6, 'o']]
        ),
        // Pattern 3 moves in parallel 3rds between strings 1 and 2.
        pairs: pairNotes(scale, 1, p3Upper, 2, p3Lower, 2),
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
    // svguitar derives all of these from `stringSpacing`.  A little more
    // side padding shortens the horizontal diagram's height; increasing the
    // other relative sizes by the same ratio preserves its width and the
    // diameter of the circular notes.
    fingerSize: 0.68,
    fingerTextSize: 0,
    fingerStrokeWidth: 0,
    strokeWidth: 2,
    nutWidth: 6,
    sidePadding: 0.16,
    fretSize: 1.606,
    emptyStringIndicatorSize: 0.618,
    showFretMarkers: false,
  };

  // Real fretboards dot these frets for orientation.
  var POSITION_MARKER_FRETS = [3, 5, 7, 9, 12];

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

  // svguitar's background fills the whole SVG canvas, which also includes the
  // open/muted-string symbols and the position markers. Give only the actual
  // fretboard a white surface instead, keeping those surrounding areas on the
  // page background.
  function addFretboardBackground(svg) {
    var left = Infinity;
    var top = Infinity;
    var right = -Infinity;
    var bottom = -Infinity;

    svg.querySelectorAll('line').forEach(function (line) {
      var x1 = parseFloat(line.getAttribute('x1'));
      var y1 = parseFloat(line.getAttribute('y1'));
      var x2 = parseFloat(line.getAttribute('x2'));
      var y2 = parseFloat(line.getAttribute('y2'));
      // Ignore the diagonal strokes used for muted-string X markers.
      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2) ||
          (x1 !== x2 && y1 !== y2)) return;
      left = Math.min(left, x1, x2);
      top = Math.min(top, y1, y2);
      right = Math.max(right, x1, x2);
      bottom = Math.max(bottom, y1, y2);
    });

    if (!isFinite(left) || !isFinite(top)) return;

    var board = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    board.setAttribute('x', left);
    board.setAttribute('y', top);
    board.setAttribute('width', right - left);
    board.setAttribute('height', bottom - top);
    board.setAttribute('fill', '#fff');
    board.setAttribute('class', 'picking-fretboard-background');
    svg.insertBefore(board, svg.firstChild);
  }

  // Real (criolla) fretboards mark frets 3, 5, 7, 9 and 12 with a small dot
  // inlaid above the strings, not on the neck itself. svguitar's own
  // fretMarkers option draws them centered inside the fretboard, so instead
  // this reads the fret-line x positions svguitar already drew and places a
  // dot above the top string line, centered over each marked fret's cell.
  function addPositionMarkers(svg, totalFrets) {
    var fretLineXs = [];
    var topInk = Infinity;
    svg.querySelectorAll('line').forEach(function (line) {
      var x1 = parseFloat(line.getAttribute('x1'));
      var y1 = parseFloat(line.getAttribute('y1'));
      var x2 = parseFloat(line.getAttribute('x2'));
      var y2 = parseFloat(line.getAttribute('y2'));
      if (x1 === x2 && y1 !== y2) fretLineXs.push(x1);
      topInk = Math.min(topInk, y1, y2);
    });
    // The topmost string's finger circles (open-string or fretted notes)
    // stick out above the string line itself — measure their top edge too,
    // so the gap above the markers is consistent whether or not the first
    // string has a note on it (otherwise a note there crowds the marker).
    svg.querySelectorAll('circle').forEach(function (circle) {
      var cy = parseFloat(circle.getAttribute('cy'));
      var r = parseFloat(circle.getAttribute('r'));
      if (isFinite(cy) && isFinite(r)) topInk = Math.min(topInk, cy - r);
    });
    if (!fretLineXs.length || !isFinite(topInk)) return;
    fretLineXs.sort(function (a, b) { return a - b; });

    var gap = 18;
    var radius = 8;
    var markerY = topInk - gap;

    // Grow the viewBox upward if there isn't enough headroom above the neck,
    // so the dots don't get clipped — svguitar only reserves a few units of
    // margin above the top string, not enough for the wider gap here.
    var box = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (box.length === 4) {
      var needed = radius + 2 - (markerY - box[1]);
      if (needed > 0) {
        box[1] -= needed;
        box[3] += needed;
        svg.setAttribute('viewBox', box.join(' '));
      }
    }

    var svgNS = 'http://www.w3.org/2000/svg';
    POSITION_MARKER_FRETS.forEach(function (fret) {
      if (fret > totalFrets) return;
      var left = fretLineXs[fret - 1];
      var right = fretLineXs[fret];
      if (left === undefined || right === undefined) return;
      var dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', (left + right) / 2);
      dot.setAttribute('cy', markerY);
      dot.setAttribute('r', radius);
      dot.setAttribute('fill', 'rgba(26, 26, 26, 0.35)');
      dot.setAttribute('class', 'position-marker position-marker-fret-' + fret);
      svg.appendChild(dot);
    });
  }

  // Wires hover on every melodic note — fretted or open — so pointing at one
  // highlights it and the 3rd/6th it's paired with, per pattern.pairs. The
  // pedal on string 6 is always open too and renders with the same
  // "fret-NaN" class as any other open note (fixStringMarkers above relies
  // on this too), so it's told apart by string number, not by shape, and
  // left out of the hover entirely.
  function pickingNoteElements(svg, pattern) {
    var elements = {};
    pattern.fingers.forEach(function (finger) {
      var stringNum = finger[0];
      var fret = finger[1];
      var arrIndex = Math.abs(stringNum - 6);
      if (fret === 'x') return;
      if (fret === 'o') {
        if (stringNum === 6) return;
        var openEl = svg.querySelector('.finger-string-' + arrIndex + '-fret-NaN');
        if (openEl) elements[stringNum + ':0'] = openEl;
        return;
      }
      var key = stringNum + ':' + fret;
      var el = svg.querySelector('.finger-string-' + arrIndex + '-fret-' + (fret - 1));
      if (el) elements[key] = el;
    });

    return elements;
  }

  // Draw each pair once, underneath the note circles.  The pair map contains
  // both directions so it can power hover from either note; a small seen map
  // prevents it from producing duplicate connector lines.
  function addPairConnectors(svg, pairs, elements) {
    var seen = {};
    var svgNS = 'http://www.w3.org/2000/svg';
    var firstNote = Object.keys(elements).map(function (key) {
      return elements[key];
    })[0];

    Object.keys(pairs).forEach(function (key) {
      var partnerKey = pairs[key];
      var pairKey = [key, partnerKey].sort().join('|');
      var from = elements[key];
      var to = elements[partnerKey];
      if (seen[pairKey] || !from || !to) return;
      seen[pairKey] = true;

      var line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', from.getAttribute('cx'));
      line.setAttribute('y1', from.getAttribute('cy'));
      line.setAttribute('x2', to.getAttribute('cx'));
      line.setAttribute('y2', to.getAttribute('cy'));
      line.setAttribute('class', 'picking-pair-connector');
      // Insert before the first note so the circles stay legible and clickable.
      svg.insertBefore(line, firstNote);
    });
  }

  function wireHover(elements, pattern) {

    Object.keys(elements).forEach(function (key) {
      var el = elements[key];
      var partnerEl = elements[pattern.pairs[key]];
      el.classList.add('picking-note');
      el.addEventListener('mouseenter', function () {
        el.classList.add('picking-note-active');
        if (partnerEl) partnerEl.classList.add('picking-note-active');
      });
      el.addEventListener('mouseleave', function () {
        el.classList.remove('picking-note-active');
        if (partnerEl) partnerEl.classList.remove('picking-note-active');
      });
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
    if (svg) {
      fixStringMarkers(svg);
      addFretboardBackground(svg);
      addPositionMarkers(svg, pattern.frets);
      var elements = pickingNoteElements(svg, pattern);
      addPairConnectors(svg, pattern.pairs, elements);
      wireHover(elements, pattern);
    }
  });
})();
