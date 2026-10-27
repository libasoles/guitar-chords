'use strict';
/* fingerprint.js — Versiona por contenido los assets estaticos de dist/site.
   Renombra assets/**.{js,css,svg} y assets/icons/*.png a <nombre>.<hash10>.<ext> y reescribe todas
   las referencias (HTML, JS, CSS, manifests y sw.js). Un deploy que cambia un
   archivo cambia su URL, asi que las URLs fingerprinted son inmutables y se
   pueden servir con cache de larga vida. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HASHED_EXT = new Set(['.js', '.css', '.svg', '.png']);
const TEXT_EXT = new Set(['.html', '.js', '.css', '.webmanifest', '.svg', '.xml', '.json']);
const HASH_LEN = 10;
// Nombre ya fingerprinted: name.<10 hex>.ext
const HASHED_NAME_RE = new RegExp('\\.[0-9a-f]{' + HASH_LEN + '}\\.(js|css|svg|png)$');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function hashOf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LEN);
}

// Any asset-looking file name delimited like a reference. One scan per file
// finds every candidate; a Map lookup decides whether it is one we renamed.
// "(" precedes an unquoted url(name.svg), which minified CSS produces.
const NAME_RE = "(?<=[/'\"`(])([^/'\"`()\\s?#]+\\.(?:js|css|svg|png))(?=['\"`?#)\\s])";

/* Reemplaza el nombre de archivo cuando aparece como ultimo segmento de una
   ruta o literal ("/x/name.js", 'name.js', "name.js?v=1"). */
function rewriteRefs(text, renames) {
  if (!renames.size) return text;
  return text.replace(new RegExp(NAME_RE, 'g'), (m) => renames.get(m) || m);
}

function referencedNames(text) {
  return new Set(text.match(new RegExp(NAME_RE, 'g')) || []);
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
   otros), luego el resto. Dentro de cada pasada, los assets se procesan después
   de sus dependencias: asi CSS que apunta a un SVG incluye el nombre versionado
   del SVG antes de calcular su propio hash. Devuelve Map(relPath viejo ->
   relPath nuevo) relativo a siteDir, con separador '/'. */
function fingerprintAssets(siteDir) {
  const assetsDir = path.join(siteDir, 'assets');
  const iconsDir = path.join(assetsDir, 'icons') + path.sep;
  const result = new Map();

  function pass(filter) {
    const targets = walk(assetsDir).filter((f) =>
      HASHED_EXT.has(path.extname(f)) && !HASHED_NAME_RE.test(f) && filter(f) &&
      // Only the PWA icons: og images keep stable URLs for social crawlers.
      (path.extname(f) !== '.png' || f.startsWith(iconsDir)));
    const renames = new Map();

    // A target can only be named after every target it references. Each text
    // target is scanned once for its references; targets are then processed in
    // dependency order (Kahn), so CSS pointing at a background image includes
    // the image's fingerprinted name before computing its own hash.
    const sources = new Map();
    const byName = new Map();
    targets.forEach((f) => {
      const name = path.basename(f);
      byName.set(name, [...(byName.get(name) || []), f]);
    });
    const waiting = new Map(); // target -> unprocessed targets it references
    const dependents = new Map(); // target -> targets waiting on it
    targets.forEach((f) => {
      const deps = new Set();
      if (TEXT_EXT.has(path.extname(f))) {
        const source = fs.readFileSync(f, 'utf8');
        sources.set(f, source);
        referencedNames(source).forEach((n) => {
          (byName.get(n) || []).forEach((other) => {
            if (other === f) return;
            deps.add(other);
            dependents.set(other, [...(dependents.get(other) || []), f]);
          });
        });
      }
      waiting.set(f, deps);
    });
    const queue = targets.filter((f) => !waiting.get(f).size);
    let done = 0;

    while (queue.length) {
      const f = queue.shift();
      const from = path.basename(f);
      let contents;
      if (sources.has(f)) {
        contents = Buffer.from(rewriteRefs(sources.get(f), renames), 'utf8');
        fs.writeFileSync(f, contents);
        sources.delete(f);
      } else {
        contents = fs.readFileSync(f);
      }
      const ext = path.extname(f);
      const base = path.basename(f, ext);
      const next = path.join(path.dirname(f), base + '.' + hashOf(contents) + ext);
      fs.renameSync(f, next);
      renames.set(from, path.basename(next));
      result.set(path.relative(siteDir, f).split(path.sep).join('/'),
        path.relative(siteDir, next).split(path.sep).join('/'));
      done++;
      (dependents.get(f) || []).forEach((g) => {
        const w = waiting.get(g);
        w.delete(f);
        if (!w.size && !queue.includes(g)) queue.push(g);
      });
    }
    if (done < targets.length) {
      throw new Error('Cannot fingerprint cyclic asset references: ' +
        targets.filter((f) => fs.existsSync(f)).map((f) => path.basename(f)).join(', '));
    }
    rewriteTextFiles(walk(siteDir), renames);
  }

  const vendorDir = path.join(assetsDir, 'vendor') + path.sep;
  pass((f) => f.startsWith(vendorDir));
  pass(() => true);
  return result;
}

module.exports = { fingerprintAssets, HASHED_NAME_RE };
