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
    { filter: 'sus',   i18n: 6 },
    { filter: 'slash', i18n: 7 },
    { filter: 'otros', i18n: 8 },
  ];

  var DEFAULT_FILTER_LABELS = ['Todos', 'Mayores', 'Menores', 'Con 7ª (dom.)', 'Menor 7ª', 'Mayor 7ª', 'Sus', 'Con bajo (/)', 'Otros'];

  function filterLabel(index) {
    var labels = t('cfFilters', DEFAULT_FILTER_LABELS);
    return labels[index] || DEFAULT_FILTER_LABELS[index];
  }

  var STYLES = [
    ':host { display: block; }',
    '*, *::before, *::after { box-sizing: border-box; }',
    '',
    '.controls {',
    '  display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center;',
    '  margin: 1rem 0 1.5rem; padding: 0.8rem 1rem;',
    '  background: #fff;',
    '  border: 1px solid var(--rule, #d8d2c4);',
    '  border-radius: 6px; position: sticky; top: 0; z-index: 10;',
    '}',
    '.search {',
    '  flex: 1 1 200px;',
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
    '  color: var(--ink-soft, #555); font-style: italic; padding: 2rem 1rem;',
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
    '.pinned-title {',
    '  font-family: var(--sans, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif);',
    '  font-size: 0.78rem; font-weight: 600; text-transform: uppercase;',
    '  letter-spacing: 0.05em; color: var(--accent, #8b0000);',
    '  margin: 0 0 0.6rem;',
    '}',
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
    this._cards = [];
    this._pinnedNames = [];
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

    var controls = document.createElement('div');
    controls.className = 'controls';
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', t('cfToolbarAriaLabel', 'Filtros y búsqueda'));

    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'search';
    input.placeholder = 'Cmaj7, Am7, D/F#…';
    input.autocomplete = 'off';
    input.spellcheck = false;
    controls.appendChild(input);

    var self = this;
    this._pills = FILTER_DEFS.map(function (f) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'pill';
      pill.dataset.filter = f.filter;
      pill.textContent = filterLabel(f.i18n);
      pill.setAttribute('aria-pressed', f.filter === 'all' ? 'true' : 'false');
      pill.addEventListener('click', function () {
        self._pills.forEach(function (p) { p.setAttribute('aria-pressed', 'false'); });
        pill.setAttribute('aria-pressed', 'true');
        self._activeFilter = f.filter;
        self._applyFilter();
      });
      controls.appendChild(pill);
      return pill;
    });

    var strip = document.createElement('div');
    strip.className = 'pinned-strip';
    strip.hidden = true;
    var stripTitle = document.createElement('p');
    stripTitle.className = 'pinned-title';
    stripTitle.textContent = t('cfPinnedTitle', 'Acordes pineados');
    var stripList = document.createElement('div');
    stripList.className = 'pinned-list';
    strip.appendChild(stripTitle);
    strip.appendChild(stripList);

    var grid = document.createElement('div');
    grid.className = 'grid';
    grid.setAttribute('aria-live', 'polite');

    root.appendChild(controls);
    root.appendChild(strip);
    root.appendChild(grid);

    this._input = input;
    this._grid = grid;
    this._strip = strip;
    this._stripList = stripList;

    input.addEventListener('input', function () { self._applyFilter(); });
  };

  ChordFinder.prototype._renderCards = function () {
    var grid = this._grid;
    var self = this;
    this._cards = window.CHORDS.map(function (chord) {
      var card = document.createElement('div');
      card.className = 'card';
      card._chord = chord;
      card._families = chord.families || [];

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
      name.textContent = chord.name;
      card.appendChild(name);

      var aka = document.createElement('div');
      aka.className = 'aka';
      aka.textContent = chord.notes || '';
      card.appendChild(aka);

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

    var matched = window.ChordSearch.matchChords(q, window.CHORDS);
    var matchedSet = null;
    var hasQuery = q.trim() !== '';
    if (hasQuery) matchedSet = new Set(matched);

    var visible = 0;
    this._cards.forEach(function (card) {
      var matchesFamily = fam === 'all' || card._families.indexOf(fam) !== -1;
      var matchesSearch = !hasQuery || matchedSet.has(card._chord);
      var show = matchesFamily && matchesSearch;
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
      nm.textContent = chord.name;
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
