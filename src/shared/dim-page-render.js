/* dim-page-render.js — Shared renderer for the diminished chords page. The
   page's data script supplies three groups of chord refs (one per root
   string — 6th, 5th, 4th) and calls window.DimGuidePage.render(groups).
   Each ref is either a chord name (looked up in window.CHORDS) or a chord
   object literal for a one-off voicing that only exists on this page.
   Each group lists its 12 chords in chromatic order from C. A dim7 chord
   repeats every minor third, so chords 3 semitones apart (index mod 3)
   share the same notes: they go in the same row, lowest fret first. Rows
   are ordered by their lowest-fret chord. */
(function () {
  'use strict';

  function resolveChord(ref) {
    if (typeof ref === 'object') return ref;
    return window.CHORDS.find(function (c) { return c.name === ref; });
  }

  function buildCard(chord) {
    var card = document.createElement('div');
    card.className = 'v7-card';

    var target = document.createElement('div');
    target.className = 'diagram';
    card.appendChild(target);

    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = chord.name;
    card.appendChild(name);

    try {
      window.ChordDiagram.render(target, chord, 'finder-white');
    } catch (err) {
      target.innerHTML = '<small style="color:#999">(error)</small>';
      if (window.console) console.error('svguitar error for', chord.name, err);
    }

    return card;
  }

  function lowestFret(chord) {
    var min = Infinity;
    chord.fingers.forEach(function (f) {
      if (typeof f[1] === 'number' && f[1] < min) min = f[1];
    });
    return min;
  }

  function buildRows(chords) {
    var rows = [[], [], []];
    chords.forEach(function (chord, i) { rows[i % 3].push(chord); });
    rows.forEach(function (row) {
      row.sort(function (a, b) { return lowestFret(a) - lowestFret(b); });
    });
    rows.sort(function (a, b) { return lowestFret(a[0]) - lowestFret(b[0]); });
    return rows;
  }

  function render(groups) {
    function run() {
      if (!window.CHORDS || !window.ChordDiagram) return;

      groups.forEach(function (group) {
        var grid = document.getElementById(group.gridId);
        if (!grid) return;

        var chords = group.chords.map(resolveChord);
        if (chords.some(function (c) { return !c; })) return;

        buildRows(chords).forEach(function (chordsInRow) {
          var row = document.createElement('div');
          row.className = 'dim-row';
          chordsInRow.forEach(function (chord) {
            row.appendChild(buildCard(chord));
          });
          grid.appendChild(row);
        });
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  window.DimGuidePage = { render: render };
})();
