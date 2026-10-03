/* v7-page-render.js — Shared renderer for the "chords and their V7" pages
   (major and minor). Each page's script just supplies its own list of
   [tonicRef, v7Ref] pairs and calls window.V7GuidePage.render(gridId, pairs).
   Each ref is either a chord name (looked up in window.CHORDS, falling back
   to window.V7_CHORD_OVERRIDES for a page-wide fret preference) or a chord
   object literal for a one-off voicing that only applies to that pair. */
(function () {
  'use strict';

  var LABELS = window.V7_GUIDE_LABELS || {};
  var POSITION_LABELS = LABELS.positionLabels || {};

  function chordPositions(chord) {
    if (window.ChordPositions && typeof window.ChordPositions.getPositions === 'function') {
      return window.ChordPositions.getPositions(chord);
    }
    return [{ fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1 }];
  }

  function navButton(className, path, label) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pos-nav ' + className;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
    button.setAttribute('aria-label', label);
    button.title = label;
    return button;
  }

  function resolveChord(ref) {
    if (typeof ref === 'object') return ref;
    var overrides = window.V7_CHORD_OVERRIDES || {};
    return overrides[ref] || window.CHORDS.find(function (c) { return c.name === ref; });
  }

  function buildCard(chord) {
    var card = document.createElement('div');
    card.className = 'v7-card';

    var positions = chordPositions(chord);
    var index = 0;
    var multi = positions.length > 1;

    var diagramWrap = document.createElement('div');
    diagramWrap.className = 'diagram-wrap';

    var prev = navButton('pos-prev', 'M15 4l-8 8 8 8', LABELS.prevLabel || 'Previous position');
    prev.hidden = !multi;
    diagramWrap.appendChild(prev);

    var target = document.createElement('div');
    target.className = 'diagram';
    diagramWrap.appendChild(target);

    var next = navButton('pos-next', 'M9 4l8 8-8 8', LABELS.nextLabel || 'Next position');
    next.hidden = !multi;
    diagramWrap.appendChild(next);
    card.appendChild(diagramWrap);

    var positionLabel = document.createElement('div');
    positionLabel.className = 'pos-label';
    positionLabel.hidden = !multi;
    card.appendChild(positionLabel);

    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = chord.name;
    card.appendChild(name);

    function renderPosition() {
      var position = positions[index];
      if (multi) positionLabel.textContent = POSITION_LABELS[position.kind] || POSITION_LABELS.open || '';
      var renderChord = {
        name: chord.name,
        families: chord.families,
        aliases: chord.aliases,
        notes: chord.notes,
        fingers: position.fingers,
        barres: position.barres,
        position: position.position,
      };

      target.innerHTML = '';
      try {
        window.ChordDiagram.render(target, renderChord, 'finder-white');
      } catch (err) {
        target.innerHTML = '<small style="color:#999">(error)</small>';
        if (window.console) console.error('svguitar error for', chord.name, err);
      }
    }

    function step(delta) {
      index = (index + delta + positions.length) % positions.length;
      renderPosition();
    }

    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    renderPosition();

    return card;
  }

  function render(gridId, pairs) {
    function run() {
      var grid = document.getElementById(gridId);
      if (!grid || !window.CHORDS || !window.ChordDiagram) return;

      grid.querySelectorAll('.v7-skeleton-row').forEach(function (skeleton) {
        skeleton.remove();
      });

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

      grid.setAttribute('aria-busy', 'false');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  window.V7GuidePage = { render: render };
})();
