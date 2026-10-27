/* score-editor.js — Pagina /partitura: una partitura donde se arrastran notas desde la paleta.
   Verovio dibuja el MusicXML que sale de ScoreModel; aca solo viven la paleta, el arrastre y las descargas. */
(function () {
  'use strict';

  const M = window.ScoreModel;
  const STORAGE_KEY = 'scoreEditor.v2';
  const LEGACY_KEY = 'scoreEditor.v1'; // guardada con 8 divisiones por negra
  const SCALE = 60;
  const HISTORY_LIMIT = 100;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const script = document.currentScript;
  const t = JSON.parse(document.getElementById('scoreStrings').textContent);

  const stage = document.getElementById('scoreStage');
  const status = document.getElementById('scoreStatus');
  const palette = document.getElementById('scorePalette');
  const barlines = document.getElementById('scoreBarlines');
  const toolbars = document.querySelector('.score-page');
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
  let selected = null; // { mi, i }: la figura principal
  let group = []; // con dos o mas figuras elegidas, todas (incluida la principal)
  let drag = null;
  let activeItem = null;
  let layout = []; // por compas: { left, right, lines: [y1..y5] } relativo al escenario
  let history = [];
  let renderedWidth = 0;

  function load() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return M.sanitize(JSON.parse(current));
      return M.sanitize(JSON.parse(localStorage.getItem(LEGACY_KEY)), 8);
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
    group = [];
    save();
    render();
  }

  function eventAt(sel) {
    return sel && M.measures(score)[sel.mi] && M.measures(score)[sel.mi][sel.i];
  }

  const same = (a, b) => a.mi === b.mi && a.i === b.i;

  function picks() {
    return group.length > 1 ? group : selected ? [selected] : [];
  }

  function setPicks(list) {
    selected = list.length ? list[list.length - 1] : null;
    group = list.length > 1 ? list : [];
    markSelected();
  }

  function togglePick(ref) {
    const list = picks().slice();
    const k = list.findIndex((p) => same(p, ref));
    if (k >= 0) list.splice(k, 1);
    else list.push(ref);
    setPicks(list);
  }

  // Shift + flechas: suma la figura vecina en orden de lectura; sin Shift, la reemplaza.
  function stepSelection(dir, extend) {
    const list = picks();
    if (!list.length) return;
    const order = M.sequence(score);
    const at = list.map((p) => order.findIndex((o) => same(o, p)));
    const next = order[(dir > 0 ? Math.max(...at) : Math.min(...at)) + dir];
    if (!next || list.some((p) => same(p, next))) return;
    setPicks(extend ? list.concat(next) : [next]);
  }

  function dropNew(item, target) {
    if (item.kind === 'bar') {
      change(() => M.setBarline(score, target.mi, item.bar));
      say('');
      return;
    }
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
        group = [];
      });
    }
  }

  function isModifier(item) {
    return item && (item.kind === 'dot' || item.kind === 'acc');
  }

  function deactivateTool() {
    activeItem = null;
    clearHoverGhost();
    toolbars.querySelectorAll('.score-palette-item[aria-pressed]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  function activateTool(item) {
    if (activeItem === item) { deactivateTool(); return; }
    activeItem = item;
    clearHoverGhost();
    updateHoverGhost();
    toolbars.querySelectorAll('.score-palette-item[aria-pressed]').forEach((button) => {
      button.setAttribute('aria-pressed', String(item.key ? button.dataset.shortcut === item.key : button.dataset.barline === item.bar));
    });
    if (item.kind === 'bar') return;
    if (isModifier(item)) {
      if (eventAt(selected)) applyModifier(item, selected);
      return;
    }
    const ev = eventAt(selected);
    if (!ev || (ev.d === item.d && !!ev.rest === (item.kind === 'rest'))) return;
    const replacement = Object.assign({}, ev, { d: item.d });
    delete replacement.tp;
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
      if (!M.canDot(measure, hit.i, score)) return say(ev.d === 'w' || ev.d === 's' || ev.tp ? t.noDot : t.full);
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
    ['tp', 'tie', 'slur', 'beam'].forEach((key) => { delete moved[key]; });
    if (!ev.rest) moved.n = target.n;
    const spot = M.placement(others, moved, target.t, score);
    if (!spot) return say(t.full);
    change(() => {
      all[from.mi].splice(from.i, 1);
      moved.d = spot.d;
      if (spot.dot) moved.dot = true;
      else delete moved.dot;
      selected = { mi: target.mi, i: M.insertAt(destination, moved, spot.at) };
      group = [];
    });
  }

  // Mueve las figuras elegidas juntas: el mismo desplazamiento en tiempo, compas y altura que la figura agarrada.
  function moveGroup(refs, from, target) {
    const all = M.measures(score);
    const anchor = eventAt(from);
    const items = refs.map((r) => ({ ev: all[r.mi][r.i], mi: r.mi, at: M.onsets(all[r.mi])[r.i] }));
    const anchorAt = items.find((x) => x.ev === anchor).at;
    const grid = items.some((x) => x.ev.tp) ? 2 : M.GRID;
    const dt = Math.round((target.t - anchorAt) / grid) * grid;
    const dmi = target.mi - from.mi;
    const pitched = items.filter((x) => !x.ev.rest);
    let dn = anchor.rest ? 0 : target.n - anchor.n;
    if (pitched.length) {
      dn = Math.max(M.LOWEST - Math.min(...pitched.map((x) => x.ev.n)), Math.min(M.HIGHEST - Math.max(...pitched.map((x) => x.ev.n)), dn));
    }
    if (!dt && !dmi && !dn) return;
    const moving = new Set(items.map((x) => x.ev));
    const plan = items.map((x) => Object.assign({}, x, { to: x.mi + dmi, at: x.at + dt }));
    const clash = (p) => {
      const rest = all[p.to] && all[p.to].filter((o) => !moving.has(o));
      const starts = rest && M.onsets(rest);
      return !rest || p.at < 0 || p.at + M.length(p.ev) > M.capacity(score) ||
        (!p.ev.rest && rest.some((o, i) => !o.rest && starts[i] === p.at && o.n === p.ev.n + dn && o.acc === p.ev.acc));
    };
    if (plan.some(clash)) return say(t.full);
    change(() => {
      all.forEach((measure) => {
        for (let i = measure.length - 1; i >= 0; i -= 1) if (moving.has(measure[i])) measure.splice(i, 1);
      });
      const ids = new Map();
      plan.sort((a, b) => a.at - b.at).forEach((p) => {
        const destination = all[p.to];
        if (!p.ev.rest) p.ev.n += dn;
        delete p.ev.tie;
        delete p.ev.slur;
        if (p.ev.tp) {
          const key = p.mi + '-' + p.ev.tp;
          if (!ids.has(key)) ids.set(key, Math.max(0, ...destination.map((o) => o.tp || 0)) + 1);
          p.ev.tp = ids.get(key);
        }
        M.insertAt(destination, p.ev, p.at);
      });
      const refsAfter = plan.map((p) => ({ mi: p.to, i: all[p.to].indexOf(p.ev) }));
      selected = refsAfter[refsAfter.length - 1];
      group = refsAfter.length > 1 ? refsAfter : [];
    });
  }

  function removeSelected() {
    const list = picks().filter(eventAt);
    if (!list.length) return;
    change(() => {
      list.sort((a, b) => b.mi - a.mi || b.i - a.i).forEach((p) => M.measures(score)[p.mi].splice(p.i, 1));
      selected = null;
      group = [];
    });
  }

  function shiftSelected(delta) {
    const notes = picks().map(eventAt).filter((ev) => ev && !ev.rest);
    if (!notes.length) return;
    change(() => { notes.forEach((ev) => { ev.n = M.clampPitch(ev.n + delta); }); });
  }

  function applyAction(action) {
    const list = picks();
    const result = change(() => M.applySelection(score, list, action));
    if (!result) say(t.full);
    else say('');
    stage.focus({ preventScroll: true });
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
    toolkit.loadData(M.toMusicXml(score));
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
    mountBarlineButtons();
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

  function clearBarSelection() {
    stage.querySelector('.score-barline-remove')?.remove();
    stage.querySelectorAll('.is-bar-selected').forEach((node) => node.classList.remove('is-bar-selected'));
    stage.querySelectorAll('.score-barline-trigger').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.score-barline-trigger, .score-barline-remove')) clearBarSelection();
  });

  function mountBarlineButtons() {
    const origin = stage.getBoundingClientRect();
    stage.querySelectorAll('g.measure').forEach((measure) => {
      const mi = Number(measure.id.slice(1));
      const hasStart = score.barlines && score.barlines[mi]?.start;
      measure.querySelectorAll('g.barLine').forEach((node, index) => {
        const box = node.getBoundingClientRect();
        if (!box.height) return;
        const side = hasStart && index === 0 ? 'start' : 'end';
        const x = box.left + box.width / 2 - origin.left;
        const y = box.top - origin.top;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'score-barline-trigger';
        button.dataset.measure = mi;
        button.dataset.side = side;
        button.setAttribute('aria-label', t.selectBarline);
        button.setAttribute('aria-pressed', 'false');
        button.style.left = x + 'px';
        button.style.top = y + 'px';
        button.style.width = Math.max(20, box.width + 12) + 'px';
        button.style.height = Math.max(44, box.height) + 'px';
        button.addEventListener('click', () => {
          clearBarSelection();
          deactivateTool();
          selected = null;
          markSelected();
          node.classList.add('is-bar-selected');
          button.setAttribute('aria-pressed', 'true');
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'score-barline-remove';
          remove.setAttribute('aria-label', t.deleteBarline);
          remove.title = t.deleteBarline;
          remove.innerHTML = lucide('x');
          remove.style.left = x + 'px';
          remove.style.top = (y - 4) + 'px';
          remove.addEventListener('click', () => change(() => M.removeBarline(score, mi, side)));
          remove.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { clearBarSelection(); button.focus(); }
          });
          stage.appendChild(remove);
        });
        stage.appendChild(button);
      });
    });
  }

  function markSelected() {
    stage.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
    if (!selected) group = [];
    const nodes = picks().map((p) => stage.querySelector('[id="e' + p.mi + '-' + p.i + '"]'));
    if (nodes.some((node) => !node)) {
      selected = null;
      group = [];
    } else nodes.forEach((node) => node.classList.add('is-selected'));
    updateSelectionMenu();
  }

  // ---- menu contextual de la seleccion --------------------------------------

  function hideSelectionMenu() {
    stage.querySelector('.score-selection-menu')?.remove();
  }

  // Aparece junto a las figuras elegidas con lo que se puede hacer con ellas; se va al cambiar la seleccion.
  function updateSelectionMenu() {
    hideSelectionMenu();
    const list = picks();
    if (!list.length || drag?.active) return;
    const actions = M.selectionActions(score, list);
    if (!actions.length) return;
    const origin = stage.getBoundingClientRect();
    const boxes = list.map((p) => stage.querySelector('[id="e' + p.mi + '-' + p.i + '"]').getBoundingClientRect());
    const top = Math.min(...boxes.map((b) => b.top)) - origin.top;
    const bottom = Math.max(...boxes.map((b) => b.bottom)) - origin.top;
    const center = (Math.min(...boxes.map((b) => b.left)) + Math.max(...boxes.map((b) => b.right))) / 2 - origin.left;
    const menu = document.createElement('div');
    menu.className = 'score-selection-menu';
    menu.setAttribute('role', 'toolbar');
    menu.setAttribute('aria-label', t.selectionActions);
    actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'score-selection-action';
      button.dataset.action = action;
      button.innerHTML = lucide(ACTION_ICONS[action]) + '<span></span>';
      button.lastChild.textContent = t[action];
      button.addEventListener('click', () => applyAction(action));
      menu.appendChild(button);
    });
    stage.appendChild(menu);
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    menu.style.left = Math.max(4, Math.min(stage.clientWidth - width - 4, center - width / 2)) + 'px';
    menu.style.top = (top - height - 12 >= 4 ? top - height - 12 : bottom + 12) + 'px';
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
      const own = skip && [].concat(skip).some((s) => s.mi === mi && s.i === i);
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
    const item = drag ? drag.item : activeItem;
    const x = item && item.kind === 'bar' ? layout[hit.mi][item.bar === 'start' ? 'left' : 'right'] : hit.x;
    line.style.left = x + 'px';
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
    if (!drag) {
      showMarker(null);
      stage.querySelectorAll('.is-target').forEach((node) => node.classList.remove('is-target'));
    }
  }

  function updateHoverGhost() {
    const point = hoverPoint;
    const over = point && document.elementFromPoint(point.clientX, point.clientY);
    const overStage = over && stage.contains(over) && !over.closest('.score-barline-trigger, .score-barline-remove, .score-selection-menu');
    const hit = activeItem && !drag && overStage && locate(point.clientX, point.clientY);
    if (!hit) { clearHoverGhost(); return; }
    if (!hoverGhost) {
      hoverGhost = startGhost(glyphFor(activeItem), point, activeItem.kind);
      hoverGhost.classList.add('score-hover-ghost');
    } else moveGhost(hoverGhost, point);
    stage.querySelectorAll('.is-target').forEach((node) => node.classList.remove('is-target'));
    if (isModifier(activeItem)) {
      showMarker(null);
      const target = eventUnder(point.clientX, point.clientY);
      if (target) stage.querySelector('[id="e' + target.mi + '-' + target.i + '"]').classList.add('is-target');
    } else showMarker(hit);
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
      hideSelectionMenu();
      if (drag.insert) return;
      drag.ghost = startGhost(drag.glyph, event, drag.kind);
      document.body.classList.add('score-dragging');
    }
    if (drag.insert) return;
    event.preventDefault();
    moveGhost(drag.ghost, event);
    const modifier = isModifier(drag.item);
    if (modifier) {
      showMarker(null);
      stage.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
      const hit = eventUnder(event.clientX, event.clientY);
      if (hit) stage.querySelector('[id="e' + hit.mi + '-' + hit.i + '"]').classList.add('is-target');
    } else {
      showMarker(locate(event.clientX, event.clientY, drag.group || drag.from));
    }
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
      if (d.group) setPicks([d.from]);
      if (d.item) activateTool(d.item);
      else if (d.from && isModifier(activeItem)) applyModifier(activeItem, d.from);
      else if (d.insert) {
        const target = locate(event.clientX, event.clientY);
        if (target && activeItem) dropNew(activeItem, target);
      }
      return;
    }
    if (d.insert) return;
    if (isModifier(d.item)) {
      const hit = eventUnder(event.clientX, event.clientY);
      if (hit) applyModifier(d.item, hit);
      return;
    }
    const target = locate(event.clientX, event.clientY, d.group || d.from);
    if (!target) { markSelected(); return; }
    if (d.group) moveGroup(d.group, d.from, target);
    else if (d.from) moveEvent(d.from, target);
    else dropNew(d.item, target);
    markSelected();
  }

  document.addEventListener('pointerup', (event) => {
    endDrag(event, false);
    updateHoverGhost();
  });
  document.addEventListener('pointercancel', (event) => endDrag(event, true));

  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.score-meter-trigger, .score-clef-trigger, .score-barline-trigger, .score-barline-remove, .score-selection-menu')) return;
    if (activeItem && activeItem.kind === 'bar') {
      event.preventDefault();
      stage.focus({ preventScroll: true });
      beginDrag(event, { insert: true });
      return;
    }
    const match = eventUnder(event.clientX, event.clientY);
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    if (!match) {
      if (!additive) setPicks([]);
      stage.focus({ preventScroll: true });
      if (activeItem) beginDrag(event, { insert: true });
      else if (event.pointerType !== 'touch') beginMarquee(event, additive);
      return;
    }
    event.preventDefault();
    stage.focus({ preventScroll: true });
    if (additive) { togglePick(match); return; }
    const inGroup = group.length > 1 && group.some((p) => same(p, match));
    if (inGroup) selected = match;
    else setPicks([match]);
    const ev = eventAt(match);
    beginDrag(event, {
      from: match,
      group: inGroup ? group.slice() : null,
      kind: ev.rest ? 'rest' : 'note',
      glyph: glyphFor({ kind: ev.rest ? 'rest' : 'note', d: ev.d }),
    });
  });

  // ---- marco de seleccion ---------------------------------------------------

  let marquee = null;

  function beginMarquee(event, additive) {
    marquee = { x: event.clientX, y: event.clientY, id: event.pointerId, active: false, additive, base: additive ? picks().slice() : [], el: null };
  }

  function marqueeRect(m, event) {
    return {
      left: Math.min(m.x, event.clientX),
      top: Math.min(m.y, event.clientY),
      right: Math.max(m.x, event.clientX),
      bottom: Math.max(m.y, event.clientY),
    };
  }

  document.addEventListener('pointermove', (event) => {
    if (!marquee || event.pointerId !== marquee.id) return;
    if (!marquee.active) {
      if (Math.hypot(event.clientX - marquee.x, event.clientY - marquee.y) < 5) return;
      marquee.active = true;
      marquee.el = document.createElement('div');
      marquee.el.className = 'score-marquee';
      stage.appendChild(marquee.el);
    }
    const origin = stage.getBoundingClientRect();
    const r = marqueeRect(marquee, event);
    Object.assign(marquee.el.style, {
      left: r.left - origin.left + 'px',
      top: r.top - origin.top + 'px',
      width: r.right - r.left + 'px',
      height: r.bottom - r.top + 'px',
    });
  });

  function endMarquee(event, cancelled) {
    if (!marquee || event.pointerId !== marquee.id) return;
    const m = marquee;
    marquee = null;
    if (m.el) m.el.remove();
    if (!m.active || cancelled) return;
    const r = marqueeRect(m, event);
    const found = [...stage.querySelectorAll('g.note, g.rest')].filter((node) => {
      const b = (node.querySelector('.notehead') || node).getBoundingClientRect();
      return b.left <= r.right && b.right >= r.left && b.top <= r.bottom && b.bottom >= r.top;
    }).map((node) => /^e(\d+)-(\d+)$/.exec(node.id)).filter(Boolean).map((match) => ({ mi: +match[1], i: +match[2] }));
    setPicks(m.base.concat(found.filter((f) => !m.base.some((b) => same(b, f)))));
  }

  document.addEventListener('pointerup', (event) => endMarquee(event, false));
  document.addEventListener('pointercancel', (event) => endMarquee(event, true));

  stage.addEventListener('dblclick', (event) => {
    const hit = eventUnder(event.clientX, event.clientY);
    if (!hit || eventAt(hit).rest) return;
    event.preventDefault();
    selected = hit;
    applyModifier({ kind: 'dot' }, hit);
  });

  stage.addEventListener('keydown', (event) => {
    if (event.target !== stage) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); shiftSelected(1); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); shiftSelected(-1); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      stepSelection(event.key === 'ArrowRight' ? 1 : -1, event.shiftKey);
    } else if (event.key === 'Escape') setPicks([]);
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Escape') {
      clearBarSelection();
      deactivateTool();
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && !meterPopup.matches(':popover-open') && !clefPopup.matches(':popover-open')) {
      const item = ITEMS.find((item) => item && item.key === event.key.toLowerCase());
      if (item) { event.preventDefault(); if (!event.repeat) activateTool(item); return; }
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
  // Tres renglones, de menos a más alteraciones: sin armadura, bemoles (1 a 7), sostenidos (1 a 7).
  const keyOrder = [0, ...[1, 2, 3, 4, 5, 6, 7].map((n) => -n), ...[1, 2, 3, 4, 5, 6, 7]];
  keyOrder.forEach((fifths, i) => {
    const button = signatureButton(keyOptions, 'fifths', fifths, t.keys[fifths + 7]);
    const column = fifths === 0 ? 1 : Math.abs(fifths);
    button.style.gridRow = fifths === 0 ? 1 : fifths < 0 ? 2 : 3;
    button.style.gridColumn = column;
    if (column === 1) button.classList.add('first-column');
    if (column === 7) button.classList.add('last-column');
    if (fifths === 0) {
      const none = document.createElement('span');
      none.className = 'score-key-none';
      none.textContent = t.keyNone;
      button.appendChild(none);
    }
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
    const width = kind === 'clef' ? 1000 : Math.max(800, (box?.width || 0) + 100);
    const height = kind === 'clef' ? 1700 : Math.max(800, (box?.height || 0) + 100);
    const center = box && box.width ? box.x + box.width / 2 : 1350;
    const left = center - width / 2;
    const middle = kind === 'key' && box?.height ? box.y + box.height / 2 : (staffBox.y + bottom) / 2 + (kind === 'clef' ? 130 : 0); // deja sitio al 8 bajo la clave de guitarra
    const top = middle - height / 2;
    lines.forEach((line) => {
      const y = line.getBBox().y;
      line.setAttribute('d', `M${left} ${y} L${left + width} ${y}`);
      line.setAttribute('stroke', 'currentColor');
    });
    if (kind === 'key') {
      lines.forEach((line) => line.remove());
    }
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
        if (!Number(button.dataset.fifths)) return;
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
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    unlink: '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" x2="8" y1="2" y2="5"/><line x1="2" x2="5" y1="8" y2="8"/><line x1="16" x2="16" y1="19" y2="22"/><line x1="19" x2="22" y1="16" y2="16"/>',
    beam: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    // Sin equivalente en Lucide: tresillo, tresillo quitado y notas separadas.
    triplet: '<path d="M3 19v-5h6M21 19v-5h-6"/><path d="M10 7.500c.5-1 4-1.500 4 .500 0 1.200-1.500 1.800-2 1.800.600 0 2.200.400 2.200 2 0 2-3.700 1.800-4.200.700" stroke-width="1.700"/>',
    untriplet: '<path d="M3 19v-5h6M21 19v-5h-6"/><path d="M10 7.500c.5-1 4-1.500 4 .500 0 1.200-1.500 1.800-2 1.800.600 0 2.200.400 2.200 2 0 2-3.700 1.800-4.200.700" stroke-width="1.700"/><path d="M4 4l16 12"/>',
    unbeam: '<circle cx="6" cy="18" r="3"/><path d="M9 18V4"/><circle cx="18" cy="16" r="3"/><path d="M21 16V2"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  };

  const ACTION_ICONS = { triplet: 'triplet', untriplet: 'untriplet', link: 'link', unlink: 'unlink', beam: 'beam', unbeam: 'unbeam' };

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
    'bar:double': '<path d="M12 4v24M18 4v24" stroke="currentColor" stroke-width="1.6"/>',
    'bar:start': '<path d="M9 4v24M14 4v24" stroke="currentColor" stroke-width="1.6"/><path d="M9 4v24" stroke="currentColor" stroke-width="3.5"/><circle cx="21" cy="12" r="1.8"/><circle cx="21" cy="20" r="1.8"/>',
    'bar:end': '<path d="M16 4v24M21 4v24" stroke="currentColor" stroke-width="1.6"/><path d="M21 4v24" stroke="currentColor" stroke-width="3.5"/><circle cx="9" cy="12" r="1.8"/><circle cx="9" cy="20" r="1.8"/>',
    dot: '<circle cx="15" cy="15" r="3.200"/>',
    'acc:#': '<path d="M11 6v20M18 4v20M7.500 12.500l14-3.500M7.500 21l14-3.500" stroke="currentColor" stroke-width="1.800" fill="none"/>',
    'acc:b': '<path d="M10 4v22c4-2 8-5 8-8.500 0-2.500-2-3.500-4-3.500-1.500 0-3 .800-4 2" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
    'acc:n': '<path d="M10 5v16l10-3.500M20 27V11L10 14.500" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
  };

  function glyphKey(item) {
    if (item.kind === 'bar') return 'bar:' + item.bar;
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
    { kind: 'dot', key: t.shortcuts.dot, label: t.dot },
    { kind: 'acc', acc: '#', key: t.shortcuts.sharp, label: t.sharp },
    { kind: 'acc', acc: 'b', key: t.shortcuts.flat, label: t.flat },
    { kind: 'acc', acc: 'n', key: t.shortcuts.natural, label: t.natural },
  ];

  const BARS = [
    { kind: 'bar', bar: 'double', label: t.barDouble },
    { kind: 'bar', bar: 'start', label: t.barRepeatStart },
    { kind: 'bar', bar: 'end', label: t.barRepeatEnd },
  ];

  ITEMS.concat(BARS).forEach((item) => {
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
    button.setAttribute('aria-pressed', 'false');
    if (item.kind === 'bar') {
      button.dataset.barline = item.bar;
      button.addEventListener('click', (event) => {
        if (event.detail === 0) activateTool(item);
      });
    }
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
        if (event.detail === 0) activateTool(item);
      });
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      beginDrag(event, { item, kind: item.kind, glyph: glyphFor(item) });
    });
    (item.kind === 'bar' ? barlines : palette).appendChild(button);
  });

  // ---- renglones, descargas ----------------------------------------------

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
    if (score.barlines) Object.keys(score.barlines).forEach((mi) => {
      if (+mi >= M.measures(score).length) delete score.barlines[mi];
    });
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
      pdfToolkit.loadData(M.toMusicXml(score));
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
