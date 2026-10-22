import '/ascii-tabs.js';

const collection = document.querySelector('#collection');
const exercises = document.querySelector('#exercises');
const status = document.querySelector('#status');
const track = document.querySelector('#track');
const TRACK_KEY = 'folklore.lab.track.v1';
const ns = 'http://www.w3.org/2000/svg';
let currentSet;
let models = [];
let viewId = 0;
let pending = 0;
let saving = Promise.resolve();
let sequence = [];
try { sequence = JSON.parse(localStorage.getItem(TRACK_KEY) || '[]'); } catch { /* Start with an empty track. */ }
if (!Array.isArray(sequence)) sequence = [];



function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación');
  return body;
}

function columns(notes) {
  return [...new Set(notes.map(note => note.at))].sort((a, b) => a - b).map(at => {
    const value = Array(6).fill(null);
    notes.filter(note => note.at === at && note.active !== false).forEach(note => { value[note.string - 1] = note.fret; });
    return { at, value };
  });
}

function plain(value) {
  return value?.fret === undefined ? value : value.fret;
}

function changesFor(notes, value) {
  const attacks = columns(notes);
  if (value.length !== attacks.length) throw new Error('Conservá las columnas del compás.');
  const changes = [];
  attacks.forEach((attack, index) => {
    const slots = notes.filter(note => note.at === attack.at);
    const remaining = value[index].map((fret, string) => ({ fret: plain(fret), string: string + 1 }))
      .filter(cell => cell.fret !== null);
    const assigned = new Set();
    // Keep identities for notes that remain on their string, then reuse the
    // other positions for moves/additions. Empty positions remain available.
    slots.filter(note => note.active !== false).forEach(note => {
      const matching = remaining.findIndex(cell => cell.string === note.string);
      if (matching < 0) return;
      changes.push({ key: note.key, active: true, ...remaining.splice(matching, 1)[0] });
      assigned.add(note.key);
    });
    slots.filter(note => !assigned.has(note.key)).forEach(note => {
      changes.push(remaining.length
        ? { key: note.key, active: true, ...remaining.shift() }
        : { key: note.key, active: false });
    });
  });
  return changes;
}

function scopeSvg(svg) {
  const ids = new Map([...svg.querySelectorAll('[id]'), svg].map(node => [node.id, `excerpt-${++viewId}-${node.id}`]));
  const references = value => value.replace(/#([\w-]+)/g, (match, id) => ids.has(id) ? '#' + ids.get(id) : match);
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      if (attr.name === 'id') node.setAttribute('id', ids.get(attr.value));
      else if (attr.value.includes('#')) node.setAttributeNS(attr.namespaceURI, attr.name, references(attr.value));
    }
    if (node.localName === 'style') node.textContent = references(node.textContent);
  }
}

// Each excerpt uses the original staff and notehead X coordinates. Only the
// SVG viewport changes: no engraving or rhythmic spacing is recalculated here.
function excerpts(model) {
  const host = element('div', 'svg-measurement');
  host.innerHTML = model.svg;
  document.body.append(host);
  const original = host.querySelector('svg');
  const layoutHost = element('div');
  layoutHost.innerHTML = model.layoutSvg;
  host.append(layoutHost);
  const layoutMeasures = [...layoutHost.querySelectorAll('g.measure')];
  const measures = [...original.querySelectorAll('g.measure')];
  const ranges = measures.map(measure => {
    const staff = measure.querySelector('g.staff');
    const line = staff.querySelector('path').getBBox();
    const boxes = [staff.getBBox(), ...[...measure.querySelectorAll('g.fermata:not([visibility="hidden"])')].map(mark => mark.getBBox())];
    return { top: Math.min(...boxes.map(box => box.y)) - line.y,
      bottom: Math.max(...boxes.map(box => box.y + box.height)) - line.y };
  });
  const top = Math.min(...ranges.map(range => range.top)) - 260;
  const bottom = Math.max(...ranges.map(range => range.bottom)) + 260;
  const result = measures.map((measure, index) => {
    const svg = original.cloneNode(false);
    [...original.children].filter(child => ['defs', 'style'].includes(child.localName))
      .forEach(child => svg.append(child.cloneNode(true)));
    const copy = measure.cloneNode(true);
    svg.append(copy);
    host.append(svg);
    const staves = [...copy.children].filter(child => child.classList.contains('staff'));
    staves.slice(1).forEach(staff => staff.remove());
    const staffLine = staves[0].querySelector('path').getBBox();
    const bars = [...copy.querySelectorAll('g.barLine')];
    bars.forEach(bar => bar.remove());
    bars.forEach(bar => copy.append(bar));
    const x = staffLine.x - 100;
    const width = staffLine.width + 200;
    const y = staffLine.y + top;
    const height = bottom - top;
    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    svg.setAttribute('overflow', 'hidden');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    const notes = model.notes.filter(note => note.bar === index + 1);
    const positions = columns(notes).map(attack => {
      const note = notes.find(item => item.at === attack.at);
      const head = layoutMeasures[index].querySelector(`[data-id="n${note.key}"] .notehead`).getBBox();
      return (head.x + head.width / 2 - x) * .05;
    });
    // Scope both glyph references and Verovio's staff-line CSS per excerpt.
    scopeSvg(svg);
    return { bar: index + 1, notes, svg: svg.outerHTML, staffTop: -top * .05, staffBottom: bottom * .05, layout: { width: width * .05, positions },
      number: model.number, title: model.title, meter: model.meter, set: currentSet,
      label: collection.selectedOptions[0]?.textContent || currentSet };
  });
  host.remove();
  return result;
}

