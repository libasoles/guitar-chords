/* tab-editor.js — "Tablatura ASCII" page: an editor for guitar tabs.
   Each tab is one continuous run of columns (one fret number or empty per
   string); staves are only visual wrapping, recomputed from the available
   width. Click a slot and type the fret, move with arrows/Enter/Tab, drag a
   number to another slot, and copy the tab as plain ASCII text. Tabs are
   kept in localStorage. */
(function () {
  'use strict';

  var STRINGS = window.TAB_EDITOR_STRINGS || {};
  function t(key, fallback) { return STRINGS[key] !== undefined ? STRINGS[key] : fallback; }

  var STRING_NAMES = ['1', '2', '3', '4', '5', '6'];
  var STORAGE_KEY = 'tabEditor.tabs';
  var LABEL_W = 2; // "1 "
  var CELL_W = 3;  // "---"
  var MAX_FRET = 24;

  // Lucide icons, inlined
  function svg(paths) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICON_COPY = svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
  var ICON_CHECK = svg('<path d="M20 6 9 17l-5-5"/>');
  var ICON_TRASH = svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>');

  var $sheets = document.getElementById('tabSheets');
  var $add = document.getElementById('tabAdd');
  var $key = document.getElementById('tabKey');
  var $probe = document.getElementById('tabProbe');
  if (!$sheets || !$add || !$key || !$probe) return;

  function emptyCol() { return STRING_NAMES.map(function () { return ''; }); }

  var tabs = [];
  try {
    var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored)) tabs = stored.filter(Array.isArray);
  } catch (e) {}
  if (!tabs.length) tabs = [[]];

  var perStaff = 16;
  var cur = null;    // { t, c, s } focused cell
  var draft = null;  // text being typed in the focused cell, null if untouched
  var drag = null;   // { t, c, s, x, y, moved } number being dragged

  function lastUsed(cols) {
    for (var i = cols.length - 1; i >= 0; i--) {
      if (cols[i].some(function (v) { return v !== ''; })) return i;
    }
    return -1;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs.map(function (cols) {
        return cols.slice(0, lastUsed(cols) + 1);
      })));
    } catch (e) {}
  }

  // Always leave room after the last note; a new staff appears when you write past the end
  function fit(ti) {
    var cols = tabs[ti];
    var need = Math.max(lastUsed(cols) + 2, cur && cur.t === ti ? cur.c + 1 : 0, 1);
    var total = Math.ceil(need / perStaff) * perStaff;
    while (cols.length < total) cols.push(emptyCol());
    cols.length = total;
  }

  function measure() {
    var el = $sheets.querySelector('.tab-staves');
    if (!el) return;
    var chW = $probe.getBoundingClientRect().width / 10;
    var chars = Math.floor(el.clientWidth / chW);
    perStaff = Math.max(4, Math.floor((chars - LABEL_W) / CELL_W));
  }

  function cellHtml(v) {
    if (v === '') return '-<span class="mid">-</span><span class="caret"> </span>-';
    if (v.length === 1) return '-<span class="n">' + v + '</span>-';
    return '-<span class="n">' + v + '</span>';
  }

  function cellText(v) {
    return v === '' ? '---' : v.length === 1 ? '-' + v + '-' : '-' + v;
  }

  // Plain-text version, with every staff cut right after its last note
  function tabText(cols) {
    var last = lastUsed(cols);
    if (last < 0) return '';
    var staves = [];
    for (var start = 0; start <= last; start += perStaff) {
      var end = Math.min(start + perStaff, last + 1);
      staves.push(STRING_NAMES.map(function (name, s) {
        var line = name + ' ';
        for (var c = start; c < end; c++) line += cellText(cols[c][s]);
        return line;
      }).join('\n'));
    }
    return staves.join('\n\n');
  }

  // Sheet frames (with their buttons) are only rebuilt when tabs are added or removed
  function build() {
    var copyLabel = t('tabEditorCopyLabel', 'Copy');
    var deleteLabel = t('tabEditorDeleteLabel', 'Delete');
    $sheets.innerHTML = tabs.map(function (_, ti) {
      return '<section class="tab-sheet" data-t="' + ti + '">' +
        '<div class="tab-tools">' +
          '<button class="tab-icon-btn copy" type="button" title="' + copyLabel + '" aria-label="' + copyLabel + '">' + ICON_COPY + '</button>' +
          (tabs.length > 1 ? '<button class="tab-icon-btn del" type="button" title="' + deleteLabel + '" aria-label="' + deleteLabel + '">' + ICON_TRASH + '</button>' : '') +
        '</div>' +
        '<div class="tab-staves"></div>' +
      '</section>';
    }).join('');
  }

  function render() {
    $sheets.querySelectorAll('.tab-staves').forEach(function (el, ti) {
      fit(ti);
      var cols = tabs[ti];
      var html = '';
      for (var start = 0; start < cols.length; start += perStaff) {
        html += '<div class="staff">';
        STRING_NAMES.forEach(function (name, s) {
          html += '<span class="line"><span class="label">' + name + ' </span>';
          for (var c = start; c < start + perStaff; c++) {
            var isCur = cur && cur.t === ti && cur.c === c && cur.s === s;
            var v = isCur && draft !== null ? draft : cols[c][s];
            var cls = 'cell' + (isCur ? ' cur' : '') + (v !== '' ? ' has' : '');
            html += '<span class="' + cls + '" data-t="' + ti + '" data-c="' + c + '" data-s="' + s + '">' + cellHtml(v) + '</span>';
          }
          html += '</span>';
        });
        html += '</div>';
      }
      el.innerHTML = html;
    });
    placeKey();
  }

  // Keep the hidden input next to the focused cell so phones scroll to it
  function placeKey() {
    var el = cur && $sheets.querySelector('.cell.cur');
    if (!el) return;
    var r = el.getBoundingClientRect();
    $key.style.left = (r.left + scrollX) + 'px';
    $key.style.top = (r.top + scrollY) + 'px';
  }

  function commit() {
    if (cur && draft !== null) {
      tabs[cur.t][cur.c][cur.s] = draft;
      save();
    }
    draft = null;
  }

  function goTo(ti, c, s) {
    commit();
    cur = { t: ti, c: Math.max(0, c), s: s };
    render();
    var el = $sheets.querySelector('.cell.cur');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function moveH(d) {
    goTo(cur.t, cur.c + d, cur.s);
  }

  // Up/down walks across strings and jumps between staves at the edges
  function moveV(d) {
    var c = cur.c;
    var s = cur.s + d;
    if (s < 0) {
      if (c - perStaff < 0) return goTo(cur.t, c, 0);
      c -= perStaff; s = STRING_NAMES.length - 1;
    } else if (s >= STRING_NAMES.length) {
      c += perStaff; s = 0;
    }
    goTo(cur.t, c, s);
  }

  function valid(text) {
    return /^(0|[1-9][0-9]?)$/.test(text) && Number(text) <= MAX_FRET;
  }

  function typeDigit(d) {
    if (draft === null || draft === '') draft = d;
    else if (valid(draft + d)) draft += d;
    else return;
    render();
  }

  $key.addEventListener('keydown', function (e) {
    if (!cur) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); return typeDigit(e.key); }
    switch (e.key) {
      case 'Enter':
      case 'Tab':
        e.preventDefault(); return moveH(e.shiftKey ? -1 : 1);
      case 'ArrowRight': e.preventDefault(); return moveH(1);
      case 'ArrowLeft':  e.preventDefault(); return moveH(-1);
      case 'ArrowUp':    e.preventDefault(); return moveV(-1);
      case 'ArrowDown':  e.preventDefault(); return moveV(1);
      case 'Backspace':
        e.preventDefault();
        draft = (draft !== null ? draft : tabs[cur.t][cur.c][cur.s]).slice(0, -1);
        return render();
      case 'Delete':
        e.preventDefault(); draft = ''; return render();
      case 'Escape':
        e.preventDefault(); draft = null; return render();
    }
  });

  // Phone keyboards often skip keydown for digits; pick them up here
  $key.addEventListener('input', function () {
    for (var i = 0; i < $key.value.length; i++) {
      if (/[0-9]/.test($key.value[i])) typeDigit($key.value[i]);
    }
    $key.value = '';
  });

  $key.addEventListener('focus', function () { document.body.classList.add('tab-editing'); });
  $key.addEventListener('blur', function () {
    document.body.classList.remove('tab-editing');
    commit();
    cur = null;
    render();
  });

  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.closest('.tab-sheet .cell');
  }
  function cellEl(p) {
    return $sheets.querySelector('.cell[data-t="' + p.t + '"][data-c="' + p.c + '"][data-s="' + p.s + '"]');
  }
  function pos(el) {
    return { t: +el.dataset.t, c: +el.dataset.c, s: +el.dataset.s };
  }

  $sheets.addEventListener('pointerdown', function (e) {
    var cell = e.target.closest('.cell');
    if (!cell || e.button !== 0) return;
    e.preventDefault(); // keep focus on the hidden input
    var p = pos(cell);
    goTo(p.t, p.c, p.s);
    $key.focus({ preventScroll: true });
    if (tabs[p.t][p.c][p.s] !== '') drag = { t: p.t, c: p.c, s: p.s, x: e.clientX, y: e.clientY, moved: false };
  });

  addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.moved = true;
      document.body.classList.add('tab-dragging');
      var src = cellEl(drag);
      if (src) src.classList.add('src');
    }
    var prev = $sheets.querySelector('.cell.drop');
    if (prev) prev.classList.remove('drop');
    var over = cellAt(e.clientX, e.clientY);
    if (over && !over.classList.contains('src')) over.classList.add('drop');
  });

  function endDrag(e, cancelled) {
    if (!drag) return;
    var from = drag;
    drag = null;
    document.body.classList.remove('tab-dragging');
    if (!from.moved) return;
    var over = !cancelled && cellAt(e.clientX, e.clientY);
    if (!over) return render();
    var to = pos(over);
    if (to.t !== from.t || to.c !== from.c || to.s !== from.s) {
      tabs[to.t][to.c][to.s] = tabs[from.t][from.c][from.s];
      tabs[from.t][from.c][from.s] = '';
      save();
    }
    goTo(to.t, to.c, to.s);
  }
  addEventListener('pointerup', function (e) { endDrag(e, false); });
  addEventListener('pointercancel', function (e) { endDrag(e, true); });

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (!navigator.clipboard) return Promise.resolve(fallback());
    return navigator.clipboard.writeText(text).catch(fallback);
  }

  $sheets.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab-icon-btn');
    if (!btn) return;
    var ti = +btn.closest('.tab-sheet').dataset.t;
    if (btn.classList.contains('copy')) {
      copyText(tabText(tabs[ti])).then(function () {
        btn.innerHTML = ICON_CHECK;
        btn.classList.add('done');
        btn.setAttribute('aria-label', t('tabEditorCopiedLabel', 'Copied'));
        clearTimeout(btn._timer);
        btn._timer = setTimeout(function () {
          btn.innerHTML = ICON_COPY;
          btn.classList.remove('done');
          btn.setAttribute('aria-label', t('tabEditorCopyLabel', 'Copy'));
        }, 1200);
      });
    } else if (btn.classList.contains('del')) {
      if (lastUsed(tabs[ti]) >= 0 && !confirm(t('tabEditorDeleteConfirm', 'Delete this tab?'))) return;
      tabs.splice(ti, 1);
      save();
      build();
      render();
    }
  });

  $add.addEventListener('pointerdown', function (e) { e.preventDefault(); }); // stay focused through the click
  $add.addEventListener('click', function () {
    commit();
    tabs.push([]);
    save();
    build();
    goTo(tabs.length - 1, 0, 0);
    $key.focus({ preventScroll: true });
  });

  var resizeTimer;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var before = perStaff;
      measure();
      if (perStaff !== before) render();
    }, 100);
  });

  build();
  measure();
  render();
})();
