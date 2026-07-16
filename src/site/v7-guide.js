/* v7-guide.js — Renders the tonic/V7 two-column list on the "chords and their
   V7" page. Pairs walk the circle of fifths starting at C; each tonic name
   and each V7 name must match a `name` in window.CHORDS exactly (chords-db.js
   already prefers the open, no-barre voicing wherever one exists). */
(function () {
  'use strict';

  var PAIRS = [
    ['C', 'G7'],
    ['G', 'D7'],
    ['D', 'A7'],
    ['A', 'E7'],
    ['E', 'B7'],
    ['B', 'F♯7'],
    ['F♯', 'D♭7'],
    ['D♭', 'A♭7'],
    ['A♭', 'E♭7'],
    ['E♭', 'B♭7'],
    ['B♭', 'F7'],
    ['F', 'C7']
  ];

  // E♭ (position 6) resolves into B♭7: chords-db's default B♭7 sits at fret 1,
  // a big jump from E♭'s fret 6. This page-local override keeps the same
  // barre shape at fret 6 (the F7 shape moved up 5 frets) for a smoother hand
  // transition — chords-db's own B♭7 entry is left untouched for the finder.
  var OVERRIDES = {
    'B♭7': {
      name: 'B♭7', families: ['dom7'], aliases: ['A♯7'],
      notes: 'B♭ F A♭ D F B♭', position: 6, barres: [{ fromString: 6, toString: 1, fret: 6 }],
      fingers: [[5, 8, '3'], [3, 7, '2']]
    }
  };

  function findChord(name) {
    return OVERRIDES[name] || window.CHORDS.find(function (c) { return c.name === name; });
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
      window.ChordDiagram.render(target, chord, 'finder');
    } catch (err) {
      target.innerHTML = '<small style="color:#999">(error)</small>';
      if (window.console) console.error('svguitar error for', chord.name, err);
    }

    return card;
  }

  function init() {
    var grid = document.getElementById('v7Grid');
    if (!grid || !window.CHORDS || !window.ChordDiagram) return;

    PAIRS.forEach(function (pair) {
      var tonic = findChord(pair[0]);
      var dominant = findChord(pair[1]);
      if (!tonic || !dominant) return;

      var row = document.createElement('div');
      row.className = 'v7-row';
      row.appendChild(buildCard(tonic));
      row.appendChild(buildCard(dominant));
      grid.appendChild(row);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
