'use strict';
const collection = document.querySelector('#collection');
const exercises = document.querySelector('#exercises');
const status = document.querySelector('#status');
const dialog = document.querySelector('#note-dialog');
const form = document.querySelector('#note-form');
let currentSet;
let selected;
let opener;
let models = [];

async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación');
  return body;
}

function openNote(model, note, element) {
  selected = { model, note };
  opener = element;
  document.querySelector('#note-context').textContent = `Ejercicio ${model.number} · Compás ${note.bar} · Voz ${note.voice}`;
  document.querySelector('#string').value = note.string;
  document.querySelector('#fret').value = note.fret;
  document.querySelector('#note-error').textContent = '';
  dialog.showModal();
  document.querySelector('#fret').focus();
  document.querySelector('#fret').select();
}

function wireScore(card, model) {
  const svg = card.querySelector('.score svg');
  model.notes.forEach(note => {
    const element = svg.querySelector(`[data-id="t${note.key}"]`);
    if (!element) return;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `Compás ${note.bar}, ${note.voice}, cuerda ${note.string}, traste ${note.fret}. Editar nota`);
    const box = element.getBBox();
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hit.setAttribute('class', 'note-hit');
    for (const [name, value] of Object.entries({ x: box.x - 40, y: box.y - 35, width: box.width + 80, height: box.height + 70 })) hit.setAttribute(name, value);
    element.prepend(hit);
    element.addEventListener('click', () => openNote(model, note, element));
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openNote(model, note, element);
      }
    });
  });
}

function makeCard(model) {
  const card = document.createElement('article');
  card.className = 'exercise';
  card.dataset.number = model.number;
  const head = document.createElement('div');
  head.className = 'card-header';
  const text = document.createElement('div');
  const number = document.createElement('div');
  number.className = 'eyebrow';
  number.textContent = `EJERCICIO ${String(model.number).padStart(2, '0')} / 10 · ${model.meter}`;
  const title = document.createElement('h2');
  title.textContent = model.title;
  const objective = document.createElement('p');
  objective.textContent = model.objective;
  text.append(number, title, objective);
  const download = document.createElement('a');
  download.className = 'download';
  download.textContent = 'Descargar MusicXML';
  download.href = `/api/musicxml/${currentSet}/${model.number}`;
  download.download = `${currentSet}-${String(model.number).padStart(2, '0')}-editado.musicxml`;
  head.append(text, download);
  const score = document.createElement('div');
  score.className = 'score';
  score.innerHTML = model.svg;
  card.append(head, score);
  return card;
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
    models.forEach(model => wireScore(exercises.querySelector(`[data-number="${model.number}"]`), model));
    status.textContent = '10 ejercicios · Tocá una cifra de la TAB para editar';
  } catch (error) {
    if (currentSet) collection.value = currentSet;
    status.textContent = error.message;
  } finally {
    collection.disabled = false;
    exercises.setAttribute('aria-busy', 'false');
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const controls = [...form.querySelectorAll('button,input,select')];
  controls.forEach(control => { control.disabled = true; });
  document.querySelector('#note-error').textContent = '';
  try {
    const { model, note } = selected;
    const updated = await request('/api/edit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set: currentSet, exercise: model.number, key: note.key,
        string: Number(document.querySelector('#string').value), fret: Number(document.querySelector('#fret').value) }),
    });
    const oldCard = exercises.querySelector(`[data-number="${model.number}"]`);
    const card = makeCard(updated);
    oldCard.replaceWith(card);
    wireScore(card, updated);
    models = models.map(item => item.number === updated.number ? updated : item);
    opener = card.querySelector(`[data-id="t${note.key}"]`);
    dialog.close();
    status.textContent = 'Nota guardada · Ritmo y posiciones conservados';
  } catch (error) {
    document.querySelector('#note-error').textContent = error.message;
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
});
document.querySelector('#cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => { if (form.querySelector('button').disabled) event.preventDefault(); });
dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); });
collection.addEventListener('change', loadSet);
(async () => {
  try {
    const sets = await request('/api/sets');
    collection.replaceChildren(...sets.map(set => new Option(set.label, set.id)));
    if (!sets.length) throw new Error('No se encontraron colecciones en el laboratorio');
    await loadSet();
  } catch (error) {
    status.textContent = error.message;
    exercises.setAttribute('aria-busy', 'false');
  }
})();
