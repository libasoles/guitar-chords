/* chord-finder.js — Custom element <chord-finder>.
   Reads window.CHORD_FINDER_I18N for localized strings (injected by build).
   Falls back to Spanish if the object is absent. */

(function () {
  'use strict';

  var I18N = window.CHORD_FINDER_I18N || {};

  function t(key, fallback) {
    return I18N[key] !== undefined ? I18N[key] : fallback;
  }

  var FILTER_DEFS = [
    { filter: 'all',   i18n: 0 },
    { filter: 'major', i18n: 1 },
    { filter: 'minor', i18n: 2 },
    { filter: 'dom7',  i18n: 3 },
    { filter: 'm7',    i18n: 4 },
    { filter: 'maj7',  i18n: 5 },
    { filter: '6ta',   i18n: 6 },
    { filter: 'sus',   i18n: 7 },
    { filter: 'slash', i18n: 8 },
    { filter: 'otros', i18n: 9 },
  ];

  var DEFAULT_FILTER_LABELS = ['Todos', 'Mayores', 'Menores', 'Con 7ª (dom.)', 'Menor 7ª', 'Mayor 7ª', 'Con 6ª', 'Sus', 'Con bajo (/)', 'Otros'];

  function filterLabel(index) {
    var labels = t('cfFilters', DEFAULT_FILTER_LABELS);
    return labels[index] || DEFAULT_FILTER_LABELS[index];
  }

  function filterDisplayName(filter) {
    var match = FILTER_DEFS.find(function (item) { return item.filter === filter; });
    return match ? filterLabel(match.i18n) : filterLabel(0);
  }

  var ROOT_DEFS = [
    { root: 'all' },
    { root: 0 }, { root: 1 }, { root: 2 }, { root: 3 },
    { root: 4 }, { root: 5 }, { root: 6 }, { root: 7 },
    { root: 8 }, { root: 9 }, { root: 10 }, { root: 11 },
  ];

  var DEFAULT_ROOT_LABELS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];

  var ROOT_PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Extracts the root note (leading letter + optional accidental) from a chord
  // name and maps it to a pitch class 0-11, ignoring quality and slash bass.
  function rootPitchClass(name) {
    var m = /^([A-G])([♯♭]?)/.exec(String(name || ''));
    if (!m) return -1;
    var base = ROOT_PITCH_CLASS[m[1]];
    if (m[2] === '♯') base += 1;
    else if (m[2] === '♭') base -= 1;
    return ((base % 12) + 12) % 12;
  }

  function rootLabel(root) {
    var labels = t('cfRootLabels', DEFAULT_ROOT_LABELS);
    return labels[root] || DEFAULT_ROOT_LABELS[root];
  }

  function rootDisplayName(root) {
    return root === 'all' ? filterLabel(0) : rootLabel(root);
  }

  var STYLES = [
    ':host { display: block; }',
    '*, *::before, *::after { box-sizing: border-box; }',
    '',
    '.controls {',
    '  display: flex; flex-direction: column; gap: 0.75rem;',
    '  margin: 1rem 0 1.5rem; padding: 0.8rem 1rem;',
    '  background: #fff;',
    '  border: 1px solid var(--rule, #d8d2c4);',
    '  border-radius: 6px; position: sticky; top: 0; z-index: 10;',
    '}',
    '.controls-main {',
    '  display: flex; gap: 0.75rem; align-items: center;',
    '}',
    '.title-row {',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  gap: 0.75rem; margin-bottom: 0.75rem;',
    '}',
    '.title-row ::slotted(h1) { margin: 0; }',
    '.search {',
    '  flex: 1 1 auto; min-width: 0;',
    '  font-family: var(--mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);',
    '  font-size: 1rem; padding: 0.45rem 0.6rem;',
    '  border: 1px solid var(--rule, #d8d2c4); border-radius: 4px;',
    '  background: var(--paper, #fdfaf5);',
    '  color: var(--ink, #1a1a1a);',
    '}',
    '.search:focus {',
    '  outline: 2px solid var(--accent, #8b0000); outline-offset: -1px;',
    '  border-color: var(--accent, #8b0000);',
    '}',
    '.advanced-toggle {',
    '  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.55rem;',
    '  min-height: 2.5rem; padding: 0.45rem 0.8rem;',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.9rem; white-space: nowrap;',
    '  border: 1px solid var(--rule, #d8d2c4); border-radius: 999px;',
    '  background: var(--paper, #fdfaf5); color: var(--ink, #1a1a1a); cursor: pointer;',
    '}',
    '.advanced-toggle:hover { border-color: var(--ink-soft, #555); }',
    '.advanced-toggle:focus-visible {',
    '  outline: 2px solid var(--accent, #8b0000); outline-offset: 2px;',
    '}',
    '.advanced-toggle svg { width: 1rem; height: 1rem; stroke: currentColor; }',
    '.advanced-toggle-label { font-weight: 600; }',
    '.advanced-toggle-value { color: var(--ink-soft, #555); }',
    '.advanced-toggle[aria-expanded="true"] .advanced-toggle-value { color: var(--accent, #8b0000); }',
    '.notation-group {',
    '  flex: 0 0 auto; display: inline-flex;',
    '  border: 1px solid var(--rule, #d8d2c4); border-radius: 999px;',
    '  background: var(--paper, #fdfaf5); overflow: hidden;',
    '}',
    '.notation-option {',
    '  min-height: 1.9rem; padding: 0.3rem 0.65rem;',
    '  font-family: var(--mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);',
    '  font-size: 0.9rem; font-weight: 600;',
    '  border: none; background: transparent; color: var(--ink-soft, #555); cursor: pointer;',
    '}',
    '.notation-option:hover { color: var(--ink, #1a1a1a); }',
    '.notation-option:focus-visible {',
    '  outline: 2px solid var(--accent, #8b0000); outline-offset: -2px;',
    '}',
    '.notation-option[aria-pressed="true"] {',
    '  background: var(--ink, #1a1a1a); color: var(--paper, #fdfaf5);',
    '}',
    '.advanced-panel {',
    '  display: flex; flex-direction: column; gap: 0.6rem;',
    '  padding-top: 0.1rem;',
    '}',
    '.advanced-panel[hidden] { display: none; }',
    '.filter-group {',
    '  display: flex; flex-direction: column; gap: 0.35rem;',
    '}',
    '.filter-group-label {',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.72rem; font-weight: 600; text-transform: uppercase;',
    '  letter-spacing: 0.05em; color: var(--ink-soft, #555); margin: 0;',
    '}',
    '.filter-group-pills {',
    '  display: flex; flex-wrap: wrap; gap: 0.6rem;',
    '}',
    '.pill {',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.78rem; padding: 0.3rem 0.65rem;',
    '  background: var(--paper, #fdfaf5);',
    '  border: 1px solid var(--rule, #d8d2c4); border-radius: 999px;',
    '  cursor: pointer; color: var(--ink-soft, #555); user-select: none;',
    '}',
    '.pill[aria-pressed="true"] {',
    '  background: var(--ink, #1a1a1a); color: var(--paper, #fdfaf5);',
    '  border-color: var(--ink, #1a1a1a);',
    '}',
    '.filter-panel-header {',
    '  display: flex; justify-content: flex-end;',
    '}',
    '.clear-filters {',
    '  border: 0; background: transparent; padding: 0; cursor: pointer;',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.72rem; font-weight: 600; text-transform: uppercase;',
    '  letter-spacing: 0.05em; color: var(--ink-soft, #555);',
    '}',
    '.clear-filters:hover { color: var(--accent, #8b0000); }',
    '',
    '.grid {',
    '  display: grid;',
    '  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));',
    '  gap: 1rem;',
    '}',
    '.card {',
    '  background: #fff; border: 1px solid var(--rule, #d8d2c4);',
    '  border-radius: 6px; padding: 0.6rem 0.5rem 0.4rem; text-align: center;',
    '  display: flex; flex-direction: column; align-items: center;',
    '}',
    '.card.hidden { display: none; }',
    '.card.match { box-shadow: 0 0 0 2px var(--accent, #8b0000); }',
    '.card .name {',
    '  font-family: var(--mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);',
    '  font-weight: 600; font-size: 1.05rem; margin-top: 0.3rem;',
    '}',
    '.card .aka {',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.72rem; color: var(--ink-soft, #555); min-height: 1em;',
    '}',
    '.card .diagram {',
    '  width: 150px; height: 176px; margin: 0 auto;',
    '}',
    '.card .diagram svg { display: block; width: 100%; height: 100%; }',
    '',
    '.empty {',
    '  grid-column: 1 / -1; text-align: center;',
    '  color: var(--ink-soft, #555); padding: 2rem 1rem;',
    '}',
    '.error {',
    '  border: 1px solid var(--accent, #8b0000);',
    '  border-left: 3px solid var(--accent, #8b0000);',
    '  border-radius: 6px; padding: 1rem 1.2rem; margin: 1rem 0;',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  color: var(--ink, #1a1a1a); background: #fff;',
    '}',
    '.error strong { color: var(--accent, #8b0000); }',
    '',
    '.pinned-strip {',
    '  margin: 1rem 0 1.5rem; padding: 0.8rem 1rem;',
    '  background: var(--paper, #fdfaf5);',
    '  border: 1px solid var(--accent, #8b0000);',
    '  border-left: 3px solid var(--accent, #8b0000);',
    '  border-radius: 6px;',
    '}',
    '.pinned-strip[hidden] { display: none; }',
    '.pinned-title-row {',
    '  display: flex; align-items: baseline; justify-content: space-between;',
    '  margin: 0 0 0.6rem;',
    '}',
    '.pinned-title {',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.78rem; font-weight: 600; text-transform: uppercase;',
    '  letter-spacing: 0.05em; color: var(--accent, #8b0000);',
    '  margin: 0;',
    '}',
    '.pinned-clear {',
    '  border: 0; background: transparent; padding: 0; cursor: pointer;',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.72rem; font-weight: 600; text-transform: uppercase;',
    '  letter-spacing: 0.05em; color: var(--ink-soft, #555);',
    '}',
    '.pinned-clear:hover { color: var(--accent, #8b0000); }',
    '.pinned-list {',
    '  display: flex; flex-wrap: wrap; gap: 0.8rem;',
    '}',
    '.pinned-card {',
    '  position: relative; background: #fff;',
    '  border: 1px solid var(--rule, #d8d2c4); border-radius: 6px;',
    '  padding: 0.5rem 0.5rem 0.3rem; text-align: center;',
    '  display: flex; flex-direction: column; align-items: center;',
    '}',
    '.pinned-card .diagram { width: 110px; height: 130px; }',
    '.pinned-card .diagram svg { display: block; width: 100%; height: 100%; }',
    '.pinned-card .name {',
    '  font-family: var(--mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);',
    '  font-weight: 600; font-size: 0.95rem; margin-top: 0.2rem;',
    '}',
    '.pinned-remove {',
    '  position: absolute; top: -0.5rem; right: -0.5rem;',
    '  width: 1.4rem; height: 1.4rem; line-height: 1; padding: 0;',
    '  font-size: 1rem; cursor: pointer;',
    '  background: var(--accent, #8b0000); color: #fff;',
    '  border: none; border-radius: 999px;',
    '}',
    '.card .pin-button { display: none; }',
    ':host([pinnable]) .card .pin-button {',
    '  display: inline-block; align-self: flex-end;',
    '  margin: 0 0 -0.2rem; padding: 0.15rem 0.4rem;',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.7rem; cursor: pointer;',
    '  background: var(--paper, #fdfaf5); color: var(--ink-soft, #555);',
    '  border: 1px solid var(--rule, #d8d2c4); border-radius: 999px;',
    '}',
    ':host([pinnable]) .card .pin-button[aria-pressed="true"] {',
    '  background: var(--accent, #8b0000); color: #fff;',
    '  border-color: var(--accent, #8b0000);',
    '}',
    '@media (max-width: 700px) {',
    '  .controls-main { flex-direction: column; align-items: stretch; }',
    '  .advanced-toggle { justify-content: center; }',
    '}',
  ].join('\n');

  class ChordFinder extends HTMLElement {}

  ChordFinder.prototype.connectedCallback = function () {
    if (this._mounted) return;
    this._mounted = true;

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    var missing = this._missingDeps();
    if (missing.length) {
      this._renderError(missing);
      return;
    }

    this._activeFilter = 'all';
    this._activeRoot = 'all';
    this._cards = [];
    this._pinnedNames = this._loadPinned();
    this._notation = this._loadNotation();
    this._buildUI();
    this._renderCards();
    this._renderPinned();
    this._applyFilter();
    this._bindKeyboardShortcut();
  };

  ChordFinder.prototype.disconnectedCallback = function () {
    if (this._onKeydown) {
      document.removeEventListener('keydown', this._onKeydown);
      this._onKeydown = null;
    }
  };

  ChordFinder.prototype._missingDeps = function () {
    var missing = [];
    if (!Array.isArray(window.CHORDS)) missing.push('window.CHORDS (chords-db.js)');
    if (!window.ChordDiagram || typeof window.ChordDiagram.render !== 'function') {
      missing.push('window.ChordDiagram (chord-diagram.js)');
    }
    if (!window.ChordSearch || typeof window.ChordSearch.matchChords !== 'function') {
      missing.push('window.ChordSearch (chord-search.js)');
    }
    if (typeof window.svguitar === 'undefined') missing.push('svguitar');
    return missing;
  };

  var NOTATION_STORAGE_KEY = 'chordNotation';
  var PINNED_STORAGE_KEY = 'pinnedChords';

  ChordFinder.prototype._loadPinned = function () {
    try {
      var stored = window.localStorage.getItem(PINNED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  };

  ChordFinder.prototype._savePinned = function () {
    try {
      window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(this._pinnedNames));
    } catch (e) {
      // localStorage puede no estar disponible; ignorar.
    }
  };

  ChordFinder.prototype._loadNotation = function () {
    try {
      return window.localStorage.getItem(NOTATION_STORAGE_KEY) === 'es' ? 'es' : 'en';
    } catch (e) {
      return 'en';
    }
  };

  ChordFinder.prototype._saveNotation = function (notation) {
    try {
      window.localStorage.setItem(NOTATION_STORAGE_KEY, notation);
    } catch (e) {
      // localStorage puede no estar disponible (modo privado, etc.); ignorar.
    }
  };

  ChordFinder.prototype._displayName = function (chord) {
    if (this._notation === 'es' && window.NoteNames) return window.NoteNames.toSpanishName(chord.name);
    return chord.name;
  };

  ChordFinder.prototype._displayNotes = function (chord) {
    if (this._notation === 'es' && window.NoteNames) return window.NoteNames.toSpanishNotes(chord.notes || '');
    return chord.notes || '';
  };

  ChordFinder.prototype._renderError = function (missing) {
    var items = missing
      .map(function (m) { return '<li>' + m + '</li>'; })
      .join('');
    this.shadowRoot.innerHTML =
      '<style>' + STYLES + '</style>' +
      '<div class="error" role="alert">' +
      '<strong>Could not initialize the chord finder.</strong>' +
      '<p>Missing:</p><ul>' + items + '</ul>' +
      '</div>';
  };

  ChordFinder.prototype._buildUI = function () {
    var root = this.shadowRoot;
    root.innerHTML = '<style>' + STYLES + '</style>';

    var titleRow = document.createElement('div');
    titleRow.className = 'title-row';
    var titleSlot = document.createElement('slot');
    titleSlot.name = 'title';
    titleRow.appendChild(titleSlot);

    var controls = document.createElement('div');
    controls.className = 'controls';
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', t('cfToolbarAriaLabel', 'Filtros y búsqueda'));

    var mainRow = document.createElement('div');
    mainRow.className = 'controls-main';

    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'search';
    input.placeholder = 'Cmaj7, Am7, D/F#…';
    input.autocomplete = 'off';
    input.spellcheck = false;
    mainRow.appendChild(input);

    var notationGroup = document.createElement('div');
    notationGroup.className = 'notation-group';
    notationGroup.setAttribute('role', 'group');
    notationGroup.setAttribute('aria-label', t('cfNotationGroupLabel', 'Notación de acordes'));

    var self0 = this;
    var americanOption = document.createElement('button');
    americanOption.type = 'button';
    americanOption.className = 'notation-option';
    americanOption.textContent = 'C';
    americanOption.title = t('cfNotationAmerican', 'Notación americana (C D E)');
    americanOption.setAttribute('aria-label', americanOption.title);

    var spanishOption = document.createElement('button');
    spanishOption.type = 'button';
    spanishOption.className = 'notation-option';
    spanishOption.textContent = 'Do';
    spanishOption.title = t('cfNotationSpanish', 'Notación en español (Do Re Mi)');
    spanishOption.setAttribute('aria-label', spanishOption.title);

    function syncNotationToggle() {
      var isSpanish = self0._notation === 'es';
      americanOption.setAttribute('aria-pressed', String(!isSpanish));
      spanishOption.setAttribute('aria-pressed', String(isSpanish));
    }
    syncNotationToggle();

    function selectNotation(notation) {
      if (self0._notation === notation) return;
      self0._notation = notation;
      self0._saveNotation(notation);
      syncNotationToggle();
      self0._applyNotation();
    }
    americanOption.addEventListener('click', function () { selectNotation('en'); });
    spanishOption.addEventListener('click', function () { selectNotation('es'); });

    notationGroup.appendChild(americanOption);
    notationGroup.appendChild(spanishOption);
    titleRow.appendChild(notationGroup);

    var panelId = 'advanced-filters-' + Math.random().toString(36).slice(2, 9);
    var advancedToggle = document.createElement('button');
    advancedToggle.type = 'button';
    advancedToggle.className = 'advanced-toggle';
    advancedToggle.setAttribute('aria-expanded', 'false');
    advancedToggle.setAttribute('aria-controls', panelId);
    advancedToggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="21" y1="4" x2="14" y2="4"></line>' +
      '<line x1="10" y1="4" x2="3" y2="4"></line>' +
      '<line x1="21" y1="12" x2="12" y2="12"></line>' +
      '<line x1="8" y1="12" x2="3" y2="12"></line>' +
      '<line x1="21" y1="20" x2="16" y2="20"></line>' +
      '<line x1="12" y1="20" x2="3" y2="20"></line>' +
      '<line x1="14" y1="2" x2="14" y2="6"></line>' +
      '<line x1="8" y1="10" x2="8" y2="14"></line>' +
      '<line x1="16" y1="18" x2="16" y2="22"></line>' +
      '</svg>' +
      '<span class="advanced-toggle-label">' + t('cfAdvancedFiltersLabel', 'Filtros') + '</span>' +
      '<span class="advanced-toggle-value">' + filterDisplayName(this._activeFilter) + '</span>';
    mainRow.appendChild(advancedToggle);
    controls.appendChild(mainRow);

    var advancedPanel = document.createElement('div');
    advancedPanel.className = 'advanced-panel';
    advancedPanel.id = panelId;
    advancedPanel.hidden = true;

    var self = this;

    var panelHeader = document.createElement('div');
    panelHeader.className = 'filter-panel-header';
    var clearFiltersBtn = document.createElement('button');
    clearFiltersBtn.type = 'button';
    clearFiltersBtn.className = 'clear-filters';
    clearFiltersBtn.textContent = t('cfClearFilters', 'Limpiar filtros');
    clearFiltersBtn.addEventListener('click', function () {
      self._activeFilter = 'all';
      self._activeRoot = 'all';
      self._syncPillStates();
      self._syncAdvancedToggle();
      self._applyFilter();
    });
    panelHeader.appendChild(clearFiltersBtn);
    advancedPanel.appendChild(panelHeader);

    var typeGroup = document.createElement('div');
    typeGroup.className = 'filter-group';
    var typeLabel = document.createElement('p');
    typeLabel.className = 'filter-group-label';
    typeLabel.textContent = t('cfFilterCategoryType', 'Tipo');
    var typePills = document.createElement('div');
    typePills.className = 'filter-group-pills';
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typePills);

    this._pills = FILTER_DEFS.filter(function (f) { return f.filter !== 'all'; }).map(function (f) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill';
      pill.dataset.filter = f.filter;
      pill.textContent = filterLabel(f.i18n);
      pill.setAttribute('aria-pressed', 'false');
      pill.addEventListener('click', function () {
        self._activeFilter = f.filter;
        self._activeRoot = 'all';
        self._syncPillStates();
        self._syncAdvancedToggle();
        self._applyFilter();
      });
      typePills.appendChild(pill);
      return pill;
    });
    advancedPanel.appendChild(typeGroup);

    var keyGroup = document.createElement('div');
    keyGroup.className = 'filter-group';
    var keyLabel = document.createElement('p');
    keyLabel.className = 'filter-group-label';
    keyLabel.textContent = t('cfFilterCategoryKey', 'Tonalidad');
    var keyPills = document.createElement('div');
    keyPills.className = 'filter-group-pills';
    keyGroup.appendChild(keyLabel);
    keyGroup.appendChild(keyPills);

    this._rootPills = ROOT_DEFS.filter(function (r) { return r.root !== 'all'; }).map(function (r) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill';
      pill.dataset.root = String(r.root);
      pill.textContent = rootDisplayName(r.root);
      pill.setAttribute('aria-pressed', 'false');
      pill.addEventListener('click', function () {
        self._activeRoot = r.root;
        self._activeFilter = 'all';
        self._syncPillStates();
        self._syncAdvancedToggle();
        self._applyFilter();
      });
      keyPills.appendChild(pill);
      return pill;
    });
    advancedPanel.appendChild(keyGroup);

    controls.appendChild(advancedPanel);
    this._syncPillStates();

    var strip = document.createElement('div');
    strip.className = 'pinned-strip';
    strip.hidden = true;
    var stripTitleRow = document.createElement('div');
    stripTitleRow.className = 'pinned-title-row';
    var stripTitle = document.createElement('p');
    stripTitle.className = 'pinned-title';
    stripTitle.textContent = t('cfPinnedTitle', 'Acordes pineados');
    var stripClear = document.createElement('button');
    stripClear.type = 'button';
    stripClear.className = 'pinned-clear';
    stripClear.textContent = t('cfClearPinned', 'Limpiar');
    stripClear.addEventListener('click', function () { self._clearPinned(); });
    stripTitleRow.appendChild(stripTitle);
    stripTitleRow.appendChild(stripClear);
    var stripList = document.createElement('div');
    stripList.className = 'pinned-list';
    strip.appendChild(stripTitleRow);
    strip.appendChild(stripList);

    var grid = document.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('aria-live', 'polite');

    root.appendChild(titleRow);
    root.appendChild(controls);
    root.appendChild(strip);
    root.appendChild(grid);

    this._input = input;
    this._grid = grid;
    this._strip = strip;
    this._stripList = stripList;
    this._advancedPanel = advancedPanel;
    this._advancedToggle = advancedToggle;

    input.addEventListener('input', function () { self._applyFilter(); });
    advancedToggle.addEventListener('click', function () {
      var isOpen = advancedToggle.getAttribute('aria-expanded') === 'true';
      advancedToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      advancedPanel.hidden = isOpen;
    });
  };

  ChordFinder.prototype._syncPillStates = function () {
    var self = this;
    if (this._pills) {
      this._pills.forEach(function (p) {
        p.setAttribute('aria-pressed', p.dataset.filter === self._activeFilter ? 'true' : 'false');
      });
    }
    if (this._rootPills) {
      this._rootPills.forEach(function (p) {
        p.setAttribute('aria-pressed', p.dataset.root === String(self._activeRoot) ? 'true' : 'false');
      });
    }
  };

  ChordFinder.prototype._syncAdvancedToggle = function () {
    if (!this._advancedToggle) return;
    var value = this._advancedToggle.querySelector('.advanced-toggle-value');
    if (!value) return;
    var parts = [];
    if (this._activeFilter !== 'all') parts.push(filterDisplayName(this._activeFilter));
    if (this._activeRoot !== 'all') parts.push(rootDisplayName(this._activeRoot));
    value.textContent = parts.length ? parts.join(' · ') : filterLabel(0);
  };

  ChordFinder.prototype._renderCards = function () {
    var grid = this._grid;
    var self = this;
    this._cards = window.CHORDS.map(function (chord) {
      var card = document.createElement('div');
      card.className = 'card';
      card._chord = chord;
      card._families = chord.families || [];
      card._root = rootPitchClass(chord.name);

      var pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin-button';
      pin.textContent = t('cfPinLabel', 'Pinear');
      pin.setAttribute('aria-pressed', 'false');
      pin.addEventListener('click', function () { self._togglePin(chord); });
      card._pinBtn = pin;
      card.appendChild(pin);

      var target = document.createElement('div');
      target.className = 'diagram';
      card.appendChild(target);

      var name = document.createElement('div');
      name.className = 'name';
      name.textContent = self._displayName(chord);
      card.appendChild(name);
      card._nameEl = name;

      var aka = document.createElement('div');
      aka.className = 'aka';
      aka.textContent = self._displayNotes(chord);
      card.appendChild(aka);
      card._akaEl = aka;

      grid.appendChild(card);

      try {
        window.ChordDiagram.render(target, chord, 'finder');
      } catch (err) {
        target.innerHTML = '<small style="color:#999">(error)</small>';
        if (window.console) console.error('svguitar error for', chord.name, err);
      }

      return card;
    });
  };

  ChordFinder.prototype._applyFilter = function () {
    var q = this._input.value || '';
    var fam = this._activeFilter;
    var key = this._activeRoot;

    var matched = window.ChordSearch.matchChords(q, window.CHORDS);
    var matchedSet = null;
    var hasQuery = q.trim() !== '';
    if (hasQuery) matchedSet = new Set(matched);

    var visible = 0;
    this._cards.forEach(function (card) {
      var matchesFamily = fam === 'all' || card._families.indexOf(fam) !== -1;
      var matchesKey = key === 'all' || card._root === key;
      var matchesSearch = !hasQuery || matchedSet.has(card._chord);
      var show = matchesFamily && matchesKey && matchesSearch;
      card.classList.toggle('hidden', !show);
      card.classList.toggle('match', show && hasQuery);
      if (show) visible++;
    });

    var empty = this._grid.querySelector('.empty');
    if (visible === 0) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = t('cfEmpty', 'No hay acordes que coincidan.');
        this._grid.appendChild(empty);
      }
    } else if (empty) {
      empty.remove();
    }
  };

  ChordFinder.prototype._isPinned = function (chord) {
    return this._pinnedNames.indexOf(chord.name) !== -1;
  };

  ChordFinder.prototype._togglePin = function (chord) {
    if (!this.hasAttribute('pinnable')) return;
    var i = this._pinnedNames.indexOf(chord.name);
    if (i === -1) this._pinnedNames.push(chord.name);
    else this._pinnedNames.splice(i, 1);
    this._savePinned();
    this._renderPinned();
  };

  ChordFinder.prototype._clearPinned = function () {
    this._pinnedNames.length = 0;
    this._savePinned();
    this._renderPinned();
  };

  ChordFinder.prototype._renderPinned = function () {
    var self = this;
    var strip = this._strip;
    var list = this._stripList;

    this._cards.forEach(function (card) {
      var pinned = self._isPinned(card._chord);
      card._pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      card._pinBtn.textContent = pinned ? t('cfPinnedLabel', 'Pineado') : t('cfPinLabel', 'Pinear');
    });

    if (!this.hasAttribute('pinnable') || this._pinnedNames.length === 0) {
      list.textContent = '';
      strip.hidden = true;
      return;
    }
    strip.hidden = false;

    list.textContent = '';
    this._pinnedNames.forEach(function (name) {
      var chord = window.CHORDS.find(function (c) { return c.name === name; });
      if (!chord) return;

      var item = document.createElement('div');
      item.className = 'pinned-card';

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pinned-remove';
      var unpinTpl = t('cfUnpinAriaLabel', 'Despinear {name}');
      remove.setAttribute('aria-label', unpinTpl.replace('{name}', chord.name));
      remove.title = unpinTpl.replace('{name}', chord.name);
      remove.textContent = '×';
      remove.addEventListener('click', function () { self._togglePin(chord); });
      item.appendChild(remove);

      var target = document.createElement('div');
      target.className = 'diagram';
      item.appendChild(target);

      var nm = document.createElement('div');
      nm.className = 'name';
      nm.textContent = self._displayName(chord);
      item.appendChild(nm);

      list.appendChild(item);

      try {
        window.ChordDiagram.render(target, chord, 'finder');
      } catch (err) {
        target.innerHTML = '<small style="color:#999">(error)</small>';
        if (window.console) console.error('svguitar error for', chord.name, err);
      }
    });
  };

  ChordFinder.prototype._applyNotation = function () {
    var self = this;
    this._cards.forEach(function (card) {
      card._nameEl.textContent = self._displayName(card._chord);
      card._akaEl.textContent = self._displayNotes(card._chord);
    });
    this._renderPinned();
  };

  ChordFinder.prototype._bindKeyboardShortcut = function () {
    var self = this;
    this._onKeydown = function (e) {
      if (e.key !== '/') return;
      var active = document.activeElement;
      if (active === self) active = self.shadowRoot.activeElement;
      var tag = active && active.tagName ? active.tagName.toLowerCase() : '';
      var isTyping =
        tag === 'input' || tag === 'textarea' ||
        (active && active.isContentEditable);
      if (isTyping) return;
      e.preventDefault();
      self._input.focus();
    };
    document.addEventListener('keydown', this._onKeydown);
  };

  if (typeof customElements !== 'undefined' && !customElements.get('chord-finder')) {
    customElements.define('chord-finder', ChordFinder);
  }
})();
