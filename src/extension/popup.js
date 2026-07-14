/* popup.js — Thin adapter between chord-search and the DOM/svguitar.
   Uses chrome.i18n for all user-visible strings (falls back to English). */

(function () {
  'use strict';

  // chrome.i18n is available in extension context; fall back to English in tests.
  function i18n(key, fallback) {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
    return fallback;
  }

  // Apply i18n strings to static DOM elements.
  document.getElementById('pinned-header-label').textContent = i18n('pinnedHeader', 'Pinned chords');
  document.getElementById('pinned-clear').textContent = i18n('clearPinned', 'Clear');
  document.title = i18n('appName', 'Guitar Chords');

  const input = document.getElementById('q');
  const results = document.getElementById('results');
  const resultsShell = document.getElementById('results-shell');
  const pinned = document.getElementById('pinned');
  const pinnedShell = document.getElementById('pinned-shell');
  const pinnedClear = document.getElementById('pinned-clear');
  const notationAmerican = document.getElementById('notation-american');
  const notationSpanish = document.getElementById('notation-spanish');
  const { matchChords } = window.ChordSearch;
  const MAX_POPUP_HEIGHT = 600;
  const NOTATION_STORAGE_KEY = 'chordNotation';
  const PINNED_STORAGE_KEY = 'pinnedChords';
  const SEARCH_EXAMPLE_CHORDS = ['Cmaj7', 'Am7', 'D/F#'];

  function loadPinned() {
    try {
      const stored = window.localStorage.getItem(PINNED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function savePinned() {
    try {
      window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedChordNames));
    } catch (e) {
      // localStorage puede no estar disponible; ignorar.
    }
  }

  const pinnedChordNames = loadPinned();

  function loadNotation() {
    try {
      return window.localStorage.getItem(NOTATION_STORAGE_KEY) === 'es' ? 'es' : 'en';
    } catch (e) {
      return 'en';
    }
  }

  function saveNotation(notation) {
    try {
      window.localStorage.setItem(NOTATION_STORAGE_KEY, notation);
    } catch (e) {
      // localStorage puede no estar disponible; ignorar.
    }
  }

  let notation = loadNotation();

  function searchPlaceholder() {
    const examples = SEARCH_EXAMPLE_CHORDS.map((chord) =>
      notation === 'es' && window.NoteNames ? window.NoteNames.toSpanishName(chord) : chord
    );
    return i18n('searchPlaceholderPrefix', 'Type') + ' ' + examples.join(', ') + '…';
  }
  input.placeholder = searchPlaceholder();

  function displayName(chord) {
    if (notation === 'es' && window.NoteNames) return window.NoteNames.toSpanishName(chord.name);
    return chord.name;
  }

  function displayNotes(chord) {
    if (notation === 'es' && window.NoteNames) return window.NoteNames.toSpanishNotes(chord.notes || '');
    return chord.notes || '';
  }

  notationAmerican.title = i18n('notationAmerican', 'American notation (C D E)');
  notationAmerican.setAttribute('aria-label', notationAmerican.title);
  notationSpanish.title = i18n('notationSpanish', 'Spanish notation (Do Re Mi)');
  notationSpanish.setAttribute('aria-label', notationSpanish.title);

  function syncNotationToggle() {
    notationAmerican.setAttribute('aria-pressed', String(notation !== 'es'));
    notationSpanish.setAttribute('aria-pressed', String(notation === 'es'));
  }

  function drawDiagram(target, chord) {
    try {
      window.ChordDiagram.render(target, chord, 'finder');
    } catch (err) {
      target.innerHTML = '<small style="color:#999">(error)</small>';
      console.error('svguitar error for', chord.name, err);
    }
  }

  function isPinned(chord) {
    return pinnedChordNames.indexOf(chord.name) !== -1;
  }

  function pinChord(chord) {
    if (isPinned(chord)) return;
    pinnedChordNames.push(chord.name);
    savePinned();
    render();
  }

  function unpinChord(chordName) {
    const index = pinnedChordNames.indexOf(chordName);
    if (index === -1) return;
    pinnedChordNames.splice(index, 1);
    savePinned();
    render();
  }

  function clearPinned() {
    pinnedChordNames.length = 0;
    savePinned();
    render();
  }

  pinnedClear.addEventListener('click', clearPinned);

  function getPinnedChords() {
    return pinnedChordNames
      .map((name) => window.CHORDS.find((chord) => chord.name === name))
      .filter(Boolean);
  }

  function buildCard(chord) {
    const card = document.createElement('div');
    card.className = 'card';

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'pin-button';
    pin.setAttribute('aria-label', i18n('pinAriaLabel', 'Pin ' + chord.name).replace('$CHORD$', chord.name));
    pin.title = i18n('pinAriaLabel', 'Pin ' + chord.name).replace('$CHORD$', chord.name);
    pin.innerHTML = [
      '<svg viewBox="0 0 24 24" aria-hidden="true">',
      '<path d="M9 3.5h6"/><path d="M10 3.5v5.2l-2.8 3.1v0.9h9.6v-0.9L14 8.7V3.5"/><path d="M12 12.7v7.8"/>',
      '</svg>',
    ].join('');
    if (isPinned(chord)) {
      pin.disabled = true;
      pin.hidden = true;
    } else {
      pin.addEventListener('click', () => pinChord(chord));
    }
    card.appendChild(pin);

    const diagram = document.createElement('div');
    diagram.className = 'diagram';
    card.appendChild(diagram);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = displayName(chord);
    card.appendChild(name);

    const notes = document.createElement('div');
    notes.className = 'notes';
    notes.textContent = displayNotes(chord);
    card.appendChild(notes);

    results.appendChild(card);
    drawDiagram(diagram, chord);
    return card;
  }

  function buildPinnedCard(chord) {
    const item = document.createElement('div');
    item.className = 'pinned-card';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'pinned-remove';
    const unpinLabel = i18n('unpinAriaLabel', 'Unpin ' + chord.name).replace('$CHORD$', chord.name);
    remove.setAttribute('aria-label', unpinLabel);
    remove.title = unpinLabel;
    remove.textContent = '×';
    remove.addEventListener('click', () => unpinChord(chord.name));
    item.appendChild(remove);

    const diagram = document.createElement('div');
    diagram.className = 'pinned-diagram';
    item.appendChild(diagram);

    const name = document.createElement('div');
    name.className = 'pinned-name';
    name.textContent = displayName(chord);
    item.appendChild(name);

    pinned.appendChild(item);
    drawDiagram(diagram, chord);
    return item;
  }

  function syncResultsFade() {
    const hasOverflow = results.scrollHeight > results.clientHeight + 1;
    const atBottom = results.scrollTop + results.clientHeight >= results.scrollHeight - 1;
    resultsShell.dataset.hasOverflow = String(hasOverflow);
    resultsShell.dataset.atBottom = String(atBottom);
  }

  function syncPopupHeight() {
    const bodyStyles = window.getComputedStyle(document.body);
    const bodyPaddingBottom = parseFloat(bodyStyles.paddingBottom) || 0;
    const shellTop = resultsShell.offsetTop;
    const available = Math.max(160, Math.floor(MAX_POPUP_HEIGHT - shellTop - bodyPaddingBottom));
    results.style.setProperty('--results-max-height', `${available}px`);
  }

  function renderPinned() {
    pinned.textContent = '';
    const chords = getPinnedChords();
    pinnedShell.hidden = chords.length === 0;
    chords.forEach(buildPinnedCard);
  }

  function renderResults() {
    results.textContent = '';
    const query = input.value;
    const matches = matchChords(query, window.CHORDS);

    if (query.trim() === '') return;

    if (matches.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.textContent = i18n('noResults', 'No matching chords.');
      results.appendChild(msg);
      return;
    }

    matches.forEach(buildCard);
  }

  function render() {
    renderPinned();
    renderResults();
    syncPopupHeight();
    syncResultsFade();
  }

  window.addEventListener('resize', () => { syncPopupHeight(); syncResultsFade(); });
  results.addEventListener('scroll', syncResultsFade, { passive: true });
  input.addEventListener('input', render);
  function selectNotation(next) {
    if (notation === next) return;
    notation = next;
    saveNotation(notation);
    syncNotationToggle();
    input.placeholder = searchPlaceholder();
    render();
  }
  notationAmerican.addEventListener('click', () => selectNotation('en'));
  notationSpanish.addEventListener('click', () => selectNotation('es'));
  syncNotationToggle();
  input.focus();
  render();
})();
