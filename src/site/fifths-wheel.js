/* Interactive fifths, with diatonic spelling derived from each key signature. */
(function () {
  'use strict';
  var lang = (document.documentElement.lang || '').slice(0, 2);
  var pt = lang === 'pt';
  var es = lang === 'es';
  var letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var solfege = pt ? ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'] : ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  var natural = [0, 2, 4, 5, 7, 9, 11];
  var keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
  var counts = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];
  var sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  var flatOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  var qualities = ['', 'm', 'm', '', '', 'm', '°'];
  var majorDegrees = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
  var minorDegrees = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
  var ns = 'http://www.w3.org/2000/svg';
  var selected = { index: 0, minor: false };
  var pinned = false;
  var buttons = [];
  var host = document.getElementById('fifths-wheel');
  function svg(tag, attrs, content) {
    var el = document.createElementNS(ns, tag);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    if (content != null) el.textContent = content;
    return el;
  }
  function name(note) {
    return es || pt ? solfege[letters.indexOf(note[0])] + note.slice(1) : note;
  }
  function signature(index) {
    var count = counts[index];
    return (count < 0 ? flatOrder : sharpOrder).slice(0, Math.abs(count)).map(function (n) {
      return n + (count < 0 ? '♭' : '♯');
    });
  }
  function scale(index) {
    var alterations = signature(index);
    var start = letters.indexOf(keys[index][0]);
    return letters.map(function (_, i) {
      var letter = letters[(start + i) % 7];
      return alterations.find(function (n) { return n[0] === letter; }) || letter;
    });
  }
  function pc(note) {
    return (natural[letters.indexOf(note[0])] + (note.includes('♯') ? 1 : note.includes('♭') ? -1 : 0) + 12) % 12;
  }
  // The accidentals and their names share a group so they crossfade together. Each name sits under
  // its accidental, dropped by the same zigzag offset the accidentals follow on the staff.
  function accidentals(index, labelSize) {
    var group = svg('g', { class: 'fifths-accidentals' });
    // Treble-clef positions: F5 C5 G5 D5 A4 E5 B4; flats: B4 E5 A4 D5 G4 C5 F4.
    var positions = counts[index] < 0 ? [35, 23, 39, 27, 43, 31, 47] : [19, 31, 15, 27, 39, 23, 35];
    var top = counts[index] < 0 ? 23 : 15;
    signature(index).forEach(function (note, i) {
      var x = 44 + i * 14;
      group.appendChild(svg('text', { x: x, y: positions[i], 'font-size': 21, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'serif' }, note[1]));
      group.appendChild(svg('text', { x: x, y: 66 + (positions[i] - top) * 1.2, 'font-size': labelSize, 'text-anchor': 'middle', class: 'fifths-accidental-names' }, name(note)));
    });
    if (!counts[index]) {
      group.appendChild(svg('text', { x: 75, y: 78, 'font-size': labelSize, 'text-anchor': 'middle', class: 'fifths-accidental-names' }, es ? 'Sin alteraciones' : pt ? 'Sem alterações' : 'No accidentals'));
    }
    return group;
  }
  function staff(index, width, labelSize) {
    var staffSvg = svg('svg', { viewBox: '0 0 150 104', width: width, height: width * 104 / 150, 'aria-hidden': 'true', class: 'fifths-staff' });
    for (var y = 19; y <= 51; y += 8) staffSvg.appendChild(svg('line', { x1: 4, x2: 146, y1: y, y2: y, stroke: 'currentColor', 'stroke-width': 0.8 }));
    staffSvg.appendChild(svg('text', { x: 5, y: 52, 'font-size': 52, 'font-family': 'serif' }, '𝄞'));
    staffSvg.appendChild(accidentals(index, labelSize));
    return staffSvg;
  }
  function polar(radius, degrees) {
    var rad = degrees * Math.PI / 180;
    return [430 + Math.sin(rad) * radius, 430 - Math.cos(rad) * radius];
  }
  function sector(outer, inner, angle) {
    var a = polar(outer, angle - 15), b = polar(outer, angle + 15);
    var c = polar(inner, angle + 15), d = polar(inner, angle - 15);
    return 'M' + a + ' A' + outer + ',' + outer + ' 0 0 1 ' + b + ' L' + c + ' A' + inner + ',' + inner + ' 0 0 0 ' + d + ' Z';
  }
  // Hovering or focusing a key selects it, and leaving it keeps that selection. Clicking pins its
  // region; while one is pinned, pointer and focus movement change nothing and only a click
  // releases it (see click()).
  function restore() { show(selected.index, selected.minor); }
  function preview(index, minor) {
    if (pinned) return;
    selected = { index: index, minor: minor };
    restore();
  }
  function click(index, minor, button) {
    if (pinned && (!button || button.el.classList.contains('is-related'))) pinned = false;
    else { pinned = true; selected = { index: index, minor: minor }; }
    restore();
  }
  function interact(el, index, minor) {
    var button = function () { return buttons.find(function (b) { return b.el === el; }); };
    el.addEventListener('mouseenter', function () { preview(index, minor); });
    el.addEventListener('focus', function () { preview(index, minor); });
    el.addEventListener('click', function () { click(index, minor, button()); });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); click(index, minor, button()); }
      if (event.key === 'Escape') { el.blur(); if (pinned) click(index, minor, null); }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        var next = (index + (event.key === 'ArrowRight' ? 1 : 11)) % 12;
        buttons.find(function (b) { return b.index === next && b.minor === minor; }).el.focus();
      }
    });
  }
  var wheel = svg('svg', { viewBox: '0 0 860 860', class: 'fifths-svg', role: 'group', 'aria-label': es ? 'Tonalidades y armaduras' : pt ? 'Tonalidades e armaduras de clave' : 'Keys and key signatures' });
  keys.forEach(function (_, index) {
    var notes = scale(index);
    [false, true].forEach(function (minor) {
      var chord = notes[minor ? 5 : 0] + (minor ? 'm' : '');
      var g = svg('g', { class: 'fifths-key', tabindex: 0, role: 'button', 'aria-label': name(notes[minor ? 5 : 0]) + (minor ? (es ? ' menor' : pt ? ' menor' : ' minor') : (es ? ' mayor' : pt ? ' maior' : ' major')), 'aria-pressed': 'false' });
      g.appendChild(svg('path', { d: sector(minor ? 186 : 254, minor ? 118 : 186, index * 30) }));
      var pos = polar(minor ? 152 : 220, index * 30);
      var label = svg('text', { x: pos[0], y: pos[1], class: 'fifths-chord-name', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, name(notes[minor ? 5 : 0]) + (minor ? 'm' : ''));
      g.appendChild(label);
      var degreePos = [pos[0], pos[1] + 25];
      var degree = svg('text', { x: degreePos[0], y: degreePos[1], class: 'fifths-degree', 'text-anchor': 'middle' });
      g.appendChild(degree);
      buttons.push({ el: g, label: label, degree: degree, index: index, minor: minor, pc: pc(chord), quality: minor ? 'm' : '' });
      interact(g, index, minor);
      wheel.appendChild(g);
    });
    var p = polar(340, index * 30);
    var group = svg('g', { transform: 'translate(' + (p[0] - 82) + ' ' + (p[1] - 57) + ')', class: 'fifths-outer-signature' });
    group.appendChild(staff(index, 165, 16));
    wheel.appendChild(group);
  });
  // Related keys are cloned onto a layer above the wheel so they can stand out
  // (zoom and shadow) without reordering the interactive sectors, which would drop focus.
  var lift = svg('g', { class: 'fifths-lift', 'aria-hidden': 'true' });
  wheel.appendChild(lift);
  wheel.appendChild(svg('circle', { cx: 430, cy: 430, r: 117, class: 'fifths-center' }));
  var centerName = svg('text', { x: 430, y: 430, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'fifths-center-name' });
  wheel.appendChild(centerName);
  host.appendChild(wheel);
  // The sidebar trails the wheel: a short debounce skips keys the pointer only crosses, and each
  // piece of text crossfades with its replacement, so there is never a moment without text.
  var detailKey = null;
  var detailTimer = 0;
  function queueDetail(key, render) {
    clearTimeout(detailTimer);
    if (key === detailKey) return;
    if (detailKey === null) { render(); detailKey = key; return; }
    detailTimer = setTimeout(function () { render(); detailKey = key; }, 70);
  }
  // Stacks the new content over the old in the same cell; the old layer fades out and is removed.
  function retire(layer) {
    layer.classList.add('is-leaving');
    setTimeout(function () { layer.remove(); }, 380);
  }
  function crossfade(el, text) {
    var current = el.querySelector('.fifths-layer:not(.is-leaving)');
    if (current && current.textContent === text) return;
    var layer = document.createElement('i');
    layer.className = 'fifths-layer';
    layer.textContent = text;
    if (current) { retire(current); layer.classList.add('is-entering'); }
    el.appendChild(layer);
  }
  function show(index, minor) {
    var notes = scale(index);
    var chords = notes.map(function (n, i) { return { note: n, quality: qualities[i] }; });
    if (minor) chords = chords.slice(5).concat(chords.slice(0, 5));
    var degrees = minor ? minorDegrees : majorDegrees;
    var dimIndex = minor ? 1 : 6;
    var dimNote = chords[dimIndex].note;
    buttons.forEach(function (button) {
      var match = chords.findIndex(function (c) { return pc(c.note) === button.pc && c.quality === button.quality; });
      var tonic = button.index === index && button.minor === minor;
      button.el.classList.toggle('is-related', match !== -1);
      button.el.classList.toggle('is-tonic', tonic);
      button.el.setAttribute('aria-pressed', String(pinned && button.index === selected.index && button.minor === selected.minor));
      // The key's diminished chord has no region of its own, so it takes over the minor
      // region with the same root, which is shown as diminished while this key is selected.
      var diminished = match < 0 && button.minor && button.pc === pc(dimNote);
      button.el.classList.toggle('is-diminished', diminished);
      button.degree.textContent = match >= 0 ? degrees[match] : diminished ? degrees[dimIndex] : '';
      button.label.textContent = diminished ? name(dimNote) + '°' : match < 0 ? name(scale(button.index)[button.minor ? 5 : 0]) + button.quality : name(chords[match].note) + button.quality;
    });
    // Rebuilding the clones would restart their animation, so a pin on the key already
    // shown only changes the layer's state.
    var liftKey = index + (minor ? 'm' : 'M');
    if (liftKey !== lift.getAttribute('data-key')) {
      lift.setAttribute('data-key', liftKey);
      lift.replaceChildren();
      buttons.filter(function (button) { return button.el.classList.contains('is-related'); })
        .sort(function (a, b) { return a.el.classList.contains('is-tonic') - b.el.classList.contains('is-tonic'); })
        .forEach(function (button) {
          var clone = button.el.cloneNode(true);
          ['tabindex', 'role', 'aria-label', 'aria-pressed'].forEach(function (attr) { clone.removeAttribute(attr); });
          // Major arcs (outer ring) also slide outward along their radius when pinned.
          var radians = button.index * 30 * Math.PI / 180;
          clone.style.setProperty('--dx', button.minor ? 0 : Math.sin(radians).toFixed(3));
          clone.style.setProperty('--dy', button.minor ? 0 : (-Math.cos(radians)).toFixed(3));
          clone.setAttribute('class', 'fifths-lifted' + (button.el.classList.contains('is-tonic') ? ' is-tonic' : ''));
          lift.appendChild(clone);
        });
    }
    lift.classList.toggle('is-pinned', pinned);
    wheel.classList.toggle('is-pinned', pinned);
    var title = name(chords[0].note) + (minor ? (es ? ' menor' : pt ? ' menor' : ' minor') : (es ? ' mayor' : pt ? ' maior' : ' major'));
    // The accidental sits close to its note: the glyph's own advance leaves a visible gap.
    var root = name(chords[0].note);
    var accidental = /[♭♯]$/.test(root) ? root.slice(-1) : '';
    centerName.replaceChildren(document.createTextNode(root.slice(0, root.length - accidental.length)));
    if (accidental) centerName.appendChild(svg('tspan', { dx: -3 }, accidental));
    centerName.appendChild(document.createTextNode(title.slice(root.length)));
    queueDetail(index + (minor ? 'm' : 'M'), function () {
      crossfade(document.getElementById('fifths-key'), title);
      // Only the text and the accidentals change; the staff, clef and chord tiles stay put.
      var signatureEl = document.getElementById('fifths-signature');
      var staffEl = signatureEl.querySelector('.fifths-staff');
      var text = signatureEl.querySelector('span');
      if (!staffEl) {
        signatureEl.append(staff(index, 180, 12.5));
        text = document.createElement('span');
        signatureEl.appendChild(text);
      } else {
        var fresh = accidentals(index, 12.5);
        fresh.classList.add('is-entering');
        staffEl.querySelectorAll('.fifths-accidentals:not(.is-leaving)').forEach(retire);
        staffEl.appendChild(fresh);
      }
      text.textContent = (signature(index).map(name).join(' · ') || (es ? 'Sin alteraciones' : pt ? 'Sem alterações' : 'No accidentals'));
      var chordList = document.getElementById('fifths-chords');
      chords.forEach(function (chord, i) {
        var item = chordList.children[i];
        if (!item) {
          item = document.createElement('div'); item.className = 'fifths-chord';
          item.append(document.createElement('small'), document.createElement('strong'));
          chordList.appendChild(item);
        }
        crossfade(item.children[0], degrees[i]);
        crossfade(item.children[1], name(chord.note) + chord.quality);
      });
    });
  }
  document.addEventListener('click', function (event) {
    if (pinned && !event.target.closest('.fifths-key, .fifths-detail')) click(0, false, null);
  });
  restore();
})();
