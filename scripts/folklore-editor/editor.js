import '/ascii-tabs.js';

const collection = document.querySelector('#collection');
const exercises = document.querySelector('#exercises');
const status = document.querySelector('#status');
const track = document.querySelector('#track');
const TRACK_KEY = 'folklore.lab.track.v1';
const SIGNATURE_KEY = 'folklore.lab.signature.v1';
let trackSignature = null;
try { trackSignature = JSON.parse(localStorage.getItem(SIGNATURE_KEY) || 'null'); } catch { /* Recover from the first chunk. */ }
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

// Strip annotations before measuring so text does not reserve vertical space.
// Also apply this to persisted track snapshots created by earlier versions.
function stripScoreText(svg) {
  svg.querySelectorAll('text, foreignObject, g.dir, g.dynam, g.tempo, g.harm, g.verse, g.syl, g.mNum, g.reh, g.fing').forEach(node => node.remove());
}

// Keep the staff and the glyphs that describe notes and their rhythm.
// Apply on display as well, so previously saved chunks use the same format.
function stripTrackContext(svg) {
  const noteGroups = new Set(['staff', 'layer', 'beam', 'chord', 'note',
    'notehead', 'stem', 'flag', 'dots', 'accid', 'ledgerLines',
    'tuplet', 'tupletNum', 'tupletBracket']);
  svg.querySelectorAll('g.measure g').forEach(group => {
    if (![...group.classList].some(name => noteGroups.has(name))) group.remove();
  });
}

// The opening staff supplies the effective signature even when a later bar
// has no repeated clef, key signature or meter glyphs of its own.
function captureSignature(original) {
  const staff = original.querySelector('g.staff');
  const symbols = [...staff.querySelectorAll('g.clef, g.keySig, g.meterSig')];
  const boxes = symbols.map(node => node.getBBox()).filter(box => box.width > 0);
  if (!boxes.length) return null;
  const lines = [...staff.children].filter(node => node.localName === 'path');
  const line = lines[0].getBBox();
  const x = line.x - 100;
  const width = Math.max(...boxes.map(box => box.x + box.width)) - x + 180;
  const y = Math.min(line.y, ...boxes.map(box => box.y)) - 100;
  const bottom = Math.max(...lines.map(node => node.getBBox().y), ...boxes.map(box => box.y + box.height)) + 100;
  const svg = original.cloneNode(false);
  [...original.children].filter(node => ['defs', 'style'].includes(node.localName))
    .forEach(node => svg.append(node.cloneNode(true)));
  const copy = staff.cloneNode(false);
  lines.forEach(node => {
    const path = node.cloneNode(true);
    const lineY = node.getBBox().y;
    path.setAttribute('d', `M${x} ${lineY} L${x + width} ${lineY}`);
    copy.append(path);
  });
  symbols.forEach(node => copy.append(node.cloneNode(true)));
  svg.append(copy);
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${bottom - y}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return { svg: svg.outerHTML, width: width * .05,
    staffTop: (line.y - y) * .05, staffBottom: (bottom - line.y) * .05 };
}

function renderSignature(top) {
  document.querySelector('.track-signature')?.remove();
  if (!sequence.length || !trackSignature) return;
  const label = element('div', 'track-signature');
  label.setAttribute('role', 'img');
  label.setAttribute('aria-label', 'Clave, armadura y compás del track');
  label.style.width = trackSignature.width + 'px';
  label.style.paddingTop = (28 + top - trackSignature.staffTop) + 'px';
  label.innerHTML = trackSignature.svg;
  scopeSvg(label.querySelector('svg'));
  track.before(label);
}

