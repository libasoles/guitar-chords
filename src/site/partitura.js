/* partitura.js — Partitura y tablatura tool page.

   Flow: file + rights consent (either order, automatic tuning) -> Turnstile token ->
   POST /jobs, PUT upload, POST /jobs/:id/process -> poll GET /jobs/:id ->
   desktop: Verovio preview with one <ascii-tabs> per measure aligned to the
   notes, edit, confirm -> POST /jobs/:id/export -> downloads;
   mobile: direct download of the PDF with the Digitación sugerida.

   API and preview contract: docs/partitura-api.md. Plain ES5-style JS;
   uses vendor/ascii-tabs.js and the shared toast bundle. Configuration comes from
   window.PARTITURA_CONFIG (see scripts/build-site.js). */
(function () {
  'use strict';

  var CFG = window.PARTITURA_CONFIG || {};
  var STR = CFG.strings || {};
  var API = String(CFG.apiUrl || '').replace(/\/+$/, '');
  var POLL_MS = Number(CFG.pollMs) > 0 ? Number(CFG.pollMs) : 2000;
  var MAX_BYTES = 20 * 1024 * 1024;
  var DESKTOP_QUERY = '(min-width: 768px)';
  var STRINGS_COUNT = 6;
  var TURNSTILE_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var ERROR_CODES = [
    'rate_limited', 'busy', 'budget_paused', 'turnstile_failed', 'too_large',
    'omr_failed', 'no_notes', 'timeout', 'export_limit', 'expired',
  ];

  function $(id) { return document.getElementById(id); }

  function t(key, vars) {
    var text = STR[key] != null ? String(STR[key]) : key;
    if (vars) {
      Object.keys(vars).forEach(function (name) {
        text = text.split('{' + name + '}').join(String(vars[name]));
      });
    }
    return text;
  }

  function errorText(code) {
    if (code === 'network') return t('partErrNetwork');
    if (ERROR_CODES.indexOf(code) !== -1) return t('partErr_' + code);
    if (STR['partErr_' + code]) return t('partErr_' + code);
    return t('partErrDefault');
  }

  function ApiError(code, status) {
    this.code = code;
    this.status = status;
  }

  // ---- DOM references ------------------------------------------------------

  var form = $('partForm');
  var stage = $('partStage');
  var rightsBox = $('partRights');
  var rightsRow = $('partRightsRow');
  var rightsError = $('partRightsError');
  var dropTitle = $('partDropTitle');
  var fileInput = $('partFile');
  var dropzone = $('partDropzone');
  var progressEl = $('partProgress');
  var statusEl = $('partStatus');
  var elapsedEl = $('partElapsed');
  var resultEl = $('partResult');
  var turnstileBox = $('partTurnstile');
  if (!form) return;

  // ---- state ---------------------------------------------------------------

  var state = {
    pendingFile: null,
    jobId: null,
    pollTimer: null,
    tickTimer: null,
    elapsedBase: 0,
    elapsedAt: 0,
    preview: null,
    previewJobId: null,
    exporting: false,
    token: null,
    tokenWaiters: [],
    turnstileWidget: null,
    turnstileStarted: false,
    warmedUp: false,
    autoDownloaded: false,
  };

  // ---- UI helpers ----------------------------------------------------------

  // The toast bundle (React + Radix) loads on the visitor's first interaction
  // with the form, or when the first error needs it.
  var toastLoading = null;
  var latestError = '';

  function loadToast() {
    if (window.SiteToast) return Promise.resolve();
    if (!toastLoading) {
      toastLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = document.body.getAttribute('data-toast-src');
        script.onload = function () { resolve(); };
        script.onerror = function () { toastLoading = null; reject(new Error('toast')); };
        document.head.appendChild(script);
      });
    }
    return toastLoading;
  }

  function showError(message) {
    latestError = message || '';
    if (window.SiteToast) {
      if (message) window.SiteToast.show(message, { variant: 'alert' });
      else window.SiteToast.clear();
      return;
    }
    if (!message) return; // nothing on screen yet, so nothing to clear
    loadToast().then(function () {
      // Skip it when a newer message or a clear arrived while loading.
      if (latestError === message) window.SiteToast.show(message, { variant: 'alert' });
    }, function () {
      window.alert(message);
    });
  }

  function clearRightsError() {
    rightsError.textContent = '';
    rightsError.hidden = true;
    rightsRow.classList.remove('needs-rights');
    rightsBox.removeAttribute('aria-invalid');
    rightsBox.removeAttribute('aria-describedby');
  }

  function setBusy(busy, immediate) {
    stage.classList.toggle('is-busy', busy);
    stage.classList.toggle('is-resuming', busy && !!immediate);
    form.hidden = busy;
    form.inert = busy;
    fileInput.disabled = busy;
    dropzone.setAttribute('aria-disabled', String(fileInput.disabled));
    dropzone.classList.remove('is-dragging');
    rightsBox.disabled = busy;
  }

  function setStatus(message) {
    progressEl.hidden = !message;
    statusEl.textContent = message || '';
  }

  function clearResult() {
    resultEl.textContent = '';
    resultEl.hidden = true;
    closeModal();
  }

  // The desktop preview lives in a full-viewport modal so the score can use
  // more width than the page column. Closing it returns to a fresh form.
  var modalKeydown = null;

  function openModal() {
    resultEl.classList.add('part-result-modal');
    resultEl.setAttribute('role', 'dialog');
    resultEl.setAttribute('aria-modal', 'true');
    resultEl.setAttribute('aria-label', t('partPreviewDialog'));
    document.documentElement.classList.add('part-modal-open');
    var close = el('button', 'part-modal-close');
    close.type = 'button';
    close.setAttribute('aria-label', t('partPreviewClose'));
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>';
    close.addEventListener('click', leaveModal);
    resultEl.appendChild(close);
    var logo = el('span', 'part-modal-logo');
    logo.setAttribute('aria-hidden', 'true');
    resultEl.appendChild(logo);
    modalKeydown = function (event) {
      if (event.key === 'Escape' && !event.defaultPrevented) leaveModal();
    };
    document.addEventListener('keydown', modalKeydown);
    resultEl.scrollTop = 0;
    close.focus();
  }

  function closeModal() {
    resultEl.classList.remove('part-result-modal');
    resultEl.removeAttribute('role');
    resultEl.removeAttribute('aria-modal');
    resultEl.removeAttribute('aria-label');
    document.documentElement.classList.remove('part-modal-open');
    if (modalKeydown) document.removeEventListener('keydown', modalKeydown);
    modalKeydown = null;
  }

  function leaveModal() {
    window.location.href = window.location.pathname;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function isDesktop() {
    return window.matchMedia(DESKTOP_QUERY).matches;
  }

  // ---- elapsed seconds -----------------------------------------------------

  function renderElapsed() {
    var seconds = Math.max(
      0,
      Math.floor(state.elapsedBase + (Date.now() - state.elapsedAt) / 1000),
    );
    elapsedEl.textContent = t('partElapsed', { s: seconds });
  }

  function startElapsed(base) {
    state.elapsedBase = Number(base) || 0;
    state.elapsedAt = Date.now();
    renderElapsed();
    if (!state.tickTimer) state.tickTimer = setInterval(renderElapsed, 1000);
  }

  function syncElapsed(serverSeconds) {
    if (typeof serverSeconds !== 'number' || !isFinite(serverSeconds)) return;
    state.elapsedBase = serverSeconds;
    state.elapsedAt = Date.now();
    renderElapsed();
  }

  function stopElapsed() {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }

  // ---- API -----------------------------------------------------------------

  function request(method, path, body) {
    var init = { method: method, headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(API + path, init).then(
      function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!res.ok) {
            var code = data && data.error;
            if (code && typeof code === 'object') code = code.code;
            if (!code && data) code = data.code || data.errorCode;
            if (!code && res.status === 410) code = 'expired';
            if (!code && res.status === 413) code = 'too_large';
            throw new ApiError(code || 'unknown', res.status);
          }
          return data || {};
        });
      },
      function () { throw new ApiError('network', 0); },
    );
  }

  function upload(target, file) {
    if (!target || !target.url) return Promise.reject(new ApiError('unknown', 0));
    var init;
    if (target.fields) {
      var data = new FormData();
      Object.keys(target.fields).forEach(function (key) {
        data.append(key, target.fields[key]);
      });
      data.append('file', file);
      init = { method: 'POST', body: data };
    } else {
      init = {
        method: target.method || 'PUT',
        headers: target.headers || {},
        body: file,
      };
    }
    return fetch(target.url, init).then(
      function (res) {
        if (!res.ok) throw new ApiError(res.status === 413 ? 'too_large' : 'unknown', res.status);
      },
      function () { throw new ApiError('network', 0); },
    );
  }

  // ---- Turnstile (script loaded only on this page) -------------------------

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = TURNSTILE_SRC;
      script.async = true;
      script.defer = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('turnstile')); };
      document.head.appendChild(script);
    });
  }

  function deliverToken(token) {
    state.token = token;
    var waiters = state.tokenWaiters.splice(0);
    waiters.forEach(function (resolve) { resolve(token); });
  }

  // Started on the first interaction with the form (or when a token is first
  // needed), so Cloudflare's script and widget stay out of the page load.
  function initTurnstile() {
    if (state.turnstileStarted) return;
    state.turnstileStarted = true;
    loadTurnstile().then(function () {
      if (!window.turnstile || state.turnstileWidget !== null) return;
      state.turnstileWidget = window.turnstile.render(turnstileBox, {
        sitekey: CFG.turnstileSiteKey,
        action: 'partitura-tablatura',
        appearance: 'interaction-only',
        callback: deliverToken,
        'expired-callback': function () { state.token = null; },
        'error-callback': function () { state.token = null; },
      });
    }).catch(function () { /* surfaced as turnstile_failed on submit */ });
  }

  // First interaction with the form: load the third-party script and the
  // toast bundle now, so both are ready by the time they are needed.
  function warmUp() {
    if (state.warmedUp) return;
    state.warmedUp = true;
    initTurnstile();
    loadToast().catch(function () { /* retried when an error needs it */ });
  }

  function takeToken() {
    function consume(token) {
      state.token = null;
      return token;
    }
    if (state.token) return Promise.resolve(consume(state.token));
    initTurnstile();
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new ApiError('turnstile_failed', 0));
      }, 30000);
      state.tokenWaiters.push(function (token) {
        clearTimeout(timer);
        resolve(consume(token));
      });
    });
  }

  function resetTurnstile() {
    try {
      if (window.turnstile && state.turnstileWidget !== null) {
        window.turnstile.reset(state.turnstileWidget);
      }
    } catch (e) { /* ignore */ }
  }

  // ---- job lifecycle -------------------------------------------------------

  function setJobInUrl(id) {
    try {
      var url = new URL(window.location.href);
      if (id) url.searchParams.set('trabajo', id);
      else url.searchParams.delete('trabajo');
      window.history.replaceState(null, '', url.toString());
    } catch (e) { /* ignore */ }
  }

  function stopPolling() {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }

  function fail(code) {
    stopPolling();
    stopElapsed();
    setStatus('');
    clearResult();
    state.jobId = null;
    state.preview = null;
    state.autoDownloaded = false;
    setJobInUrl(null);
    form.hidden = false;
    setBusy(false);
    showError(errorText(code));
  }

  function statusMessage(job) {
    if (job.status === 'exporting') return t('partStageExporting');
    if (job.stage === 'ocr') return t('partStageOcr');
    if (job.stage === 'preparing') return t('partStagePreparing');
    if (job.status === 'created' || job.status === 'uploaded') return t('partQueued');
    return t('partStagePreparing');
  }

  function schedulePoll() {
    stopPolling();
    state.pollTimer = setTimeout(poll, POLL_MS);
  }

  function poll() {
    if (!state.jobId) return;
    var jobId = state.jobId;
    request('GET', '/jobs/' + encodeURIComponent(jobId)).then(
      function (job) {
        if (jobId !== state.jobId) return;
        onJob(job);
      },
      function (err) {
        if (jobId !== state.jobId) return;
        if (err.code === 'network') {
          // Keep trying: a transient network error should not lose the Trabajo.
          schedulePoll();
          return;
        }
        fail(err.code);
      },
    );
  }

  function onJob(job) {
    syncElapsed(job.elapsedSeconds != null ? job.elapsedSeconds : job.elapsed);
    switch (job.status) {
      case 'failed':
        fail(job.error || job.errorCode || 'unknown');
        return;
      case 'expired':
        fail('expired');
        return;
      case 'ready':
      case 'exported':
        stopPolling();
        stopElapsed();
        onReady(job);
        return;
      default:
        setStatus(statusMessage(job));
        schedulePoll();
    }
  }

  function startJob(file, tuning) {
    showError('');
    clearResult();
    fileInput.disabled = true;
    rightsBox.disabled = true;
    dropzone.setAttribute('aria-disabled', 'true');
    var kind = /\.pdf$/i.test(file.name) ? 'pdf' : 'musicxml';
    new Promise(function (resolve) { setTimeout(resolve, 500); })
      .then(function () {
        setBusy(true);
        setStatus(t('partVerifying'));
        startElapsed(0);
        return takeToken();
      })
      .then(function (token) {
        setStatus(t('partUploading'));
        return request('POST', '/jobs', {
          filename: file.name,
          kind: kind,
          tuning: tuning,
          turnstileToken: token,
        });
      })
      .then(function (created) {
        resetTurnstile();
        state.jobId = created.id;
        setJobInUrl(created.id);
        return upload(created.upload, file).then(function () {
          return request('POST', '/jobs/' + encodeURIComponent(created.id) + '/process');
        });
      })
      .then(function () {
        form.hidden = true;
        setStatus(t('partQueued'));
        startElapsed(0);
        poll();
      })
      .catch(function (err) {
        resetTurnstile();
        fail(err && err.code ? err.code : 'unknown');
      });
  }

  function resumeJob(id) {
    state.jobId = id;
    setBusy(true, true);
    setStatus(t('partQueued'));
    startElapsed(0);
    poll();
  }

  // ---- ready: preview (desktop) or direct download (mobile) ----------------

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new ApiError('unknown', res.status);
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new ApiError('unknown', res.status);
      return res.text();
    });
  }

  // GET /jobs/:id -> { preview: { json, suggestion, svgs[] } } (signed URLs).
  // Builds the model the preview renders: rows of measures with their
  // attacks (note ids, frets, bass strings) from suggestion.json.
  function loadPreviewModel(job) {
    var p = job.preview;
    if (!p || !p.json || !p.suggestion) return Promise.reject(new ApiError('unknown', 0));
    return Promise.all([fetchJson(p.json), fetchJson(p.suggestion)]).then(function (res) {
      var layout = res[0];
      var suggestion = res[1];
      var rows = Array.isArray(layout.rows) ? layout.rows : [];
      var urls = Array.isArray(p.svgs) ? p.svgs : [];
      return Promise.all(rows.map(function (row, i) {
        return urls[i] ? fetchText(urls[i]) : Promise.resolve('');
      })).then(function (markups) {
        var tabs = suggestion.tabs || [];
        var columns = suggestion.preview_columns || [];
        var measures = tabs.map(function (tab, m) {
          return (tab || []).map(function (column, c) {
            var info = (columns[m] && columns[m][c]) || {};
            return {
              noteIds: info.note_ids || [],
              bass: info.bass_strings || [],
              frets: normalizeAttack(column),
            };
          });
        });
        return {
          rows: rows.map(function (row, i) {
            return { svg: markups[i], first: row.first, last: row.last };
          }),
          staff_space: layout.staff_space,
          measures: measures,
          dropped: job.discardedNotes || suggestion.dropped || [],
          tuning: (suggestion.tuning || job.tuning) === 'dropd' ? 'E B G D A D' : 'E B G D A E',
          title: typeof suggestion.title === 'string' ? suggestion.title : '',
          author: Array.isArray(suggestion.subtitles) ? suggestion.subtitles.join(' · ') : '',
          suggestionTabs: tabs.map(function (tab) { return (tab || []).map(normalizeAttack); }),
        };
      });
    });
  }

  function onReady(job) {
    var jobId = state.jobId;
    if (!isDesktop()) {
      setStatus('');
      mobileDownload(job);
      return;
    }
    loadPreviewModel(job).then(function (model) {
      if (jobId !== state.jobId) return;
      return renderPreview(model, model.dropped, jobId).then(function () {
        // The intermediate MusicXML (PDF jobs) is available from ready.
        loadDownloads(jobId, { quiet: true });
      });
    }).catch(function (err) {
      fail(err && err.code ? err.code : 'unknown');
    });
  }

  function waitForExport(jobId) {
    return new Promise(function (resolve, reject) {
      function step() {
        request('GET', '/jobs/' + encodeURIComponent(jobId)).then(function (job) {
          if (jobId !== state.jobId) return;
          syncElapsed(job.elapsedSeconds != null ? job.elapsedSeconds : job.elapsed);
          if (job.status === 'exported') return resolve(job);
          if (job.status === 'failed') return reject(new ApiError(job.error || 'unknown', 0));
          if (job.status === 'expired') return reject(new ApiError('expired', 0));
          setTimeout(step, POLL_MS);
        }, function (err) {
          if (err.code === 'network') return setTimeout(step, POLL_MS);
          reject(err);
        });
      }
      step();
    });
  }

  function runExport(jobId, tabs, header) {
    // tabs === null asks the engine to use the Digitación sugerida.
    var body = { tabs: tabs };
    if (header) {
      body.title = header.title;
      body.subtitle = header.subtitle;
    }
    return request('POST', '/jobs/' + encodeURIComponent(jobId) + '/export', body)
      .then(function () { return waitForExport(jobId); })
      .then(function () { return request('GET', '/jobs/' + encodeURIComponent(jobId) + '/downloads'); });
  }

  var DOWNLOAD_ITEMS = [
    { keys: ['pdf'], label: 'partDlPdf' },
    { keys: ['musicxml', 'mxl', 'finalMusicxml'], label: 'partDlMusicxml' },
    { keys: ['tabs', 'json'], label: 'partDlJson' },
    { keys: ['intermediate', 'intermedio', 'intermediateMusicxml'], label: 'partDlIntermediate' },
  ];

  function downloadUrl(downloads, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = (downloads.downloads || downloads)[keys[i]];
      if (value && typeof value === 'object') value = value.url;
      if (typeof value === 'string' && value) return value;
    }
    return null;
  }

  function renderDownloads(container, downloads) {
    container.textContent = '';
    var any = false;
    var list = el('ul', 'part-download-list');
    DOWNLOAD_ITEMS.forEach(function (item) {
      var url = downloadUrl(downloads, item.keys);
      if (!url) return;
      any = true;
      var li = el('li');
      var a = el('a', 'part-download', t(item.label));
      a.href = url;
      a.setAttribute('download', '');
      a.rel = 'noopener';
      li.appendChild(a);
      list.appendChild(li);
    });
    if (!any) return false;
    container.appendChild(el('h2', 'part-downloads-heading', t('partDownloadsHeading')));
    container.appendChild(list);
    return true;
  }

  function loadDownloads(jobId, opts) {
    var box = document.getElementById('partDownloads');
    if (!box) return Promise.resolve();
    return request('GET', '/jobs/' + encodeURIComponent(jobId) + '/downloads').then(
      function (downloads) { if (jobId === state.jobId) renderDownloads(box, downloads); },
      function (err) { if (!(opts && opts.quiet)) showError(errorText(err.code)); },
    );
  }

  function triggerDownload(url) {
    var a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function mobileDownload(job) {
    var jobId = state.jobId;
    clearResult();
    resultEl.hidden = false;
    setStatus(t('partStageExporting'));
    startElapsed(job.elapsedSeconds || 0);
    var already = job.status === 'exported'
      ? request('GET', '/jobs/' + encodeURIComponent(jobId) + '/downloads')
      : loadPreviewModel(job).then(function (model) {
          return runExport(jobId, model.suggestionTabs);
        });
    already.then(function (downloads) {
      if (jobId !== state.jobId) return;
      stopElapsed();
      setStatus('');
      resultEl.appendChild(el('p', 'part-mobile-ready', t('partMobileReady')));
      var box = el('div', 'part-downloads');
      renderDownloads(box, downloads);
      resultEl.appendChild(box);
      resultEl.appendChild(el('p', 'part-note', t('partMobileNote')));
      var pdf = downloadUrl(downloads, ['pdf']);
      if (pdf && !state.autoDownloaded) {
        state.autoDownloaded = true;
        triggerDownload(pdf);
      }
      showNewJobLink();
    }).catch(function (err) {
      fail(err && err.code ? err.code : 'unknown');
    });
  }

  function showNewJobLink() {
    var btn = el('button', 'part-btn part-btn-secondary', t('partNewJob'));
    btn.type = 'button';
    btn.addEventListener('click', function () {
      window.location.href = window.location.pathname;
    });
    resultEl.appendChild(btn);
  }

  // ---- preview: Verovio SVG + one <ascii-tabs> per measure -----------------

  var STORAGE_PREFIX = 'partitura.edits.v1.';

  function loadEdits(jobId) {
    try {
      var raw = window.localStorage.getItem(STORAGE_PREFIX + jobId);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveEdits(jobId, tabs) {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + jobId, JSON.stringify(tabs));
    } catch (e) { /* storage unavailable: edits stay in memory */ }
  }

  function fretOf(cell) {
    if (cell !== null && typeof cell === 'object') return cell.fret == null ? null : cell.fret;
    return cell == null ? null : cell;
  }

  // ascii-tabs value (cells may be objects) -> Columns of 6 numbers|null.
  function plainTab(value) {
    return (value || []).map(function (column) {
      var out = [];
      for (var s = 0; s < STRINGS_COUNT; s++) out.push(fretOf(column && column[s]));
      return out;
    });
  }

  function normalizeAttack(frets) {
    var out = [];
    for (var s = 0; s < STRINGS_COUNT; s++) {
      var v = frets && frets[s];
      out.push(typeof v === 'number' && isFinite(v) ? v : null);
    }
    return out;
  }

  // ---- First-use tips ------------------------------------------------------

  // Each tip stays 12 seconds, then goes away by itself. Closing it with the
  // button remembers that in localStorage so it never returns; letting it
  // expire does not, so it shows again next time.
  var TIP_MS = 12000;
  var TIP_BASS_KEY = 'partitura.tip.bass';
  var TIP_BOLD_KEY = 'partitura.tip.bold';
  var tipsStarted = false;

  function tipSeen(key) {
    try { return window.localStorage.getItem(key) === '1'; } catch (e) { return false; }
  }

  function rememberTip(key) {
    try { window.localStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
  }

  // Staff with a downward-stem note (the bass) next to an upward-stem one.
  function bassTipGraphic() {
    var ns = 'http://www.w3.org/2000/svg';
    function node(name, attrs, text) {
      var n = document.createElementNS(ns, name);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (text) n.textContent = text;
      return n;
    }
    var svg = node('svg', { viewBox: '0 0 200 112', 'class': 'part-tip-graphic', 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) {
      var y = 34 + i * 8;
      svg.appendChild(node('line', { x1: 8, x2: 192, y1: y, y2: y, stroke: 'currentColor', 'stroke-width': 1, opacity: 0.45 }));
    }
    // Melody: stem up on the right of the head.
    svg.appendChild(node('ellipse', { cx: 140, cy: 42, rx: 6.5, ry: 4.6, transform: 'rotate(-20 140 42)', fill: 'currentColor' }));
    svg.appendChild(node('line', { x1: 146, x2: 146, y1: 41, y2: 8, stroke: 'currentColor', 'stroke-width': 1.6 }));
    svg.appendChild(node('text', { x: 140, y: 100, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': 12 }, t('partTipBassMelody')));
    // Bass: stem down on the left of the head, highlighted.
    svg.appendChild(node('ellipse', { cx: 60, cy: 66, rx: 6.5, ry: 4.6, transform: 'rotate(-20 60 66)', fill: 'var(--accent)' }));
    svg.appendChild(node('line', { x1: 54, x2: 54, y1: 67, y2: 98, stroke: 'var(--accent)', 'stroke-width': 1.6 }));
    svg.appendChild(node('path', { d: 'M54 104 l-4 -6 h8 z', fill: 'var(--accent)' }));
    svg.appendChild(node('text', { x: 60, y: 22, 'text-anchor': 'middle', fill: 'var(--accent)', 'font-size': 12, 'font-weight': 700 }, t('partTipBassBass')));
    return svg;
  }

  function boldTipGraphic() {
    var template = $('partBoldTipDemo');
    return template && template.content ? template.content.cloneNode(true) : null;
  }

  // Shows one tip; `done` runs once when it ends, closed or expired.
  function showTip(storageKey, title, body, graphic, done) {
    var tip = el('div', 'part-tip');
    tip.setAttribute('role', 'status');
    var close = el('button', 'part-tip-close');
    close.type = 'button';
    close.setAttribute('aria-label', t('partTipClose'));
    close.appendChild(el('span', null, '×'));
    close.firstChild.setAttribute('aria-hidden', 'true');
    tip.appendChild(close);
    tip.appendChild(el('strong', 'part-tip-title', title));
    if (graphic) {
      var art = el('div', 'part-tip-art');
      art.appendChild(graphic);
      tip.appendChild(art);
    }
    tip.appendChild(el('p', 'part-tip-body', body));
    var bar = el('span', 'part-tip-timer');
    bar.style.animationDuration = TIP_MS + 'ms';
    tip.appendChild(bar);
    var ended = false;
    var timer = null;
    function end(remember) {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      if (remember) rememberTip(storageKey);
      tip.remove();
      done();
    }
    close.addEventListener('click', function () { end(true); });
    timer = setTimeout(function () { end(false); }, TIP_MS);
    document.body.appendChild(tip);
  }

  // The first time the bass is highlighted: how the bass is chosen, then the B shortcut.
  function showBassTips() {
    if (tipsStarted) return;
    tipsStarted = true;
    function boldTip() {
      if (tipSeen(TIP_BOLD_KEY)) return;
      var demo = boldTipGraphic();
      if (demo) demo.firstChild.classList.add('part-tip-demo');
      showTip(TIP_BOLD_KEY, t('partTipBoldTitle'), t('partTipBoldBody'), demo, function () {});
    }
    if (tipSeen(TIP_BASS_KEY)) { boldTip(); return; }
    showTip(TIP_BASS_KEY, t('partTipBassTitle'), t('partTipBassBody'), bassTipGraphic(), boldTip);
  }

  // Bass: the lowest sounding String (highest index) of a Column.
  function bassString(column) {
    for (var s = STRINGS_COUNT - 1; s >= 0; s--) if (column[s] !== null) return s;
    return -1;
  }

  // Bass strings come from the engine (suggestion.json bass_strings): only
  // notes with a downward stem. An empty list means no bass in that Column;
  // the lowest-String fallback applies only when the engine sent no data.
  function styledTab(tab, boldBass, bassColumns) {
    if (!boldBass) return tab.map(function (column) { return column.slice(); });
    return tab.map(function (column, c) {
      var listed = bassColumns && bassColumns[c];
      var bass = listed ? listed : [bassString(column)];
      return column.map(function (fret, s) {
        return fret === null ? null : { fret: fret, bold: bass.indexOf(s) !== -1 };
      });
    });
  }

  function sanitizeSvg(markup) {
    var doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    var root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
      return null;
    }
    Array.prototype.forEach.call(root.querySelectorAll('script, foreignObject'), function (n) {
      n.remove();
    });
    Array.prototype.forEach.call(root.querySelectorAll('*'), function (node) {
      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
      });
    });
    return document.importNode(root, true);
  }

  function intrinsicSize(svg) {
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    var w = parseFloat(svg.getAttribute('width'));
    var h = parseFloat(svg.getAttribute('height'));
    if (!(w > 0) && vb.length === 4) w = vb[2];
    if (!(h > 0) && vb.length === 4) h = vb[3];
    if (!(w > 0)) w = 1000;
    if (!(h > 0)) h = 300;
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    return { w: w, h: h };
  }

  function byId(root, id) {
    if (!id) return null;
    var esc = window.CSS && CSS.escape ? CSS.escape(id) : id;
    try {
      // Verovio ids reach the SVG as data-id (and as id on the element).
      return root.querySelector('[data-id="' + String(id).replace(/"/g, '') + '"]') ||
        root.querySelector('#' + esc);
    } catch (e) { return null; }
  }

  // Center x (client pixels) of a note, found by identifier, never by order.
  function noteCenter(svg, id) {
    var node = byId(svg, id);
    if (!node) return null;
    var head = node.querySelector('.notehead') || node;
    var box = head.getBoundingClientRect();
    if (!box.width && !box.height) return null;
    return box.left + box.width / 2;
  }

  var CHAR_WIDTH = 11; // px of one fret digit at the tab font size
  var MIN_GAP = 6;

  // Positions of each Column in CSS pixels from the measure's left edge.
  function computeLayout(attacks, svg, measureNode) {
    var count = attacks.length;
    var left = 0;
    var width = 0;
    if (measureNode) {
      var mb = measureNode.getBoundingClientRect();
      left = mb.left;
      width = mb.width;
    }
    if (!(width > 0)) width = Math.max(count * 36, 60);
    var positions = [];
    var known = 0;
    for (var c = 0; c < count; c++) {
      var ids = attacks[c].noteIds || [];
      var sum = 0;
      var n = 0;
      for (var i = 0; i < ids.length; i++) {
        var x = noteCenter(svg, ids[i]);
        if (x !== null) { sum += x; n++; }
      }
      if (n) { positions.push(sum / n - left); known++; } else positions.push(null);
    }
    if (!known || !measureNode) {
      // No usable note positions: spread the Columns evenly.
      positions = positions.map(function (_, c) { return ((c + 0.5) / count) * width; });
    } else {
      // Fill gaps by interpolation between known neighbors.
      for (var k = 0; k < count; k++) {
        if (positions[k] !== null) continue;
        var prev = k - 1;
        while (prev >= 0 && positions[prev] === null) prev--;
        var next = k + 1;
        while (next < count && positions[next] === null) next++;
        var a = prev >= 0 ? positions[prev] : 0;
        var b = next < count ? positions[next] : width;
        var pa = prev >= 0 ? prev : -1;
        var pb = next < count ? next : count;
        positions[k] = a + ((b - a) * (k - pa)) / (pb - pa);
      }
    }
    return { width: width, positions: positions };
  }

  // Keep Frets from overlapping: enforce a minimum gap sized by digit count and
  // widen the area when the measure is too tight (the tab then scrolls).
  function spaceColumns(layout, tab, charWidth, minChars) {
    charWidth = charWidth || CHAR_WIDTH;
    minChars = minChars || 1;
    var positions = layout.positions.slice();
    var width = layout.width;
    for (var c = 0; c < positions.length; c++) {
      var digits = minChars;
      for (var s = 0; s < STRINGS_COUNT; s++) {
        var f = tab[c] ? fretOf(tab[c][s]) : null;
        if (f !== null) digits = Math.max(digits, String(f).length);
      }
      var half = (digits * charWidth) / 2 + 1;
      if (positions[c] < half) positions[c] = half;
      if (c > 0) {
        var prevDigits = minChars;
        for (var p = 0; p < STRINGS_COUNT; p++) {
          var pf = tab[c - 1] ? fretOf(tab[c - 1][p]) : null;
          if (pf !== null) prevDigits = Math.max(prevDigits, String(pf).length);
        }
        var gap = (prevDigits * charWidth) / 2 + half + MIN_GAP;
        if (positions[c] < positions[c - 1] + gap) positions[c] = positions[c - 1] + gap;
      }
    }
    if (positions.length) {
      var last = positions[positions.length - 1];
      width = Math.max(width, last + 12);
    }
    return { width: width, positions: positions };
  }

  // The example is one real row of four measures: the engine's notation and
  // the same TAB component and note-id geometry as an uploaded score, without
  // creating a Job. The TAB clef completes the staff.
  function renderExample() {
    var container = $('partExampleScore');
    var example = CFG.example;
    if (!container || !example) return;
    var svg = sanitizeSvg(example.svg);
    if (!svg) return;
    var size = intrinsicSize(svg);
    var row = el('div', 'part-row');
    var notation = el('div', 'part-row-notation');
    var tabsLine = el('div', 'part-row-tabs');
    var staffNames = el('div', 'part-example-names');
    var join = null;
    notation.appendChild(svg);
    row.appendChild(notation);
    row.appendChild(tabsLine);
    container.appendChild(row);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('partExampleAlt'));

    customElements.whenDefined('ascii-tabs').then(function () {
      var values = example.measures.map(function (attacks) {
        return attacks.map(function (attack) { return attack.frets; });
      });
      var elements = values.map(function () {
        var tabs = document.createElement('ascii-tabs');
        tabs.className = 'part-example-tab';
        tabs.setAttribute('labels', 'none');
        tabs.setAttribute('variant', 'flat');
        tabs.setAttribute('theme', 'light');
        tabs.setAttribute('lang', CFG.locale === 'en' ? 'en' : 'es');
        tabs.setAttribute('readonly', '');
        tabs.appendChild(document.createElement('ascii-tabs-sheet'));
        tabsLine.appendChild(tabs);
        return tabs;
      });
      tabsLine.appendChild(staffNames);

      // "TAB" under the clef.
      function decorate() {
        var base = tabsLine.getBoundingClientRect();
        var areas = elements[0].querySelectorAll('.ascii-tabs-area');
        var clef = svg.querySelector('g.clef');
        staffNames.textContent = '';
        if (areas.length !== STRINGS_COUNT || !clef) return;
        var first = areas[0].getBoundingClientRect();
        var step = (areas[STRINGS_COUNT - 1].getBoundingClientRect().top - first.top) / (STRINGS_COUNT - 1);
        var clefBox = clef.getBoundingClientRect();
        'TAB'.split('').forEach(function (letter, i) {
          var mark = el('span', 'part-example-clef', letter);
          mark.style.left = (clefBox.left + clefBox.width / 2 - base.left) + 'px';
          mark.style.top = (first.top - base.top + step * (1.5 + i) + first.height / 2) + 'px';
          staffNames.appendChild(mark);
        });
        // System barline joining the staff and the TAB, as in the preview.
        if (join) join.remove();
        var staff = svg.querySelector('g.staff');
        if (staff) {
          var rowBox = row.getBoundingClientRect();
          var lines = Array.prototype.filter.call(staff.children, function (n) {
            return n.nodeName.toLowerCase() === 'path';
          });
          var staffBox = (lines[0] || staff).getBoundingClientRect();
          var bottom = first.top + step * (STRINGS_COUNT - 1) + first.height / 2;
          join = el('span', 'part-row-join');
          join.style.left = (staffBox.left - rowBox.left) + 'px';
          join.style.top = (staffBox.top - rowBox.top) + 'px';
          join.style.height = (bottom - staffBox.top) + 'px';
          row.appendChild(join);
        }
      }

      function layout() {
        var staffSpace = example.staffSpace || 7.2;
        // Same scale rule as an uploaded score; a narrow screen scrolls the
        // example instead of shrinking the digits.
        var box = getComputedStyle(container);
        var content = container.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
        var available = Math.max(content, 560);
        var scale = available / Math.max(90 * staffSpace, size.w);
        if (!(scale > 0)) return;
        var font = Math.min(28, Math.max(13, 2 * staffSpace * scale));
        tabsLine.style.setProperty('--ascii-tabs-font-size', font + 'px');
        svg.setAttribute('width', String(size.w * scale));
        svg.setAttribute('height', String(size.h * scale));
        var rowLeft = svg.getBoundingClientRect().left;
        var nodes = svg.querySelectorAll('g.measure');
        elements.forEach(function (tabs, k) {
          var node = nodes[k] || null;
          var attacks = example.measures[k];
          var measure = computeLayout(attacks, svg, node);
          var spaced = spaceColumns(measure, values[k]);
          tabs.style.left = (node ? node.getBoundingClientRect().left - rowLeft : 0) + 'px';
          // The first measure's box starts a few px before the staff lines;
          // clip the TAB lines so they begin on the system barline.
          var staffLine = k === 0 && svg.querySelector('g.staff path');
          var overshoot = staffLine ? staffLine.getBoundingClientRect().left - (node ? node.getBoundingClientRect().left : rowLeft) : 0;
          tabs.style.clipPath = overshoot > 0 ? 'inset(0 0 0 ' + overshoot + 'px)' : '';
          tabs.style.width = Math.min(measure.width, spaced.width) + 'px';
          tabs.setDocument({ value: [values[k]], columnLayout: [spaced] });
        });
        requestAnimationFrame(function () {
          var height = 0;
          elements.forEach(function (tabs) { height = Math.max(height, tabs.offsetHeight); });
          if (height) tabsLine.style.height = height + 'px';
          decorate();
        });
      }
      layout();
      new ResizeObserver(layout).observe(container);
    });
  }

  function renderPreview(preview, dropped, jobId) {
    clearResult();
    resultEl.hidden = false;
    openModal();
    // Keep the loading visible until the modal is up.
    setStatus('');
    state.preview = preview;
    state.previewJobId = jobId;

    var rows = preview.rows;

    var persisted = loadEdits(jobId);
    var suggested = [];
    var current = [];
    var elements = [];
    var layouts = [];
    var bassOf = [];
    var boldBass = false;
    var editRevision = 0;
    var downloadedRevision = null;

    function markEdited() {
      editRevision += 1;
      confirmBtn.disabled = state.exporting;
    }

    // Toolbar.
    var toolbar = el('div', 'part-toolbar');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', t('partToolbarLabel'));
    function toolbarCheckbox(id, text) {
      var label = el('label', 'part-toolbar-item');
      label.htmlFor = id;
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      label.appendChild(input);
      label.appendChild(el('span', null, text));
      return { label: label, input: input };
    }
    var notation = toolbarCheckbox('partNotation', t('partNotationNames'));
    var notationInput = notation.input;
    var boldControl = toolbarCheckbox('partBoldBass', t('partBoldBass'));
    var boldInput = boldControl.input;
    function notationValue() { return notationInput.checked ? 'solfege' : 'frets'; }
    var tabFontPx = 15;
    toolbar.appendChild(notation.label);
    toolbar.appendChild(boldControl.label);
    // Title and author as underlined inputs, prefilled from the extraction;
    // what the user leaves here is what the PDF header shows.
    function headerInput(id, label, value) {
      var input = document.createElement('input');
      input.type = 'text';
      input.id = id;
      input.className = 'part-header-input part-header-' + (id === 'partTitle' ? 'title' : 'author');
      input.value = value || '';
      input.maxLength = 200;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', label);
      input.placeholder = label;
      return input;
    }
    var titleInput = headerInput('partTitle', t('partTitleLabel'), preview.title);
    var authorInput = headerInput('partAuthor', t('partAuthorLabel'), preview.author);
    titleInput.addEventListener('input', markEdited);
    authorInput.addEventListener('input', markEdited);
    var titleRow = el('div', 'part-header-row');
    var titleWrap = el('div', 'part-header');
    titleWrap.appendChild(titleInput);
    titleRow.appendChild(titleWrap);
    resultEl.appendChild(titleRow);
    var authorWrap = el('div', 'part-header');
    authorWrap.appendChild(authorInput);
    toolbar.appendChild(authorWrap);
    resultEl.appendChild(toolbar);

    // Sticky footer with the primary action.
    var footer = el('div', 'part-footer');
    var confirmBtn = el('button', 'part-btn part-footer-btn');
    confirmBtn.type = 'button';
    confirmBtn.id = 'partConfirm';
    var confirmIcon = el('span', 'part-footer-icon');
    confirmIcon.setAttribute('aria-hidden', 'true');
    confirmIcon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />' +
      '<path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" />' +
      '<path d="M16 17H8" /></svg>';
    var confirmText = el('span', null, t('partConfirm'));
    confirmBtn.appendChild(confirmIcon);
    confirmBtn.appendChild(confirmText);
    footer.appendChild(confirmBtn);

    var rowsEl = el('div', 'part-rows');
    rowsEl.id = 'partRows';
    resultEl.appendChild(rowsEl);
    resultEl.appendChild(footer);

    // Build rows.
    var rowViews = [];
    var svgPromises = rows.map(function (row) {
      return Promise.resolve(row.svg || '');
    });

    return Promise.all(svgPromises).then(function (markups) {
      return customElements.whenDefined('ascii-tabs').then(function () {
        rows.forEach(function (row, r) {
          var wrap = el('div', 'part-row');
          var notation = el('div', 'part-row-notation');
          var svg = markups[r] ? sanitizeSvg(markups[r]) : null;
          var tabsLine = el('div', 'part-row-tabs');
          var names = el('div', 'part-example-names');
          wrap.appendChild(notation);
          wrap.appendChild(tabsLine);
          rowsEl.appendChild(wrap);
          var view = { svg: svg, notation: notation, tabsLine: tabsLine, names: names, size: null, measures: [] };
          if (svg) {
            view.size = intrinsicSize(svg);
            notation.appendChild(svg);
          }
          var first = Number(row.first) || 0;
          var last = row.last != null ? Number(row.last) : first;
          for (var k0 = 0; first + k0 <= last; k0++) (function (k) {
            var attacks = preview.measures[first + k] || [];
            var index = first + k;
            while (suggested.length < index) { suggested.push([]); current.push([]); elements.push(null); bassOf.push([]); }
            bassOf[index] = attacks.map(function (a) { return a.bass; });
            var base = attacks.map(function (a) { return a.frets; });
            suggested.push(base);
            var restored = persisted && persisted[index];
            var tab = Array.isArray(restored) && restored.length === base.length
              ? restored.map(normalizeAttack)
              : base.map(function (c) { return c.slice(); });
            current.push(tab);
            var tabsEl = document.createElement('ascii-tabs');
            tabsEl.className = 'part-measure-tab';
            tabsEl.setAttribute('labels', 'none');
            tabsEl.setAttribute('tuning', preview.tuning || 'E B G D A E');
            tabsEl.setAttribute('variant', 'flat');
            tabsEl.setAttribute('theme', 'light');
            tabsEl.setAttribute('lang', CFG.locale === 'en' ? 'en' : 'es');
            tabsEl.dataset.measure = String(index);
            tabsEl.appendChild(document.createElement('ascii-tabs-sheet'));
            tabsLine.appendChild(tabsEl);
            if (k === 0) tabsLine.appendChild(names);
            elements.push(tabsEl);
            var measureView = {
              index: index,
              k: k,
              attacks: attacks,
              el: tabsEl,
            };
            view.measures.push(measureView);
            tabsEl.addEventListener('change', function (event) {
              current[index] = plainTab(event.detail.value[0]);
              onEdited();
            });
          })(k0);
          rowViews.push(view);
        });

        function layoutAll() {
          var available = Math.max(rowsEl.clientWidth || 700, 760);
          var widest = 0;
          rowViews.forEach(function (v) { if (v.size) widest = Math.max(widest, v.size.w); });
          // Match the original music21 preview: one scale for all systems,
          // with a four-measure minimum so short scores keep natural proportions.
          var staffSpace = preview.staff_space || 7.2;
          var reference = Math.max(90 * staffSpace, widest);
          var scale = available / reference;
          var names = notationInput.checked;
          rowsEl.classList.toggle('part-names-mode', names);
          // One font size in both modes so the TAB height never changes;
          // note names are shrunk per cell in CSS instead.
          var tabFont = Math.min(28, Math.max(13, 2 * staffSpace * scale));
          tabFontPx = tabFont;
          rowViews.forEach(function (v) {
            if (!v.svg || !v.size) return;
            v.tabsLine.style.setProperty('--ascii-tabs-font-size', tabFont + 'px');
            v.svg.setAttribute('width', String(v.size.w * scale));
            v.svg.setAttribute('height', String(v.size.h * scale));
          });
          rowViews.forEach(function (v) {
            var rowLeft = v.svg ? v.svg.getBoundingClientRect().left : 0;
            v.measures.forEach(function (m) {
              var node = v.svg ? v.svg.querySelectorAll('g.measure')[m.k] || null : null;
              var layout = computeLayout(m.attacks, v.svg || document.body, node);
              // Note-names mode keeps each name at its score position; overlap is fine.
              var spaced = notationInput.checked
                ? layout
                : spaceColumns(layout, current[m.index]);
              layouts[m.index] = spaced;
              var left = node ? node.getBoundingClientRect().left - rowLeft : 0;
              m.el.style.left = left + 'px';
              m.el.style.width = Math.min(layout.width, spaced.width) + 'px';
              applyValue(m.index, true);
            });
          });
          requestAnimationFrame(function () {
            rowViews.forEach(function (v) {
              var h = 0;
              v.measures.forEach(function (m) { h = Math.max(h, m.el.offsetHeight); });
              if (h) v.tabsLine.style.height = h + 'px';
              decorateRow(v);
            });
          });
        }

        // String names beside the first measure and "TAB" under the clef.
        function decorateRow(v) {
          v.names.textContent = '';
          var first = v.measures[0];
          if (!first || !v.svg) return;
          var base = v.tabsLine.getBoundingClientRect();
          var areas = first.el.querySelectorAll('.ascii-tabs-area');
          if (areas.length !== STRINGS_COUNT) return;
          var tuning = (preview.tuning || 'E B G D A E').split(/\s+/);
          var top = areas[0].getBoundingClientRect();
          var step = (areas[STRINGS_COUNT - 1].getBoundingClientRect().top - top.top) / (STRINGS_COUNT - 1);
          var left = areas[0].getBoundingClientRect().left - base.left;
          for (var s = 0; s < STRINGS_COUNT; s++) {
            var name = el('span', 'part-string-name', tuning[s] || '');
            name.style.left = (left - 6) + 'px';
            name.style.top = (top.top - base.top + step * s + top.height / 2) + 'px';
            v.names.appendChild(name);
          }
          // System barline joining the staff and the TAB, as in the PDF.
          var staff = v.svg.querySelector('g.staff');
          if (v.join) v.join.remove();
          if (staff) {
            var wrapBox = v.tabsLine.parentNode.getBoundingClientRect();
            // The staff group's box includes stems, clef and ornaments; the
            // barline must start at the first staff line itself.
            var lines = Array.prototype.filter.call(staff.children, function (n) {
              return n.nodeName.toLowerCase() === 'path';
            });
            var staffBox = (lines[0] || staff).getBoundingClientRect();
            var bottom = top.top + step * (STRINGS_COUNT - 1) + top.height / 2;
            v.join = el('span', 'part-row-join');
            v.join.style.left = (staffBox.left - wrapBox.left) + 'px';
            v.join.style.top = (staffBox.top - wrapBox.top) + 'px';
            v.join.style.height = (bottom - staffBox.top) + 'px';
            v.tabsLine.parentNode.appendChild(v.join);
          }
          var clef = v.svg.querySelector('g.clef');
          if (!clef) return;
          var clefBox = clef.getBoundingClientRect();
          'TAB'.split('').forEach(function (letter, i) {
            var mark = el('span', 'part-example-clef', letter);
            mark.style.left = (clefBox.left + clefBox.width / 2 - base.left) + 'px';
            mark.style.top = (top.top - base.top + step * (1.5 + i) + top.height / 2) + 'px';
            v.names.appendChild(mark);
          });
        }

        function applyValue(index, withLayout) {
          var elx = elements[index];
          var value = styledTab(current[index], boldBass, bassOf[index]);
          try {
            if (withLayout) {
              elx.setDocument({ value: [value], columnLayout: [layouts[index]] });
            } else {
              elx.value = [value];
            }
          } catch (e) {
            // Invalid geometry: fall back to plain ASCII layout for this measure.
            try { elx.setDocument({ value: [value] }); } catch (e2) { /* ignore */ }
          }
          if (elx.notation !== notationValue()) elx.notation = notationValue();
        }

        function onEdited() {
          saveEdits(jobId, current);
          markEdited();
        }

        notationInput.addEventListener('change', function () {
          layoutAll();
        });
        boldInput.addEventListener('change', function () {
          boldBass = boldInput.checked;
          if (boldBass) showBassTips();
          elements.forEach(function (_, i) { applyValue(i, true); });
        });
        confirmBtn.addEventListener('click', function () {
          if (state.exporting || downloadedRevision === editRevision) return;
          var exportingRevision = editRevision;
          state.exporting = true;
          confirmBtn.disabled = true;
          showError('');
          var label = confirmText.textContent;
          var idleIcon = confirmIcon.innerHTML;
          confirmIcon.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56" /></svg>';
          confirmBtn.setAttribute('aria-busy', 'true');
          confirmText.textContent = t('partExporting');
          runExport(jobId, current.map(function (tab) { return tab.map(function (c) { return c.slice(); }); }),
            { title: titleInput.value, subtitle: authorInput.value })
            .then(function (downloads) {
              var pdf = downloadUrl(downloads, ['pdf']);
              if (pdf) {
                triggerDownload(pdf);
                downloadedRevision = exportingRevision;
                loadToast().then(function () {
                  window.SiteToast.show(t('partPdfDownloaded'), { duration: 6000 });
                }, function () { /* Download succeeded even if the toast cannot load. */ });
              }
            })
            .catch(function (err) {
              showError(errorText(err && err.code));
            })
            .then(function () {
              state.exporting = false;
              confirmBtn.disabled = downloadedRevision === editRevision;
              confirmBtn.removeAttribute('aria-busy');
              confirmIcon.innerHTML = idleIcon;
              confirmText.textContent = label;
            });
        });

        layoutAll();
        var resizeTimer = null;
        window.addEventListener('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(layoutAll, 150);
        });
      });
    });
  }

  // ---- form wiring ---------------------------------------------------------

  function extensionOk(name) {
    return /\.(pdf|mxl|musicxml|xml)$/i.test(name);
  }

  rightsBox.addEventListener('change', function () {
    setBusy(false);
    showError('');
    clearRightsError();
    if (rightsBox.checked && state.pendingFile) attachFile(state.pendingFile);
  });

  rightsRow.addEventListener('animationend', function () {
    rightsRow.classList.remove('needs-rights');
  });

  function attachFile(file) {
    if (fileInput.disabled) return;
    showError('');
    if (!file) return;
    state.pendingFile = null;
    clearRightsError();
    dropTitle.textContent = t('partDropTitle');
    if (!extensionOk(file.name)) {
      showError(t('partErrBadType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      showError(errorText('too_large'));
      return;
    }
    dropTitle.textContent = file.name;
    if (!rightsBox.checked) {
      state.pendingFile = file;
      rightsRow.classList.remove('needs-rights');
      void rightsRow.offsetWidth;
      rightsRow.classList.add('needs-rights');
      rightsBox.setAttribute('aria-invalid', 'true');
      rightsBox.setAttribute('aria-describedby', 'partRightsError');
      rightsError.textContent = t('partErrRights');
      rightsError.hidden = false;
      rightsBox.focus();
      return;
    }
    startJob(file, 'auto');
  }

  form.addEventListener('submit', function (event) { event.preventDefault(); });
  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    attachFile(file);
  });
  dropzone.addEventListener('dragover', function (event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = fileInput.disabled ? 'none' : 'copy';
    if (!fileInput.disabled) dropzone.classList.add('is-dragging');
  });
  dropzone.addEventListener('dragleave', function (event) {
    if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-dragging');
  });
  dropzone.addEventListener('drop', function (event) {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    attachFile(event.dataTransfer.files[0]);
  });

  if (isDesktop()) renderExample();
  setBusy(false);

  ['pointerdown', 'focusin', 'dragenter', 'keydown'].forEach(function (type) {
    form.addEventListener(type, warmUp, true);
  });

  var resumeId = null;
  try { resumeId = new URL(window.location.href).searchParams.get('trabajo'); } catch (e) { /* ignore */ }
  if (resumeId && /^[A-Za-z0-9_-]{6,128}$/.test(resumeId)) resumeJob(resumeId);
})();