function syncSaving() {
  collection.disabled = pending > 0;
  exercises.querySelectorAll('.measure-label button').forEach(button => { button.disabled = pending > 0; });
}

function clearDrop() {
  track.classList.remove('drag-over');
  track.querySelectorAll('.drop-before').forEach(node => node.classList.remove('drop-before'));
}

function enableDrag(notation, measure) {
  let drag;
  function targetAt(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    return target && track.contains(target) ? target : null;
  }
  notation.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (pending && !measure.closest('.track-item'))) return;
    event.preventDefault();
    notation.focus({ preventScroll: true });
    notation.setPointerCapture(event.pointerId);
    const item = measure.closest('.track-item');
    drag = { x: event.clientX, y: event.clientY, pointer: event.pointerId,
      id: item?.dataset.id, snapshot: measure.snapshot };
  });
  notation.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.preview && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    if (!drag.preview) {
      drag.preview = element('div', 'measure-drag-preview', `Compás ${drag.snapshot.bar}`);
      document.body.append(drag.preview);
    }
    drag.preview.style.transform = `translate(${event.clientX + 12}px, ${event.clientY + 12}px)`;
    clearDrop();
    const target = targetAt(event);
    if (target) {
      track.classList.add('drag-over');
      target.closest('.track-item')?.classList.add('drop-before');
      const box = track.getBoundingClientRect();
      if (event.clientX > box.right - 40) track.scrollLeft += 12;
      if (event.clientX < box.left + 40) track.scrollLeft -= 12;
    }
  });
  function finish(event, cancelled) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { preview, id, snapshot } = drag;
    drag = null;
    if (notation.hasPointerCapture(event.pointerId)) notation.releasePointerCapture(event.pointerId);
    preview?.remove();
    clearDrop();
    if (cancelled || !preview) return;
    const target = targetAt(event);
    if (!target) return;
    const beforeId = target.closest('.track-item')?.dataset.id;
    if (id) moveItem(id, beforeId);
    else insertSnapshot(snapshot, beforeId);
  }
  notation.addEventListener('pointerup', event => finish(event, false));
  notation.addEventListener('pointercancel', event => finish(event, true));
}

function makeMeasure(snapshot, editable) {
  const measure = element('div', 'measure-view');
  measure.dataset.bar = snapshot.bar;
  measure.style.width = snapshot.layout.width + 'px';
  const label = element('div', 'measure-label');
  label.append(element('span', '', `Compás ${snapshot.bar}`));
  if (editable) {
    const add = element('button', '', 'Agregar al track');
    add.type = 'button';
    add.addEventListener('click', () => insertSnapshot(measure.snapshot));
    label.append(add);
  }
  const notation = element('div', 'measure-notation');
  notation.innerHTML = snapshot.svg;
  scopeSvg(notation.querySelector('svg'));
  notation.draggable = false;
  notation.tabIndex = 0;
  notation.setAttribute('aria-label', editable ? `Arrastrar compás ${snapshot.bar} al track` : `Arrastrar para ordenar compás ${snapshot.bar}`);
  notation.setAttribute('role', 'group');
  enableDrag(notation, measure);
  notation.addEventListener('keydown', event => {
    if (editable && !pending && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      insertSnapshot(measure.snapshot);
    }
  });
  const tabs = document.createElement('ascii-tabs');
  for (const [name, value] of Object.entries({ lang: 'es', theme: 'light', labels: 'none', variant: 'flat' })) tabs.setAttribute(name, value);
  tabs.append(document.createElement('ascii-tabs-sheet'));
  tabs.readonly = !editable;
  tabs.setDocument({ value: [columns(snapshot.notes).map(attack => attack.value)], columnLayout: [snapshot.layout] });
  measure.snapshot = snapshot;
  measure.append(label, notation, tabs);
  if (editable) {
    let timer;
    tabs.addEventListener('change', () => {
      if (timer !== null && timer !== undefined) { clearTimeout(timer); pending--; }
      pending++;
      syncSaving();
      status.textContent = 'Guardando…';
      const value = tabs.value[0];
      timer = setTimeout(() => {
        saving = saving.then(() => saveMeasure(measure, value)).finally(() => {
          pending--;
          syncSaving();
        });
        timer = null;
      }, 250);
    });
  }
  return measure;
}

