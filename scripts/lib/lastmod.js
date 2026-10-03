'use strict';
/* lastmod.js — Fechas de modificacion del sitemap basadas en contenido.
   Un manifest versionado (por URL: hash del contenido indexable + fecha)
   evita renovar la fecha de paginas que no cambiaron: la fecha solo avanza
   cuando el hash del contenido cambia. */

const fs = require('fs');
const crypto = require('crypto');

function hashOf(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function loadManifest(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return {};
  }
}

/* entries: { [url]: content (string|Buffer) }. Devuelve { lastmods, manifest }
   donde manifest solo contiene las URLs vigentes (las retiradas se descartan). */
function resolveLastmods(previous, entries, today) {
  const manifest = {};
  const lastmods = {};
  Object.keys(entries).sort().forEach((url) => {
    const hash = hashOf(entries[url]);
    const prev = previous[url];
    const lastmod = prev && prev.hash === hash ? prev.lastmod : today;
    manifest[url] = { hash, lastmod };
    lastmods[url] = lastmod;
  });
  return { lastmods, manifest };
}

function saveManifest(file, manifest) {
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

module.exports = { resolveLastmods, loadManifest, saveManifest };
