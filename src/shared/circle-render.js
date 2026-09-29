/* circle-render.js — Renderer for the "circle of fifths" page. Walks a list of
   major chord names (in circle-of-fifths order) and, for each one, draws its
   diagram next to its three chord tones: root, third and fifth. When a chord
   has more than one playable position (open vs. barre, via
   window.ChordPositions), chevrons let the user cycle between them. Under each
   diagram, the six string labels show the pitch that actually sounds on that
   string for the current position. */
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
  function soundingFrets(fingers, barres) {
    var frets = {};
    (barres || []).forEach(function (barre) {
      var lo = Math.min(barre.fromString, barre.toString);
      var hi = Math.max(barre.fromString, barre.toString);
      for (var s = lo; s <= hi; s++) frets[s] = barre.fret;
    });
    (fingers || []).forEach(function (finger) {
      var string = finger[0];
      var value = finger[1];
      if (value === 'x') delete frets[string];
      else if (value === 'o') frets[string] = 0;
      else frets[string] = value;
    });
    return frets;
  }

  // Prefer the spelling used by the chord itself (E♭ rather than D♯, for
  // example). This makes the per-string labels agree with the chord notes.
  function spellingForPitch(chord, pc) {
    var spellings = (chord.notes || '').split(/\s+/);
    for (var i = 0; i < spellings.length; i++) {
      if (pitchClass(spellings[i]) === pc) return spellings[i];
    }
    return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pc];
  }

  // Return one label per physical string, ordered as the diagram (6 → 1).
  // A muted string keeps its place so every label remains under its string.
  function soundingNotes(chord, fingers, barres) {
    var frets = soundingFrets(fingers, barres);
    var notes = [];
    for (var string = 6; string >= 1; string--) {
      if (frets[string] == null) {
        notes.push('—');
        continue;
      }
      notes.push(spellingForPitch(chord, (OPEN_STRING[string] + frets[string]) % 12));
    }
    return notes;
  }

  function buildStringNotes(notes) {
    var wrap = document.createElement('div');
    wrap.className = 'string-notes';
    notes.forEach(function (note) {
      var label = document.createElement('span');
      label.className = 'string-note';
      label.textContent = note;
      wrap.appendChild(label);
    });
    return wrap;
  }

  // Composition text lists each chord tone with the number of strings that
  // actually sound it in the current voicing (e.g. a barre chord may sound
  // the root or fifth several times).
  function buildComposition(chord, fingers, barres, thirdSemitones) {
    var root = pitchClass(chord.name);
    var third = thirdSemitones || 4;
    var tones = root == null ? [] : [root, (root + third) % 12, (root + 7) % 12];
    var counts = tones.map(function () { return 0; });
    var frets = soundingFrets(fingers, barres);
    Object.keys(frets).forEach(function (string) {
      var open = OPEN_STRING[string];
      if (open == null) return;
      var pc = (open + frets[string]) % 12;
      var idx = tones.indexOf(pc);
      if (idx !== -1) counts[idx] += 1;
    });

    var composition = document.createElement('div');
    composition.className = 'circle-composition';
    composition.textContent = tones.map(function (pc, i) {
      return spellingForPitch(chord, pc) + ' ×' + counts[i];
    }).join('  ');
    return composition;
  }

  function chordPositions(chord) {
    if (window.ChordPositions && typeof window.ChordPositions.getPositions === 'function') {
      return window.ChordPositions.getPositions(chord);
    }
    return [{ fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1, kind: 'open' }];
  }

  function renderPosition(entry, labels, thirdSemitones, diagramVariant) {
    var pos = entry.positions[entry.index];
    var multi = entry.positions.length > 1;

    entry.prevBtn.hidden = !multi;
    entry.nextBtn.hidden = !multi;
    var renderChord = {
      name: entry.chord.name, families: entry.chord.families, aliases: entry.chord.aliases,
      notes: entry.chord.notes, fingers: pos.fingers, barres: pos.barres, position: pos.position,
    };

    entry.diagramTarget.innerHTML = '';
    try {
      window.ChordDiagram.render(entry.diagramTarget, renderChord, diagramVariant || 'finder');
    } catch (err) {
      entry.diagramTarget.innerHTML = '<small style="color:#999">(error)</small>';
      if (window.console) console.error('svguitar error for', entry.chord.name, err);
    }

    entry.stringNotes.innerHTML = '';
    entry.stringNotes.appendChild(buildStringNotes(soundingNotes(entry.chord, pos.fingers, pos.barres)));

    entry.countsWrap.innerHTML = '';
    entry.countsWrap.appendChild(buildComposition(entry.chord, pos.fingers, pos.barres, thirdSemitones));
  }

  function stepPosition(entry, delta, labels, thirdSemitones, diagramVariant) {
    var n = entry.positions.length;
    if (n <= 1) return;
    entry.index = (entry.index + delta + n) % n;
    renderPosition(entry, labels, thirdSemitones, diagramVariant);
  }

  function buildDiagram(chord, entry) {
    var card = document.createElement('div');
    card.className = 'circle-card';

    var diagramWrap = document.createElement('div');
    diagramWrap.className = 'diagram-wrap';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'pos-nav pos-prev';
    prevBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>';
    diagramWrap.appendChild(prevBtn);
    entry.prevBtn = prevBtn;

    var target = document.createElement('div');
    target.className = 'diagram';
    diagramWrap.appendChild(target);
    entry.diagramTarget = target;

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'pos-nav pos-next';
    nextBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>';
    diagramWrap.appendChild(nextBtn);
    entry.nextBtn = nextBtn;

    // Nested inside diagramWrap (not a sibling in `card`) so its 72% width
    // resolves against the diagram's own fixed pixel width — `card` is a
    // grid item stretched to fill its column, which would otherwise make
    // the percentage (and the string labels under it) far wider than the
    // diagram itself and throw off the alignment.
    var stringNotes = document.createElement('div');
    stringNotes.className = 'string-notes-wrap';
    diagramWrap.appendChild(stringNotes);
    entry.stringNotes = stringNotes;

    card.appendChild(diagramWrap);

    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = chord.name;
    card.appendChild(name);

    return card;
  }

  function render(gridId, names, labels, opts) {
    var thirdSemitones = (opts && opts.thirdSemitones) || 4;
    var diagramVariant = (opts && opts.diagramVariant) || 'finder';
    function run() {
      var grid = document.getElementById(gridId);
      if (!grid || !window.CHORDS || !window.ChordDiagram) return;

      names.forEach(function (name) {
        var chord = window.CHORDS.find(function (c) { return c.name === name; });
        if (!chord) return;

        var entry = { chord: chord, positions: chordPositions(chord), index: 0 };

        var row = document.createElement('div');
        row.className = 'circle-row';
        row.appendChild(buildDiagram(chord, entry));

        var countsWrap = document.createElement('div');
        entry.countsWrap = countsWrap;
        row.appendChild(countsWrap);

        entry.prevBtn.setAttribute('aria-label', labels.prevLabel || '');
        entry.prevBtn.title = labels.prevLabel || '';
        entry.nextBtn.setAttribute('aria-label', labels.nextLabel || '');
        entry.nextBtn.title = labels.nextLabel || '';
        entry.prevBtn.addEventListener('click', function () { stepPosition(entry, -1, labels, thirdSemitones, diagramVariant); });
        entry.nextBtn.addEventListener('click', function () { stepPosition(entry, 1, labels, thirdSemitones, diagramVariant); });

        grid.appendChild(row);
        renderPosition(entry, labels, thirdSemitones, diagramVariant);
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
