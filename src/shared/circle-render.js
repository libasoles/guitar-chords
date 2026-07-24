/* circle-render.js — Renderer for the "circle of fifths" page. Walks a list of
   major chord names (in circle-of-fifths order) and, for each one, draws its
   diagram next to a count of how many roots (1ª), thirds (3ª) and fifths (5ª)
   the voicing actually sounds on the guitar.

   The counts are computed from the actual voicing geometry (fingers + barres +
   standard tuning), so they reflect how many *strings* sound each degree — not
   just which pitch names are present. Each sounding string's pitch is reduced
   to its interval above the root, and we tally the tonic (0), the major third
   (4) and the perfect fifth (7). Labels are supplied per-locale by the page. */
(function () {
  'use strict';

  var PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Pitch class of each open string in standard tuning (string 6 = low E … 1 = high E).
  var OPEN_STRING = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };

  // 'E♭' → 3, 'F♯' → 6, 'C' → 0. Reads the leading letter + optional accidental.
  function pitchClass(token) {
    if (!token) return null;
    var pc = PITCH[token[0]];
    if (pc == null) return null;
    var acc = token[1];
    if (acc === '♯' || acc === '#') pc += 1;
    else if (acc === '♭' || acc === 'b') pc -= 1;
    return ((pc % 12) + 12) % 12;
  }

  // Resolve the fret sounded on each string: barres set a floor, then explicit
  // fingers override ('x' mutes, 'o' = open/0, a number = that fret). Returns a
  // { string: fret } map for every sounding string (muted strings omitted).
  function soundingFrets(chord) {
    var frets = {};
    (chord.barres || []).forEach(function (barre) {
      var lo = Math.min(barre.fromString, barre.toString);
      var hi = Math.max(barre.fromString, barre.toString);
      for (var s = lo; s <= hi; s++) frets[s] = barre.fret;
    });
    (chord.fingers || []).forEach(function (finger) {
      var string = finger[0];
      var value = finger[1];
      if (value === 'x') delete frets[string];
      else if (value === 'o') frets[string] = 0;
      else frets[string] = value;
    });
    return frets;
  }

  // Count how many *strings* sound the root (0), the major third (4) and the
  // perfect fifth (7) semitones above the root, for this major-triad voicing.
  function intervalCounts(chord) {
    var rootPc = pitchClass(chord.name);
    var counts = { root: 0, third: 0, fifth: 0 };
    if (rootPc == null) return counts;

    var frets = soundingFrets(chord);
    Object.keys(frets).forEach(function (string) {
      var open = OPEN_STRING[string];
      if (open == null) return;
      var pc = (open + frets[string]) % 12;
      var interval = ((pc - rootPc) % 12 + 12) % 12;
      if (interval === 0) counts.root += 1;
      else if (interval === 4) counts.third += 1;
      else if (interval === 7) counts.fifth += 1;
    });
    return counts;
  }

  function buildDiagram(chord) {
    var card = document.createElement('div');
    card.className = 'circle-card';

    var target = document.createElement('div');
    target.className = 'diagram';
    card.appendChild(target);

    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = chord.name;
    card.appendChild(name);

    try {
      window.ChordDiagram.render(target, chord, 'finder');
    } catch (err) {
      target.innerHTML = '<small style="color:#999">(error)</small>';
      if (window.console) console.error('svguitar error for', chord.name, err);
    }
    return card;
  }

  function buildCounts(counts, labels) {
    var wrap = document.createElement('div');
    wrap.className = 'circle-counts';

    [
      ['root', counts.root],
      ['third', counts.third],
      ['fifth', counts.fifth],
    ].forEach(function (pair) {
      var key = pair[0];
      var stat = document.createElement('div');
      stat.className = 'circle-stat circle-stat--' + key;

      var num = document.createElement('span');
      num.className = 'circle-stat-num';
      num.textContent = String(pair[1]);
      stat.appendChild(num);

      var lab = document.createElement('span');
      lab.className = 'circle-stat-label';
      lab.textContent = labels[key];
      stat.appendChild(lab);

      wrap.appendChild(stat);
    });
    return wrap;
  }

  function render(gridId, names, labels) {
    function run() {
      var grid = document.getElementById(gridId);
      if (!grid || !window.CHORDS || !window.ChordDiagram) return;

      names.forEach(function (name) {
        var chord = window.CHORDS.find(function (c) { return c.name === name; });
        if (!chord) return;

        var row = document.createElement('div');
        row.className = 'circle-row';
        row.appendChild(buildDiagram(chord));
        row.appendChild(buildCounts(intervalCounts(chord), labels));
        grid.appendChild(row);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  window.CircleFifthsPage = { render: render };
})();
