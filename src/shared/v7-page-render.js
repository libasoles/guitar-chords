/* v7-page-render.js — Shared renderer for the "chords and their V7" pages
   (major and minor). Each page's script just supplies its own list of
   [tonicRef, v7Ref] pairs and calls window.V7GuidePage.render(gridId, pairs).
   Each ref is either a chord name (looked up in window.CHORDS, falling back
   to window.V7_CHORD_OVERRIDES for a page-wide fret preference) or a chord
   object literal for a one-off voicing that only applies to that pair. */
(function () {
  'use strict';

  function resolveChord(ref) {
    if (typeof ref === 'object') return ref;
    var overrides = window.V7_CHORD_OVERRIDES || {};
    return overrides[ref] || window.CHORDS.find(function (c) { return c.name === ref; });
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

  function render(gridId, pairs) {
    function run() {
      var grid = document.getElementById(gridId);
      if (!grid || !window.CHORDS || !window.ChordDiagram) return;

      pairs.forEach(function (pair) {
        var tonic = resolveChord(pair[0]);
        var dominant = resolveChord(pair[1]);
        if (!tonic || !dominant) return;

        var row = document.createElement('div');
        row.className = 'v7-row';
        row.appendChild(buildCard(tonic));
        row.appendChild(buildCard(dominant));
        grid.appendChild(row);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  window.V7GuidePage = { render: render };
})();
