/* score-editor.js — Pagina /partitura: una partitura donde se arrastran notas desde la paleta.
   Verovio dibuja el MusicXML que sale de ScoreModel; aca solo viven la paleta, el arrastre y las descargas. */
(function () {
  'use strict';

  const M = window.ScoreModel;
  const STORAGE_KEY = 'scoreEditor.v1';
  const SCALE = 60;
  const HISTORY_LIMIT = 100;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const script = document.currentScript;
  const t = JSON.parse(document.getElementById('scoreStrings').textContent);

  const stage = document.getElementById('scoreStage');
  const status = document.getElementById('scoreStatus');
  const palette = document.getElementById('scorePalette');
  const addRow = document.getElementById('scoreAddRow');
  const removeRow = document.getElementById('scoreRemoveRow');

  let score = load();
  const title = document.getElementById('scoreTitle');
  if (typeof score.title !== 'string') score.title = title.value;
  title.value = score.title;
  title.addEventListener('input', () => {
    score.title = title.value;
    save();
  });
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      title.blur();
    }
  });
  let toolkit = null;
  let selected = null; // { mi, i }
  let drag = null;
  let activeItem = null;
  let layout = []; // por compas: { left, right, lines: [y1..y5] } relativo al escenario
  let history = [];
  let renderedWidth = 0;

  function load() {
    try {
      return M.sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (e) {
      return M.emptyScore();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(score));
    } catch (e) {
      // Sin almacenamiento la partitura sigue funcionando, solo que no se recuerda.
    }
  }

  function say(text) {
    status.textContent = text;
  }

  function vendorUrl(file) {
    return script.src.replace(/[^/?#]*([?#].*)?$/, 'vendor/' + file);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(src + ' failed to load'));
      document.head.appendChild(el);
    });
  }

  function newToolkit() {
    return new window.verovio.toolkit();
  }

  async function loadVerovio() {
    await loadScript(vendorUrl('verovio-toolkit-wasm.js'));
    await new Promise((resolve) => {
      if (window.verovio.module.calledRun) resolve();
      else window.verovio.module.onRuntimeInitialized = resolve;
    });
    toolkit = newToolkit();
  }

  // ---- edicion ------------------------------------------------------------

  function change(mutate) {
    const before = M.clone(score);
    if (mutate() === false) return false;
    history.push(before);
    if (history.length > HISTORY_LIMIT) history.shift();
    save();
    render();
    return true;
  }

  function undo() {
    if (!history.length) return;
    score = Object.assign(history.pop(), { title: score.title });
    selected = null;
    save();
    render();
  }

  function eventAt(sel) {
    return sel && M.measures(score)[sel.mi] && M.measures(score)[sel.mi][sel.i];
  }

  function dropNew(item, target) {
    const measure = M.measures(score)[target.mi];
    if (item.kind === 'note' || item.kind === 'rest') {
      const ev = { d: item.d };
      if (item.kind === 'rest') ev.rest = true;
      else ev.n = target.n;
      const spot = M.placement(measure, ev, target.t, score);
      if (!spot) return say(t.full);
      change(() => {
        ev.d = spot.d;
        if (spot.dot) ev.dot = true;
        selected = { mi: target.mi, i: M.insertAt(measure, ev, spot.at) };
      });
    }
  }

  function activateFigure(item) {
    activeItem = item;
    clearHoverGhost();
    updateHoverGhost();
    palette.querySelectorAll('[aria-pressed]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.shortcut === item.key));
    });
    const ev = eventAt(selected);
    if (!ev || (ev.d === item.d && !!ev.rest === (item.kind === 'rest'))) return;
    const replacement = Object.assign({}, ev, { d: item.d });
    if (item.kind === 'rest') { replacement.rest = true; delete replacement.n; delete replacement.acc; }
    else { delete replacement.rest; replacement.n = ev.rest ? M.bottomLine(score) : ev.n; }
    if (item.d === 'w' || item.d === 's') delete replacement.dot;
    const measure = M.measures(score)[selected.mi];
    if (M.onsets(measure)[selected.i] + M.length(replacement) > M.capacity(score)) return say(t.full);
    change(() => { M.settle(measure); measure[selected.i] = replacement; });
    say('');
  }

  // El puntillo afecta al acorde de igual duracion, sin modificar otras voces.
  function applyModifier(item, hit) {
    const measure = M.measures(score)[hit.mi];
    const ev = measure[hit.i];
    const column = measure.filter((o) => o.at === ev.at && o.d === ev.d && !!o.dot === !!ev.dot && !o.rest === !ev.rest);
    if (item.kind === 'dot') {
      if (ev.dot) return change(() => { column.forEach((o) => { delete o.dot; }); });
      if (!M.canDot(measure, hit.i, score)) return say(ev.d === 'w' || ev.d === 's' ? t.noDot : t.full);
      return change(() => { column.forEach((o) => { o.dot = true; }); });
    }
    if (ev.rest) return;
    change(() => {
      if (ev.acc === item.acc) delete ev.acc;
      else ev.acc = item.acc;
    });
  }

  function moveEvent(from, target) {
    const all = M.measures(score);
    const ev = all[from.mi][from.i];
    const destination = all[target.mi];
    const others = destination.filter((o) => o !== ev);
    const moved = Object.assign({}, ev);
    if (!ev.rest) moved.n = target.n;
    const spot = M.placement(others, moved, target.t, score);
    if (!spot) return say(t.full);
    change(() => {
      all[from.mi].splice(from.i, 1);
      moved.d = spot.d;
      if (spot.dot) moved.dot = true;
      else delete moved.dot;
      selected = { mi: target.mi, i: M.insertAt(destination, moved, spot.at) };
    });
  }

  function removeSelected() {
    if (!eventAt(selected)) return;
    change(() => {
      M.measures(score)[selected.mi].splice(selected.i, 1);
      selected = null;
    });
  }

  function shiftSelected(delta) {
    const ev = eventAt(selected);
    if (!ev || ev.rest) return;
    change(() => { ev.n = M.clampPitch(ev.n + delta); });
  }

  // ---- dibujo -------------------------------------------------------------

  function layoutOptions(width, extra) {
    return Object.assign({
      scale: SCALE,
      pageWidth: Math.round(width * 100 / SCALE),
      adjustPageHeight: true,
      breaks: 'encoded',
      header: 'none',
      footer: 'none',
      svgViewBox: true,
      pageMarginLeft: 60,
      pageMarginRight: 60,
      pageMarginTop: 60,
      pageMarginBottom: 60,
      minLastJustification: 0,
      justifyVertically: false,
      spacingSystem: 12,
      mnumInterval: 0,
    }, extra);
  }

  function render() {
    if (!toolkit) return;
    const width = stage.clientWidth;
    if (!width) return;
    renderedWidth = width;
    toolkit.setOptions(layoutOptions(width));
    toolkit.loadData(M.toMusicXml(score, { plainGuitarClef: true }));
    meterPopup.hidePopover();
    clefPopup.hidePopover();
    stage.innerHTML = toolkit.renderToSVG(1);
    marker = null;
    const svg = stage.querySelector('svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t.scoreLabel);
    mountMeterButton();
    mountClefButtons();
    measureLayout();
    markSelected();
    updateHoverGhost();
    removeRow.hidden = score.rows.length <= M.MIN_ROWS;
  }

  function measureLayout() {
    const origin = stage.getBoundingClientRect();
    layout = [...stage.querySelectorAll('g.measure')].map((node) => {
      const lines = [...node.querySelectorAll(':scope > g.staff > path')].slice(0, 5).map((p) => {
        const r = p.getBoundingClientRect();
        return (r.top + r.bottom) / 2 - origin.top;
      });
      const box = node.querySelector(':scope > g.staff > path').getBoundingClientRect();
      return { left: box.left - origin.left, right: box.right - origin.left, lines };
    });
  }

  function markSelected() {
    stage.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
    if (!selected) return;
    const node = stage.querySelector('[id="e' + selected.mi + '-' + selected.i + '"]');
    if (node) node.classList.add('is-selected');
    else selected = null;
  }

  // ---- hit-testing --------------------------------------------------------

  function eventNodes(mi) {
    const nodes = [];
    for (let i = 0; ; i += 1) {
      const node = stage.querySelector('[id="e' + mi + '-' + i + '"]');
      if (!node) break;
      nodes.push(node);
    }
    return nodes;
  }

  function centerX(node, origin) {
    const head = node.querySelector('.notehead') || node;
    const r = head.getBoundingClientRect();
    return (r.left + r.right) / 2 - origin.left;
  }

  // Tiempo (en divisiones) que le corresponde a una x dentro del compas, interpolando entre las figuras ya dibujadas.
  function timeAt(x, m, starts, centers) {
    const anchors = [{ x: m.left, t: 0 }, { x: m.right, t: M.capacity(score) }];
    centers.forEach((c, i) => anchors.push({ x: c, t: starts[i] }));
    anchors.sort((p, q) => p.x - q.x || p.t - q.t);
    for (let k = 1; k < anchors.length; k += 1) {
      const a = anchors[k - 1];
      const b = anchors[k];
      if (x <= b.x && b.x > a.x) return a.t + ((x - a.x) / (b.x - a.x)) * (b.t - a.t);
    }
    return M.capacity(score);
  }

  // Donde queda lo que se suelta en (clientX, clientY): el compas mas cercano, el tono por la altura y el
  // tiempo por la posicion horizontal. Sobre la columna de una nota cercana se alinea con ella.
  function locate(clientX, clientY, skip) {
    const origin = stage.getBoundingClientRect();
    const x = clientX - origin.left;
    const y = clientY - origin.top;
    let best = null;
    layout.forEach((m, mi) => {
      const space = (m.lines[4] - m.lines[0]) / 4;
      const dx = Math.max(m.left - x, 0, x - m.right);
      const dy = Math.abs(y - m.lines[2]);
      if (dy > space * 7 || dx > space * 3) return;
      const cost = dy + dx * 2;
      if (best && cost >= best.cost) return;
      best = { mi, m, space, cost };
    });
    if (!best) return null;
    const { mi, m, space } = best;
    const half = space / 2;
    const n = M.clampPitch(M.bottomLine(score) + Math.round((m.lines[4] - y) / half));
    const measure = M.measures(score)[mi];
    const starts = M.onsets(measure);
    const centers = eventNodes(mi).map((node) => centerX(node, origin));
    let at = timeAt(Math.max(m.left, Math.min(m.right, x)), m, starts, centers);
    let markX = Math.max(m.left, Math.min(m.right, x));
    let near = null;
    centers.forEach((c, i) => {
      const own = skip && skip.mi === mi && skip.i === i;
      if (own || measure[i].rest || Math.abs(c - x) > space * 1.5) return;
      if (!near || Math.abs(c - x) < Math.abs(near.c - x)) near = { c, i };
    });
    if (near) {
      at = starts[near.i];
      markX = near.c;
    }
    return {
      mi, n, space,
      t: at,
      x: markX,
      y: m.lines[4] - (n - M.bottomLine(score)) * half,
      top: m.lines[0],
      bottom: m.lines[4],
    };
  }

  // La figura bajo el puntero o, con 8 px de margen, la mas cercana: cabezas y plicas son chicas.
  function eventUnder(clientX, clientY) {
    let best = null;
    stage.querySelectorAll('g.note, g.rest').forEach((node) => {
      const r = (node.querySelector('.notehead') || node).getBoundingClientRect();
      const dx = Math.max(r.left - clientX, 0, clientX - r.right);
      const dy = Math.max(r.top - clientY, 0, clientY - r.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance <= 8 && (!best || distance < best.distance)) best = { node, distance };
    });
    const match = best && /^e(\d+)-(\d+)$/.exec(best.node.id);
    return match ? { mi: +match[1], i: +match[2] } : null;
  }

  // ---- arrastre -----------------------------------------------------------

  let marker = null;
  function showMarker(hit) {
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'score-marker';
      marker.innerHTML = '<span class="score-marker-line"></span>';
      stage.appendChild(marker);
    }
    if (!hit) { marker.hidden = true; return; }
    marker.hidden = false;
    const line = marker.firstChild;
    line.style.left = hit.x + 'px';
    line.style.top = hit.top - hit.space * 2 + 'px';
    line.style.height = (hit.bottom - hit.top) + hit.space * 4 + 'px';
  }

  function startGhost(source, event, kind) {
    const ghost = document.createElement('div');
    ghost.className = 'score-ghost';
    ghost.appendChild(source.cloneNode(true));
    document.body.appendChild(ghost);
    // Anclar la cabeza de la nota al puntero; los demas simbolos se centran.
    const glyph = ghost.firstChild;
    const box = kind === 'note' ? glyph.firstChild.getBBox() : glyph.viewBox.baseVal;
    glyph.style.transform = 'translate(' + -(box.x + box.width / 2) + 'px,' + -(box.y + box.height / 2) + 'px)';
    moveGhost(ghost, event);
    return ghost;
  }

  function moveGhost(ghost, event) {
    ghost.style.transform = 'translate(' + event.clientX + 'px,' + event.clientY + 'px)';
  }

  let hoverPoint = null;
  let hoverGhost = null;

  function clearHoverGhost() {
    if (hoverGhost) hoverGhost.remove();
    hoverGhost = null;
    if (!drag) showMarker(null);
  }

  function updateHoverGhost() {
    const point = hoverPoint;
    const overStage = point && stage.contains(document.elementFromPoint(point.clientX, point.clientY));
    const hit = activeItem && !drag && overStage && locate(point.clientX, point.clientY);
    if (!hit) { clearHoverGhost(); return; }
    if (!hoverGhost) {
      hoverGhost = startGhost(glyphFor(activeItem), point, activeItem.kind);
      hoverGhost.classList.add('score-hover-ghost');
    } else moveGhost(hoverGhost, point);
    showMarker(hit);
  }

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    hoverPoint = { clientX: event.clientX, clientY: event.clientY };
    updateHoverGhost();
  });
  stage.addEventListener('pointerleave', () => {
    hoverPoint = null;
    clearHoverGhost();
  });
  window.addEventListener('blur', () => {
    hoverPoint = null;
    clearHoverGhost();
  });

  function beginDrag(event, info) {
    clearHoverGhost();
    drag = Object.assign({ x: event.clientX, y: event.clientY, id: event.pointerId, active: false }, info);
  }

  document.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      drag.active = true;
      if (drag.insert) return;
      drag.ghost = startGhost(drag.glyph, event, drag.kind);
      document.body.classList.add('score-dragging');
    }
    if (drag.insert) return;
    event.preventDefault();
    moveGhost(drag.ghost, event);
    const modifier = drag.item && (drag.item.kind === 'dot' || drag.item.kind === 'acc');
    if (modifier) {
      showMarker(null);
      stage.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
      const hit = eventUnder(event.clientX, event.clientY);
      if (hit) stage.querySelector('[id="e' + hit.mi + '-' + hit.i + '"]').classList.add('is-target');
    } else {
      showMarker(locate(event.clientX, event.clientY, drag.from));
    }
    drag.overTrash = !!document.elementFromPoint(event.clientX, event.clientY)?.closest('#scoreTrash');
  }, { passive: false });

  function endDrag(event, cancelled) {
    if (!drag || event.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    document.body.classList.remove('score-dragging');
    stage.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
    showMarker(null);
    if (d.ghost) d.ghost.remove();
    if (cancelled) return;
    if (!d.active) {
      if (d.item && d.item.key) activateFigure(d.item);
      else if (d.insert) {
        const target = locate(event.clientX, event.clientY);
        if (target && activeItem) dropNew(activeItem, target);
      }
      return;
    }
    if (d.insert) return;
    if (d.overTrash) {
      if (d.from) { selected = d.from; removeSelected(); }
      return;
    }
    if (d.item && (d.item.kind === 'dot' || d.item.kind === 'acc')) {
      const hit = eventUnder(event.clientX, event.clientY);
      if (hit) applyModifier(d.item, hit);
      return;
    }
    const target = locate(event.clientX, event.clientY, d.from);
    if (!target) return;
    if (d.from) moveEvent(d.from, target);
    else dropNew(d.item, target);
  }

  document.addEventListener('pointerup', (event) => {
    endDrag(event, false);
    updateHoverGhost();
  });
  document.addEventListener('pointercancel', (event) => endDrag(event, true));

  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.score-meter-trigger, .score-clef-trigger')) return;
    const match = eventUnder(event.clientX, event.clientY);
    if (!match) {
      selected = null;
      markSelected();
      stage.focus({ preventScroll: true });
      if (activeItem) beginDrag(event, { insert: true });
      return;
    }
    event.preventDefault();
    stage.focus({ preventScroll: true });
    selected = match;
    markSelected();
    const ev = eventAt(selected);
    beginDrag(event, { from: selected, kind: ev.rest ? 'rest' : 'note', glyph: glyphFor({ kind: ev.rest ? 'rest' : 'note', d: ev.d }) });
  });

  stage.addEventListener('keydown', (event) => {
    if (event.target !== stage) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); shiftSelected(1); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); shiftSelected(-1); }
    else if (event.key === 'Escape') { selected = null; markSelected(); }
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape') {
      activeItem = null;
      clearHoverGhost();
      palette.querySelectorAll('[aria-pressed]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && !meterPopup.matches(':popover-open') && !clefPopup.matches(':popover-open')) {
      const item = ITEMS.find((item) => item && item.key === event.key);
      if (item) { event.preventDefault(); activateFigure(item); return; }
    }
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });

  // ---- selector de compas -------------------------------------------------

  const meterPopup = document.createElement('div');
  meterPopup.id = 'scoreMeterPopup';
  meterPopup.className = 'score-meter-popup';
  meterPopup.setAttribute('popover', 'auto');
  meterPopup.setAttribute('role', 'group');
  meterPopup.setAttribute('aria-label', t.meter);
  const meterTitle = document.createElement('p');
  meterTitle.textContent = t.meter;
  meterPopup.appendChild(meterTitle);
  const meterOptions = document.createElement('div');
  meterOptions.className = 'score-meter-options';
  meterPopup.appendChild(meterOptions);
  document.querySelector('.score-page').appendChild(meterPopup);

  M.METERS.forEach((meter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = meter;
    button.addEventListener('click', () => {
      if (meter === M.meterOf(score)) {
        meterPopup.hidePopover();
      } else {
        const changed = change(() => M.setMeter(score, meter));
        if (!changed) { say(t.meterFull); return; }
        say('');
      }
      stage.querySelector('.score-meter-trigger')?.focus({ preventScroll: true });
    });
    meterOptions.appendChild(button);
  });

  meterPopup.addEventListener('toggle', (event) => {
    stage.querySelector('.score-meter-trigger')?.setAttribute('aria-expanded', String(event.newState === 'open'));
  });

  function mountMeterButton() {
    const meter = stage.querySelector('g.meterSig');
    if (!meter) return;
    const box = meter.getBoundingClientRect();
    const origin = stage.getBoundingClientRect();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'score-meter-trigger';
    button.setAttribute('aria-label', t.meter + ': ' + M.meterOf(score));
    button.setAttribute('aria-controls', meterPopup.id);
    button.setAttribute('aria-expanded', 'false');
    button.style.left = (box.left + box.width / 2 - origin.left - stage.clientLeft) + 'px';
    button.style.top = (box.top + box.height / 2 - origin.top - stage.clientTop) + 'px';
    button.style.height = Math.max(44, box.height + 12) + 'px';
    button.addEventListener('click', () => {
      if (meterPopup.matches(':popover-open')) { meterPopup.hidePopover(); return; }
      [...meterOptions.children].forEach((option) => {
        option.setAttribute('aria-pressed', String(option.textContent === M.meterOf(score)));
      });
      meterPopup.showPopover();
      const anchor = button.getBoundingClientRect();
      const popup = meterPopup.getBoundingClientRect();
      meterPopup.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - popup.width - 8)) + 'px';
      meterPopup.style.top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - popup.height - 8)) + 'px';
      meterOptions.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    });
    stage.appendChild(button);
  }

  // ---- clave y armadura ---------------------------------------------------

  const clefPopup = document.createElement('div');
  clefPopup.id = 'scoreClefPopup';
  clefPopup.className = 'score-meter-popup score-clef-popup';
  clefPopup.setAttribute('popover', 'auto');
  clefPopup.setAttribute('role', 'dialog');
  clefPopup.setAttribute('aria-label', t.clefAndKey);
  document.querySelector('.score-page').appendChild(clefPopup);
  let clefAnchor = 0;
  let previewToolkit = null;
  let galleryClef = null;

  function signatureGroup(title, className) {
    const heading = document.createElement('p');
    heading.textContent = title;
    const group = document.createElement('div');
    group.className = className;
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', title);
    clefPopup.append(heading, group);
    return group;
  }

  function signatureButton(group, field, value, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'score-signature-option tooltip';
    button.dataset[field] = value;
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => {
      const current = field === 'clef' ? M.clefOf(score) : M.fifthsOf(score);
      if (current !== value) change(() => { score[field] = value; });
      openClefPopup(clefAnchor, button);
    });
    group.appendChild(button);
    return button;
  }

  const clefOptions = signatureGroup(t.clef, 'score-clef-options');
  Object.keys(M.CLEFS).forEach((clef) => signatureButton(clefOptions, 'clef', clef, t.clefs[clef]));
  const keyOptions = signatureGroup(t.keySignature, 'score-key-options');
  t.keys.forEach((label, i) => {
    const button = signatureButton(keyOptions, 'fifths', i - 7, label);
    const name = document.createElement('span');
    name.className = 'score-key-name';
    name.textContent = label.split(' · ')[0];
    button.appendChild(name);
  });

  // El mismo grabador de la partitura dibuja las muestras: posiciones de clave y armadura reales.
  function signaturePreview(button, clef, fifths, kind) {
    if (!previewToolkit) previewToolkit = newToolkit();
    const sample = { clef, fifths, rows: [[[]]] };
    previewToolkit.setOptions(layoutOptions(300));
    previewToolkit.loadData(M.toMusicXml(sample));
    const doc = new DOMParser().parseFromString(previewToolkit.renderToSVG(1), 'image/svg+xml');
    const staff = doc.querySelector('g.staff');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('score-signature-preview');
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(document.importNode(doc.querySelector('defs'), true));
    const lines = [...staff.querySelectorAll(':scope > path')].slice(0, 5).map((path) => {
      const line = document.importNode(path, true);
      svg.appendChild(line);
      return line;
    });
    const symbol = staff.querySelector(kind === 'clef' ? 'g.clef' : 'g.keySig');
    const glyph = symbol && document.importNode(symbol, true);
    if (glyph) svg.appendChild(glyph);
    button.prepend(svg);
    const staffBox = lines[0].getBBox();
    const bottom = lines[4].getBBox().y;
    const box = glyph && glyph.getBBox();
    const width = kind === 'clef' ? 1100 : 2700;
    const height = 1800;
    const center = box && box.width ? box.x + box.width / 2 : 1350;
    const left = center - width / 2;
    const top = (staffBox.y + bottom) / 2 - height / 2;
    lines.forEach((line) => {
      const y = line.getBBox().y;
      line.setAttribute('d', `M${left} ${y} L${left + width} ${y}`);
      line.setAttribute('stroke', 'currentColor');
    });
    svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
  }

  function openClefPopup(index, focusButton) {
    clefAnchor = index;
    const anchorButton = stage.querySelectorAll('.score-clef-trigger')[index];
    clefOptions.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.clef === M.clefOf(score)));
    });
    keyOptions.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.fifths) === M.fifthsOf(score)));
    });
    if (!clefPopup.matches(':popover-open')) clefPopup.showPopover();
    clefOptions.querySelectorAll('button').forEach((button) => {
      if (!button.querySelector('svg')) signaturePreview(button, button.dataset.clef, 0, 'clef');
    });
    if (galleryClef !== M.clefOf(score)) {
      keyOptions.querySelectorAll('button').forEach((button) => {
        button.querySelector('svg')?.remove();
        signaturePreview(button, M.clefOf(score), Number(button.dataset.fifths), 'key');
      });
      galleryClef = M.clefOf(score);
    }
    const anchor = anchorButton.getBoundingClientRect();
    const popup = clefPopup.getBoundingClientRect();
    clefPopup.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - popup.width - 8)) + 'px';
    clefPopup.style.top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - popup.height - 8)) + 'px';
    (focusButton || clefOptions.querySelector('[aria-pressed="true"]')).focus({ preventScroll: true });
  }

  clefPopup.addEventListener('toggle', (event) => {
    stage.querySelectorAll('.score-clef-trigger').forEach((button, i) => {
      button.setAttribute('aria-expanded', String(event.newState === 'open' && i === clefAnchor));
    });
  });

  function mountClefButtons() {
    stage.querySelectorAll('g.clef').forEach((clef, i) => {
      const box = clef.getBoundingClientRect();
      const origin = stage.getBoundingClientRect();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'score-clef-trigger';
      button.setAttribute('aria-label', t.clefAndKey + ': ' + t.clefs[M.clefOf(score)] + ', ' + t.keys[M.fifthsOf(score) + 7]);
      button.setAttribute('aria-controls', clefPopup.id);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.style.left = (box.left + box.width / 2 - origin.left - stage.clientLeft) + 'px';
      button.style.top = (box.top + box.height / 2 - origin.top - stage.clientTop) + 'px';
      button.style.height = Math.max(44, box.height + 8) + 'px';
      button.addEventListener('click', () => {
        if (clefPopup.matches(':popover-open')) { clefPopup.hidePopover(); return; }
        openClefPopup(i);
      });
      stage.appendChild(button);
    });
  }

  // ---- paleta -------------------------------------------------------------

  const ICONS = {
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  };

  function lucide(name) {
    return '<svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // Glifos propios: Lucide no tiene figuras musicales.
  const HEAD = 'M13.2 29.2c-3.6 0-6.2-1.6-6.2-3.9 0-2.9 3.7-5.5 7.6-5.5 3.3 0 5.4 1.5 5.4 3.8 0 3.1-3.6 5.6-6.8 5.6z';
  const HOLLOW_HEAD = 'M14.4 19.8c3.5 0 5.6 1.5 5.6 3.8 0 3-3.7 5.7-7.2 5.7-3.4 0-5.8-1.6-5.8-3.9 0-3 3.9-5.6 7.4-5.6zm-.4 1.9c-2.7 1.2-5 3.3-5 4.7 0 .9.9 1.4 2.2 1.4 2.4-.9 4.9-3.2 4.9-4.7 0-.8-.8-1.5-2.1-1.4z';
  const GLYPHS = {
    'note:w': '<path d="' + HOLLOW_HEAD + '" fill-rule="evenodd"/>',
    'note:h': '<path d="' + HOLLOW_HEAD + '" fill-rule="evenodd"/><path d="M19.6 24.2V5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:q': '<path d="' + HEAD + '"/><path d="M19.6 24.2V5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:e': '<path d="' + HEAD + '"/><path d="M19.6 24.2V5c0 4 5 5.5 5 11" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:s': '<path d="' + HEAD + '"/><path d="M19.6 24.2V4m0 0c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'rest:w': '<path d="M5 12h20" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h12v6H9z"/>',
    'rest:h': '<path d="M5 18h20" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h12v6H9z"/>',
    'rest:q': '<path d="M12 5l7 8-5 5 6 7c-3-1-6.500-.5-6 3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
    'rest:e': '<circle cx="12" cy="11" r="2.4"/><path d="M13 12.500c3 0 5-1.300 6-3.500l-5 20" stroke="currentColor" stroke-width="1.700" fill="none"/>',
    'rest:s': '<circle cx="12" cy="9" r="2.400"/><circle cx="10" cy="17" r="2.400"/><path d="M13 10c3 0 5-1.300 6-3.500l-6.500 22" stroke="currentColor" stroke-width="1.700" fill="none"/>',
    dot: '<circle cx="15" cy="15" r="3.200"/>',
    'acc:#': '<path d="M11 6v20M18 4v20M7.500 12.500l14-3.500M7.500 21l14-3.500" stroke="currentColor" stroke-width="1.800" fill="none"/>',
    'acc:b': '<path d="M10 4v22c4-2 8-5 8-8.500 0-2.500-2-3.500-4-3.500-1.500 0-3 .800-4 2" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
    'acc:n': '<path d="M10 5v16l10-3.500M20 27V11L10 14.500" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
  };

  function glyphKey(item) {
    if (item.kind === 'note' || item.kind === 'rest') return item.kind + ':' + item.d;
    return item.kind === 'dot' ? 'dot' : 'acc:' + item.acc;
  }

  function glyphFor(item) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 30 32');
    svg.setAttribute('width', '30');
    svg.setAttribute('height', '32');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = GLYPHS[glyphKey(item)];
    return svg;
  }

  const ITEMS = [
    { kind: 'note', d: 'w', key: '1', label: t.whole },
    { kind: 'note', d: 'h', key: '2', label: t.half },
    { kind: 'note', d: 'q', key: '3', label: t.quarter },
    { kind: 'note', d: 'e', key: '4', label: t.eighth },
    { kind: 'note', d: 's', key: '5', label: t.sixteenth },
    null,
    { kind: 'rest', d: 'w', key: '6', label: t.restWhole },
    { kind: 'rest', d: 'h', key: '7', label: t.restHalf },
    { kind: 'rest', d: 'q', key: '8', label: t.restQuarter },
    { kind: 'rest', d: 'e', key: '9', label: t.restEighth },
    { kind: 'rest', d: 's', key: '0', label: t.restSixteenth },
    null,
    { kind: 'dot', label: t.dot },
    { kind: 'acc', acc: '#', label: t.sharp },
    { kind: 'acc', acc: 'b', label: t.flat },
    { kind: 'acc', acc: 'n', label: t.natural },
  ];

  ITEMS.forEach((item) => {
    if (!item) {
      const sep = document.createElement('span');
      sep.className = 'score-palette-sep';
      palette.appendChild(sep);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'score-palette-item';
    button.setAttribute('aria-label', item.label);
    button.title = item.label;
    button.appendChild(glyphFor(item));
    if (item.key) {
      button.dataset.shortcut = item.key;
      button.setAttribute('aria-keyshortcuts', item.key);
      button.setAttribute('aria-pressed', 'false');
      button.title += ' (' + item.key + ')';
      const key = document.createElement('span');
      key.className = 'score-palette-key';
      key.setAttribute('aria-hidden', 'true');
      key.textContent = item.key;
      button.appendChild(key);
      button.addEventListener('click', (event) => {
        if (event.detail === 0) activateFigure(item);
      });
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      beginDrag(event, { item, kind: item.kind, glyph: glyphFor(item) });
    });
    palette.appendChild(button);
  });

  // ---- renglones, descargas ----------------------------------------------

  document.getElementById('scoreTrash').innerHTML = lucide('trash');
  document.getElementById('scoreTrash').addEventListener('click', removeSelected);
  addRow.innerHTML = lucide('plus');
  removeRow.innerHTML = lucide('minus');
  document.querySelectorAll('[data-icon="download"]').forEach((node) => { node.insertAdjacentHTML('afterbegin', lucide('download')); });

  const downloads = document.getElementById('scoreDownloads');
  const downloadToggle = document.getElementById('scoreDownloadToggle');
  const downloadOptions = document.getElementById('scoreDownloadOptions');
  function closeDownloads() {
    downloadOptions.hidden = true;
    downloadToggle.setAttribute('aria-expanded', 'false');
  }
  downloadToggle.addEventListener('click', () => {
    downloadOptions.hidden = !downloadOptions.hidden;
    downloadToggle.setAttribute('aria-expanded', String(!downloadOptions.hidden));
  });
  document.addEventListener('click', (event) => {
    if (!downloads.contains(event.target)) closeDownloads();
  });
  downloads.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !downloadOptions.hidden) {
      event.preventDefault();
      closeDownloads();
      downloadToggle.focus();
    }
  });
  downloadOptions.addEventListener('click', (event) => {
    if (event.target.closest('button')) {
      closeDownloads();
      downloadToggle.focus();
    }
  });

  addRow.addEventListener('click', () => change(() => { score.rows.push(M.emptyRow()); }));
  removeRow.addEventListener('click', () => change(() => {
    if (score.rows.length <= M.MIN_ROWS) return false;
    selected = null;
    score.rows.pop();
  }));

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.getElementById('scoreDownloadXml').addEventListener('click', () => {
    download(new Blob([M.toMusicXml(score)], { type: 'application/vnd.recordare.musicxml+xml' }), 'partitura.musicxml');
  });

  // Verovio numera el primer compas de cada renglon; en una partitura de uso personal sobran.
  function withoutMeasureNumbers(markup) {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    doc.querySelectorAll('g.mNum').forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(doc);
  }

  function rasterize(svgMarkup, pixelWidth, pixelHeight) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, pixelWidth, pixelHeight);
        ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('rasterize failed')); };
      img.src = url;
    });
  }

  document.getElementById('scoreDownloadPdf').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript(vendorUrl('jspdf.umd.min.js'));
      // A4 a 200 ppp. El ancho de pagina esta en unidades de Verovio (como en pantalla) para que el pentagrama
      // conserve su proporcion; el alto sigue la relacion de A4 y se rasteriza a 1654 x 2339.
      const pdfWidth = 2400;
      const pdfToolkit = newToolkit();
      pdfToolkit.setOptions({
        scale: SCALE,
        pageWidth: pdfWidth,
        pageHeight: Math.round(pdfWidth * 297 / 210),
        adjustPageHeight: false,
        breaks: 'encoded',
        header: 'none',
        footer: 'none',
        svgViewBox: true,
        pageMarginLeft: 100,
        pageMarginRight: 100,
        pageMarginTop: score.title ? 230 : 150,
        pageMarginBottom: 150,
        justifyVertically: false,
        minLastJustification: 0,
        mnumInterval: 0,
      });
      pdfToolkit.loadData(M.toMusicXml(score, { plainGuitarClef: true }));
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      for (let page = 1; page <= pdfToolkit.getPageCount(); page += 1) {
        const image = await rasterize(withoutMeasureNumbers(pdfToolkit.renderToSVG(page)), 1654, 2339);
        if (page > 1) pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, 0, 210, 297);
        if (page === 1 && score.title) {
          pdf.setFont('times', 'bold');
          pdf.setFontSize(18);
          pdf.setFontSize(Math.min(18, 18 * 192 / pdf.getTextWidth(score.title)));
          pdf.text(score.title, 8.75, 15);
        }
      }
      pdf.save('partitura.pdf');
    } catch (e) {
      say(t.pdfError);
    } finally {
      button.disabled = false;
    }
  });

  // ---- arranque -----------------------------------------------------------

  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (stage.clientWidth !== renderedWidth) render(); }, 120);
  }).observe(stage);

  stage.setAttribute('aria-busy', 'true');
  loadVerovio().then(() => {
    stage.removeAttribute('aria-busy');
    render();
  }, () => {
    stage.removeAttribute('aria-busy');
    say(t.loadError);
  });

  window.scoreEditor = { get score() { return score; }, render };
})();