// Each excerpt uses the original staff and notehead X coordinates. Only the
// SVG viewport changes: no engraving or rhythmic spacing is recalculated here.
function excerpts(model) {
  const host = element('div', 'svg-measurement');
  host.innerHTML = model.svg;
  document.body.append(host);
  const original = host.querySelector('svg');
  stripScoreText(original);
  const signature = captureSignature(original);
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
    return { bar: index + 1, notes, signature, svg: svg.outerHTML, staffTop: -top * .05, staffBottom: bottom * .05, layout: { width: width * .05, positions },
      number: model.number, title: model.title, meter: model.meter, set: currentSet,
      label: collection.selectedOptions[0]?.textContent || currentSet };
  });
  host.remove();
  return result;
}

function syncSaving() {
  collection.disabled = pending > 0;
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
  const notation = element('div', 'measure-notation');
  notation.innerHTML = snapshot.svg;
  stripScoreText(notation.querySelector('svg'));
  if (!editable) stripTrackContext(notation.querySelector('svg'));
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
  measure.append(notation, tabs);
  if (editable) {
    let timer;
    tabs.addEventListener('change', () => {
      if (timer !== null && timer !== undefined) { clearTimeout(timer); pending--; }
      pending++;
      syncSaving();
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
  } catch (error) {
    tabs.value = [columns(snapshot.notes).map(attack => attack.value)];
    measure.append(element('p', 'measure-error', error.message));
    status.textContent = 'No se guardó el cambio';
  }
}

function makeExercise(model) {
  const exercise = element('article', 'exercise');
  exercise.dataset.number = model.number;
  exercise.setAttribute('aria-label', `Ejercicio ${model.number}: ${model.title}`);
  const scroll = element('div', 'measure-scroll');
  excerpts(model).forEach((snapshot, index) => {
    if (index % 4 === 0) scroll.append(element('div', 'measure-row'));
    scroll.lastElementChild.append(makeMeasure(snapshot, true));
  });
  exercise.append(scroll);
  return exercise;
}

function saveTrack() {
  if (!sequence.length) trackSignature = null;
  try {
    localStorage.setItem(TRACK_KEY, JSON.stringify(sequence));
    if (trackSignature) localStorage.setItem(SIGNATURE_KEY, JSON.stringify(trackSignature));
    else localStorage.removeItem(SIGNATURE_KEY);
  }
  catch { status.textContent = 'El track sigue disponible en esta página, pero no se pudo guardar en el navegador.'; }
}

function insertSnapshot(snapshot, beforeId) {
  if (!sequence.length) trackSignature = structuredClone(snapshot.signature);
  const item = { id: crypto.randomUUID(), snapshot: structuredClone(snapshot) };
  const before = sequence.findIndex(entry => entry.id === beforeId);
  sequence.splice(before < 0 ? sequence.length : before, 0, item);
  saveTrack();
  renderTrack();
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
  const top = Math.max(trackSignature?.staffTop || 0, ...sequence.map(entry => entry.snapshot.staffTop));
  renderSignature(top);
  const bottom = Math.max(0, ...sequence.map(entry => entry.snapshot.staffBottom));
  track.replaceChildren(...sequence.map(entry => {
    const item = element('article', 'track-item');
    item.dataset.id = entry.id;
    item.setAttribute('role', 'listitem');
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
}


async function loadSet() {
  const nextSet = collection.value;
  collection.disabled = true;
  exercises.setAttribute('aria-busy', 'true');
  status.textContent = '';
  try {
    const nextModels = await request(`/api/set/${nextSet}`);
    currentSet = nextSet;
    models = nextModels;
    exercises.replaceChildren(...models.map(makeExercise));
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
  if (sequence.length && !trackSignature) {
    const first = sequence[0].snapshot;
    const sourceModels = first.set === currentSet ? models : await request(`/api/set/${first.set}`);
    const model = sourceModels.find(model => model.number === first.number);
    if (model && sequence[0]?.snapshot === first && !trackSignature) {
      trackSignature = excerpts(model)[0].signature;
      saveTrack();
      renderTrack();
    }
  }
} catch (error) {
  status.textContent = error.message;
  exercises.setAttribute('aria-busy', 'false');
}
