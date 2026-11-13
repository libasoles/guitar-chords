/* popup.js — Note search over the arpeggio positions of the website's
   /recursos/tablaturas-para-arpegios page. The user writes frets in a one-column
   tab (string -> fret); every position that has them all is listed per root,
   as tablature or as chord diagrams. Strings come from chrome.i18n. */

(function () {
  'use strict';

  const STRINGS = 6;
  const CHORDS_PER_STAFF = 6;
  const HIGHLIGHT = '#c62828';
  const TAB_CHARS = 47;
    const EMPTY_COLUMN = [null, null, null, null, null, null];

  // chrome.i18n is available in extension context; fall back to English elsewhere.
  function i18n(key, fallback) {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) return message;
    }
    return fallback;
  }

  const query = document.getElementById('query');
  const results = document.getElementById('results');
  const viewTabs = document.getElementById('view-tabs');
  const viewDiagrams = document.getElementById('view-diagrams');
  const clear = document.getElementById('clear');
  const optionsButton = document.getElementById('options-button');
  const optionsPanel = document.getElementById('options-panel');
  const highlightOption = document.getElementById('opt-highlight');
  const roots = window.ARPEGGIO_ROOTS.map((root) => ({ ...root, chords: root.variants.flatMap((variant) => variant.chords) }));
  const lang = /^es/i.test(typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n.getUILanguage() : '') ? 'es' : 'en';
  const variantIndex = new Map();

  document.title = i18n('appName', 'Chord Identifier');
  document.getElementById('wordmark').textContent = document.title;
  document.getElementById('view-tabs-label').textContent = i18n('showTabs', 'Tablature');
  document.getElementById('view-diagrams-label').textContent = i18n('showDiagrams', 'Diagrams');
  clear.textContent = i18n('clearLabel', 'Clear');
  optionsButton.title = i18n('optionsLabel', 'Options');
  optionsButton.setAttribute('aria-label', optionsButton.title);
  document.getElementById('opt-highlight-label').textContent = i18n('highlightNotes', 'Highlight notes');
  results.setAttribute('aria-label', i18n('resultsLabel', 'Search results'));
  query.setAttribute('aria-label', i18n('inputLabel', 'Notes to search'));
  document.getElementById('site-label').textContent = i18n('siteLabel', 'All arpeggio tabs');
  document.getElementById('site-link').href = i18n('siteUrl', 'https://acordesdeguitarra.com.ar/en/resources/tabs-for-arpeggios');

  // Note names follow the browser language: no switch.
  const notation = /^es/i.test(typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n.getUILanguage() : '') ? 'es' : 'en';
  // The search and the view survive closing the popup.
  const STATE_KEY = 'identifierSearch';
  function loadState() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STATE_KEY));
      const valid = saved && Array.isArray(saved.frets) && saved.frets.length === STRINGS &&
        saved.frets.every((fret) => fret === null || Number.isInteger(fret));
      if (valid) return { frets: saved.frets, diagrams: saved.diagrams === true, highlight: saved.highlight !== false };
    } catch (e) {
      // localStorage may be unavailable or hold something else; start empty.
    }
    return { frets: new Array(STRINGS).fill(null), diagrams: false, highlight: true };
  }
  function saveState() {
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify({ frets, diagrams, highlight }));
    } catch (e) {
      // localStorage may be unavailable; ignore.
    }
  }

  const saved = loadState();
  let diagrams = saved.diagrams;
  let frets = saved.frets;
  let highlight = saved.highlight;
  let version = 0;

  const spanish = () => notation === 'es';
  const display = (name) => (spanish() ? window.NoteNames.toSpanishName(name) : name);

  function fretOf(note) { return note !== null && typeof note === 'object' ? note.fret : note; }
  function active() { return frets.some((fret) => fret !== null); }

  function matches(root) {
    return root.chords.filter((chord) => frets.every((fret, s) => fret === null || chord.form[s] === fret));
  }

  function rootTitle(root) {
    return root.root === 'Dim7' ? 'dim7' : display(root.root.replace('b', '♭').replace('#', '♯'));
  }

  function tabFor(chords) {
    const staves = [];
    const annotations = [];
    chords.forEach((chord, i) => {
      if (i % CHORDS_PER_STAFF === 0) { staves.push([]); annotations.push([]); }
      const columns = staves[staves.length - 1];
      // A blank column separates the chords.
      if (columns.length) columns.push(EMPTY_COLUMN.slice());
      annotations[annotations.length - 1].push({ column: columns.length, text: display(chord.name) });
      // A note is highlighted (colored and bold) only at the string and fret written in the search, not by pitch.
      columns.push(chord.form.map((fret, s) => {
        if (fret === null) return null;
        const note = { fret, bold: false };
        if (highlight && frets[s] === fret) { note.color = HIGHLIGHT; note.bold = true; }
        return note;
      }));
    });
    const tab = document.createElement('ascii-tabs');
    tab.className = 'results-tab';
    tab.setAttribute('readonly', '');
    tab.setAttribute('theme', 'light');
    tab.setAttribute('labels', 'notes');
    tab.setAttribute('spacing', '3');
    tab.setAttribute('annotation-fit', 'overflow');
    tab.setAttribute('variant', 'flat');
    tab.innerHTML = '<ascii-tabs-sheet></ascii-tabs-sheet>';
    return { tab, document: { value: staves, annotations } };
  }

  // Diagrams are drawn when they scroll into view: svguitar is slow in bulk.
  const lazyCards = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      lazyCards.unobserve(entry.target);
      window.ChordCard.render(entry.target);
    });
  }, { root: results, rootMargin: '200px' });

  function diagramsFor(chords) {
    const row = document.createElement('div');
    row.className = 'diagrams';
    chords.forEach((chord) => {
      const card = { ...chord.card, name: display(chord.name) };
      if (highlight) {
        card.fingers = card.fingers.map(([string, fret, finger]) => {
          if (frets[string - 1] === null || chord.form[string - 1] !== frets[string - 1]) return [string, fret, finger];
          const marker = { color: HIGHLIGHT, strokeColor: HIGHLIGHT, textColor: '#fff' };
          return [string, fret, fret === 'o' ? marker : { ...marker, text: finger ? String(finger) : '' }];
        });
      }
      if (spanish()) card.stringNotes = card.stringNotes.map((note) => window.NoteNames.toSpanishName(note));
      const slot = document.createElement('div');
      slot.setAttribute('data-chord-card', '');
      slot.dataset.chord = JSON.stringify(card);
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', card.name);
      row.appendChild(slot);
      lazyCards.observe(slot);
    });
    return row;
  }

  function message(key, fallback) {
    const message = document.createElement('div');
    message.className = 'msg';
    const image = document.createElement('img');
    image.src = 'note-finder-empty.png';
    image.alt = '';
    image.width = 160;
    image.height = 149;
    message.appendChild(image);
    const text = document.createElement('div');
    text.textContent = i18n(key, fallback);
    message.appendChild(text);
    return message;
  }

  function yieldToInput() {
    return window.scheduler && window.scheduler.yield
      ? window.scheduler.yield()
      : new Promise((resolve) => setTimeout(resolve, 0));
  }

  // The search starts level with the first tablature (or diagram) of the results.
  const search = document.querySelector('.search');
  const alignObserver = new ResizeObserver(alignSearch);
  function alignSearch() {
    const first = results.querySelector('.results-tab .ascii-tabs-staff, .diagrams > *');
    let offset = 0;
    if (first) {
      const box = first.getBoundingClientRect();
      // The tab's paper is drawn behind the strings, anchored to the bottom of the staff.
      const top = first.classList.contains('ascii-tabs-staff')
        ? box.bottom - parseFloat(window.getComputedStyle(first, '::before').height)
        : box.top;
      offset = top - results.getBoundingClientRect().top + results.scrollTop;
    }
    search.style.paddingTop = Math.max(0, Math.round(offset)) + 'px';
  }

  // Fills a container with the chords as tablature or as diagrams.
  async function fill(container, chords, current) {
    container.textContent = '';
    if (diagrams) {
      container.appendChild(diagramsFor(chords));
      return;
    }
    const { tab, document: value } = tabFor(chords);
    container.appendChild(tab);
    await customElements.whenDefined('ascii-tabs');
    if (current !== version) return;
    tab.setDocument(value);
  }

  // Without a search every root shows its quality tabs, as on the website.
  function qualityTabs(root, panel, current) {
    const list = document.createElement('div');
    list.className = 'quality-tabs';
    list.setAttribute('role', 'tablist');
    const buttons = root.variants.map((variant, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.textContent = variant.label[lang] || variant.label.en;
      button.addEventListener('click', () => {
        variantIndex.set(root.root, i);
        sync();
        fill(panel, variant.chords, version).then(alignSearch);
      });
      list.appendChild(button);
      return button;
    });
    function sync() {
      const selected = variantIndex.get(root.root) || 0;
      buttons.forEach((button, i) => button.setAttribute('aria-selected', String(i === selected)));
    }
    sync();
    return list;
  }

  async function render() {
    const current = ++version;
    lazyCards.disconnect();
    alignObserver.disconnect();
    results.textContent = '';
    const searching = active();
    let found = false;
    for (const root of roots) {
      // Let pending typing run between roots: each tab is costly to lay out.
      await yieldToInput();
      if (current !== version) return;
      const chords = searching ? matches(root) : root.chords;
      if (!chords.length) continue;
      found = true;
      const group = document.createElement('section');
      group.className = 'root-group';
      const header = document.createElement('div');
      header.className = 'root-header';
      const title = document.createElement('h2');
      title.className = 'root-title';
      title.textContent = rootTitle(root);
      header.appendChild(title);
      const panel = document.createElement('div');
      let shown = chords;
      if (!searching) {
        header.appendChild(qualityTabs(root, panel, current));
        shown = root.variants[variantIndex.get(root.root) || 0].chords;
      }
      group.appendChild(header);
      group.appendChild(panel);
      results.appendChild(group);
      if (group === results.firstElementChild) alignObserver.observe(group);
      await fill(panel, shown, current);
      if (group === results.firstElementChild) alignSearch();
    }
    if (!found) {
      results.appendChild(message('noResults', 'No chord matches those notes.'));
      alignSearch();
    }
  }

  let timer;
  function scheduleRender(immediate) {
    clearTimeout(timer);
    if (immediate) render();
    else timer = setTimeout(render, 200);
  }

  function selectView(next) {
    if (diagrams === next) return;
    diagrams = next;
    syncView();
    saveState();
    scheduleRender(true);
  }

  function syncView() {
    viewTabs.setAttribute('aria-pressed', String(!diagrams));
    viewDiagrams.setAttribute('aria-pressed', String(diagrams));
  }

  // Focus is given by replaying a press on the first cell, which has no real pointer to capture.
  query.setPointerCapture = function () {};

  let focusRetries = 0;
  function focusFirstCell() {
    const cell = query.querySelector('.ascii-tabs-cell');
    if (!cell && focusRetries++ < 10) return requestAnimationFrame(focusFirstCell);
    focusRetries = 0;
    if (cell) cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }));
  }

  function showQuery() {
    query.setDocument({ value: [[frets.slice()]] });
  }

  // One column only: sideways keys never reach the tab.
  query.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].indexOf(event.key) === -1) return;
    event.stopPropagation();
    if (event.key !== 'Tab') event.preventDefault();
  }, true);

  query.addEventListener('change', (event) => {
    const tab = event.detail.value[0] || [];
    frets = (tab[0] || EMPTY_COLUMN).map((note) => (note === null ? null : fretOf(note)));
    saveState();
    scheduleRender(!active());
    if (tab.length > 1) {
      // Keep the first column only.
      query.setDocument({ value: [[(tab[0] || EMPTY_COLUMN).slice()]] });
      focusFirstCell();
    }
  });

  clear.addEventListener('click', () => {
    frets = new Array(STRINGS).fill(null);
    saveState();
    showQuery();
    scheduleRender(true);
    requestAnimationFrame(focusFirstCell);
  });

  highlightOption.checked = highlight;
  highlightOption.addEventListener('change', () => {
    highlight = highlightOption.checked;
    saveState();
    scheduleRender(true);
  });

  function toggleOptions(open) {
    optionsPanel.hidden = !open;
    optionsButton.setAttribute('aria-expanded', String(open));
  }
  optionsButton.addEventListener('click', () => toggleOptions(optionsPanel.hidden));
  document.addEventListener('pointerdown', (event) => {
    if (!optionsPanel.hidden && !event.target.closest('.options')) toggleOptions(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !optionsPanel.hidden) { toggleOptions(false); optionsButton.focus(); }
  });

  viewTabs.addEventListener('click', () => selectView(false));
  viewDiagrams.addEventListener('click', () => selectView(true));

  // A toolbar popup can first measure the tab at zero size and, with a fixed width, never get
  // a resize to lay it out again: nudge the minimum width until its cells exist.
  function ensureLaidOut() {
    let tries = 0;
    const timer = setInterval(() => {
      if (query.querySelector('.ascii-tabs-cell')) { fitTabs(); alignSearch(); return clearInterval(timer); }
      if (tries++ > 100) return clearInterval(timer);
      query.style.minWidth = tries % 2 ? '51px' : '';
    }, 50);
  }

  // Grow the digits of every tab, the search one included, until the results fill their column.
  // The search column widens with them, so settle in a few passes.
  function fitTabs() {
    let size = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--tab-size')) || 18;
    for (let pass = 0; pass < 4; pass++) {
      const next = Math.max(12, Math.min(26, Math.floor(((results.clientWidth - 44) / (TAB_CHARS * 0.6)) * 2) / 2));
      if (next === size) break;
      size = next;
      document.documentElement.style.setProperty('--tab-size', size + 'px');
    }
  }

  syncView();
  render();
  customElements.whenDefined('ascii-tabs').then(() => {
    showQuery();
    ensureLaidOut();
    requestAnimationFrame(focusFirstCell);
  });
})();
