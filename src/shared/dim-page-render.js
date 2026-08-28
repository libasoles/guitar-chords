/* dim-page-render.js — Shared renderer for the diminished chords page. The
   page's data script supplies three groups of chord refs (one per root
   string — 6th, 5th, 4th) and calls window.DimGuidePage.render(groups).
   Each ref is either a chord name (looked up in window.CHORDS) or a chord
   object literal for a one-off voicing that only exists on this page. */
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
      window.ChordDiagram.render(target, chord, 'finder');
    } catch (err) {
      target.innerHTML = '<small style="color:#999">(error)</small>';
      if (window.console) console.error('svguitar error for', chord.name, err);
    }

    return card;
  }

  function render(groups) {
    function run() {
      if (!window.CHORDS || !window.ChordDiagram) return;

      groups.forEach(function (group) {
        var grid = document.getElementById(group.gridId);
        if (!grid) return;

        group.chords.forEach(function (ref) {
          var chord = resolveChord(ref);
          if (!chord) return;
          grid.appendChild(buildCard(chord));
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
