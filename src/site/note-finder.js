/* note-finder.js — "Identificar acordes a partir de notas" page.
   A piano-style note picker with naturals in the center column and
   accidentals split into two side columns (sharps on the left, flats
   on the right, since the same black key is one or the other
   depending which natural you approach it from), descending one
   octave from B to C. Toggling notes filters window.CHORDS (via
   window.NoteMatch) down to the guitar chords that contain every
   selected note, rendered like the chord-finder search results
   (diagram + name + notes).

   The note list is rendered three times, stacked in a scrollable
   track (previous / real / next), so scrolling past either edge
   loops seamlessly into an identical copy — an infinite carousel.
   Only the middle copy is interactive; the other two are purely
   visual and mirror its selection state. */
(function () {
  'use strict';

  var STRINGS = window.NOTE_FINDER_STRINGS || {};
  function t(key, fallback) { return STRINGS[key] !== undefined ? STRINGS[key] : fallback; }

  // Default selection: C7 (Do, Mi, Sol, Sib) — pitch classes 0, 4, 7, 10.
  var DEFAULT_SELECTED = [0, 4, 7, 10];

  // Naturals column, descending one octave from B down to C (piano-style).
  // Grid row of natural i (0-indexed) is 1 + i*2.
  var NATURAL_PCS = [11, 9, 7, 5, 4, 2, 0];

  // Accidental slots, one per gap between adjacent naturals above; null
  // where there is no black key in that gap (E-F). Grid row of
  // accidental i is 2 + i*2, i.e. right between naturals i and i+1.
  var ACCIDENTAL_SLOTS = [10, 8, 6, null, 3, 1];

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    if (!window.CHORDS || !window.ChordDiagram || !window.NoteMatch) return;

    var labels = window.NOTE_FINDER_LABELS || [];
    function label(pc) { return labels[pc] !== undefined ? labels[pc] : String(pc); }

    var selected = new Set(DEFAULT_SELECTED);
    var buttonsByPc = {};

    var track = document.getElementById('noteFinderKeysTrack');
    var viewport = document.getElementById('noteFinderKeysViewport');
    var clearBtn = document.getElementById('noteFinderClear');
    var grid = document.getElementById('noteFinderGrid');

    function toggle(pc) {
      if (selected.has(pc)) selected.delete(pc);
      else selected.add(pc);
      syncButtons();
      renderResults();
    }

    function buildKeysGrid(interactive) {
      var gridEl = document.createElement('div');
      gridEl.className = 'note-finder-keys';
      if (!interactive) gridEl.setAttribute('aria-hidden', 'true');

      function makeButton(pc, column, row, extraClass, text) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'note-finder-note' + (extraClass ? ' ' + extraClass : '');
        btn.style.gridColumn = String(column);
        btn.style.gridRow = String(row);
        btn.textContent = text;
        btn.setAttribute('aria-pressed', 'false');
        if (interactive) {
          btn.addEventListener('click', function () { toggle(pc); });
        } else {
          btn.tabIndex = -1;
        }
        (buttonsByPc[pc] = buttonsByPc[pc] || []).push(btn);
        gridEl.appendChild(btn);
      }

      NATURAL_PCS.forEach(function (pc, i) {
        makeButton(pc, 2, 1 + i * 2, 'note-finder-note-natural', label(pc));
      });

      ACCIDENTAL_SLOTS.forEach(function (pc, i) {
        if (pc === null) return;
        var parts = label(pc).split('/');
        var row = 2 + i * 2;
        makeButton(pc, 1, row, 'note-finder-note-accidental note-finder-note-sharp', parts[0] || label(pc));
        makeButton(pc, 3, row, 'note-finder-note-accidental note-finder-note-flat', parts[1] || label(pc));
      });

      return gridEl;
    }

    track.appendChild(buildKeysGrid(false));
    var mainGrid = buildKeysGrid(true);
    track.appendChild(mainGrid);
    track.appendChild(buildKeysGrid(false));

    function syncViewportHeight() {
      var cycleHeight = mainGrid.getBoundingClientRect().height;
      if (!cycleHeight) return;
      viewport.style.height = cycleHeight + 'px';
      viewport.scrollTop = cycleHeight;
      return cycleHeight;
    }

    var cycleHeight = syncViewportHeight();

    viewport.addEventListener('scroll', function () {
      if (!cycleHeight) return;
      if (viewport.scrollTop <= 0) {
        viewport.scrollTop += cycleHeight;
      } else if (viewport.scrollTop >= cycleHeight * 2) {
        viewport.scrollTop -= cycleHeight;
      }
    });

    window.addEventListener('resize', function () {
      cycleHeight = syncViewportHeight();
    });

    function syncButtons() {
      Object.keys(buttonsByPc).forEach(function (key) {
        var pc = Number(key);
        var pressed = selected.has(pc);
        buttonsByPc[pc].forEach(function (btn) {
          btn.classList.toggle('is-selected', pressed);
          btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        });
      });
    }

    clearBtn.addEventListener('click', function () {
      if (selected.size === 0) return;
      selected.clear();
      syncButtons();
      renderResults();
    });

    function chordFirstPosition(chord) {
      if (window.ChordPositions && typeof window.ChordPositions.getPositions === 'function') {
        return window.ChordPositions.getPositions(chord)[0];
      }
      return { fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1 };
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

      var notes = document.createElement('div');
      notes.className = 'notes';
      notes.textContent = chord.notes || '';
      card.appendChild(notes);

      var pos = chordFirstPosition(chord);
      var renderChord = {
        name: chord.name, families: chord.families, aliases: chord.aliases, notes: chord.notes,
        fingers: pos.fingers, barres: pos.barres, position: pos.position,
      };
      try {
        window.ChordDiagram.render(target, renderChord, 'finder');
      } catch (err) {
        target.innerHTML = '<small style="color:#999">(error)</small>';
        if (window.console) console.error('svguitar error for', chord.name, err);
      }

      return card;
    }

    function renderEmpty(message) {
      var empty = document.createElement('div');
      empty.className = 'note-finder-empty';
      empty.textContent = message;
      grid.appendChild(empty);
    }

    function renderResults() {
      grid.innerHTML = '';
      if (selected.size === 0) {
        renderEmpty(t('noteFinderSelectPrompt', 'Marcá al menos una nota para ver acordes.'));
        return;
      }
      var matches = window.NoteMatch.matchByNotes(selected, window.CHORDS);
      if (matches.length === 0) {
        renderEmpty(t('noteFinderEmpty', 'No hay acordes que contengan todas esas notas.'));
        return;
      }
      matches.forEach(function (chord) { grid.appendChild(buildCard(chord)); });
    }

    syncButtons();
    renderResults();
  });
})();
