/* Interactive fifths, with diatonic spelling derived from each key signature. */
(function () {
  'use strict';
  var es = document.documentElement.lang === 'es';
  var letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
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
  var buttons = [];
  var host = document.getElementById('fifths-wheel');
  function svg(tag, attrs, content) {
    var el = document.createElementNS(ns, tag);
    Object.keys(attrs || {}).forEach(function (key) { el.setAttribute(key, attrs[key]); });
    if (content != null) el.textContent = content;
    return el;
  }
  function name(note) {
    return es ? solfege[letters.indexOf(note[0])] + note.slice(1) : note;
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
  function staff(index, width, height) {
    var staffSvg = svg('svg', { viewBox: '0 0 150 70', width: width, height: height, 'aria-hidden': 'true', class: 'fifths-staff' });
    for (var y = 19; y <= 51; y += 8) staffSvg.appendChild(svg('line', { x1: 4, x2: 146, y1: y, y2: y, stroke: 'currentColor', 'stroke-width': 0.8 }));
    staffSvg.appendChild(svg('text', { x: 6, y: 51, 'font-size': 46, 'font-family': 'serif' }, '𝄞'));
    // Treble-clef positions: F5 C5 G5 D5 A4 E5 B4; flats: B4 E5 A4 D5 G4 C5 F4.
    var positions = counts[index] < 0 ? [35, 23, 39, 27, 43, 31, 47] : [19, 31, 15, 27, 39, 23, 35];
    signature(index).forEach(function (note, i) {
      staffSvg.appendChild(svg('text', { x: 39 + i * 14, y: positions[i], 'font-size': 23, 'dominant-baseline': 'central', 'font-family': 'serif' }, note[1]));
    });
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
  function restore() { show(selected.index, selected.minor); }
  function interact(el, index, minor) {
    el.addEventListener('mouseenter', function () { show(index, minor); });
    el.addEventListener('mouseleave', restore);
    el.addEventListener('focus', function () { show(index, minor); });
    el.addEventListener('blur', restore);
    el.addEventListener('click', function () { selected = { index: index, minor: minor }; restore(); });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = { index: index, minor: minor }; restore(); }
      if (event.key === 'Escape') { el.blur(); restore(); }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        var next = (index + (event.key === 'ArrowRight' ? 1 : 11)) % 12;
        buttons.find(function (b) { return b.index === next && b.minor === minor; }).el.focus();
      }
    });
  }
  var wheel = svg('svg', { viewBox: '0 0 860 860', class: 'fifths-svg', role: 'group', 'aria-label': es ? 'Tonalidades y armaduras' : 'Keys and key signatures' });
  keys.forEach(function (_, index) {
    var notes = scale(index);
    [false, true].forEach(function (minor) {
      var chord = notes[minor ? 5 : 0] + (minor ? 'm' : '');
      var g = svg('g', { class: 'fifths-key', tabindex: 0, role: 'button', 'aria-label': name(notes[minor ? 5 : 0]) + (minor ? (es ? ' menor' : ' minor') : (es ? ' mayor' : ' major')), 'aria-pressed': 'false' });
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
    var group = svg('g', { transform: 'translate(' + (p[0] - 66) + ' ' + (p[1] - 43) + ')', class: 'fifths-outer-signature' });
    group.appendChild(staff(index, 132, 62));
    var accidentals = signature(index).map(name);
    var chunks = accidentals.length ? [accidentals.slice(0, 3).join(' · '), accidentals.slice(3).join(' · ')] : [es ? 'Sin alteraciones' : 'No accidentals'];
    chunks.forEach(function (text, i) {
      group.appendChild(svg('text', { x: 66, y: 72 + i * 17, 'text-anchor': 'middle', class: 'fifths-accidental-names' }, text));
    });
    wheel.appendChild(group);
  });
  wheel.appendChild(svg('circle', { cx: 430, cy: 430, r: 117, class: 'fifths-center' }));
  var centerName = svg('text', { x: 430, y: 414, 'text-anchor': 'middle', class: 'fifths-center-name' });
  var diminished = svg('text', { x: 430, y: 453, 'text-anchor': 'middle', class: 'fifths-diminished' });
  wheel.appendChild(centerName); wheel.appendChild(diminished);
  host.appendChild(wheel);
  function show(index, minor) {
    var notes = scale(index);
    var chords = notes.map(function (n, i) { return { note: n, quality: qualities[i] }; });
    if (minor) chords = chords.slice(5).concat(chords.slice(0, 5));
    var degrees = minor ? minorDegrees : majorDegrees;
    buttons.forEach(function (button) {
      var match = chords.findIndex(function (c) { return pc(c.note) === button.pc && c.quality === button.quality; });
      var tonic = button.index === index && button.minor === minor;
      button.el.classList.toggle('is-related', match !== -1);
      button.el.classList.toggle('is-tonic', tonic);
      button.el.setAttribute('aria-pressed', String(button.index === selected.index && button.minor === selected.minor));
      button.degree.textContent = match < 0 ? '' : degrees[match];
      button.label.textContent = match < 0 ? name(scale(button.index)[button.minor ? 5 : 0]) + button.quality : name(chords[match].note) + button.quality;
    });
    var title = name(chords[0].note) + (minor ? (es ? ' menor' : ' minor') : (es ? ' mayor' : ' major'));
    centerName.textContent = title;
    var dimIndex = minor ? 1 : 6;
    diminished.textContent = degrees[dimIndex] + ' · ' + name(chords[dimIndex].note) + '°';
    document.getElementById('fifths-key').textContent = title;
    var signatureEl = document.getElementById('fifths-signature');
    signatureEl.replaceChildren(staff(index, 180, 84));
    var text = document.createElement('span');
    text.textContent = signature(index).map(name).join(' · ') || (es ? 'Sin alteraciones' : 'No accidentals');
    signatureEl.appendChild(text);
    var chordList = document.getElementById('fifths-chords');
    chordList.replaceChildren();
    chords.forEach(function (chord, i) {
      var item = document.createElement('div'); item.className = 'fifths-chord';
      var degree = document.createElement('small'); degree.textContent = degrees[i];
      var label = document.createElement('strong'); label.textContent = name(chord.note) + chord.quality;
      item.append(degree, label); chordList.appendChild(item);
    });
  }
  restore();
})();
