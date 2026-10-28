/* score-editor.js — Pagina /partitura: una partitura donde se arrastran notas desde la paleta.
   Verovio dibuja el MusicXML que sale de ScoreModel; aca solo viven la paleta, el arrastre y las descargas. */
(function () {
  'use strict';

  const M = window.ScoreModel;
  const STORAGE_KEY = 'scoreEditor.v2';
  const TABS_KEY = 'scoreEditor.tabs.v1'; // varias partituras: { active, scores: [...] }
  const LEGACY_KEY = 'scoreEditor.v1'; // guardada con 8 divisiones por negra
  const SCALE = 60;
  const HISTORY_LIMIT = 100;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const script = document.currentScript;
  const t = JSON.parse(document.getElementById('scoreStrings').textContent);

  const stage = document.getElementById('scoreStage');
  const palette = document.getElementById('scorePalette');
  const barlines = document.getElementById('scoreBarlines');
  const toolbars = document.querySelector('.score-page');
  const addRow = document.getElementById('scoreAddRow');
  const removeRow = document.getElementById('scoreRemoveRow');

  const tabsBar = document.getElementById('scoreTabs');
  const stored = loadAll();
  const docs = stored.scores; // una partitura por pestana
  const histories = docs.map(() => []);
  let active = stored.active;
  let score = docs[active];
  const defaultTitle = tabsBar.dataset.defaultTitle;
  if (typeof score.title !== 'string') score.title = defaultTitle;
  const title = document.getElementById('scoreTitle'); // el titulo completo, sobre la partitura
  let tabTitle = null; // el input de la pestana activa: el mismo titulo, abreviado por el ancho de la pestana
  title.value = score.title;
  const author = document.getElementById('scoreAuthor');
  author.value = score.author || '';
  author.addEventListener('input', () => {
    if (author.value) score.author = author.value;
    else delete score.author;
    save();
  });
  author.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      author.blur();
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
  let tabSpace = 0; // unidades de Verovio que se reservan bajo cada renglon para su tablatura
  let focusBarre = null; // compas cuya cejilla recien se coloco: su numero queda en foco

  function loadOne() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return M.sanitize(JSON.parse(current));
      return M.sanitize(JSON.parse(localStorage.getItem(LEGACY_KEY)), 8);
    } catch (e) {
      return M.emptyScore();
    }
  }

  function loadAll() {
    try {
      const data = JSON.parse(localStorage.getItem(TABS_KEY));
      if (data && Array.isArray(data.scores) && data.scores.length) {
        const scores = data.scores.map((one) => M.sanitize(one));
        return { scores, active: Math.min(Math.max(data.active | 0, 0), scores.length - 1) };
      }
    } catch (e) {
      // Sin datos validos se parte de la partitura de antes, o de una vacia.
    }
    return { scores: [loadOne()], active: 0 };
  }

  function save() {
    docs[active] = score;
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify({ active, scores: docs }));
    } catch (e) {
      // Sin almacenamiento la partitura sigue funcionando, solo que no se recuerda.
    }
  }

  // Messages are Radix alert toasts; an empty text leaves any toast to expire on its own.
  function say(text) {
    if (text && window.SiteToast) window.SiteToast.show(text, { variant: 'alert' });
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

  // ---- pestanas -----------------------------------------------------------

  title.addEventListener('input', () => {
    score.title = title.value;
    if (tabTitle) tabTitle.value = score.title;
    save();
  });
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      title.blur();
    }
  });

  function tabLabel(one, index) {
    return one.title || t.untitledScore.replace('{n}', index + 1);
  }

  function renderTabs() {
    tabsBar.querySelectorAll('.score-doc-tab').forEach((node) => node.remove());
    const add = document.getElementById('scoreNewTab');
    docs.forEach((one, index) => {
      if (index === active) {
        const wrap = document.createElement('div');
        wrap.className = 'score-doc-tab is-active';
        wrap.setAttribute('role', 'tab');
        wrap.setAttribute('aria-selected', 'true');
        tabTitle = document.createElement('input');
        tabTitle.type = 'text';
        tabTitle.className = 'score-doc-tab-input';
        tabTitle.setAttribute('aria-label', t.titleLabel);
        tabTitle.value = score.title;
        title.value = score.title;
        author.value = score.author || '';
        tabTitle.addEventListener('input', () => {
          score.title = tabTitle.value;
          title.value = score.title;
          save();
        });
        tabTitle.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            tabTitle.blur();
          }
        });
        wrap.appendChild(tabTitle);
        tabsBar.insertBefore(wrap, add);
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'score-doc-tab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        button.textContent = tabLabel(one, index);
        button.addEventListener('click', () => switchTo(index));
        tabsBar.insertBefore(button, add);
      }
    });
  }

  function switchTo(index) {
    if (index === active || !docs[index]) return;
    docs[active] = score;
    histories[active] = history;
    active = index;
    score = docs[active];
    history = histories[active];
    if (typeof score.title !== 'string') score.title = '';
    selected = null;
    group = [];
    save();
    renderTabs();
    render();
  }

  function newTab() {
    docs[active] = score;
    histories[active] = history;
    docs.push(Object.assign(M.emptyScore(), { title: defaultTitle }));
    histories.push([]);
    switchTo(docs.length - 1);
    tabTitle.focus();
    tabTitle.select();
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
    const restored = history.pop();
    // La tablatura no depende de las notas: deshacer no la toca.
    ['showTabs', 'tabs'].forEach((key) => { if (score[key]) restored[key] = score[key]; else delete restored[key]; });
    score = Object.assign(restored, { title: score.title }, score.author ? { author: score.author } : {});
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
      change(() => {
        const widths = currentMeasureWidths();
        const oldCount = M.measures(score).length;
        const bounds = layout[target.mi];
        const fraction = Math.max(0, Math.min(1, ((target.rawX ?? target.x) - bounds.left) / (bounds.right - bounds.left)));
        const previousWidths = score.measureWidths;
        if (item.bar === 'double') score.measureWidths = widths;
        const changed = M.setBarline(score, target.mi, item.bar, target.rawT ?? target.t);
        if (!changed) {
          if (previousWidths) score.measureWidths = previousWidths;
          else delete score.measureWidths;
        }
        if (changed && M.measures(score).length > oldCount) {
          score.measureWidths[target.mi] = widths[target.mi] * fraction;
          score.measureWidths[target.mi + 1] = widths[target.mi] * (1 - fraction);
        }
        if (changed) { selected = null; group = []; }
        return changed;
      });
      say('');
      return;
    }
    if (item.kind === 'barre') {
      // Sobre una nota que no es la primera arranca ahi; si no, cubre desde el inicio del compas.
      const existing = score.barres && score.barres[target.mi];
      const at = target.onNote ? target.t : 0;
      focusBarre = target.mi;
      if (!change(() => M.setBarre(score, target.mi, at, existing ? existing.fret : 1, existing && (existing.span || existing.to > at) ? existing.to : undefined, existing && existing.span))) focusBarre = null;
      say('');
      return;
    }
    const measure = M.measures(score)[target.mi];
    if (item.kind === 'note' || item.kind === 'rest') {
      const ev = { d: item.d };
      if (item.kind === 'rest') ev.rest = true;
      else ev.n = target.n;
      const spot = M.placement(measure, ev, target.t, score, target.mi);
      if (!spot) return say(t.full);
      change(() => {
        ev.d = spot.d;
        if (spot.dot) ev.dot = true;
        selected = { mi: target.mi, i: M.insertAt(measure, ev, spot.at) };
        group = [];
      });
    }
  }

  function isPlacing(item) {
    return item && (item.kind === 'bar' || item.kind === 'barre');
  }

  function isModifier(item) {
    return item && (item.kind === 'dot' || item.kind === 'acc');
  }

  function deactivateTool() {
    activeItem = null;
    stage.classList.remove('has-tool');
    clearHoverGhost();
    toolbars.querySelectorAll('.score-palette-item[aria-pressed]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  function activateTool(item) {
    if (activeItem === item) { deactivateTool(); return; }
    activeItem = item;
    stage.classList.add('has-tool');
    clearHoverGhost();
    updateHoverGhost();
    toolbars.querySelectorAll('.score-palette-item[aria-pressed]').forEach((button) => {
      const same = item.key ? button.dataset.shortcut === item.key : item.kind === 'bar' ? button.dataset.barline === item.bar : button.dataset.tool === item.kind;
      button.setAttribute('aria-pressed', String(same));
    });
    if (isPlacing(item)) return;
    if (isModifier(item)) {
      if (eventAt(selected)) applyModifier(item, selected);
      return;
    }
    const ev = eventAt(selected);
    if (!ev || (ev.d === item.d && !!ev.rest === (item.kind === 'rest'))) return;
    const replacement = Object.assign({}, ev, { d: item.d });
    delete replacement.tp;
    if (item.kind === 'rest') { replacement.rest = true; delete replacement.n; delete replacement.acc; }
    else { delete replacement.rest; replacement.n = ev.rest ? M.bottomLine(score, selected.mi) : ev.n; }
    if (item.d === 'w' || item.d === 's' || item.d === 'f') delete replacement.dot;
    const measure = M.measures(score)[selected.mi];
    if (M.onsets(measure)[selected.i] + M.length(replacement) > M.capacity(score, selected.mi)) return say(t.full);
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
      if (!M.canDot(measure, hit.i, score)) return say(ev.d === 'w' || ev.d === 's' || ev.d === 'f' || ev.tp ? t.noDot : t.full);
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
    const spot = M.placement(others, moved, target.t, score, target.mi);
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
    const grid = M.gridOf(items.map((x) => x.ev));
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
      return !rest || p.at < 0 || p.at + M.length(p.ev) > M.capacity(score, p.to) ||
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

  // The barlines sidebar starts level with the top line of the first staff instead of the top of the page.
  function alignBarlinesToFirstStaff() {
    const side = barlines.closest('.score-side');
    const line = stage.querySelector('g.staff > path');
    const glyph = barlines.querySelector('svg');
    if (!side || !line || !glyph) return;
    side.style.marginTop = '0';
    const offset = line.getBoundingClientRect().top - glyph.getBoundingClientRect().top;
    side.style.marginTop = Math.max(0, offset) + 'px';
  }

  function render() {
    if (!toolkit) return;
    const width = stage.clientWidth;
    if (!width) return;
    renderedWidth = width;
    toolkit.setOptions(layoutOptions(width, score.showTabs && tabSpace ? { spacingSystem: Math.min(48, 12 + tabSpace), pageMarginBottom: 60 + tabSpace } : undefined));
    toolkit.loadData(M.toMusicXml(score));
    meterPopup.hidePopover();
    clefPopup.hidePopover();
    stage.innerHTML = toolkit.renderToSVG(1);
    applyMeasureWidths();
    stage.style.minHeight = '';
    alignBarlinesToFirstStaff();
    marker = null;
    const svg = stage.querySelector('svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t.scoreLabel);
    mountMeterButton();
    mountClefButtons();
    mountKeyButtons();
    liftBarreMarks(svg);
    measureLayout();
    mountBarlineButtons();
    mountRowTools();
    mountBarreInputs();
    mountTabs();
    document.getElementById('scoreTabToggle')?.setAttribute('aria-pressed', String(!!score.showTabs));
    markSelected();
    updateHoverGhost();
    removeRow.hidden = score.rows.length <= M.MIN_ROWS;
  }

  // El espaciado se aplica al SVG; las figuras conservan su tamano y las plicas anclan los haces.
  let naturalLayout = [];
  function applyMeasureWidths() {
    const nodes = [...stage.querySelectorAll('g.measure')];
    naturalLayout = nodes.map((node) => {
      const staff = node.querySelector(':scope > g.staff > path');
      const box = staff.getBBox();
      return { left: box.x, width: box.width, pixels: staff.getBoundingClientRect().width };
    });
    M.rowStarts(score).forEach((first, row) => {
      const count = score.rows[row].length;
      const original = naturalLayout.slice(first, first + count);
      const total = original.reduce((sum, m) => sum + m.width, 0);
      const weights = original.map((m, i) => score.measureWidths?.[first + i]);
      const assigned = weights.reduce((sum, w) => sum + (w || 0), 0);
      const free = original.reduce((sum, m, i) => sum + (weights[i] ? 0 : m.width), 0);
      const desired = original.map((m, i) => weights[i] ? weights[i] * total : m.width * Math.max(0.1, 1 - assigned) * total / (free || total));
      const sum = desired.reduce((a, b) => a + b, 0);
      const fit = sum > total ? total / sum : 1;
      let left = original[0].left;
      const positions = desired.map((width) => {
        const position = { left, width: width * fit };
        left += position.width;
        return position;
      });
      const mapX = (x) => {
        let index = original.findIndex((m) => x <= m.left + m.width);
        if (index < 0) index = original.length - 1;
        return positions[index].left + (x - original[index].left) * positions[index].width / original[index].width;
      };
      original.forEach((m, i) => {
        const node = nodes[first + i];
        const width = positions[i].width;
        const left = positions[i].left;
        const scale = width / m.width;
        if (Math.abs(scale - 1) > 0.00001 || Math.abs(left - m.left) > 0.01) {
          node.setAttribute('transform', `translate(${left - scale * m.left} 0) scale(${scale} 1)`);
          node.querySelectorAll('g.chord, g.note, g.rest, g.clef, g.keySig, g.meterSig, g.barLine, g.accid, g.dots, text').forEach((glyph) => {
            if (glyph.parentElement.closest('.chord, .note, .rest, .clef, .keySig, .meterSig, .barLine, .accid, .dots, text')) return;
            const stem = glyph.querySelector('.stem path');
            const box = glyph.getBBox();
            const x = stem ? stem.getBBox().x : box.x;
            const transform = glyph.getAttribute('transform') || '';
            glyph.setAttribute('transform', `translate(${x} 0) scale(${1 / scale} 1) translate(${-x} 0) ${transform}`);
          });
        }
        // Las ligaduras y cejillas pueden terminar en otro compas, con una escala diferente.
        node.querySelectorAll('g.tie, g.slur, g.bracketSpan').forEach((span) => {
          span.setAttribute('transform', `translate(${(scale * m.left - left) / scale} 0) scale(${1 / scale} 1)`);
          span.querySelectorAll('path').forEach((path) => {
            const d = path.getAttribute('d');
            if (!d || (d.match(/[a-z]/gi) || []).some((command) => !['M', 'L', 'C', 'Q', 'Z'].includes(command))) return;
            let coordinate = 0;
            path.setAttribute('d', d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (number) => coordinate++ % 2 ? number : mapX(Number(number))));
          });
        });
      });
    });
  }

  function currentMeasureWidths() {
    const widths = {};
    M.rowStarts(score).forEach((first, row) => {
      const count = score.rows[row].length;
      const total = naturalLayout.slice(first, first + count).reduce((sum, m) => sum + m.pixels, 0);
      for (let i = first; i < first + count; i += 1) widths[i] = Math.min(1, (layout[i].right - layout[i].left) / total);
    });
    return widths;
  }

  function mountBarResize(button, mi, side) {
    const boundary = side === 'start' ? mi - 1 : mi;
    if (boundary < M.rowOf(score, mi).first) return;
    button.classList.add('is-resizable');
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const start = event.clientX;
      const row = M.rowOf(score, boundary);
      const left = layout[boundary];
      const right = boundary < row.last ? layout[boundary + 1] : null;
      const widths = currentMeasureWidths();
      const total = naturalLayout.slice(row.first, row.last + 1).reduce((sum, m) => sum + m.pixels, 0);
      const minLeft = Math.min(left.right - left.left, boundary === row.first ? 100 : 48);
      const minRight = right ? Math.min(right.right - right.left, 48) : 0;
      const rowRight = layout[row.first].left + total;
      let delta = 0, moved = false, cancelled = false;
      const preview = document.createElement('div');
      preview.className = 'score-width-guide';
      preview.style.top = left.lines[0] - 16 + 'px';
      preview.style.height = left.lines[4] - left.lines[0] + 32 + 'px';
      const move = (e) => {
        if (e.pointerId !== event.pointerId) return;
        if (Math.abs(e.clientX - start) < 4 && !moved) return;
        if (!moved) deactivateTool(); // El ajuste usa su guia limitada, no el phantom de insercion.
        moved = true;
        delta = Math.max(left.left + minLeft - left.right, Math.min((right ? right.right - minRight : rowRight) - left.right, e.clientX - start));
        preview.style.left = left.right + delta + 'px';
        if (!preview.isConnected) stage.appendChild(preview);
      };
      const finish = (e) => {
        if (e.pointerId !== event.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', escape);
        preview.remove();
        if (moved) {
          button.addEventListener('click', (click) => { click.preventDefault(); click.stopImmediatePropagation(); }, { once: true, capture: true });
          if (!cancelled && Math.abs(delta) > 0.01) change(() => {
            widths[boundary] += delta / total;
            if (right) widths[boundary + 1] -= delta / total;
            score.measureWidths = widths;
          });
        }
      };
      const cancel = (e) => { cancelled = true; finish(e); };
      const escape = (e) => { if (e.key === 'Escape') cancel({ pointerId: event.pointerId }); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', escape);
    });
  }

  // Verovio pega la cejilla (letra y linea) al pentagrama; se sube un poco para que respire.
  const BARRE_LIFT = 10;
  function liftBarreMarks(svg) {
    svg.querySelectorAll('g.measure g.dir, g.measure g.bracketSpan').forEach((node) => {
      const scale = node.getScreenCTM() && node.getScreenCTM().a;
      if (scale) node.setAttribute('transform', 'translate(0 ' + (-BARRE_LIFT / scale) + ') ' + (node.getAttribute('transform') || ''));
    });
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

  function showBarRemove(mi, side, x, y, button) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'score-barline-remove tooltip';
    remove.setAttribute('aria-label', t.deleteBarline);
    remove.dataset.tooltip = t.deleteBarline;
    remove.innerHTML = lucide('x');
    remove.style.left = x + 'px';
    remove.style.top = (y - 4) + 'px';
    remove.addEventListener('click', () => change(() => M.removeBarline(score, mi, side)));
    remove.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { clearBarSelection(); button.focus(); }
    });
    stage.appendChild(remove);
  }

  // Click en un compas sin herramienta: la x aparece sobre sus barras especiales (doble, inicio, fin).
  function selectMeasureBars(event) {
    const hit = [...stage.querySelectorAll('g.measure')].find((node) => {
      const r = node.getBoundingClientRect();
      return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
    if (!hit) return;
    const mi = Number(hit.id.slice(1));
    const bars = score.barlines || {};
    const special = (bar, side) => bar && (side === 'start' ? bar.start : bar.double || bar.end);
    // Izquierda: la apertura del compas o el cierre del anterior en la misma fila; derecha: su cierre.
    const sides = [];
    if (special(bars[mi], 'start')) sides.push([mi, 'start']);
    else if (mi > M.rowOf(score, mi).first && special(bars[mi - 1], 'end')) sides.push([mi - 1, 'end']);
    if (special(bars[mi], 'end')) sides.push([mi, 'end']);
    if (!sides.length) return;
    const origin = stage.getBoundingClientRect();
    clearBarSelection();
    sides.forEach(([m, side]) => {
      const button = stage.querySelector('.score-barline-trigger[data-measure="' + m + '"][data-side="' + side + '"]');
      if (!button) return;
      const box = button.getBoundingClientRect();
      showBarRemove(m, side, box.left + box.width / 2 - origin.left, box.top - origin.top, button);
    });
  }

  function mountBarlineButtons() {
    const origin = stage.getBoundingClientRect();
    stage.querySelectorAll('g.measure').forEach((measure) => {
      const mi = Number(measure.id.slice(1));
      const hasStart = score.barlines && score.barlines[mi]?.start;
      measure.querySelectorAll('g.barLine').forEach((node, index) => {
        const box = node.getBoundingClientRect();
        if (!box.height) return;
        const side = hasStart && index === 0 ? 'start' : 'end';
        const bar = (score.barlines && score.barlines[mi]) || {};
        const simple = side === 'end' && !bar.double && !bar.end;
        const x = box.left + box.width / 2 - origin.left;
        const y = box.top - origin.top;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'score-barline-trigger';
        button.dataset.measure = mi;
        button.dataset.side = side;
        button.setAttribute('aria-label', t.selectBarline);
        button.setAttribute('aria-pressed', 'false');
        if (!simple && !(side === 'end' && mi === M.rowOf(score, mi).last)) {
          button.setAttribute('aria-haspopup', 'dialog');
          button.setAttribute('aria-expanded', 'false');
        }
        button.style.left = x + 'px';
        button.style.top = y + 'px';
        button.style.width = Math.max(20, box.width + 12) + 'px';
        button.style.height = Math.max(44, box.height) + 'px';
        mountBarResize(button, mi, side);
        button.addEventListener('click', () => {
          clearBarSelection();
          deactivateTool();
          selected = null;
          markSelected();
          node.classList.add('is-bar-selected');
          button.setAttribute('aria-pressed', 'true');
          showBarRemove(mi, side, x, y, button);
          // La armadura rige desde el compas siguiente si la barra cierra el compas, o desde este si la abre.
          const target = side === 'start' ? mi : mi + 1;
          // Si la barra es la ultima del renglon, no hay a que compas siguiente aplicar clave ni armadura.
          const endsRow = side === 'end' && mi === M.rowOf(score, mi).last;
          if (!simple && !endsRow && target < M.measures(score).length) {
            if (clefPopup.matches(':popover-open')) clefPopup.hidePopover();
            else openClefPopup({ kind: 'bar', mi, side }, target);
          }
        });
        stage.appendChild(button);
      });
    });
  }

  // Quitar un renglon elimina todos sus compases, incluidas las divisiones creadas con barras.
  function removeLastRow() {
    if (score.rows.length <= M.MIN_ROWS) return false;
    selected = null;
    score.rows.pop();
    M.pruneKeys(score);
    if (score.barlines) Object.keys(score.barlines).forEach((mi) => {
      if (+mi >= M.measures(score).length) delete score.barlines[mi];
    });
    if (score.barres) Object.keys(score.barres).forEach((mi) => {
      if (+mi >= M.measures(score).length) M.removeBarre(score, +mi);
    });
  }

  // Una tablatura (<ascii-tabs>) bajo cada renglon. Las digitaciones salen solas de las notas (ScoreFingering) y cada
  // columna queda bajo su nota; lo que el usuario corrige se guarda aparte en score.tabs y nunca cambia el pentagrama.
  const TAB_GAP = 8;
  const TAB_CLEF_CLEARANCE = 32; // la clave de guitarra (con su 8) baja por debajo del pentagrama
  const sameColumn = (a, b) => a.length === b.length && a.every((fret, s) => fret === b[s]);

  // Como en el visor de partituras: barra de union con el pentagrama, barras de compas y "TAB" en vertical bajo la clave.
  function decorateTab(tabs, row, start, size, head, font) {
    const origin = stage.getBoundingClientRect();
    const ys = [0, 1, 2, 3, 4, 5].map((s) => {
      const cell = tabs.querySelector('.ascii-tabs-cell[data-s="' + s + '"]');
      if (!cell) return null;
      const r = cell.getBoundingClientRect();
      return (r.top + r.bottom) / 2 - origin.top;
    });
    if (ys.some((y) => y === null)) return;
    const step = (ys[5] - ys[0]) / 5;
    const bar = (x, top, bottom) => {
      const node = document.createElement('span');
      node.className = 'score-tab-bar';
      node.style.left = (x - 0.75) + 'px';
      node.style.top = top + 'px';
      node.style.height = (bottom - top) + 'px';
      stage.appendChild(node);
    };
    bar(head.left, layout[start].lines[0], ys[5]);
    for (let k = 0; k < size; k += 1) bar(layout[start + k].right, ys[0], ys[5]);
    const clef = stage.querySelectorAll('g.system')[row] && stage.querySelectorAll('g.system')[row].querySelector('g.clef');
    const box = clef && clef.getBoundingClientRect();
    const x = box ? box.left + box.width / 2 - origin.left : head.left + 18;
    'TAB'.split('').forEach((letter, i) => {
      const mark = document.createElement('span');
      mark.className = 'score-tab-clef';
      mark.textContent = letter;
      mark.style.fontSize = font * 1.25 + 'px';
      mark.style.left = x + 'px';
      mark.style.top = (ys[0] + step * (1.5 + i)) + 'px';
      stage.appendChild(mark);
    });
  }

  function mountTabs() {
    if (!score.showTabs) { tabSpace = 0; return; }
    const first = layout[0];
    if (!first || first.lines.length < 5) return;
    const unit = (first.lines[1] - first.lines[0]) / 2; // un staff space = 2 unidades de Verovio
    const font = Math.min(28, Math.max(15, Math.round(4 * unit))); // como el visor: dos espacios del pentagrama
    const minStep = Math.round(font * 1.4); // para que no se pisen los trastes de dos cifras
    const origin = stage.getBoundingClientRect();
    const all = M.attacks(score);
    const fingered = window.ScoreFingering.assign(all.map((attack) => attack.midis));
    const auto = {};
    all.forEach((attack, i) => { auto[attack.key] = window.ScoreFingering.toColumn(fingered[i]); });
    const mounted = [];
    M.rowStarts(score).forEach((start, row) => {
      const size = score.rows[row].length;
      const head = layout[start];
      const last = layout[start + size - 1];
      if (!head || !last) return;
      const keys = all.filter((attack) => attack.mi >= start && attack.mi < start + size).map((attack) => attack.key);
      let previous = -Infinity;
      const positions = keys.map((key) => {
        const [mi, at] = key.split(':').map(Number);
        const xs = eventNodes(mi).filter((node, i) => !M.measures(score)[mi][i].rest && M.onsets(M.measures(score)[mi])[i] === at)
          .map((node) => centerX(node, origin));
        const x = xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : layout[mi].left;
        previous = Math.max(x - head.left, previous + minStep);
        return previous;
      });
      const width = Math.max(last.right - head.left, (positions.length ? positions[positions.length - 1] : 0) + 12);
      const tabs = document.createElement('ascii-tabs');
      tabs.className = 'score-tab';
      tabs.setAttribute('labels', 'none');
      tabs.setAttribute('variant', 'flat');
      tabs.setAttribute('theme', 'light');
      tabs.setAttribute('lang', document.documentElement.lang === 'en' ? 'en' : 'es');
      tabs.setAttribute('aria-label', t.tabLabel + ' ' + (row + 1));
      tabs.style.setProperty('--ascii-tabs-font-size', font + 'px');
      tabs.style.left = head.left + 'px';
      tabs.style.top = (last.lines[4] + TAB_CLEF_CLEARANCE) + 'px';
      tabs.style.width = (last.right - head.left) + 'px';
      tabs.appendChild(document.createElement('ascii-tabs-sheet'));
      // El componente se redibuja al hacer clic, asi que el escenario ya no puede reconocer el destino: no le llega el evento.
      tabs.addEventListener('pointerdown', (event) => event.stopPropagation());
      stage.appendChild(tabs);
      mounted.push({ tabs, keys, positions, width, start, size, head });
    });
    customElements.whenDefined('ascii-tabs').then(() => {
      if (!mounted.length || !mounted[0].tabs.isConnected) return;
      mounted.forEach(({ tabs, keys, positions, width, start, size, head }, row) => {
        const value = keys.map((key) => (score.tabs && score.tabs[key]) || auto[key]);
        // Un renglon sin notas lleva una columna vacia para dibujar las mismas lineas continuas que los demas.
        if (!keys.length) { value.push(new Array(6).fill(null)); positions.push(width / 2); }
        try {
          tabs.setDocument({ value: [value], columnLayout: [{ width, positions }] });
        } catch (error) {
          tabs.setDocument({ value: [value] });
        }
        decorateTab(tabs, row, start, size, head, font);
        tabs.addEventListener('change', (event) => {
          const columns = event.detail.value[0];
          keys.forEach((key, c) => {
            const column = (columns[c] || []).map((fret) => (Number.isInteger(fret) ? fret : null));
            const edited = M.sanitizeTabs({ [key]: column }, Infinity)[key];
            if (edited && !sameColumn(edited, auto[key])) { score.tabs = score.tabs || {}; score.tabs[key] = edited; }
            else if (score.tabs) delete score.tabs[key];
          });
          if (score.tabs && !Object.keys(score.tabs).length) delete score.tabs;
          save();
        });
      });
      const want = Math.ceil((mounted[0].tabs.getBoundingClientRect().height + TAB_CLEF_CLEARANCE + TAB_GAP) / unit);
      if (want !== tabSpace) { tabSpace = want; render(); return; }
      // Los botones de renglones van bajo el escenario: que no tapen la ultima tablatura.
      const bottom = mounted[mounted.length - 1].tabs.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
      stage.style.minHeight = Math.ceil(bottom + 24) + 'px';
    });
  }

  // Al pasar el mouse por el ultimo compas de un renglon aparece una barra flotante con + y - para sumar o quitar compases del renglon.
  const ROW_TOOLS_WIDTH = 34;
  function mountRowTools() {
    M.rowStarts(score).forEach((first, row) => {
      const size = score.rows[row].length;
      const last = layout[first + size - 1];
      if (!last) return;
      const tools = document.createElement('div');
      tools.className = 'score-row-tools';
      tools.dataset.row = row;
      tools.style.left = (last.right + 4) + 'px';
      tools.style.top = ((last.lines[0] + last.lines[4]) / 2) + 'px';
      [['add', 'plus', t.addMeasure, size >= M.PER_ROW, t.noRoomForMeasure],
        ['remove', 'minus', t.deleteMeasure, size <= 1, t.deleteMeasure]].forEach(([action, icon, label, disabled, blocked]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'score-row-tool tooltip';
        button.dataset.action = action;
        button.dataset.tooltip = disabled ? blocked : label;
        button.setAttribute('aria-label', label);
        // aria-disabled (no disabled) para que el boton siga mostrando su tooltip al pasar el mouse.
        if (disabled) button.setAttribute('aria-disabled', 'true');
        button.innerHTML = lucide(icon);
        button.addEventListener('click', () => {
          if (disabled) return;
          change(() => {
            selected = null;
            return action === 'add' ? M.addMeasure(score, row) : M.removeMeasure(score, row);
          });
        });
        tools.appendChild(button);
      });
      stage.appendChild(tools);
    });
  }

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const box = stage.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const starts = M.rowStarts(score);
    stage.querySelectorAll('.score-row-tools').forEach((tools) => {
      const row = +tools.dataset.row;
      const last = layout[starts[row] + score.rows[row].length - 1];
      tools.classList.toggle('is-visible', !!last && x >= last.left && x <= last.right + 4 + ROW_TOOLS_WIDTH
        && y >= last.lines[0] - 40 && y <= last.lines[4] + 40);
    });
  });
  stage.addEventListener('pointerleave', () => stage.querySelectorAll('.score-row-tools').forEach((tools) => tools.classList.remove('is-visible')));

  // Tiempo -> x dentro del compas, con las mismas anclas que timeAt.
  function xAtTime(time, m, starts, centers) {
    const anchors = [{ x: m.left, t: 0 }, { x: m.right, t: M.capacity(score, layout.indexOf(m)) }];
    centers.forEach((c, i) => anchors.push({ x: c, t: starts[i] }));
    anchors.sort((p, q) => p.t - q.t || p.x - q.x);
    for (let k = 1; k < anchors.length; k += 1) {
      const a = anchors[k - 1];
      const b = anchors[k];
      if (time <= b.t && b.t > a.t) return a.x + ((time - a.t) / (b.t - a.t)) * (b.x - a.x);
    }
    return m.right;
  }

  // Sobre la linea de la cejilla aparecen dos asas para mover su inicio y su fin, ajustados a las notas.
  function mountBarreSpan(mi, barre, origin) {
    const line = stage.querySelector('[id="m' + mi + '"] g.bracketSpan path');
    if (!line) return;
    const box = line.getBoundingClientRect();
    const zone = document.createElement('span');
    zone.className = 'score-barre-span';
    zone.style.left = (box.left - origin.left) + 'px';
    zone.style.top = (box.top + box.height / 2 - origin.top) + 'px';
    zone.style.width = box.width + 'px';
    [['start', t.barreStart], ['end', t.barreEnd]].forEach(([side, label]) => {
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'score-barre-grip';
      grip.dataset.side = side;
      grip.setAttribute('aria-label', label);
      grip.innerHTML = lucide(side === 'start' ? 'arrow-left' : 'arrow-right');
      grip.addEventListener('pointerdown', (event) => beginBarreResize(event, mi, side));
      grip.addEventListener('keydown', (event) => {
        const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (!step) return;
        event.preventDefault();
        const times = barreTimes(mi, side);
        const current = side === 'start' ? barre.at : barreEnd(barre, mi);
        const next = times[times.indexOf(current) + step];
        if (next === undefined) return;
        resizeBarre(mi, side, next);
        stage.querySelector('.score-barre-grip[data-side="' + side + '"]')?.focus({ preventScroll: true });
      });
      zone.appendChild(grip);
    });
    stage.appendChild(zone);
  }

  // Final de la cejilla como tiempo absoluto desde el inicio de su compas (puede pasar a compases siguientes).
  function measureOffset(mi, last) {
    let time = 0;
    for (let k = mi; k < last; k += 1) time += M.capacity(score, k);
    return time;
  }

  function barrePoint(mi, time) {
    let k = mi;
    while (time > M.capacity(score, k)) { time -= M.capacity(score, k); k += 1; }
    return { mi: k, at: time };
  }

  function barreEnd(barre, mi) {
    const last = mi + (barre.span || 0);
    return measureOffset(mi, last) + (barre.to || M.capacity(score, last));
  }

  // Tiempos validos para un extremo: inicios de nota (comienzo) o finales de nota (fin), mas los bordes del compas.
  // El fin tambien puede caer en compases siguientes de la misma fila, hasta el proximo con otra cejilla.
  function barreTimes(mi, side) {
    const barre = score.barres[mi];
    const end = M.capacity(score, mi);
    const all = M.measures(score);
    const rowLast = M.rowOf(score, mi).last;
    const times = new Set(side === 'start' ? [0] : []);
    for (let k = mi; k <= Math.min(rowLast, all.length - 1); k += 1) {
      if (k > mi && (score.barres[k] || side === 'start')) break;
      const starts = M.onsets(all[k]);
      if (side === 'end') times.add(measureOffset(mi, k + 1));
      all[k].forEach((ev, i) => {
        if (ev.rest) return;
        times.add(measureOffset(mi, k) + (side === 'start' ? starts[i] : Math.min(M.capacity(score, k), starts[i] + M.length(ev))));
      });
    }
    return [...times].filter((time) => (side === 'start' ? time < Math.min(end, barreEnd(barre, mi)) : time > barre.at)).sort((a, b) => a - b);
  }

  function resizeBarre(mi, side, time) {
    const barre = score.barres[mi];
    const at = side === 'start' ? time : barre.at;
    const last = side === 'end' ? time : barreEnd(barre, mi);
    if (at === barre.at && last === barreEnd(barre, mi)) return;
    const point = barrePoint(mi, last);
    change(() => M.setBarre(score, mi, at, barre.fret, point.at, point.mi - mi));
  }

  let barreResize = null;
  function beginBarreResize(event, mi, side) {
    event.preventDefault();
    event.stopPropagation();
    clearHoverGhost();
    const origin = stage.getBoundingClientRect();
    const anchors = new Map();
    // Tiempo absoluto de la cejilla -> x, usando el compas donde cae.
    const xAt = (time) => {
      const point = barrePoint(mi, time);
      const k = point.mi;
      if (!anchors.has(k)) anchors.set(k, { starts: M.onsets(M.measures(score)[k]), centers: eventNodes(k).map((node) => centerX(node, origin)) });
      const { starts, centers } = anchors.get(k);
      return xAtTime(point.at, layout[k], starts, centers);
    };
    const path = stage.querySelector('[id="m' + mi + '"] g.bracketSpan path');
    const line = path.getBoundingClientRect();
    const zone = stage.querySelector('.score-barre-span');
    const fixed = (side === 'end' ? line.left : line.right) - origin.left;
    const preview = document.createElement('span');
    preview.className = 'score-barre-preview';
    preview.style.top = (line.top + line.height / 2 - origin.top) + 'px';
    stage.appendChild(preview);
    // La linea punteada original se oculta y se redibuja en vivo entre el extremo fijo y el que se arrastra.
    const live = document.createElement('span');
    live.className = 'score-barre-live';
    live.style.top = preview.style.top;
    stage.appendChild(live);
    path.style.visibility = 'hidden';
    const place = (x) => {
      const left = Math.min(fixed, x);
      const width = Math.abs(x - fixed);
      live.style.left = left + 'px';
      live.style.width = width + 'px';
      zone.style.left = left + 'px';
      zone.style.width = width + 'px';
    };
    stage.classList.add('is-resizing-barre');
    barreResize = {
      id: event.pointerId,
      move(e) {
        const x = e.clientX - origin.left;
        let best = null;
        barreTimes(mi, side).forEach((time) => {
          const tx = xAt(time);
          if (!best || Math.abs(tx - x) < Math.abs(best.x - x)) best = { time, x: tx };
        });
        barreResize.pick = best && best.time;
        if (best) {
          preview.style.left = best.x + 'px';
          place(best.x);
        }
      },
      finish(commit) {
        preview.remove();
        live.remove();
        path.style.visibility = '';
        stage.classList.remove('is-resizing-barre');
        barreResize = null;
        if (commit && this.pick !== undefined) resizeBarre(mi, side, this.pick);
        render(); // deja asas y linea en su lugar si no hubo cambio
      },
    };
    barreResize.move(event);
  }

  document.addEventListener('pointermove', (event) => {
    if (barreResize && event.pointerId === barreResize.id) barreResize.move(event);
  });
  document.addEventListener('pointerup', (event) => {
    if (barreResize && event.pointerId === barreResize.id) barreResize.finish(true);
  });
  document.addEventListener('pointercancel', (event) => {
    if (barreResize && event.pointerId === barreResize.id) barreResize.finish(false);
  });

  // El numero de la cejilla se edita sobre su etiqueta: un campo que tapa el texto dibujado por Verovio.
  function mountBarreInputs() {
    const origin = stage.getBoundingClientRect();
    Object.keys(score.barres || {}).forEach((key) => {
      const mi = Number(key);
      const barre = score.barres[mi];
      const label = stage.querySelector('[id="m' + mi + '"] g.dir');
      if (!label) return;
      const box = label.getBoundingClientRect();
      const field = document.createElement('span');
      field.className = 'score-barre-field';
      const letter = document.createElement('span');
      letter.textContent = 'C';
      letter.setAttribute('aria-hidden', 'true');
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 2;
      input.className = 'score-barre-number';
      input.value = barre.fret;
      input.setAttribute('aria-label', t.barreFret);
      field.style.left = (box.left - origin.left) + 'px';
      field.style.top = (box.top + box.height / 2 - origin.top) + 'px';
      const commit = () => {
        if (!input.isConnected) return;
        const fret = Number(input.value);
        if (input.value.trim() === '') change(() => M.removeBarre(score, mi));
        else if (Number.isInteger(fret) && fret !== barre.fret) {
          if (!change(() => M.setBarre(score, mi, barre.at, fret, barre.to))) { input.value = barre.fret; say(t.barreFretRange); }
          else say('');
        } else input.value = barre.fret;
      };
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
      input.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
        else if (event.key === 'Escape') { input.value = barre.fret; input.blur(); }
      });
      input.addEventListener('blur', commit);
      field.append(letter, input);
      stage.appendChild(field);
      mountBarreSpan(mi, barre, origin);
      if (focusBarre === mi) {
        input.focus({ preventScroll: true });
        input.select();
      }
    });
    focusBarre = null;
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
    const left = Math.min(...boxes.map((b) => b.left)) - origin.left;
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
    menu.style.left = Math.max(4, Math.min(stage.clientWidth - width - 4, left)) + 'px';
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
    const anchors = [{ x: m.left, t: 0 }, { x: m.right, t: M.capacity(score, layout.indexOf(m)) }];
    centers.forEach((c, i) => anchors.push({ x: c, t: starts[i] }));
    anchors.sort((p, q) => p.x - q.x || p.t - q.t);
    for (let k = 1; k < anchors.length; k += 1) {
      const a = anchors[k - 1];
      const b = anchors[k];
      if (x <= b.x && b.x > a.x) return a.t + ((x - a.x) / (b.x - a.x)) * (b.t - a.t);
    }
    return M.capacity(score, layout.indexOf(m));
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
    const n = M.clampPitch(M.bottomLine(score, mi) + Math.round((m.lines[4] - y) / half));
    const measure = M.measures(score)[mi];
    const starts = M.onsets(measure);
    const centers = eventNodes(mi).map((node) => centerX(node, origin));
    let at = timeAt(Math.max(m.left, Math.min(m.right, x)), m, starts, centers);
    let markX = Math.max(m.left, Math.min(m.right, x));
    const rawT = at, rawX = markX;
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
      mi, n, space, rawT, rawX,
      onNote: !!near,
      t: at,
      x: markX,
      y: m.lines[4] - (n - M.bottomLine(score, mi)) * half,
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
    const x = item && item.kind === 'bar' && item.bar !== 'double' ? layout[hit.mi][item.bar === 'start' ? 'left' : 'right']
      : item && item.kind === 'bar' && item.bar === 'double' ? hit.rawX
      : item && item.kind === 'barre' && !hit.onNote ? layout[hit.mi].left : hit.x;
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
    const viewBox = glyph.viewBox.baseVal;
    const box = kind === 'note' ? glyph.firstChild.getBBox() : viewBox;
    // El origen del viewBox puede ser negativo para dar espacio a las plicas.
    glyph.style.transform = 'translate(' + -(box.x - viewBox.x + box.width / 2) + 'px,' + -(box.y - viewBox.y + box.height / 2) + 'px)';
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
    const overStage = over && stage.contains(over) && !over.closest('.score-barline-trigger, .score-barline-remove, .score-barre-field, .score-barre-span, .score-selection-menu');
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
    if (event.target.closest('.score-meter-trigger, .score-clef-trigger, .score-key-trigger, .score-barline-trigger, .score-barline-remove, .score-barre-field, .score-barre-span, .score-selection-menu, .score-tab')) return;
    if (isPlacing(activeItem)) {
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
      else {
        if (!additive) pureClick = { id: event.pointerId, x: event.clientX, y: event.clientY };
        if (event.pointerType !== 'touch') beginMarquee(event, additive);
      }
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
  // Solo un click limpio (sin arrastre) selecciona el compas; arrastrar es hacer un marco de seleccion.
  let pureClick = null;

  function endPureClick(event, cancelled) {
    const c = pureClick;
    if (!c || event.pointerId !== c.id) return;
    pureClick = null;
    if (cancelled || Math.hypot(event.clientX - c.x, event.clientY - c.y) >= 5) return;
    selectMeasureBars(event);
  }

  document.addEventListener('pointerup', (event) => endPureClick(event, false));
  document.addEventListener('pointercancel', (event) => endPureClick(event, true));

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
    if (event.target.closest('input, textarea, select, [contenteditable], ascii-tabs')) return;
    if (event.key === 'Escape') {
      clearBarSelection();
      deactivateTool();
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && !meterPopup.matches(':popover-open') && !clefPopup.matches(':popover-open')) {
      const item = ITEMS.find((item) => item && (item.code ? item.code === event.code : item.key === event.key.toLowerCase()));
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
    button.dataset.meter = meter;
    button.setAttribute('aria-label', meter);
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
        option.setAttribute('aria-pressed', String(option.dataset.meter === M.meterOf(score)));
      });
      meterPopup.showPopover();
      [...meterOptions.children].forEach((option) => {
        if (!option.querySelector('svg')) signaturePreview(option, M.clefOf(score), 0, 'meter', option.dataset.meter);
      });
      const anchor = button.getBoundingClientRect();
      const popup = meterPopup.getBoundingClientRect();
      meterPopup.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - popup.width - 8)) + 'px';
      meterPopup.style.top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - popup.height - 8)) + 'px';
      meterOptions.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    });
    hoverGlyph(button, meter);
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
  // Donde se abrio el popup (clave de un renglon o barra) y compas desde el que rige la armadura que se elija.
  let clefAnchor = { kind: 'clef', index: 0 };
  let keyMeasure = 0;
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
      if (field === 'clef') {
        if (M.clefAt(score, keyMeasure) !== value) change(() => M.setClef(score, keyMeasure, value));
      } else if (M.keyAt(score, keyMeasure) !== value) change(() => M.setKey(score, keyMeasure, value));
      openClefPopup(clefAnchor, keyMeasure, button);
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
  function signaturePreview(button, clef, fifths, kind, meter) {
    if (!previewToolkit) previewToolkit = newToolkit();
    const sample = { clef, fifths, meter, rows: [[[]]] };
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
    const symbol = staff.querySelector(kind === 'clef' ? 'g.clef' : kind === 'meter' ? 'g.meterSig' : 'g.keySig');
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
    const middle = kind !== 'clef' && box?.height ? box.y + box.height / 2 : (staffBox.y + bottom) / 2 + (kind === 'clef' ? 130 : 0); // deja sitio al 8 bajo la clave de guitarra
    const top = middle - height / 2;
    lines.forEach((line) => {
      const y = line.getBBox().y;
      line.setAttribute('d', `M${left} ${y} L${left + width} ${y}`);
      line.setAttribute('stroke', 'currentColor');
    });
    if (kind !== 'clef') {
      lines.forEach((line) => line.remove());
    }
    svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
  }

  function anchorButtonOf(anchor) {
    if (anchor.kind === 'key') return stage.querySelector('.score-key-trigger[data-measure="' + anchor.mi + '"]');
    return anchor.kind === 'clef'
      ? stage.querySelectorAll('.score-clef-trigger')[anchor.index]
      : stage.querySelector('.score-barline-trigger[data-measure="' + anchor.mi + '"][data-side="' + anchor.side + '"]');
  }

  // Que secciones muestra el popup: clave y armadura juntas solo si se abre desde la clave y no hay armadura.
  // Se fija al abrir, para que elegir una armadura no cambie el popup que ya esta abierto.
  let popupSections = 'both';

  function showSections(sections) {
    popupSections = sections;
    [[clefOptions, 'clef'], [keyOptions, 'key']].forEach(([group, name]) => {
      const display = sections === 'both' || sections === name ? '' : 'none';
      group.style.display = display;
      group.previousElementSibling.style.display = display;
    });
  }

  function openClefPopup(origin, measure, focusButton) {
    clefAnchor = origin;
    keyMeasure = measure;
    if (!clefPopup.matches(':popover-open')) {
      showSections(origin.kind === 'key' ? 'key' : origin.kind === 'clef' && M.keyAt(score, measure) !== 0 ? 'clef' : 'both');
    }
    const anchorButton = anchorButtonOf(origin);
    clefOptions.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.clef === M.clefAt(score, keyMeasure)));
    });
    keyOptions.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.fifths) === M.keyAt(score, keyMeasure)));
    });
    if (!clefPopup.matches(':popover-open')) clefPopup.showPopover();
    clefOptions.querySelectorAll('button').forEach((button) => {
      if (!button.querySelector('svg')) signaturePreview(button, button.dataset.clef, 0, 'clef');
    });
    if (galleryClef !== M.clefAt(score, keyMeasure)) {
      keyOptions.querySelectorAll('button').forEach((button) => {
        if (!Number(button.dataset.fifths)) return;
        button.querySelector('svg')?.remove();
        signaturePreview(button, M.clefAt(score, keyMeasure), Number(button.dataset.fifths), 'key');
      });
      galleryClef = M.clefAt(score, keyMeasure);
    }
    const anchor = anchorButton.getBoundingClientRect();
    const popup = clefPopup.getBoundingClientRect();
    clefPopup.style.left = Math.max(8, Math.min(anchor.left, window.innerWidth - popup.width - 8)) + 'px';
    clefPopup.style.top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - popup.height - 8)) + 'px';
    const focusGroup = popupSections === 'key' ? keyOptions : clefOptions;
    (focusButton || focusGroup.querySelector('[aria-pressed="true"]')).focus({ preventScroll: true });
  }

  clefPopup.addEventListener('toggle', (event) => {
    stage.querySelectorAll('.score-clef-trigger').forEach((button, i) => {
      button.setAttribute('aria-expanded', String(event.newState === 'open' && clefAnchor.kind === 'clef' && i === clefAnchor.index));
    });
    stage.querySelectorAll('.score-key-trigger').forEach((button) => {
      button.setAttribute('aria-expanded', String(event.newState === 'open' && clefAnchor.kind === 'key' && Number(button.dataset.measure) === clefAnchor.mi));
    });
    stage.querySelectorAll('.score-barline-trigger').forEach((button) => {
      button.setAttribute('aria-expanded', String(event.newState === 'open' && clefAnchor.kind === 'bar' && Number(button.dataset.measure) === clefAnchor.mi && button.dataset.side === clefAnchor.side));
    });
  });

  // La armadura abre el mismo popup que la clave, para el compas donde se dibuja.
  // El simbolo grabado se tiñe de azul mientras el cursor o el foco estan sobre su boton.
  function hoverGlyph(button, glyph) {
    const on = () => glyph.classList.add('is-hovered');
    const off = () => glyph.classList.remove('is-hovered');
    button.addEventListener('mouseenter', on);
    button.addEventListener('mouseleave', off);
    button.addEventListener('focus', on);
    button.addEventListener('blur', off);
  }

  function mountKeyButtons() {
    const origin = stage.getBoundingClientRect();
    stage.querySelectorAll('g.keySig').forEach((key) => {
      const box = key.getBoundingClientRect();
      if (!box.width) return;
      const mi = Number(key.closest('g.measure').id.slice(1));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'score-key-trigger';
      button.dataset.measure = mi;
      button.setAttribute('aria-label', t.keySignature + ': ' + t.keys[M.keyAt(score, mi) + 7]);
      button.setAttribute('aria-controls', clefPopup.id);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.style.left = (box.left + box.width / 2 - origin.left - stage.clientLeft) + 'px';
      button.style.top = (box.top + box.height / 2 - origin.top - stage.clientTop) + 'px';
      button.style.width = Math.max(20, box.width + 8) + 'px';
      button.style.height = Math.max(44, box.height + 8) + 'px';
      button.addEventListener('click', () => {
        if (clefPopup.matches(':popover-open')) { clefPopup.hidePopover(); return; }
        openClefPopup({ kind: 'key', mi }, mi);
      });
      hoverGlyph(button, key);
      stage.appendChild(button);
    });
  }

  function mountClefButtons() {
    stage.querySelectorAll('g.clef').forEach((clef, i) => {
      const box = clef.getBoundingClientRect();
      const origin = stage.getBoundingClientRect();
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'score-clef-trigger';
      button.setAttribute('aria-label', t.clefAndKey + ': ' + t.clefs[M.clefAt(score, M.rowStarts(score)[i])] + ', ' + t.keys[M.keyAt(score, M.rowStarts(score)[i]) + 7]);
      button.setAttribute('aria-controls', clefPopup.id);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.style.left = (box.left + box.width / 2 - origin.left - stage.clientLeft) + 'px';
      button.style.top = (box.top + box.height / 2 - origin.top - stage.clientTop) + 'px';
      button.style.height = Math.max(44, box.height + 8) + 'px';
      button.addEventListener('click', () => {
        if (clefPopup.matches(':popover-open')) { clefPopup.hidePopover(); return; }
        openClefPopup({ kind: 'clef', index: i }, M.rowStarts(score)[i]);
      });
      hoverGlyph(button, clef);
      stage.appendChild(button);
    });
  }

  // ---- paleta -------------------------------------------------------------

  const ICONS = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'file-code': '<path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    // Sin equivalente en Lucide: ligadura (arco entre dos notas) y ligadura quitada.
    link: '<circle cx="5" cy="8" r="2"/><circle cx="19" cy="8" r="2"/><path d="M4 13c1.500 7 14.500 7 16 0"/>',
    unlink: '<circle cx="5" cy="8" r="2"/><circle cx="19" cy="8" r="2"/><path d="M4 13c1.500 7 14.500 7 16 0"/><path d="M4 3l16 18"/>',
    beam: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    // Sin equivalente en Lucide: tresillo, tresillo quitado y notas separadas.
    triplet: '<path d="M3 19v-5h6M21 19v-5h-6"/><path d="M10 7.500c.5-1 4-1.500 4 .500 0 1.200-1.500 1.800-2 1.800.600 0 2.200.400 2.200 2 0 2-3.700 1.800-4.200.700" stroke-width="1.700"/>',
    untriplet: '<path d="M3 19v-5h6M21 19v-5h-6"/><path d="M10 7.500c.5-1 4-1.500 4 .500 0 1.200-1.500 1.800-2 1.800.600 0 2.200.400 2.200 2 0 2-3.700 1.800-4.200.700" stroke-width="1.700"/><path d="M4 4l16 12"/>',
    unbeam: '<circle cx="6" cy="18" r="3"/><path d="M9 18V4"/><circle cx="18" cy="16" r="3"/><path d="M21 16V2"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
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
    'note:h': '<path d="' + HOLLOW_HEAD + '" fill-rule="evenodd"/><path d="M19.6 24.2V-1" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:q': '<path d="' + HEAD + '"/><path d="M19.6 24.2V-1" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:e': '<path d="' + HEAD + '"/><path d="M19.6 24.2V-1c0 4 5 5.5 5 11" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:s': '<path d="' + HEAD + '"/><path d="M19.6 24.2V-2m0 0c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'note:f': '<path d="' + HEAD + '"/><path d="M19.6 24.2V-3m0 0c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11m-5-6c0 4 5 5.5 5 11" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    'rest:w':'<path d="M5 12h20" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h12v6H9z"/>',
    'rest:h': '<path d="M5 18h20" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h12v6H9z"/>',
    'rest:q': '<path d="M12 5l7 8-5 5 6 7c-3-1-6.500-.5-6 3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
    'rest:e': '<circle cx="12" cy="11" r="2.4"/><path d="M13 12.500c3 0 5-1.300 6-3.500l-5 20" stroke="currentColor" stroke-width="1.700" fill="none"/>',
    'rest:s': '<circle cx="12" cy="9" r="2.400"/><circle cx="10" cy="17" r="2.400"/><path d="M13 10c3 0 5-1.300 6-3.500l-6.500 22" stroke="currentColor" stroke-width="1.700" fill="none"/>',
    'rest:f': '<circle cx="12" cy="5" r="2.200"/><circle cx="10" cy="12" r="2.200"/><circle cx="8" cy="19" r="2.200"/><path d="M13 6c3 0 5-1.300 6-3.500l-8 26" stroke="currentColor" stroke-width="1.700" fill="none"/>',
    // Los tres comparten la misma linea fina en x=15 (y la gruesa de las repeticiones junto a ella), para que apilados se lean como una sola barra.
    'bar:double': '<path d="M10 4v24M15 4v24" stroke="currentColor" stroke-width="1.6"/>',
    'bar:start': '<path d="M10 4v24" stroke="currentColor" stroke-width="3.5"/><path d="M15 4v24" stroke="currentColor" stroke-width="1.6"/><circle cx="21" cy="12" r="1.8"/><circle cx="21" cy="20" r="1.8"/>',
    'bar:end': '<path d="M15 4v24" stroke="currentColor" stroke-width="1.6"/><path d="M20 4v24" stroke="currentColor" stroke-width="3.5"/><circle cx="9" cy="12" r="1.8"/><circle cx="9" cy="20" r="1.8"/>',
    barre: '<text x="3" y="18" font-size="16" font-weight="700" font-family="serif">C</text><path d="M3 24h24" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.500" fill="none"/>',
    dot: '<circle cx="15" cy="15" r="3.200"/>',
    'acc:#': '<path d="M11 6v20M18 4v20M7.500 12.500l14-3.500M7.500 21l14-3.500" stroke="currentColor" stroke-width="1.800" fill="none"/>',
    'acc:b': '<path d="M10 4v22c4-2 8-5 8-8.500 0-2.500-2-3.500-4-3.500-1.500 0-3 .800-4 2" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
    'acc:n': '<path d="M10 5v16l10-3.500M20 27V11L10 14.500" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
  };

  function glyphKey(item) {
    if (item.kind === 'bar') return 'bar:' + item.bar;
    if (item.kind === 'barre') return 'barre';
    if (item.kind === 'note' || item.kind === 'rest') return item.kind + ':' + item.d;
    return item.kind === 'dot' ? 'dot' : 'acc:' + item.acc;
  }

  function glyphFor(item) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    // Las plicas suben por encima de los 32px de los demas glifos, asi que las notas ganan altura arriba.
    const tall = item.kind === 'note' && item.d !== 'w';
    svg.setAttribute('viewBox', tall ? '0 -6 30 38' : '0 0 30 32');
    svg.setAttribute('width', '30');
    svg.setAttribute('height', tall ? '38' : '32');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = GLYPHS[glyphKey(item)];
    return svg;
  }

  const ITEMS = [
    { kind: 'note', d: 'f', key: '1', label: t.thirtySecond },
    { kind: 'note', d: 's', key: '2', label: t.sixteenth },
    { kind: 'note', d: 'e', key: '3', label: t.eighth },
    { kind: 'note', d: 'q', key: '4', label: t.quarter },
    { kind: 'note', d: 'h', key: '5', label: t.half },
    { kind: 'note', d: 'w', key: '6', label: t.whole },
    null,
    { kind: 'rest', d: 'f', key: 'q', code: 'KeyQ', label: t.restThirtySecond },
    { kind: 'rest', d: 's', key: 'w', code: 'KeyW', label: t.restSixteenth },
    { kind: 'rest', d: 'e', key: 'e', code: 'KeyE', label: t.restEighth },
    { kind: 'rest', d: 'q', key: 'r', code: 'KeyR', label: t.restQuarter },
    { kind: 'rest', d: 'h', key: 't', code: 'KeyT', label: t.restHalf },
    { kind: 'rest', d: 'w', key: 'y', code: 'KeyY', label: t.restWhole },
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
    { kind: 'barre', label: t.barre },
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
    button.className = 'score-palette-item tooltip';
    button.setAttribute('aria-label', item.label);
    button.dataset.tooltip = item.label;
    button.appendChild(glyphFor(item));
    button.setAttribute('aria-pressed', 'false');
    if (item.kind === 'bar') {
      button.dataset.barline = item.bar;
      button.addEventListener('click', (event) => {
        if (event.detail === 0) activateTool(item);
      });
    }
    if (item.kind === 'barre') {
      button.dataset.tool = item.kind;
      button.addEventListener('click', (event) => {
        if (event.detail === 0) activateTool(item);
      });
    }
    if (item.key) {
      button.dataset.shortcut = item.key;
      button.setAttribute('aria-keyshortcuts', item.key);
      button.setAttribute('aria-pressed', 'false');
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
    (item.kind === 'bar' || item.kind === 'barre' ? barlines : palette).appendChild(button);
  });

  // TAB: muestra u oculta una tablatura bajo cada renglon.
  const tabToggle = document.createElement('button');
  tabToggle.type = 'button';
  tabToggle.id = 'scoreTabToggle';
  tabToggle.className = 'score-palette-item score-tab-toggle tooltip';
  tabToggle.textContent = 'TAB';
  tabToggle.setAttribute('aria-label', t.tabToggle);
  tabToggle.dataset.tooltip = t.tabToggle;
  tabToggle.addEventListener('click', () => {
    if (score.showTabs) delete score.showTabs; else score.showTabs = true;
    save();
    render();
  });
  barlines.appendChild(tabToggle);

  // ---- renglones, descargas ----------------------------------------------

  addRow.innerHTML = lucide('plus');
  removeRow.innerHTML = lucide('minus');
  document.querySelectorAll('[data-icon]').forEach((node) => { node.insertAdjacentHTML('afterbegin', lucide(node.dataset.icon)); });
  document.getElementById('scoreNewTab').addEventListener('click', newTab);
  renderTabs();

  document.getElementById('scoreClear').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const isFirst = active === 0;
    const confirmed = await window.ScoreConfirm.ask({
      title: t.clearTitle, description: isFirst ? t.clearDescription : t.clearDescriptionTab, confirm: t.clearConfirm, cancel: t.clearCancel,
    });
    if (confirmed && isFirst) {
      // La primera pestana no se quita: vuelve a una partitura nueva, sin notas, titulo ni autor.
      change(() => {
        selected = null;
        group = [];
        score = Object.assign(M.emptyScore(), { title: defaultTitle });
      });
      renderTabs();
    } else if (confirmed) {
      docs.splice(active, 1);
      histories.splice(active, 1);
      active -= 1;
      score = docs[active];
      history = histories[active];
      selected = null;
      group = [];
      save();
      renderTabs();
      render();
    }
    button.focus();
  });

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
  removeRow.addEventListener('click', () => change(removeLastRow));

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
        pageMarginTop: score.title || score.author ? 230 : 150,
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
        if (page === 1 && score.author) {
          pdf.setFont('times', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(120);
          pdf.text(score.author, 201.25, 10, { align: 'right' });
          pdf.setTextColor(0);
        }
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
