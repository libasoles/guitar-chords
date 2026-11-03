(function () {
  // Local persistence. Scores live in IndexedDB (large, structured, no 5 MB cap); settings live in localStorage
  // The editor restores the workspace before starting. Each edit starts a transaction immediately,
  // so reloading right after typing does not leave a pending debounce behind.
  const DB_NAME = 'partitura';
  const STORE = 'workspace';
  const TABS_RECORD = 'tabs';
  const LEGACY_TABS_KEY = 'scoreEditor.tabs.v1'; // where the scores lived before IndexedDB

  let db = null;
  let pending = null; // latest value waiting to be written
  let writing = Promise.resolve();

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexedDB blocked'));
    });
  }

  function put(value) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, TABS_RECORD);
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function readLegacy() {
    try {
      const tabs = JSON.parse(localStorage.getItem(LEGACY_TABS_KEY));
      if (tabs && Array.isArray(tabs.scores) && tabs.scores.length) return tabs;
      for (const [key, divisions] of [['scoreEditor.v2', undefined], ['scoreEditor.v1', 8]]) {
        const one = JSON.parse(localStorage.getItem(key));
        if (one) return { active: 0, scores: [window.ScoreModel.sanitize(one, divisions)] };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function fallback(value) {
    try { localStorage.setItem(LEGACY_TABS_KEY, JSON.stringify(value)); } catch (e) { /* Storage unavailable. */ }
  }

  function flush() {
    if (pending === null) return writing;
    const value = pending;
    pending = null;
    if (db) {
      const connection = db;
      try {
        writing = put(value).catch(() => {
          connection.close();
          if (db === connection) db = null;
          fallback(value);
        });
        return writing;
      } catch (e) {
        connection.close();
        db = null;
      }
    }
    fallback(value);
    return writing;
  }

  // Resolves with the stored { active, scores } (unsanitized), or null when there is nothing saved yet.
  window.initScoreStorage = async function initStorage() {
    let stored = null;
    try {
      db = await open();
      stored = await request(db.transaction(STORE).objectStore(STORE).get(TABS_RECORD));
      if (!stored) {
        const legacy = readLegacy();
        if (legacy) {
          await put(legacy);
          stored = legacy;
          try {
            [LEGACY_TABS_KEY, 'scoreEditor.v2', 'scoreEditor.v1'].forEach(key => localStorage.removeItem(key));
          } catch (e) { /* nothing to clean */ }
        }
      }
    } catch (e) {
      if (db) db.close();
      db = null; // IndexedDB unavailable (private mode, blocked): keep using localStorage
      stored = readLegacy();
    }
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.ScoreStore = {
      stored,
      flush,
      save(value) {
        pending = value;
        flush();
      },
    };
  };
})();
