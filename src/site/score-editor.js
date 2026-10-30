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
  let selectedMeasure = null; // destino de pegar, independiente de las figuras
  let selectedNavigation = []; // { first, last, mark }: selected return signs or ending spans
  let selected = null; // { mi, i }: la figura principal
  let group = []; // con dos o mas figuras elegidas, todas (incluida la principal)
  let selectedBeam = null; // { node, refs }: barrado elegido sin seleccionar sus notas
  let drag = null;
  let activeItem = null;
  let layout = []; // por compas: { left, right, lines: [y1..y5] } relativo al escenario
  let history = [];
  let renderedWidth = 0;
  let tabColumns = {}; // digitacion visible, incluidas las correcciones, antes de editar
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
        wrap.dataset.index = index;
        tabsBar.insertBefore(wrap, add);
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'score-doc-tab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        button.textContent = tabLabel(one, index);
        button.addEventListener('click', () => switchTo(index));
        button.dataset.index = index;
        tabsBar.insertBefore(button, add);
      }
    });
  }

  // Keep document order and undo histories together, without changing the open score.
  let tabDrag = null;
  let suppressTabClick = false;
  function finishTabDrag(commit) {
    if (!tabDrag) return;
    const { from, before, moving } = tabDrag;
    tabDrag = null;
    tabsBar.classList.remove('is-reordering');
    tabsBar.querySelectorAll('.is-dragging, .drop-before, .drop-after').forEach((node) => {
      node.classList.remove('is-dragging', 'drop-before', 'drop-after');
    });
    if (!moving) return;
    suppressTabClick = true;
    setTimeout(() => { suppressTabClick = false; }, 0);
    if (!commit || before === null) return;
    const to = before > from ? before - 1 : before;
    if (to === from) return;
    docs[active] = score;
    histories[active] = history;
    const order = docs.map((_, index) => index);
    order.splice(to, 0, order.splice(from, 1)[0]);
    const reorderedDocs = order.map((index) => docs[index]);
    const reorderedHistories = order.map((index) => histories[index]);
    active = order.indexOf(active);
    docs.splice(0, docs.length, ...reorderedDocs);
    histories.splice(0, histories.length, ...reorderedHistories);
    save();
    renderTabs();
  }

  tabsBar.addEventListener('dragstart', (event) => event.preventDefault());
  tabsBar.addEventListener('click', (event) => {
    if (suppressTabClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  tabsBar.addEventListener('pointerdown', (event) => {
    const tab = event.target.closest('.score-doc-tab');
    if (!tab || event.button !== 0 || !event.isPrimary || docs.length < 2) return;
    tabDrag = { from: Number(tab.dataset.index), x: event.clientX, y: event.clientY,
      pointerId: event.pointerId, tab, moving: false, before: null };
  });
  window.addEventListener('pointermove', (event) => {
    if (!tabDrag || event.pointerId !== tabDrag.pointerId) return;
    if (!tabDrag.moving && Math.hypot(event.clientX - tabDrag.x, event.clientY - tabDrag.y) < 6) return;
    tabDrag.moving = true;
    event.preventDefault();
    tabsBar.classList.add('is-reordering');
    tabDrag.tab.classList.add('is-dragging');
    tabsBar.querySelectorAll('.drop-before, .drop-after').forEach((node) => node.classList.remove('drop-before', 'drop-after'));
    tabDrag.before = null;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.score-doc-tab, #scoreNewTab');
    if (!target || !tabsBar.contains(target)) return;
    if (target.id === 'scoreNewTab') {
      tabDrag.before = docs.length;
      target.classList.add('drop-before');
    } else {
      const box = target.getBoundingClientRect();
      const after = event.clientX >= box.left + box.width / 2;
      tabDrag.before = Number(target.dataset.index) + (after ? 1 : 0);
      target.classList.add(after ? 'drop-after' : 'drop-before');
    }
  }, { passive: false });
  window.addEventListener('pointerup', (event) => {
    if (tabDrag && event.pointerId === tabDrag.pointerId) finishTabDrag(true);
  });
  window.addEventListener('pointercancel', () => finishTabDrag(false));
  window.addEventListener('blur', () => finishTabDrag(false));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') finishTabDrag(false);
  });

  function switchTo(index) {
    if (index === active || !docs[index]) return;
    docs[active] = score;
    histories[active] = history;
    active = index;
    score = docs[active];
    history = histories[active];
    if (typeof score.title !== 'string') score.title = '';
    clearBarSelection();
    selected = null;
    selectedNavigation = [];
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

  function change(mutate, tabRefs = M.captureTabReferences(score, score.showTabs ? tabColumns : score.tabs)) {
    clearBarSelection();
    selectedBeam = null;
    const before = M.clone(score);
    if (mutate() === false) return false;
    // `at` queda siempre igual al tiempo que se ve (sin huecos): asi los clics y arrastres siguientes se ubican en el orden.
    M.measures(score).forEach(M.settle);
    M.restoreTabReferences(score, tabRefs);
    history.push(before);
    if (history.length > HISTORY_LIMIT) history.shift();
    save();
    render();
    return true;
  }

  function undo() {
    if (!history.length) return;
    const tabRefs = M.captureTabReferences(score, score.showTabs ? tabColumns : score.tabs);
    const restored = history.pop();
    const previousTabs = restored.tabs;
    M.restoreTabReferences(restored, tabRefs);
    if (previousTabs) restored.tabs = Object.assign({}, previousTabs, restored.tabs);
    // La visibilidad de TAB se conserva; sus referencias vuelven con las figuras.
    if (score.showTabs) restored.showTabs = true;
    else delete restored.showTabs;
    score = Object.assign(restored, { title: score.title }, score.author ? { author: score.author } : {});
    clearBarSelection();
    selected = null;
    selectedNavigation = [];
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
    selectedNavigation = [];
    selectedBeam = null;
    if (list.length) clearBarSelection();
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
    if (item.kind === 'navigation') {
      change(() => M.setNavigation(score, target.mi, item.mark));
      return;
    }
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
      if (!spot) return say(noRoom(ev, target.mi));
      ev.d = spot.d;
      if (spot.dot) ev.dot = true;
      if (item.kind === 'rest') {
        const placed = M.placeRest(measure, ev, spot.at, target.n, score, target.mi, target.beforeFirst);
        if (!placed.measure) return say(placed.full ? t.full : fullVoice(placed.voice));
        change(() => {
          measure.splice(0, measure.length, ...placed.measure);
          selected = activeItem ? null : { mi: target.mi, i: placed.index };
          group = [];
        });
        return;
      }
      change(() => {
        const index = M.insertNote(measure, ev, spot.at);
        // Con una herramienta activa la figura nueva no queda seleccionada: seleccion y herramienta no conviven.
        selected = activeItem ? null : { mi: target.mi, i: index };
        group = [];
      });
    }
  }

  // Las voces se cuentan de arriba abajo; `n` es la voz del click.
  function fullVoice(n) {
    return t.fullVoice.replace('{n}', n);
  }

  // Sin lugar para una figura: o es mas larga que el compas, o repite una nota que ya suena en ese tiempo.
  function noRoom(ev, mi) {
    return M.length(ev) > M.capacity(score, mi) ? t.full : t.duplicate;
  }

  function isPlacing(item) {
    return item && (item.kind === 'bar' || item.kind === 'barre' || item.kind === 'navigation');
  }

  function isModifier(item) {
    return item && (item.kind === 'dot' || item.kind === 'acc' || item.kind === 'dead');
  }

  function deactivateTool() {
    activeItem = null;
    stage.classList.remove('has-tool');
    clearHoverGhost();
    toolbars.querySelectorAll('.score-palette-tool').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  function activateTool(item) {
    if (selectedNavigation.length || selectedBeam) { selectedNavigation = []; selectedBeam = null; markSelected(); }
    if (activeItem === item) { deactivateTool(); return; }
    activeItem = item;
    stage.classList.add('has-tool');
    clearHoverGhost();
    updateHoverGhost();
    toolbars.querySelectorAll('.score-palette-tool').forEach((button) => {
      const same = item.kind === 'navigation' ? button.dataset.navigation === item.mark : item.key ? button.dataset.shortcut === item.key : item.kind === 'bar' ? button.dataset.barline === item.bar : button.dataset.tool === item.kind;
      button.setAttribute('aria-pressed', String(same));
    });
    if (isPlacing(item)) return;
    if (isModifier(item)) {
      if (eventAt(selected)) applyModifier(item, selected);
      return;
    }
    const ev = eventAt(selected);
    if (!ev || (ev.d === item.d && !!ev.rest === (item.kind === 'rest'))) return;
    const replacement = Object.assign(M.clone(ev), { d: item.d });
    delete replacement.tp;
    delete replacement.tn;
    if (item.kind === 'rest') { replacement.rest = true; delete replacement.n; delete replacement.acc; delete replacement.dead; }
    else { delete replacement.rest; replacement.n = ev.rest ? M.bottomLine(score, selected.mi) : ev.n; }
    if (item.d === 'w' || item.d === 's' || item.d === 'f') delete replacement.dot;
    else if (replacement.dot === 2 && item.d !== 'h' && item.d !== 'q') replacement.dot = true;
    const measure = M.measures(score)[selected.mi];
    // Se cuenta en orden: lo que sigue en su voz se corre, y la voz tiene que seguir entrando en el compas.
    const trial = M.settle(M.clone(measure));
    trial[selected.i] = Object.assign(replacement, { at: trial[selected.i].at }, Number.isInteger(trial[selected.i].v) ? { v: trial[selected.i].v } : {});
    if (M.measureLength(trial) > M.capacity(score, selected.mi)) return say(t.full);
    change(() => { M.settle(measure); measure[selected.i] = replacement; });
    say('');
  }

  // El puntillo afecta solo a la nota tocada; si hay que correrla, lo que empezaba junto con ella la acompana para seguir alineado.
  function applyModifier(item, hit) {
    const measure = M.measures(score)[hit.mi];
    const ev = measure[hit.i];
    if (item.kind === 'dot') {
      // Puntillo, doble puntillo y nada, en ese orden; si el doble no entra, se vuelve a la figura sin puntillo.
      if (ev.dot === 2) return change(() => { delete ev.dot; });
      const plan = M.dotPlan(measure, hit.i, score);
      if (!plan && ev.dot) return change(() => { delete ev.dot; });
      if (!plan) return say(ev.d === 'w' || ev.d === 's' || ev.d === 'f' || ev.tp ? t.noDot : t.full);
      const moves = plan.moves.map(([i, at]) => [measure[i], at]);
      return change(() => { M.settle(measure); ev.dot = plan.dot; moves.forEach(([o, at]) => { o.at = at; }); });
    }
    if (ev.rest) return;
    if (item.kind === 'dead') return change(() => { if (ev.dead) delete ev.dead; else ev.dead = true; });
    change(() => {
      // Una vez: simple; dos: doble (## o bb); tres: sin alteracion. El becuadro solo se quita.
      const double = { '#': '##', b: 'bb' }[item.acc];
      if (ev.acc === item.acc) { if (double) ev.acc = double; else delete ev.acc; }
      else if (ev.acc === double) delete ev.acc;
      else ev.acc = item.acc;
    });
  }

  function moveEvent(from, target) {
    const all = M.measures(score);
    const ev = all[from.mi][from.i];
    const destination = all[target.mi];
    const others = destination.filter((o) => o !== ev);
    const moved = M.clone(ev);
    ['tp', 'tn', 'tie', 'slur', 'beam'].forEach((key) => { delete moved[key]; });
    if (!ev.rest) moved.n = target.n;
    // Al separar la unica nota de una voz, seguir la columna anterior: una voz
    // vacia volveria a empezar en cero y anularia el desplazamiento horizontal.
    // Las voces con mas figuras conservan su frase al reordenar una nota.
    if (!ev.rest && from.mi === target.mi && !others.some((o) => o.v === ev.v)) {
      const starts = M.hints(others);
      const previous = others.map((o, i) => ({ ev: o, at: starts[i] }))
        .filter((o) => o.at < target.t)
        .sort((a, b) => b.at - a.at || Math.abs((a.ev.n ?? target.n) - target.n) - Math.abs((b.ev.n ?? target.n) - target.n))[0];
      if (previous) moved.v = previous.ev.v;
    }
    const spot = M.placement(others, moved, target.t, score, target.mi);
    if (!spot) return say(noRoom(moved, target.mi));
    moved.d = spot.d;
    if (spot.dot) moved.dot = true;
    else delete moved.dot;
    if (ev.rest) {
      // Un silencio se acomoda segun las notas que suenan a la vez: arrastrarlo arriba o abajo cambia su voz y su altura.
      const placed = M.placeRest(others, moved, spot.at, target.n, score, target.mi, target.beforeFirst);
      if (!placed.measure) return say(placed.full ? t.full : fullVoice(placed.voice));
      // Solo, el silencio queda a la altura donde se soltó: se puede bajar para escribir una nota en el centro.
      const landed = placed.measure[placed.index];
      if (!Number.isInteger(landed.n)) landed.n = M.clampPitch(target.n);
      change(() => {
        all[from.mi].splice(from.i, 1);
        destination.splice(0, destination.length, ...placed.measure);
        selected = { mi: target.mi, i: placed.index };
        group = [];
      });
      return;
    }
    change(() => {
      all[from.mi].splice(from.i, 1);
      selected = { mi: target.mi, i: M.insertNote(destination, moved, spot.at) };
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
    const dmi = target.mi - from.mi;
    // La nota agarrada puede estar en medio del grupo. Ajustar el desplazamiento
    // al espacio disponible para todo el grupo, tambien al soltar cerca de una barra.
    if (items.some((x) => !all[x.mi + dmi])) return say(t.full);
    const minDt = Math.ceil(Math.max(...items.map((x) => -x.at)) / grid) * grid;
    const maxDt = Math.floor(Math.min(...items.map((x) => M.capacity(score, x.mi + dmi) - x.at - M.length(x.ev))) / grid) * grid;
    if (minDt > maxDt) return say(t.full);
    const dt = Math.max(minDt, Math.min(maxDt, Math.round((target.t - anchorAt) / grid) * grid));
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
      const starts = rest && M.hints(rest); // el lugar de cada una antes de sacar las que se mueven
      return !rest || p.at < 0 || p.at + M.length(p.ev) > M.capacity(score, p.to) ||
        (!p.ev.rest && rest.some((o, i) => !o.rest && starts[i] === p.at && o.n === p.ev.n + dn && o.acc === p.ev.acc));
    };
    if (plan.some(clash)) return say(t.full);
    // Contado en orden, cada compas de destino tiene que seguir entrando.
    const trial = all.map((measure) => measure.filter((o) => !moving.has(o)).map((o) => Object.assign({}, o)));
    const trialInserts = new Map();
    plan.slice().sort((a, b) => a.at - b.at).forEach((p) => {
      const ev = Object.assign({}, p.ev);
      if (!ev.rest) ev.n += dn;
      if (!trialInserts.has(p.to)) trialInserts.set(p.to, []);
      trialInserts.get(p.to).push([ev, p.at]);
    });
    trialInserts.forEach((list, mi) => { M.insertMany(trial[mi], list); });
    if (plan.some((p) => M.measureLength(trial[p.to]) > M.capacity(score, p.to))) return say(t.full);
    change(() => {
      all.forEach((measure) => {
        for (let i = measure.length - 1; i >= 0; i -= 1) if (moving.has(measure[i])) measure.splice(i, 1);
      });
      const ids = new Map();
      const inserts = new Map();
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
        if (!inserts.has(p.to)) inserts.set(p.to, []);
        inserts.get(p.to).push([p.ev, p.at]);
      });
      // Todas juntas por compas: las que quedan conservan su lugar en el orden hasta que entran las movidas.
      inserts.forEach((list, mi) => { M.insertMany(all[mi], list); });
      const refsAfter = plan.map((p) => ({ mi: p.to, i: all[p.to].indexOf(p.ev) }));
      selected = refsAfter[refsAfter.length - 1];
      group = refsAfter.length > 1 ? refsAfter : [];
    });
  }

  function removeSelected() {
    if (selectedNavigation.length) {
      change(() => {
        selectedNavigation.forEach(({ first, last, mark }) => {
          for (let mi = first; mi <= last; mi += 1) M.removeNavigation(score, mi, mark);
        });
        selectedNavigation = [];
      });
      return;
    }
    if (selectedBeam) {
      const refs = selectedBeam.refs;
      change(() => M.applySelection(score, refs, 'unbeam'));
      return;
    }
    const list = picks().filter(eventAt);
    if (!list.length) return;
    change(() => {
      list.sort((a, b) => b.mi - a.mi || b.i - a.i).forEach((p) => M.measures(score)[p.mi].splice(p.i, 1));
      selected = null;
      group = [];
    });
  }

  function shiftSelected(delta) {
    const list = picks().filter((p) => eventAt(p));
    if (!list.length) return;
    // Un silencio sin altura propia esta en el centro del pentagrama.
    change(() => { list.forEach((p) => { const ev = eventAt(p); ev.n = M.clampPitch((Number.isInteger(ev.n) ? ev.n : M.bottomLine(score, p.mi) + 4) + delta); }); });
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
    const glyph = barlines.firstElementChild;
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
    mountNavigationMarks();
    mountBarlineButtons();
    markMeasureBars();
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
          node.querySelectorAll('g.chord, g.note, g.rest, g.clef, g.keySig, g.meterSig, g.barLine, g.repeatMark, g.accid, g.dots, text').forEach((glyph) => {
            if (glyph.parentElement.closest('.chord, .note, .rest, .clef, .keySig, .meterSig, .barLine, .repeatMark, .accid, .dots, text')) return;
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
      const system = nodes[first].closest('g.system');
      const spans = M.navigationEndings(score).filter((ending) => ending.first < first + count && ending.last >= first);
      system.querySelectorAll('g.ending .voltaBracket').forEach((bracket, index) => {
        const span = spans[index];
        const line = bracket.querySelector('path');
        if (!span || !line) return;
        const start = Math.max(first, span.first) - first;
        const end = Math.min(first + count - 1, span.last) - first;
        const box = line.getBBox();
        // Keep the clef clearance and small barline gaps at their original size.
        const left = positions[start].left + box.x - original[start].left;
        const right = positions[end].left + positions[end].width + box.x + box.width - original[end].left - original[end].width;
        const bracketX = (x) => left + (x - box.x) * (right - left) / box.width;
        bracket.querySelectorAll('path').forEach((path) => {
          let coordinate = 0;
          path.setAttribute('d', path.getAttribute('d').replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,
            (number) => coordinate++ % 2 ? number : bracketX(Number(number))));
        });
        bracket.querySelectorAll('text[x]').forEach((text) => text.setAttribute('x', left + Number(text.getAttribute('x')) - box.x));
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
      // Donde empieza la musica: pasada la clave, la armadura y el compas que preceden a la primera figura.
      const start = Math.max(box.left, ...[...node.querySelectorAll('g.clef, g.keySig, g.meterSig')].map((g) => g.getBoundingClientRect().right));
      // La primera figura se dibuja un espacio mas alla de la barra o de la armadura.
      return { left: box.left - origin.left, start: start - origin.left + (lines[4] - lines[0]) / 4, right: box.right - origin.left, lines };
    });
  }

  function clearBarSelection() {
    selectedMeasure = null;
    stage.querySelectorAll('.is-bar-selected').forEach((node) => node.classList.remove('is-bar-selected'));
    stage.querySelectorAll('.score-barline-trigger').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.score-barline-trigger, .score-insert-measure')) clearBarSelection();
  });

  function removeSelectedBars() {
    const bars = [...stage.querySelectorAll('.score-barline-trigger[aria-pressed="true"]')]
      .map((button) => ({ mi: Number(button.dataset.measure), side: button.dataset.side }));
    if (!bars.length) return false;
    change(() => bars.forEach(({ mi, side }) => M.removeBarline(score, mi, side)));
    return true;
  }

  // Un compas elegido es el destino del pegado; sus barras visibles se resaltan.
  function selectMeasureBars(event) {
    const origin = stage.getBoundingClientRect();
    const mi = layout.findIndex((m) => event.clientX >= origin.left + m.left && event.clientX <= origin.left + m.right &&
      event.clientY >= origin.top + m.lines[0] && event.clientY <= origin.top + m.lines[4]);
    if (mi < 0) return;
    clearBarSelection();
    selectedMeasure = mi;
    markMeasureBars();
  }

  function markMeasureBars() {
    const mi = selectedMeasure;
    if (mi === null || !layout[mi]) return;
    const sides = [];
    if (score.barlines?.[mi]?.start) sides.push([mi, 'start']);
    else if (mi > M.rowOf(score, mi).first) sides.push([mi - 1, 'end']);
    sides.push([mi, 'end']);
    sides.forEach(([m, side]) => {
      const button = stage.querySelector('.score-barline-trigger[data-measure="' + m + '"][data-side="' + side + '"]');
      if (!button) return;
      const nodes = stage.querySelector('[id="m' + m + '"]').querySelectorAll('g.barLine');
      const node = side === 'start' ? nodes[0] : nodes[nodes.length - 1];
      node?.classList.add('is-bar-selected');
      button.setAttribute('aria-pressed', 'true');
    });
    mountInsertButtons(mi);
  }

  // Un + sobre cada barra del compas elegido inserta un compas vacio antes o despues; los demas se corren.
  function mountInsertButtons(mi) {
    stage.querySelectorAll('.score-insert-measure').forEach((button) => button.remove());
    const m = layout[mi];
    [['before', m.left, mi, t.insertMeasureBefore], ['after', m.right, mi + 1, t.insertMeasureAfter]].forEach(([where, x, at, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'score-insert-measure tooltip';
      button.dataset.where = where;
      button.dataset.tooltip = label;
      button.setAttribute('aria-label', label);
      button.innerHTML = lucide('plus');
      button.style.left = x + 'px';
      button.style.top = (m.lines[0] - 18) + 'px';
      button.addEventListener('click', () => {
        // El compas nuevo queda elegido para poder seguir insertando.
        if (!change(() => { selected = null; return M.insertMeasure(score, at); })) return;
        selectedMeasure = at;
        markMeasureBars();
      });
      stage.appendChild(button);
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
          setPicks([]);
          node.classList.add('is-bar-selected');
          button.setAttribute('aria-pressed', 'true');
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
    if (score.navigation) Object.keys(score.navigation).forEach((mi) => {
      if (+mi >= M.measures(score).length) delete score.navigation[mi];
    });
    if (score.barres) Object.keys(score.barres).forEach((mi) => {
      if (+mi >= M.measures(score).length) M.removeBarre(score, +mi);
    });
  }

  // Una tablatura (<ascii-tabs>) bajo cada renglon. Las digitaciones salen solas de las notas (ScoreFingering) y cada
  // columna queda bajo su nota; score.tabs conserva las posiciones elegidas sin cambiar el pentagrama.
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
    tabColumns = Object.assign({}, auto, score.tabs);
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
            if (edited) tabColumns[key] = edited;
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
    const anchors = [{ x: m.start, t: 0 }, { x: m.right, t: M.capacity(score, layout.indexOf(m)) }];
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

  function mountNavigationMarks() {
    const mount = (node, first, last, mark) => {
      if (!node) return;
      node.dataset.navigationMark = mark;
      node.dataset.navigationFirst = first;
      node.dataset.navigationLast = last;
      node.classList.add('score-navigation-mark');
      // Transparent padding makes thin brackets and small glyphs easy to pick.
      const box = node.getBBox();
      const scale = node.getScreenCTM()?.a || 1;
      const pad = 5 / scale;
      const hit = document.createElementNS(SVG_NS, 'rect');
      hit.setAttribute('class', 'score-navigation-hit');
      // Verovio's embedded #svg rect rule overrides stylesheet selectors.
      hit.style.stroke = 'none';
      hit.setAttribute('x', box.x - pad);
      hit.setAttribute('y', box.y - pad);
      hit.setAttribute('width', box.width + pad * 2);
      hit.setAttribute('height', box.height + pad * 2);
      node.prepend(hit);
    };
    stage.querySelectorAll('g.measure').forEach((measure) => {
      const mi = Number(measure.id.slice(1));
      const nav = score.navigation?.[mi];
      if (nav?.segno) mount(measure.querySelector('g.repeatMark'), mi, mi, 'segno');
      if (nav?.dc) mount(measure.querySelector('g.dir.dacapo'), mi, mi, 'dc');
      if (nav?.ds) mount(measure.querySelector('g.dir.dalsegno'), mi, mi, 'ds');
    });
    const endings = M.navigationEndings(score);
    stage.querySelectorAll('g.system').forEach((system) => {
      const measures = [...system.querySelectorAll('g.measure')].map((measure) => Number(measure.id.slice(1)));
      if (!measures.length) return;
      const spans = endings.filter((ending) => ending.first <= measures[measures.length - 1] && ending.last >= measures[0]);
      system.querySelectorAll('g.ending > g.voltaBracket').forEach((bracket, i) => {
        const span = spans[i];
        if (span) mount(bracket, span.first, span.last, span.mark);
      });
    });
  }

  function selectNavigation(node, event) {
    const pick = { first: Number(node.dataset.navigationFirst), last: Number(node.dataset.navigationLast), mark: node.dataset.navigationMark };
    const previous = event.shiftKey || event.ctrlKey || event.metaKey ? selectedNavigation.slice() : [];
    setPicks([]);
    clearBarSelection();
    deactivateTool();
    const index = previous.findIndex((p) => p.first === pick.first && p.mark === pick.mark);
    if (index >= 0) previous.splice(index, 1); else previous.push(pick);
    selectedNavigation = previous;
    stage.focus({ preventScroll: true });
    markSelected();
  }

  function markSelected() {
    stage.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
    if (!selected) group = [];
    const nodes = picks().map((p) => stage.querySelector('[id="e' + p.mi + '-' + p.i + '"]'));
    if (nodes.some((node) => !node)) {
      selected = null;
      group = [];
    } else nodes.forEach((node) => node.classList.add('is-selected'));
    selectedNavigation = selectedNavigation.filter((pick) =>
      Array.from({ length: pick.last - pick.first + 1 }, (_, i) => score.navigation?.[pick.first + i]?.[pick.mark]).some(Boolean));
    stage.querySelectorAll('[data-navigation-mark]').forEach((node) => {
      if (selectedNavigation.some((pick) => pick.first === Number(node.dataset.navigationFirst) && pick.mark === node.dataset.navigationMark)) node.classList.add('is-selected');
    });
    if (selectedBeam && !selectedBeam.node.isConnected) selectedBeam = null;
    // Highlight a connection only when all its figures are selected, or when
    // the beam itself was picked. This does not change what Delete acts on.
    stage.querySelectorAll('g.beam').forEach((beam) => {
      const figures = [...beam.querySelectorAll('g.note, g.rest')];
      const fullySelected = figures.length > 0 && figures.every((node) => node.classList.contains('is-selected'));
      if (beam === selectedBeam?.node || fullySelected) {
        beam.querySelectorAll(':scope > polygon').forEach((node) => node.classList.add('is-selected'));
      }
    });
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
    const anchors = [{ x: m.start, t: 0 }, { x: m.right, t: M.capacity(score, layout.indexOf(m)) }];
    centers.forEach((c, i) => anchors.push({ x: c, t: starts[i] }));
    anchors.sort((p, q) => p.x - q.x || p.t - q.t);
    for (let k = 1; k < anchors.length; k += 1) {
      const a = anchors[k - 1];
      const b = anchors[k];
      if (x <= a.x && a.t === 0) return 0;
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
    const isOwn = (i) => skip && [].concat(skip).some((s) => s.mi === mi && s.i === i);
    // A la derecha de la ultima columna el tiempo interpolado cae dentro de esa figura: la nueva empieza donde termina.
    const others = measure.map((o, i) => i).filter((i) => !isOwn(i));
    if (others.length && x > Math.max(...others.map((i) => centers[i]))) {
      const last = Math.max(...others.map((i) => starts[i]));
      at = Math.max(at, ...others.map((i) => starts[i] === last ? last + M.length(measure[i]) : 0));
    }
    // Solo sobre la cabeza de una nota (no a un espacio de distancia) la figura se apila en su columna.
    let near = null;
    centers.forEach((c, i) => {
      if (isOwn(i) || measure[i].rest || Math.abs(c - x) > space * 0.8) return;
      if (!near || Math.abs(c - x) < Math.abs(near.c - x)) near = { c, i };
    });
    if (near) {
      at = starts[near.i];
      markX = near.c;
    }
    return {
      mi, n, space, rawT, rawX,
      beforeFirst: others.length > 0 && x < Math.min(...others.map((i) => centers[i])) - space * 0.8,
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
    marker.querySelectorAll('.score-marker-ledger').forEach((node) => node.remove());
    if (!hit) { marker.hidden = true; return; }
    marker.hidden = false;
    const line = marker.firstChild;
    const item = drag ? drag.item : activeItem;
    const x = item?.kind === 'navigation' ? layout[hit.mi][['dc', 'ds'].includes(item.mark) ? 'right' : 'left']
      : item && item.kind === 'bar' && item.bar !== 'double' ? layout[hit.mi][item.bar === 'start' ? 'left' : 'right']
      : item && item.kind === 'bar' && item.bar === 'double' ? hit.rawX
      : item && item.kind === 'barre' && !hit.onNote ? layout[hit.mi].left : hit.x;
    line.style.left = x + 'px';
    line.style.top = hit.top - hit.space * 2 + 'px';
    line.style.height = (hit.bottom - hit.top) + hit.space * 4 + 'px';
    // Una nota fuera del pentagrama muestra las lineas adicionales que le tocarian, una por cada espacio hasta su cabeza.
    if ((drag && drag.kind || activeItem && activeItem.kind) !== 'note') return;
    const beyond = (edge, sign) => {
      for (let k = 1; sign * (hit.y - edge) >= k * hit.space - 1; k += 1) {
        const ledger = document.createElement('span');
        ledger.className = 'score-marker-ledger';
        ledger.style.left = hit.x - hit.space * 1.1 + 'px';
        ledger.style.width = hit.space * 2.2 + 'px';
        ledger.style.top = edge + sign * k * hit.space - 1 + 'px';
        marker.appendChild(ledger);
      }
    };
    beyond(hit.top, -1);
    beyond(hit.bottom, 1);
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

  // La figura va arriba a la izquierda del puntero para que este no la tape;
  // el punto de soltado es el centro de la figura, no la punta del puntero.
  let ghostOffset = 2;

  function aimed(event) {
    return { clientX: event.clientX - ghostOffset, clientY: event.clientY - ghostOffset };
  }

  function moveGhost(ghost, event) {
    const at = aimed(event);
    ghost.style.transform = 'translate(' + at.clientX + 'px,' + at.clientY + 'px)';
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
    const raw = hoverPoint;
    const point = raw && aimed(raw);
    const over = point && document.elementFromPoint(point.clientX, point.clientY);
    const overStage = over && stage.contains(over) && !over.closest('.score-barline-trigger, .score-insert-measure, .score-barre-field, .score-barre-span, .score-selection-menu');
    const hit = activeItem && !shiftMeasures && !measureDrag && !drag && overStage && locate(point.clientX, point.clientY);
    if (!hit) { clearHoverGhost(); return; }
    if (!hoverGhost) {
      hoverGhost = startGhost(glyphFor(activeItem), raw, activeItem.kind);
      hoverGhost.classList.add('score-hover-ghost');
    } else moveGhost(hoverGhost, raw);
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
      const at = aimed(event);
      const hit = eventUnder(at.clientX, at.clientY);
      if (hit) stage.querySelector('[id="e' + hit.mi + '-' + hit.i + '"]').classList.add('is-target');
    } else {
      const at = aimed(event);
      showMarker(locate(at.clientX, at.clientY, drag.group || drag.from));
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
        const at = aimed(event);
        const target = locate(at.clientX, at.clientY);
        // El lienzo lejos de todo compas es un lugar neutro: suelta la herramienta como un click fuera de la partitura.
        if (!target) deactivateTool();
        else if (activeItem) dropNew(activeItem, target);
      }
      return;
    }
    if (d.insert) return;
    if (isModifier(d.item)) {
      const at = aimed(event);
      const hit = eventUnder(at.clientX, at.clientY);
      if (hit) applyModifier(d.item, hit);
      return;
    }
    const at = aimed(event);
    const target = locate(at.clientX, at.clientY, d.group || d.from);
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
    if (!event.shiftKey || event.button !== 0 || event.target.closest('input, button, textarea, ascii-tabs')) return;
    const origin = stage.getBoundingClientRect();
    const x = event.clientX - origin.left, y = event.clientY - origin.top;
    const from = layout.findIndex((m) => x >= m.left && x <= m.right && y >= m.lines[0] - 24 && y <= m.lines[4] + 24);
    if (from < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    deactivateTool();
    measureDrag = { from, id: event.pointerId, x: event.clientX, y: event.clientY, fit: new Map(), active: false };
  }, true);

  stage.addEventListener('pointerdown', (event) => {
    const navigation = event.target.closest('[data-navigation-mark]');
    if (navigation) {
      event.preventDefault();
      event.stopPropagation();
      selectNavigation(navigation, event);
      return;
    }
    if (event.target.closest('.score-meter-trigger, .score-clef-trigger, .score-key-trigger, .score-barline-trigger, .score-insert-measure, .score-barre-field, .score-barre-span, .score-selection-menu')) return;
    // Las cabezas graves pueden quedar dentro de TAB: la partitura recibe
    // el gesto antes de que el componente enfoque y redibuje su celda.
    const overTab = event.target.closest('.score-tab');
    if (overTab) {
      if (!eventUnder(event.clientX, event.clientY)) return;
      event.stopPropagation();
    }
    if (isPlacing(activeItem)) {
      event.preventDefault();
      stage.focus({ preventScroll: true });
      beginDrag(event, { insert: true });
      return;
    }
    // Verovio groups the notes and beam polygons together. Only the polygons
    // select the connection; a notehead inside the group still selects its note.
    const beam = event.target.closest('g.beam');
    if (beam && event.target.matches('polygon') && event.target.parentElement === beam && !activeItem) {
      const refs = [...beam.querySelectorAll('g.note, g.rest')].map((node) => /^e(\d+)-(\d+)$/.exec(node.id))
        .filter(Boolean).map((match) => ({ mi: +match[1], i: +match[2] }));
      if (M.selectionActions(score, refs).includes('unbeam')) {
        event.preventDefault();
        setPicks([]);
        clearBarSelection();
        selectedBeam = { node: beam, refs };
        markSelected();
        stage.focus({ preventScroll: true });
        return;
      }
    }
    let match = eventUnder(event.clientX, event.clientY);
    // Con una nota o un silencio en mano, un click sobre un silencio coloca la figura nueva en vez de seleccionarlo.
    if (match && activeItem && !isModifier(activeItem) && eventAt(match).rest) match = null;
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
  }, true);

  // Shift reserves the measure gesture before note selection, tools and TAB.
  let measureDrag = null;
  const measureGuide = document.createElement('div');
  measureGuide.className = 'score-measure-guide';
  let shiftMeasures = false;

  function measureCursor(on) {
    if (shiftMeasures === on) return;
    shiftMeasures = on;
    stage.classList.toggle('can-move-measures', on);
    if (on) clearHoverGhost();
    else updateHoverGhost();
  }

  function measureDrop(event, d) {
    const origin = stage.getBoundingClientRect();
    const x = event.clientX - origin.left, y = event.clientY - origin.top;
    if (x < 0 || x > origin.width || y < 0 || y > origin.height) return null;
    const starts = M.rowStarts(score);
    let row = 0;
    starts.forEach((first, r) => {
      if (Math.abs(y - layout[first].lines[2]) < Math.abs(y - layout[starts[row]].lines[2])) row = r;
    });
    const first = starts[row], last = first + score.rows[row].length - 1;
    const end = x >= (layout[last].left + layout[last].right) / 2;
    let before = last + 1, appendRow;
    if (end && row !== M.rowOf(score, d.from).row && score.rows[M.rowOf(score, d.from).row].length > 1) {
      if (!d.fit.has(row)) {
        const trial = M.clone(score);
        M.moveMeasure(trial, d.from, before, row);
        const probe = newToolkit();
        try {
          probe.setOptions(layoutOptions(stage.clientWidth, { noJustification: true }));
          probe.loadData(M.toMusicXml(trial));
          const svg = new DOMParser().parseFromString(probe.renderToSVG(1), 'image/svg+xml');
          const paths = [...svg.querySelectorAll('g.system')][row]?.querySelectorAll('g.measure > g.staff > path');
          // Unjustified staff endpoints are in Verovio drawing units (10 per page unit).
          const ends = paths ? [...paths].map((p) => [...p.getAttribute('d').matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => +m[0])).flatMap((coords) => coords.filter((_, i) => i % 2 === 0)) : [];
          const available = (Math.round(stage.clientWidth * 100 / SCALE) - 120) * 10;
          d.fit.set(row, ends.length > 0 && Math.max(...ends) - Math.min(...ends) <= available);
        } finally { probe.destroy(); }
      }
      if (d.fit.get(row)) appendRow = row;
      else if (row + 1 < starts.length) row += 1;
      // At the final row, create a following row instead of squeezing it.
      else return { before, newRow: true, left: layout[last].right, lines: layout[last].lines };
    } else if (!end) {
      before = first;
      for (let mi = first; mi <= last; mi += 1) {
        if (x > (layout[mi].left + layout[mi].right) / 2) before = mi + 1;
      }
    }
    const nextRow = row > M.rowOf(score, last).row;
    const guide = nextRow ? layout[starts[row]] : before > last ? layout[last] : layout[before];
    return { before, appendRow, left: before > last && !nextRow ? guide.right : guide.left, lines: guide.lines };
  }

  function finishMeasureDrag(event, cancel) {
    const d = measureDrag;
    if (!d || (event.pointerId !== undefined && event.pointerId !== d.id)) return;
    if (d.active && !cancel) d.target = measureDrop(event, d);
    measureDrag = null;
    measureGuide.remove();
    document.body.classList.remove('score-moving-measure');
    stage.querySelectorAll('.is-moving-measure').forEach((node) => node.classList.remove('is-moving-measure'));
    if (!d.active && !cancel) {
      const hit = eventUnder(event.clientX, event.clientY);
      if (hit) togglePick(hit); // Shift+click still extends the figure selection.
    }
    if (d.active && !cancel && d.target) {
      change(() => {
        const target = d.target;
        if (target.newRow) {
          // Make the final insertion a row of its own without adding a measure.
          if (!M.moveMeasure(score, d.from, target.before)) return false;
          const last = score.rows[score.rows.length - 1];
          if (last.length > 1) score.rows.push([last.pop()]);
        } else if (!M.moveMeasure(score, d.from, target.before, target.appendRow)) return false;
        selected = null;
        group = [];
        selectedNavigation = [];
      });
    }
    stage.focus({ preventScroll: true });
  }

  document.addEventListener('pointermove', (event) => {
    measureCursor(event.shiftKey);
    const d = measureDrag;
    if (!d || event.pointerId !== d.id) return;
    if (!d.active && Math.hypot(event.clientX - d.x, event.clientY - d.y) < 5) return;
    d.active = true;
    document.body.classList.add('score-moving-measure');
    stage.querySelector('#m' + d.from)?.classList.add('is-moving-measure');
    d.target = measureDrop(event, d);
    if (!d.target) { measureGuide.remove(); return; }
    measureGuide.style.left = d.target.left + 'px';
    measureGuide.style.top = d.target.lines[0] - 20 + 'px';
    measureGuide.style.height = d.target.lines[4] - d.target.lines[0] + 40 + 'px';
    if (!measureGuide.isConnected) stage.appendChild(measureGuide);
  });
  document.addEventListener('pointerup', (event) => finishMeasureDrag(event, false));
  document.addEventListener('pointercancel', (event) => finishMeasureDrag(event, true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') measureCursor(true);
    if (event.key === 'Escape') finishMeasureDrag(event, true);
  });
  document.addEventListener('keyup', (event) => { if (event.key === 'Shift') measureCursor(false); });
  window.addEventListener('blur', () => { measureCursor(false); finishMeasureDrag({}, true); });

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
    if (event.target.closest('[data-navigation-mark]')) return;
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

  // Un click en un lugar neutro (fuera de la partitura, las paletas y los menus) suelta la herramienta.
  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) return;
    // Los campos del titulo y el autor tambien quedan fuera de la seleccion musical.
    if ((picks().length || selectedNavigation.length || selectedBeam) && !event.target.closest('.score-stage, .score-palette, .score-toolbar, .score-side-actions, .score-doc-tab, [popover]')) setPicks([]);
    if (!activeItem) return;
    if (event.target.closest('.score-stage, .score-palette, .score-toolbar, .score-side-actions, .score-doc-tab, [popover], button, a, input, select, textarea')) return;
    deactivateTool();
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.closest('input, textarea, select, [contenteditable], ascii-tabs')) return;
    if (!event.metaKey && !event.ctrlKey && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')) {
      if (removeSelectedBars()) { event.preventDefault(); return; }
    }
    if (event.key === 'Escape') {
      clearBarSelection();
      deactivateTool();
    }
    // Shift+D: sin Ctrl/Cmd/Alt no choca con ningun atajo del navegador (Cmd+D es marcador).
    if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && event.code === 'KeyD') {
      event.preventDefault();
      if (!event.repeat) duplicateSelected();
      return;
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && !meterPopup.matches(':popover-open') && !clefPopup.matches(':popover-open')) {
      if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        deactivateTool();
        return;
      }
      const item = ITEMS.find((item) => item && (item.code ? item.code === event.code : item.key === event.key.toLowerCase()));
      if (item) { event.preventDefault(); if (!event.repeat) activateTool(item); return; }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });

  // Copia las figuras elegidas justo despues de la ultima, siguiendo en los compases que vengan.
  function duplicateSelected() {
    const refs = picks().filter((ref) => eventAt(ref));
    if (!refs.length) return;
    const trial = M.clone(score);
    M.restoreTabReferences(trial, M.captureTabReferences(score, score.showTabs ? tabColumns : score.tabs));
    const created = M.duplicateSelection(trial, refs);
    if (!created) return say(t.full);
    change(() => {
      Object.assign(score, trial);
      selected = created[created.length - 1];
      group = created.length > 1 ? created : [];
    }, M.captureTabReferences(trial));
    stage.focus({ preventScroll: true });
  }

  let pasteWithoutSignatures = false;
  document.addEventListener('keydown', (event) => { pasteWithoutSignatures = event.shiftKey; });
  document.addEventListener('keyup', (event) => { pasteWithoutSignatures = event.shiftKey; });
  window.addEventListener('blur', () => { pasteWithoutSignatures = false; });
  const clipboardType = 'application/x-guitar-score-selection';
  const editingText = (event) => event.target.closest('input, textarea, select, [contenteditable], ascii-tabs');
  document.addEventListener('copy', (event) => {
    if (editingText(event) || !event.clipboardData) return;
    const fragment = M.copySelection(score, picks(), score.showTabs ? tabColumns : score.tabs);
    if (!fragment) return;
    event.preventDefault();
    const text = JSON.stringify(fragment);
    event.clipboardData.setData(clipboardType, text);
    event.clipboardData.setData('text/plain', text);
  });
  document.addEventListener('paste', (event) => {
    if (editingText(event) || selectedMeasure === null || !event.clipboardData) return;
    let fragment;
    try {
      fragment = JSON.parse(event.clipboardData.getData(clipboardType) || event.clipboardData.getData('text/plain'));
    } catch (error) { return; }
    if (fragment?.type !== 'guitar-score-selection' || fragment.version !== 1) return;
    event.preventDefault();
    const trial = M.clone(score);
    M.restoreTabReferences(trial, M.captureTabReferences(score, score.showTabs ? tabColumns : score.tabs));
    const refs = M.pasteSelection(trial, fragment, selectedMeasure, { preserveSignatures: !pasteWithoutSignatures });
    if (!refs) return say(t.full);
    change(() => {
      Object.assign(score, trial);
      selected = refs[refs.length - 1];
      group = refs.length > 1 ? refs : [];
    }, M.captureTabReferences(trial));
    stage.focus({ preventScroll: true });
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
    link: '<ellipse cx="3" cy="8" rx="3" ry="2" transform="rotate(-25 3 8)" fill="currentColor" stroke="none"/><ellipse cx="21" cy="8" rx="3" ry="2" transform="rotate(-25 21 8)" fill="currentColor" stroke="none"/><path d="M4 13c1.500 7 14.500 7 16 0"/>',
    unlink: '<ellipse cx="3" cy="8" rx="3" ry="2" transform="rotate(-25 3 8)" fill="currentColor" stroke="none"/><ellipse cx="21" cy="8" rx="3" ry="2" transform="rotate(-25 21 8)" fill="currentColor" stroke="none"/><path d="M4 13c1.500 7 14.500 7 16 0"/><path d="M4 3l16 18"/>',
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
  // Los demas grupos (2, 4 a 9 figuras) son el icono del tresillo con su numero.
  for (let n = 2; n <= 9; n += 1) {
    if (n === 3) continue;
    ICONS['tuplet' + n] = ICONS.triplet.replace(/<path d="M10 7[^>]*>/, '') + '<text x="12" y="13" text-anchor="middle" font-size="12" font-weight="700" stroke="none" fill="currentColor">' + n + '</text>';
    ICONS['untuplet' + n] = ICONS['tuplet' + n];
    ACTION_ICONS['tuplet' + n] = 'tuplet' + n;
    ACTION_ICONS['untuplet' + n] = 'untuplet' + n;
  }

  function lucide(name) {
    return '<svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // Glifos propios: Lucide no tiene figuras musicales. Notas y silencios son los trazos Bravura que dibuja Verovio en la partitura.
  const GLYPHS = {
    'note:w': '<path d="M15.74 18.63c4.5 0 9.14 1.99 9.14 5.87c0 4.06 -5.21 5.87 -10.02 5.87c-4.46 0 -7.86 -2.03 -7.86 -5.87c0 -3.88 4.1 -5.87 8.74 -5.87zM19.93 25.43c0 -0.62 -0.13 -1.28 -0.35 -1.94c-0.31 -0.88 -0.79 -1.68 -1.46 -2.38c-0.88 -0.93 -1.9 -1.37 -3 -1.37l-0.88 0.09c-0.66 0.22 -1.19 0.62 -1.59 1.24c-0.18 0.4 -0.26 0.75 -0.35 1.06s-0.13 0.71 -0.13 1.19c0 0.66 0.13 1.5 0.4 2.52s0.79 1.81 1.5 2.43c0.66 0.66 1.59 1.02 2.74 1.02c0.18 0 0.44 -0.04 0.79 -0.09c0.84 -0.22 1.41 -0.66 1.77 -1.32s0.57 -1.5 0.57 -2.43 z" fill-rule="evenodd"/>',
    'note:h': '<path d="M19.27 21.68c0 -0.97 -0.75 -1.72 -1.9 -1.72c-0.53 0 -1.15 0.13 -1.81 0.44c-3.75 1.9 -7.28 4.15 -7.28 6.89c0.22 1.1 0.66 1.41 2.16 1.41c2.96 -0.49 8.83 -4.19 8.83 -7.02zM7 26.09c0 -3 3.22 -7.68 8.83 -7.68c2.91 0 5.03 1.72 5.03 4.28c0 3.71 -4.68 7.64 -9.62 7.64c-2.82 0 -4.24 -1.41 -4.24 -4.24 z" fill-rule="evenodd"/><path d="M20.3 22.8V-12.3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    'note:q': '<path d="M7 26.22c0 -3 3.22 -7.59 8.83 -7.59c2.91 0 5.03 1.63 5.03 4.19c0 3.71 -4.68 7.55 -9.62 7.55c-2.82 0 -4.24 -1.32 -4.24 -4.15 z"/><path d="M20.3 22.8V-12.3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    'note:e': '<path d="M7 26.22c0 -3 3.22 -7.59 8.83 -7.59c2.91 0 5.03 1.63 5.03 4.19c0 3.71 -4.68 7.55 -9.62 7.55c-2.82 0 -4.24 -1.32 -4.24 -4.15 z"/><path d="M20.3 22.8V-12.3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M27.65 16.23c0.66 -1.28 1.28 -2.43 2.03 -4.5c0.79 -2.16 1.32 -4.77 1.32 -6.09c0 -4.63 -3.53 -7.64 -7.41 -8.83c-0.79 -0.22 -2.07 -0.4 -3.84 -0.71v-8.39h0.97c0.35 0 1.46 2.69 3.13 4.19c0.18 0.13 -0.09 -0.13 2.69 2.47c2.74 2.56 5.38 6.05 5.38 10.64c0 1.68 -0.57 4.68 -1.54 7.19c-0.88 2.25 -1.9 4.37 -2.91 5.83c-0.26 0.22 -0.44 0.31 -0.57 0.31s-0.22 -0.09 -0.22 -0.22l0.18 -0.44c0.04 -0.13 0.62 -1.1 0.79 -1.46 z"/>',
    'note:s': '<path d="M7 26.22c0 -3 3.22 -7.59 8.83 -7.59c2.91 0 5.03 1.63 5.03 4.19c0 3.71 -4.68 7.55 -9.62 7.55c-2.82 0 -4.24 -1.32 -4.24 -4.15 z"/><path d="M20.3 22.8V-12.3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M28.84 20.73c1.41 -2.12 2.16 -4.41 2.16 -6.58c0 -3.93 -2.43 -7.41 -7.41 -8.96c-0.79 -0.22 -2.07 -0.4 -3.84 -0.71v-8.39v-8.39h0.97c0.35 0 1.46 2.69 3.13 4.19c0.18 0.13 -0.09 -0.13 2.69 2.47c2.74 2.56 5.38 6.05 5.38 10.64c0 1.41 -0.31 2.87 -0.75 4.24c0.49 1.28 0.75 2.65 0.75 4.15c0 3.13 -1.41 6.53 -2.96 8.39c-0.26 0.22 -0.44 0.31 -0.57 0.31s-0.22 -0.09 -0.22 -0.22l0.18 -0.44c0.04 -0.13 0.26 -0.35 0.49 -0.71zM30.7 8.15c0.18 -0.79 0.31 -1.68 0.31 -2.52c0 -4.63 -3.53 -7.64 -7.41 -8.83c-0.49 -0.13 -1.19 -0.26 -2.07 -0.4c0.4 0.75 1.02 2.69 2.34 3.88c0.18 0.13 -0.09 -0.13 2.69 2.47c1.59 1.46 3.13 3.27 4.15 5.38 z"/>',
    'note:f': '<path d="M7 26.22c0 -3 3.22 -7.59 8.83 -7.59c2.91 0 5.03 1.63 5.03 4.19c0 3.71 -4.68 7.55 -9.62 7.55c-2.82 0 -4.24 -1.32 -4.24 -4.15 z"/><path d="M20.3 22.8V-12.3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M30.7 8.15c0.18 -0.79 0.31 -1.68 0.31 -2.52c0 -4.63 -3.53 -7.64 -7.41 -8.83c-0.49 -0.13 -1.19 -0.26 -2.07 -0.4c0.4 0.75 1.02 2.69 2.34 3.88c0.18 0.13 -0.09 -0.13 2.69 2.47c1.59 1.46 3.13 3.27 4.15 5.38zM28.84 20.73c1.41 -2.12 2.16 -4.41 2.16 -6.58c0 -3.93 -2.43 -7.41 -7.41 -8.96c-0.79 -0.22 -2.07 -0.4 -3.84 -0.71v-8.39v-8.39v-8.39h0.97c0.35 0 1.46 2.69 3.13 4.19c0.18 0.13 -0.09 -0.13 2.69 2.47c2.69 2.52 5.38 5.91 5.38 10.37v0.26c-0.04 2.6 -0.44 3.53 -0.84 4.02c0.53 1.32 0.84 2.78 0.84 4.37c0 1.41 -0.31 2.87 -0.75 4.24c0.49 1.28 0.75 2.65 0.75 4.15c0 3.13 -1.41 6.53 -2.96 8.39c-0.26 0.22 -0.44 0.31 -0.57 0.31s-0.22 -0.09 -0.22 -0.22l0.18 -0.44c0.04 -0.13 0.26 -0.35 0.49 -0.71zM30.65 -0.36c0.18 -0.49 0.35 -1.24 0.35 -2.38c0 -4.63 -3.53 -7.64 -7.41 -8.83c-0.49 -0.13 -1.19 -0.26 -2.07 -0.4c0.4 0.75 1.02 2.69 2.34 3.88c0.18 0.13 -0.09 -0.13 2.69 2.47c1.54 1.46 3.09 3.18 4.1 5.25 z"/>',
    'rest:w':'<path d="M4 12.619h22" stroke="currentColor" stroke-width="1.4"/><g transform="translate(-1.676 -3.878) scale(1.225)"><path d="M7 18.54v-4.63c0 -0.4 0.04 -0.44 0.44 -0.44h12.36c0.4 0 0.44 0.04 0.44 0.44v4.63c0 0.4 -0.04 0.44 -0.44 0.44h-12.36c-0.4 0 -0.44 -0.04 -0.44 -0.44 z"/></g>',
    'rest:h': '<path d="M4 19.381h22" stroke="currentColor" stroke-width="1.4"/><g transform="translate(-1.676 -10.640) scale(1.225)"><path d="M7 24.06v-4.63c0 -0.4 0.04 -0.44 0.44 -0.44h12.36c0.4 0 0.44 0.04 0.44 0.44v4.63c0 0.4 -0.04 0.44 -0.44 0.44h-12.36c-0.4 0 -0.44 -0.04 -0.44 -0.44 z"/></g>',
    'rest:q': '<g transform="translate(-1.807 -14.445) scale(1.225)"><path d="M11.72 11.61c-0.57 -1.06 -1.32 -2.16 -2.3 -3.13c-0.04 -0.04 0 -0.09 0 -0.13l-0.09 -0.09c0.13 -0.13 0.18 -0.18 0.26 -0.18c0.53 0 1.15 0.31 1.77 0.88s1.94 1.77 3.93 3.58c1.15 1.06 1.24 1.28 2.03 2.07c0.18 0.18 0.35 0.4 0.44 0.62c0.26 0.35 0.35 0.71 0.35 1.19c0 0.84 -0.53 1.77 -1.59 2.69c-1.24 1.02 -2.16 1.68 -2.69 3.22c-0.18 0.49 -0.31 1.19 -0.44 2.21c0.57 1.9 1.5 3.66 2.6 5.34c1.37 2.07 2.6 3.49 4.46 5.69c-0.35 0 -1.15 -0.31 -2.38 -0.88l-2.74 -1.28l-0.93 -0.26l-1.02 -0.04c-1.1 0 -1.99 0.44 -2.65 1.32l-0.18 0.62l-0.04 0.53c0 1.46 0.88 2.47 1.72 3.44c0.35 0.4 0.75 0.79 1.15 1.15c0.75 0.66 1.19 1.06 1.24 1.32l-0.13 0.13c-0.49 -0.22 -0.84 -0.44 -1.1 -0.66c-0.4 -0.13 -1.63 -0.93 -1.99 -1.15c-1.06 -0.62 -1.99 -1.41 -2.78 -2.25c-0.84 -0.93 -1.63 -1.94 -1.63 -3.13c0 -2.78 1.19 -4.19 3.53 -4.19c1.81 0 3.8 0.79 6 2.3c-0.84 -1.15 -1.63 -2.12 -2.43 -2.91c-1.02 -1.02 -2.12 -1.94 -3.22 -2.87c-1.24 -1.02 -2.07 -1.77 -2.56 -2.34s-0.75 -1.15 -0.79 -1.72c3.31 -2.82 4.99 -5.52 4.99 -8.08c0 -1.19 -0.31 -2.12 -0.79 -3 z"/></g>',
    'rest:e': '<g transform="translate(-1.023 -15.817) scale(1.225)"><path d="M7 19.07c0.31 -1.5 1.46 -2.47 3.05 -2.65c1.28 0.13 1.9 0.4 2.34 1.28c0.18 0.35 0.31 0.66 0.44 0.97c0 0.93 -0.04 1.1 -0.49 1.54c-0.22 0.35 -0.79 0.62 -1.77 0.88l0.53 0.13l0.66 0.04c1.94 0 4.28 -1.15 5.38 -2.47c0.44 -0.49 0.79 -1.15 1.06 -1.85c0.31 -0.04 0.66 -0.09 0.97 -0.13l-6.18 18.71h-1.59l4.9 -14.56c-0.44 0.26 -1.19 0.53 -2.34 0.71l-2.3 0.35h-0.44l-0.88 -0.04c-0.04 0 -0.35 -0.13 -0.93 -0.26c-1.63 -0.4 -2.43 -1.24 -2.43 -2.65 z"/></g>',
    'rest:s': '<g transform="translate(-2.346 -22.645) scale(1.225)"><path d="M12.87 29.4c0 1.46 -0.93 2.21 -2.3 2.43c0.44 0.13 0.79 0.18 1.1 0.18c1.77 0 3.05 -1.06 3.97 -2.07l2.91 -8.69c-1.59 0.79 -2.82 1.1 -4.94 1.1c-1.02 0 -1.68 -0.13 -1.99 -0.35c-1.63 -0.31 -2.43 -1.19 -2.43 -2.6c0.35 -1.54 1.32 -2.38 3 -2.56c1.99 0.26 2.16 0.57 2.82 2.12c0 0.13 0.04 0.22 0.04 0.31c0 1.19 -1.1 2.03 -2.3 2.16c0.26 0.18 0.66 0.26 1.15 0.26c1.41 -0.09 2.74 -0.62 3.88 -1.28c1.41 -0.84 1.94 -1.59 2.6 -3.13l0.31 -0.04l0.44 -0.09h0.18c-3.18 9.71 -6.31 19.38 -9.49 29.09h-1.63l4.77 -14.3c-0.88 0.57 -2.25 0.88 -3.62 0.88c-0.93 0 -1.54 -0.18 -1.9 -0.44c-1.63 -0.26 -2.43 -1.15 -2.43 -2.56c0.35 -1.54 1.37 -2.47 3 -2.65c1.9 0.35 2.12 0.57 2.82 2.25 z"/></g>',
    'rest:f': '<g transform="translate(-4.371 -15.964) scale(1.225)"><path d="M10.05 26.88c1.94 0.4 2.16 0.44 2.78 2.21c0 0.62 -0.04 1.06 -0.18 1.28c-0.31 0.49 -1.02 0.88 -2.07 1.15c0.26 0.13 0.66 0.18 1.1 0.18c0.79 0 1.72 -0.31 2.69 -0.97c0.79 -0.53 1.32 -1.15 1.32 -1.15l2.69 -8.25c-0.97 0.53 -2.12 0.93 -3.58 0.93c-0.79 0 -1.5 -0.13 -2.03 -0.4c-1.59 -0.4 -2.38 -1.28 -2.38 -2.69c0.35 -1.5 1.37 -2.56 3 -2.56c1.5 0 2.78 1.06 2.78 2.52c0 0.49 -0.18 0.93 -0.44 1.32c-0.18 0.22 -0.71 0.53 -1.72 0.79c0.35 0.13 0.71 0.22 1.06 0.22c1.54 0 3.13 -1.1 3.88 -1.99l2.91 -8.74c-0.53 0.49 -1.46 0.53 -2.43 0.75c-0.79 0.18 -1.28 0.35 -1.54 0.35h-0.66l-1.24 -0.09c-0.44 -0.04 -0.75 -0.13 -1.02 -0.26c-1.63 -0.31 -2.47 -1.15 -2.47 -2.6c0.4 -1.46 1.46 -2.6 3.18 -2.6c1.46 0 2.34 0.93 2.69 2.16c0 1.63 -0.75 2.07 -2.25 2.43c0.22 0.18 0.57 0.26 1.06 0.26c0.62 0 1.28 -0.13 1.99 -0.35c2.07 -0.66 3.93 -1.9 4.46 -4.06l0.79 -0.09l0.18 0.04l-12.71 39.24h-1.63l4.68 -14.04c-0.75 0.44 -1.9 0.66 -3.18 0.66c-0.97 0 -1.77 -0.13 -2.3 -0.4c-1.54 -0.35 -2.43 -1.02 -2.43 -2.69c0.35 -1.54 1.37 -2.38 3 -2.56 z"/></g>',
    // Navigation symbols use Bravura outlines and conventional ending brackets.
    // Los tres comparten la misma linea fina en x=15 (y la gruesa de las repeticiones junto a ella), para que apilados se lean como una sola barra.
    'nav:dc': '<text x="15" y="21" text-anchor="middle" font-size="13" font-family="serif" font-weight="700">D.C.</text>',
    'nav:ds': '<text x="15" y="21" text-anchor="middle" font-size="13" font-family="serif" font-weight="700">D.S.</text>',
    'nav:segno': '<path transform="translate(5 29) scale(.049 -.049)" d="M108 474c-22 0 -38 -30 -38 -56c0 -54 73 -85 140 -116l138 205h41l-146 -221c41 -21 73 -44 96 -67c28 -29 42 -62 42 -97c0 -68 -54 -122 -124 -122c-40 0 -76 33 -76 73c0 22 21 38 43 38c23 0 34 -17 39 -38c6 -23 16 -34 31 -34c27 0 42 23 42 54c0 13 -3 23 -8 32c-9 17 -33 36 -72 57l-60 30l-134 -208h-40l141 223c-49 23 -85 50 -109 80c-21 27 -32 55 -32 84c0 47 25 80 54 102c17 13 37 20 58 20c46 0 91 -32 91 -77c0 -22 -23 -36 -45 -36c-19 0 -30 8 -35 25l-7 23c-5 17 -15 26 -30 26zM75 192c0 -21 -16 -38 -36 -38c-23 0 -39 13 -39 35c0 21 15 39 36 39c22 0 39 -15 39 -36zM337 322c0 24 16 38 37 38c23 0 37 -19 37 -37c0 -23 -17 -37 -37 -37c-23 0 -37 17 -37 36z"/>',
    'nav:first': '<path d="M4 25V7h23" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="8" y="22" font-size="14" font-family="serif">1.</text>',
    'nav:second': '<path d="M4 25V7h23" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="8" y="22" font-size="14" font-family="serif">2.</text>',
    'bar:double': '<path d="M10 4v24M15 4v24" stroke="currentColor" stroke-width="1.6"/>',
    'bar:start': '<path d="M10 4v24" stroke="currentColor" stroke-width="3.5"/><path d="M15 4v24" stroke="currentColor" stroke-width="1.6"/><circle cx="21" cy="12" r="1.8"/><circle cx="21" cy="20" r="1.8"/>',
    'bar:end': '<path d="M15 4v24" stroke="currentColor" stroke-width="1.6"/><path d="M20 4v24" stroke="currentColor" stroke-width="3.5"/><circle cx="9" cy="12" r="1.8"/><circle cx="9" cy="20" r="1.8"/>',
    barre: '<text x="3" y="18" font-size="16" font-weight="700" font-family="serif">C</text><path d="M3 24h24" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.500" fill="none"/>',
    dead: '<path d="M8.500 19.500l11 11M19.500 19.500l-11 11" stroke="currentColor" stroke-width="2.200" fill="none"/><path d="M20.3 22.8V-12.3" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    dot: '<circle cx="15" cy="15" r="3.200"/>',
    'acc:#': '<path d="M11 6v20M18 4v20M7.500 12.500l14-3.500M7.500 21l14-3.500" stroke="currentColor" stroke-width="1.800" fill="none"/>',
    'acc:b': '<path d="M10 4v22c4-2 8-5 8-8.500 0-2.500-2-3.500-4-3.500-1.500 0-3 .800-4 2" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
    'acc:n': '<path d="M10 5v16l10-3.500M20 27V11L10 14.500" stroke="currentColor" stroke-width="1.800" fill="none" stroke-linejoin="round"/>',
  };

  function glyphKey(item) {
    if (item.kind === 'navigation') return 'nav:' + item.mark;
    if (item.kind === 'bar') return 'bar:' + item.bar;
    if (item.kind === 'barre') return 'barre';
    if (item.kind === 'note' || item.kind === 'rest') return item.kind + ':' + item.d;
    if (item.kind === 'dead') return 'dead';
    return item.kind === 'dot' ? 'dot' : 'acc:' + item.acc;
  }

  function glyphFor(item) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    // Las banderas superan x=30 y la fusa sube por encima de y=-16.
    const tall = (item.kind === 'note' && item.d !== 'w') || item.kind === 'dead';
    // Los silencios usan la escala de la partitura; la fusa necesita espacio vertical extra.
    const rest = item.kind === 'rest';
    svg.setAttribute('viewBox', tall ? '0 -24 36 56' : rest ? '0 -12 30 56' : '0 0 30 32');
    svg.setAttribute('width', tall ? '36' : '30');
    svg.setAttribute('height', tall ? '56' : rest ? '56' : '32');
    if (tall) svg.classList.add('score-note-glyph');
    if (rest && ['f', 's', 'e'].includes(item.d)) svg.classList.add('score-small-rest-glyph');
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
    { kind: 'dead', key: t.shortcuts.dead, label: t.dead },
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
    { kind: 'barre', label: t.barre },
    { kind: 'bar', bar: 'start', label: t.barRepeatStart },
    { kind: 'bar', bar: 'end', label: t.barRepeatEnd },
    { kind: 'bar', bar: 'double', label: t.barDouble },
    ...['dc', 'ds', 'segno', 'first', 'second'].map((mark) => ({ kind: 'navigation', mark, label: t['nav' + mark] })),
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
    button.className = 'score-palette-item score-palette-tool tooltip';
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
    if (item.kind === 'navigation') {
      button.dataset.navigation = item.mark;
      button.addEventListener('click', (event) => { if (event.detail === 0) activateTool(item); });
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
    (item.kind === 'bar' || item.kind === 'barre' || item.kind === 'navigation' ? barlines : palette).appendChild(button);
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
  barlines.prepend(tabToggle);

  // ---- renglones, descargas ----------------------------------------------

  addRow.innerHTML = lucide('plus');
  removeRow.innerHTML = lucide('minus');
  document.querySelectorAll('[data-icon]').forEach((node) => { node.insertAdjacentHTML('afterbegin', lucide(node.dataset.icon)); });
  document.getElementById('scoreNewTab').addEventListener('click', newTab);
  renderTabs();

  document.getElementById('scoreClear').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const isOnly = docs.length === 1;
    const confirmed = await window.ScoreConfirm.ask({
      title: t.clearTitle, description: isOnly ? t.clearDescription : t.clearDescriptionTab, confirm: t.clearConfirm, cancel: t.clearCancel,
    });
    if (confirmed && isOnly) {
      // La unica pestana no se quita: vuelve a una partitura nueva, sin notas, titulo ni autor.
      change(() => {
        selected = null;
        group = [];
        score = Object.assign(M.emptyScore(), { title: defaultTitle });
      });
      renderTabs();
    } else if (confirmed) {
      docs.splice(active, 1);
      histories.splice(active, 1);
      active = Math.max(active - 1, 0);
      score = docs[active];
      history = histories[active];
      selected = null;
      selectedNavigation = [];
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

  function downloadFilename(exportScore, extension) {
    const filenameTitle = exportScore.title.trim() || 'partitura';
    const filenameAuthor = (exportScore.author || '').trim();
    return filenameTitle + (filenameAuthor ? ' - ' + filenameAuthor : '') + '.' + extension;
  }

  document.getElementById('scoreDownloadXml').addEventListener('click', () => {
    download(new Blob([M.toMusicXml(score)], { type: 'application/vnd.recordare.musicxml+xml' }), downloadFilename(score, 'musicxml'));
  });

  // Verovio numera el primer compas de cada renglon; en una partitura de uso personal sobran.
  function withoutMeasureNumbers(markup) {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    doc.querySelectorAll('g.mNum').forEach((node) => node.remove());
    return new XMLSerializer().serializeToString(doc);
  }

  // Draw TAB in the export SVG, using the PDF's own note positions (not the
  // responsive editor geometry). The extra layout spacing keeps it on its page.
  function pdfPageSvg(markup, exportScore, columns) {
    if (!exportScore.showTabs) return withoutMeasureNumbers(markup);
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden';
    host.innerHTML = markup;
    document.body.appendChild(host);
    try {
      const svg = host.querySelector('svg');
      svg.querySelectorAll('g.mNum').forEach((node) => node.remove());
      const ns = 'http://www.w3.org/2000/svg';
      const attacks = M.attacks(exportScore);
      svg.querySelectorAll('g.system').forEach((system) => {
        const measures = [...system.querySelectorAll('g.measure')];
        const first = measures[0]?.querySelector('g.staff > path');
        const last = measures[measures.length - 1]?.querySelector('g.staff > path');
        if (!first || !last) return;
        const staffLines = [...measures[0].querySelectorAll('g.staff > path')].slice(0, 5);
        const top = staffLines[0].getBBox().y;
        const bottom = staffLines[4].getBBox().y;
        const space = (bottom - top) / 4;
        const left = first.getBBox().x;
        const right = last.getBBox().x + last.getBBox().width;
        const y = bottom + space * 3.5;
        const step = space * 2.5;
        const font = space * 2;
        const group = document.createElementNS(ns, 'g');
        group.setAttribute('class', 'pdf-tab');
        function add(tag, attrs, text) {
          const node = document.createElementNS(ns, tag);
          Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
          if (text !== undefined) node.textContent = text;
          group.appendChild(node);
        }
        for (let string = 0; string < 6; string += 1) {
          add('line', { x1: left, x2: right, y1: y + step * string, y2: y + step * string, stroke: '#000', 'stroke-width': 12 });
        }
        add('line', { x1: left, x2: left, y1: top, y2: y + 5 * step, stroke: '#000', 'stroke-width': 18 });
        measures.forEach((measure) => {
          const line = measure.querySelector('g.staff > path').getBBox();
          add('line', { x1: line.x + line.width, x2: line.x + line.width, y1: y, y2: y + step * 5, stroke: '#000', 'stroke-width': 18 });
          const mi = Number(measure.id.slice(1));
          attacks.filter(attack => attack.mi === mi).forEach((attack) => {
            const events = M.measures(exportScore)[mi];
            const onsets = M.onsets(events);
            const heads = events.flatMap((event, i) => {
              const node = measure.querySelector('[id="e' + mi + '-' + i + '"] .notehead');
              return !event.rest && onsets[i] === attack.at && node ? [node] : [];
            });
            if (!heads.length) return;
            const x = heads.reduce((sum, head) => {
              const box = head.getBBox();
              const point = svg.createSVGPoint();
              point.x = box.x + box.width / 2;
              return sum + point.matrixTransform(system.getCTM().inverse().multiply(head.getCTM())).x;
            }, 0) / heads.length;
            (columns[attack.key] || []).forEach((fret, string) => {
              if (!Number.isInteger(fret)) return;
              add('text', { x, y: y + step * string, 'font-family': 'Arial, sans-serif', 'font-size': font,
                'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#000', stroke: '#fff',
                'stroke-width': font * 0.18, 'paint-order': 'stroke' }, String(fret));
            });
          });
        });
        const clef = system.querySelector('g.clef');
        const clefBox = clef?.getBBox();
        const clefX = clefBox ? clefBox.x + clefBox.width / 2 : left + space;
        'TAB'.split('').forEach((letter, i) => add('text', { x: clefX, y: y + step * (1.5 + i),
          'font-family': 'Arial, sans-serif', 'font-size': font, 'font-weight': 'bold',
          'text-anchor': 'middle', 'dominant-baseline': 'central' }, letter));
        system.appendChild(group);
      });
      return new XMLSerializer().serializeToString(svg);
    } finally {
      host.remove();
    }
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
      const exportScore = JSON.parse(JSON.stringify(score));
      const attacks = M.attacks(exportScore);
      const fingered = window.ScoreFingering.assign(attacks.map(attack => attack.midis));
      const columns = Object.assign(Object.fromEntries(attacks.map((attack, i) =>
        [attack.key, window.ScoreFingering.toColumn(fingered[i])])), exportScore.tabs);
      const pdfWidth = 2400;
      const pdfToolkit = newToolkit();
      pdfToolkit.setOptions({
        scale: SCALE,
        pageWidth: pdfWidth,
        pageHeight: Math.round(pdfWidth * 297 / 210),
        adjustPageHeight: false,
        breaks: exportScore.showTabs ? 'line' : 'encoded',
        header: 'none',
        footer: 'none',
        svgViewBox: true,
        pageMarginLeft: 100,
        pageMarginRight: 100,
        pageMarginTop: exportScore.title || exportScore.author ? 230 : 150,
        pageMarginBottom: exportScore.showTabs ? 450 : 150,
        ...(exportScore.showTabs ? { spacingSystem: 48 } : {}),
        justifyVertically: false,
        minLastJustification: 0,
        mnumInterval: 0,
      });
      pdfToolkit.loadData(M.toMusicXml(exportScore));
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      for (let page = 1; page <= pdfToolkit.getPageCount(); page += 1) {
        const image = await rasterize(pdfPageSvg(pdfToolkit.renderToSVG(page), exportScore, columns), 1654, 2339);
        if (page > 1) pdf.addPage();
        pdf.addImage(image, 'JPEG', 0, 0, 210, 297);
        if (page === 1 && exportScore.author) {
          pdf.setFont('times', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(120);
          pdf.text(exportScore.author, 201.25, 10, { align: 'right' });
          pdf.setTextColor(0);
        }
        if (page === 1 && exportScore.title) {
          pdf.setFont('times', 'bold');
          pdf.setFontSize(18);
          pdf.setFontSize(Math.min(18, 18 * 192 / pdf.getTextWidth(exportScore.title)));
          pdf.text(exportScore.title, 8.75, 15);
        }
      }
      pdf.save(downloadFilename(exportScore, 'pdf'));
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

  // Consola del navegador: `voces()` lista las figuras de cada compas, por voz.
  window.voces = () => console.log(M.voicesText(score));

  // Para la consola: descarta las voces guardadas de la partitura activa y las recalcula (la 1 es la aguda; si salen mas de 2 las une y acomoda). Se puede deshacer.
  function fix() {
    const before = JSON.stringify(score.rows);
    change(() => { M.measures(score).forEach((measure, mi) => { M.mergeVoices(measure, M.capacity(score, mi)); }); });
    return before !== JSON.stringify(score.rows);
  }

  window.scoreEditor = { get score() { return score; }, render, fix, get ghostOffset() { return ghostOffset; }, set ghostOffset(value) { ghostOffset = value; } };
})();
