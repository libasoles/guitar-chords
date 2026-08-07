/* circle-render.js — Renderer for the "circle of fifths" page. Walks a list of
   major chord names (in circle-of-fifths order) and, for each one, draws its
   diagram next to a count of how many roots (1ª), thirds (3ª) and fifths (5ª)
   the voicing actually sounds on the guitar. When a chord has more than one
   playable position (open vs. barre, via window.ChordPositions), chevrons let
   the user cycle between them — both the diagram and the counts update to
   match the position shown.

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

  var POSITION_LABEL_KEYS = { open: 'posOpen', barre6: 'posBarre6', barre5: 'posBarre5' };

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

  // Count how many *strings* sound the root (0), the third and the perfect
  // fifth (7) semitones above the root, for this triad voicing. The third is a
  // major third (4) by default; pass thirdSemitones = 3 for minor triads.
  function intervalCounts(name, fingers, barres, thirdSemitones) {
    var third = thirdSemitones || 4;
    var rootPc = pitchClass(name);
    var counts = { root: 0, third: 0, fifth: 0 };
    if (rootPc == null) return counts;

    var frets = soundingFrets(fingers, barres);
    Object.keys(frets).forEach(function (string) {
      var open = OPEN_STRING[string];
      if (open == null) return;
      var pc = (open + frets[string]) % 12;
      var interval = ((pc - rootPc) % 12 + 12) % 12;
      if (interval === 0) counts.root += 1;
      else if (interval === third) counts.third += 1;
      else if (interval === 7) counts.fifth += 1;
    });
    return counts;
  }

  function chordPositions(chord) {
    if (window.ChordPositions && typeof window.ChordPositions.getPositions === 'function') {
      return window.ChordPositions.getPositions(chord);
    }
    return [{ fingers: chord.fingers, barres: chord.barres || [], position: chord.position || 1, kind: 'open' }];
  }

  function buildCounts(counts, labels) {
    var wrap = document.createElement('div');
    wrap.className = 'circle-counts';

    var timesWord = labels.times || '';

    [
      ['root', counts.root],
      ['third', counts.third],
      ['fifth', counts.fifth],
    ].forEach(function (pair) {
      var key = pair[0];
      var stat = document.createElement('div');
      stat.className = 'circle-stat circle-stat--' + key;

      // The degree (1ª/3ª/5ª) is the headline; the count is the caption below.
      var num = document.createElement('span');
      num.className = 'circle-stat-num';
      num.textContent = labels[key];
      stat.appendChild(num);

      var lab = document.createElement('span');
      lab.className = 'circle-stat-label';
      lab.textContent = timesWord ? pair[1] + ' ' + timesWord : String(pair[1]);
      stat.appendChild(lab);

      wrap.appendChild(stat);
    });
    return wrap;
  }

  function renderPosition(entry, labels, thirdSemitones) {
    var pos = entry.positions[entry.index];
    var multi = entry.positions.length > 1;

    entry.prevBtn.hidden = !multi;
    entry.nextBtn.hidden = !multi;
    entry.posLabel.hidden = !multi;
    if (multi) {
      var labelKey = POSITION_LABEL_KEYS[pos.kind] || POSITION_LABEL_KEYS.open;
      entry.posLabel.textContent = labels[labelKey] || '';
    }

    var renderChord = {
      name: entry.chord.name, families: entry.chord.families, aliases: entry.chord.aliases,
      notes: entry.chord.notes, fingers: pos.fingers, barres: pos.barres, position: pos.position,
    };

    entry.diagramTarget.innerHTML = '';
    try {
      window.ChordDiagram.render(entry.diagramTarget, renderChord, 'finder');
    } catch (err) {
      entry.diagramTarget.innerHTML = '<small style="color:#999">(error)</small>';
      if (window.console) console.error('svguitar error for', entry.chord.name, err);
    }

    var counts = intervalCounts(entry.chord.name, pos.fingers, pos.barres, thirdSemitones);
    entry.countsWrap.innerHTML = '';
    entry.countsWrap.appendChild(buildCounts(counts, labels));
  }

  function stepPosition(entry, delta, labels, thirdSemitones) {
    var n = entry.positions.length;
    if (n <= 1) return;
    entry.index = (entry.index + delta + n) % n;
    renderPosition(entry, labels, thirdSemitones);
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

    card.appendChild(diagramWrap);

    var posLabel = document.createElement('div');
    posLabel.className = 'pos-label';
    card.appendChild(posLabel);
    entry.posLabel = posLabel;

    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = chord.name;
    card.appendChild(name);

    return card;
  }

  function render(gridId, names, labels, opts) {
    var thirdSemitones = (opts && opts.thirdSemitones) || 4;
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
        entry.prevBtn.addEventListener('click', function () { stepPosition(entry, -1, labels, thirdSemitones); });
        entry.nextBtn.addEventListener('click', function () { stepPosition(entry, 1, labels, thirdSemitones); });

        grid.appendChild(row);
        renderPosition(entry, labels, thirdSemitones);
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
