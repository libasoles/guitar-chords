'use strict';
async function clearScoreStorage(page) {
  await page.evaluate(async () => {
    await window.ScoreStore?.flush();
    localStorage.clear();
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('partitura', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      if (!db.objectStoreNames.contains('workspace')) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
}
async function readScoreStorage(page) {
  return page.evaluate(async () => {
    await window.ScoreStore.flush();
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('partitura', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const req = db.transaction('workspace').objectStore('workspace').get('tabs');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  });
}
module.exports = { clearScoreStorage, readScoreStorage };
