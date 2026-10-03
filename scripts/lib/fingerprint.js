'use strict';
/* fingerprint.js — Versiona por contenido los assets estaticos de dist/site.
   Renombra assets/**.{js,css,svg} a <nombre>.<hash10>.<ext> y reescribe todas
   las referencias (HTML, JS, CSS, manifests y sw.js). Un deploy que cambia un
   archivo cambia su URL, asi que las URLs fingerprinted son inmutables y se
   pueden servir con cache de larga vida. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASHED_EXT = new Set(['.js', '.css', '.svg']);
const TEXT_EXT = new Set(['.html', '.js', '.css', '.webmanifest', '.svg', '.xml', '.json']);
const HASH_LEN = 10;
// Nombre ya fingerprinted: name.<10 hex>.ext
const HASHED_NAME_RE = new RegExp('\\.[0-9a-f]{' + HASH_LEN + '}\\.(js|css|svg)$');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function hashOf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LEN);
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Reemplaza el nombre de archivo cuando aparece como ultimo segmento de una
   ruta o literal ("/x/name.js", 'name.js', "name.js?v=1"). */
function rewriteRefs(text, renames) {
  let out = text;
  renames.forEach((to, from) => {
    out = out.replace(new RegExp('(?<=[/\'"`])' + escapeRe(from) + '(?=[\'"`?#)\\s])', 'g'), to);
  });
  return out;
}

function rewriteTextFiles(files, renames) {
  files.forEach((f) => {
    if (!TEXT_EXT.has(path.extname(f))) return;
    const src = fs.readFileSync(f, 'utf8');
    const out = rewriteRefs(src, renames);
    if (out !== src) fs.writeFileSync(f, out, 'utf8');
  });
}

/* Dos pasadas: primero los archivos hoja (assets/vendor, que no referencian a
   otros), luego el resto; asi el hash de cada archivo incluye los nombres ya
   versionados de lo que referencia. Devuelve Map(relPath viejo -> relPath nuevo)
   relativo a siteDir, con separador '/'. */
function fingerprintAssets(siteDir) {
  const assetsDir = path.join(siteDir, 'assets');
  const result = new Map();

  function pass(filter) {
    const all = walk(siteDir);
    const targets = walk(assetsDir).filter((f) =>
      HASHED_EXT.has(path.extname(f)) && !HASHED_NAME_RE.test(f) && filter(f));
    const renames = new Map();
    targets.forEach((f) => {
      const ext = path.extname(f);
      const base = path.basename(f, ext);
      const next = path.join(path.dirname(f), base + '.' + hashOf(fs.readFileSync(f)) + ext);
      fs.renameSync(f, next);
      renames.set(path.basename(f), path.basename(next));
      result.set(path.relative(siteDir, f).split(path.sep).join('/'),
        path.relative(siteDir, next).split(path.sep).join('/'));
    });
    rewriteTextFiles(all.filter((f) => fs.existsSync(f)), renames);
  }

  const vendorDir = path.join(assetsDir, 'vendor') + path.sep;
  pass((f) => f.startsWith(vendorDir));
  pass(() => true);
  return result;
}

module.exports = { fingerprintAssets, HASHED_NAME_RE };