async function saveMeasure(measure, value) {
  const snapshot = measure.snapshot;
  const tabs = measure.querySelector('ascii-tabs');
  measure.querySelector('.measure-error')?.remove();
  try {
    const changes = changesFor(snapshot.notes, value);
    const updated = await request('/api/edit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set: snapshot.set, exercise: snapshot.number, changes }),
    });
    const card = measure.closest('.exercise');
    const next = excerpts(updated);
    next.forEach(excerpt => {
      const target = card.querySelector(`.measure-view[data-bar="${excerpt.bar}"]`);
      target.snapshot = excerpt;
      target.querySelector('.measure-notation').innerHTML = excerpt.svg;
    });
    models = models.map(model => model.number === updated.number ? updated : model);
    status.textContent = 'Guardado · Ritmo y posiciones conservados';
  } catch (error) {
    tabs.value = [columns(snapshot.notes).map(attack => attack.value)];
    measure.append(element('p', 'measure-error', error.message));
    status.textContent = 'No se guardó el cambio';
  }
}

function makeCard(model) {
  const card = element('article', 'exercise');
  card.dataset.number = model.number;
  const head = element('div', 'card-header');
  const text = element('div');
  text.append(element('div', 'eyebrow', `EJERCICIO ${String(model.number).padStart(2, '0')} / 10 · ${model.meter}`),
    element('h2', '', model.title), element('p', '', model.objective));
  const download = element('a', 'download', 'Descargar MusicXML');
  download.href = `/api/musicxml/${currentSet}/${model.number}`;
  download.download = `${currentSet}-${String(model.number).padStart(2, '0')}-editado.musicxml`;
  head.append(text, download);
  const scroll = element('div', 'measure-scroll');
  excerpts(model).forEach((snapshot, index) => {
    if (index % 4 === 0) scroll.append(element('div', 'measure-row'));
    scroll.lastElementChild.append(makeMeasure(snapshot, true));
  });
  card.append(head, scroll);
  return card;
}

function saveTrack() {
  try { localStorage.setItem(TRACK_KEY, JSON.stringify(sequence)); }
  catch { status.textContent = 'El track sigue disponible en esta página, pero no se pudo guardar en el navegador.'; }
}

function insertSnapshot(snapshot, beforeId) {
  const item = { id: crypto.randomUUID(), snapshot: structuredClone(snapshot) };
  const before = sequence.findIndex(entry => entry.id === beforeId);
  sequence.splice(before < 0 ? sequence.length : before, 0, item);
  saveTrack();
  renderTrack();
  status.textContent = `Compás ${snapshot.bar} agregado al track`;
}

function moveItem(id, beforeId) {
  if (id === beforeId) return;
  const index = sequence.findIndex(item => item.id === id);
  if (index < 0) return;
  const [item] = sequence.splice(index, 1);
  const before = sequence.findIndex(entry => entry.id === beforeId);
  sequence.splice(before < 0 ? sequence.length : before, 0, item);
  saveTrack();
  renderTrack();
}

function renderTrack() {
  const top = Math.max(0, ...sequence.map(entry => entry.snapshot.staffTop));
  const bottom = Math.max(0, ...sequence.map(entry => entry.snapshot.staffBottom));
  track.replaceChildren(...sequence.map(entry => {
    const item = element('article', 'track-item');
    item.dataset.id = entry.id;
    item.setAttribute('role', 'listitem');
    item.append(element('span', 'track-source', `${entry.snapshot.label} · Ej. ${entry.snapshot.number} · ${entry.snapshot.meter}`));
    const measure = makeMeasure(entry.snapshot, false);
    const notation = measure.querySelector('.measure-notation');
    notation.style.paddingTop = (top - entry.snapshot.staffTop) + 'px';
    notation.style.paddingBottom = (bottom - entry.snapshot.staffBottom) + 'px';
    item.append(measure);
    const remove = element('button', 'track-remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Quitar compás');
    remove.title = 'Quitar compás';
    remove.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    remove.addEventListener('click', () => {
      sequence = sequence.filter(value => value.id !== entry.id);
      saveTrack();
      renderTrack();
    });
    item.append(remove);
    return item;
  }));
  document.querySelector('#track-count').textContent = `${sequence.length} ${sequence.length === 1 ? 'compás' : 'compases'}`;
}


async function loadSet() {
  const nextSet = collection.value;
  collection.disabled = true;
  exercises.setAttribute('aria-busy', 'true');
  status.textContent = 'Cargando los 10 ejercicios…';
  try {
    const nextModels = await request(`/api/set/${nextSet}`);
    currentSet = nextSet;
    models = nextModels;
    exercises.replaceChildren(...models.map(makeCard));
    status.textContent = 'Editá la TAB o arrastrá un compás al track';
  } catch (error) {
    if (currentSet) collection.value = currentSet;
    status.textContent = error.message;
  } finally {
    collection.disabled = false;
    exercises.setAttribute('aria-busy', 'false');
  }
}

collection.addEventListener('change', loadSet);
renderTrack();
try {
  const sets = await request('/api/sets');
  collection.replaceChildren(...sets.map(set => new Option(set.label, set.id)));
  if (!sets.length) throw new Error('No se encontraron colecciones en el laboratorio');
  await loadSet();
} catch (error) {
  status.textContent = error.message;
  exercises.setAttribute('aria-busy', 'false');
}
