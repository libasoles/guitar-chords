/* score-editor.js — Pagina /partitura: una partitura donde se arrastran notas desde la paleta.
   Verovio dibuja el MusicXML que sale de ScoreModel; aca solo viven la paleta, el arrastre y las descargas. */
(function () {
  'use strict';

  const M = window.ScoreModel;
  const STORAGE_KEY = 'scoreEditor.v1';
  const SCALE = 45;
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
  let toolkit = null;
  let selected = null; // { mi, i }
  let drag = null;
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
    score = history.pop();
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
      const spot = M.placement(measure, ev, target.t);
      if (!spot) return say(t.full);
      change(() => {
        ev.d = spot.d;
        if (spot.dot) ev.dot = true;
        selected = { mi: target.mi, i: M.insertAt(measure, ev, spot.at) };
      });
    }
  }

  // Los miembros de un acorde comparten duracion, asi que el puntillo va a todos.
  function applyModifier(item, hit) {
    const measure = M.measures(score)[hit.mi];
    const ev = measure[hit.i];
    const column = measure.filter((o) => o.at === ev.at && !o.rest === !ev.rest);
    if (item.kind === 'dot') {
      if (ev.dot) return change(() => { column.forEach((o) => { delete o.dot; }); });
      if (!M.canDot(measure, hit.i)) return say(ev.d === 'w' || ev.d === 's' ? t.noDot : t.full);
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
    const spot = M.placement(others, moved, target.t);
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
      mnumInterval: 0,
    }, extra);
  }

  function render() {
    if (!toolkit) return;
    const width = stage.clientWidth;
    if (!width) return;
    renderedWidth = width;
    toolkit.setOptions(layoutOptions(width));
    toolkit.loadData(M.toMusicXml(score));
    stage.innerHTML = toolkit.renderToSVG(1);
    marker = null;
    const svg = stage.querySelector('svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t.scoreLabel);
    measureLayout();
    markSelected();
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
    const anchors = [{ x: m.left, t: 0 }, { x: m.right, t: M.MEASURE }];
    centers.forEach((c, i) => anchors.push({ x: c, t: starts[i] }));
    anchors.sort((p, q) => p.x - q.x || p.t - q.t);
    for (let k = 1; k < anchors.length; k += 1) {
      const a = anchors[k - 1];
      const b = anchors[k];
      if (x <= b.x && b.x > a.x) return a.t + ((x - a.x) / (b.x - a.x)) * (b.t - a.t);
    }
    return M.MEASURE;
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
    const n = M.clampPitch(M.BOTTOM_LINE + Math.round((m.lines[4] - y) / half));
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
      y: m.lines[4] - (n - M.BOTTOM_LINE) * half,
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
  function showMarker(hit, ghostKind) {
    if (!marker) {
      marker = document.createElement('div');
      marker.className = 'score-marker';
      marker.innerHTML = '<span class="score-marker-line"></span><span class="score-marker-head"></span>';
      stage.appendChild(marker);
    }
    if (!hit) { marker.hidden = true; return; }
    marker.hidden = false;
    const line = marker.firstChild;
    const head = marker.lastChild;
    line.style.left = hit.x + 'px';
    line.style.top = hit.top - hit.space * 2 + 'px';
    line.style.height = (hit.bottom - hit.top) + hit.space * 4 + 'px';
    head.style.display = ghostKind === 'rest' ? 'none' : '';
    head.style.left = hit.x + 'px';
    head.style.top = hit.y + 'px';
    head.style.width = hit.space * 1.3 + 'px';
    head.style.height = hit.space + 'px';
  }

  function startGhost(source, event) {
    const ghost = document.createElement('div');
    ghost.className = 'score-ghost';
    ghost.appendChild(source.cloneNode(true));
    document.body.appendChild(ghost);
    moveGhost(ghost, event);
    return ghost;
  }

  function moveGhost(ghost, event) {
    ghost.style.transform = 'translate(' + (event.clientX + 10) + 'px,' + (event.clientY + 10) + 'px)';
  }

  function beginDrag(event, info) {
    drag = Object.assign({ x: event.clientX, y: event.clientY, id: event.pointerId, active: false }, info);
  }

  document.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      drag.active = true;
      drag.ghost = startGhost(drag.glyph, event);
      document.body.classList.add('score-dragging');
    }
    event.preventDefault();
    moveGhost(drag.ghost, event);
    const modifier = drag.item && (drag.item.kind === 'dot' || drag.item.kind === 'acc');
    if (modifier) {
      showMarker(null);
      stage.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
      const hit = eventUnder(event.clientX, event.clientY);
      if (hit) stage.querySelector('[id="e' + hit.mi + '-' + hit.i + '"]').classList.add('is-target');
    } else {
      showMarker(locate(event.clientX, event.clientY, drag.from), drag.kind);
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
    if (!d.active || cancelled) return;
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

  document.addEventListener('pointerup', (event) => endDrag(event, false));
  document.addEventListener('pointercancel', (event) => endDrag(event, true));

  stage.addEventListener('pointerdown', (event) => {
    const match = eventUnder(event.clientX, event.clientY);
    if (!match) {
      selected = null;
      markSelected();
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
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); shiftSelected(1); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); shiftSelected(-1); }
    else if (event.key === 'Escape') { selected = null; markSelected(); }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });

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
    { kind: 'note', d: 'w', label: t.whole },
    { kind: 'note', d: 'h', label: t.half },
    { kind: 'note', d: 'q', label: t.quarter },
    { kind: 'note', d: 'e', label: t.eighth },
    { kind: 'note', d: 's', label: t.sixteenth },
    null,
    { kind: 'rest', d: 'w', label: t.restWhole },
    { kind: 'rest', d: 'h', label: t.restHalf },
    { kind: 'rest', d: 'q', label: t.restQuarter },
    { kind: 'rest', d: 'e', label: t.restEighth },
    { kind: 'rest', d: 's', label: t.restSixteenth },
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
        pageMarginTop: 150,
        pageMarginBottom: 150,
        justifyVertically: false,
        minLastJustification: 0,
        mnumInterval: 0,
      });
      pdfToolkit.loadData(M.toMusicXml(score));
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      for (let page = 1; page <= pdfToolkit.getPageCount(); page += 1) {
        const image = await rasterize(withoutMeasureNumbers(pdfToolkit.renderToSVG(page)), 1654, 2339);
        if (page > 1) pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, 0, 210, 297);
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
