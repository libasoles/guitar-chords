#!/usr/bin/env node
'use strict';
/* dev.js — Builds the site, serves dist/site on localhost, and rebuilds
   on changes to src/site, src/shared, src/i18n, or the local ascii-tabs symlink.
   Builds run in --dev mode (dist/site is kept, unchanged assets are skipped, no
   minify/fingerprint). Edits to a client .js/.css that build-site.js copies as-is
   are copied straight to dist/site/assets without a full build.
   Usage: npm run dev [-- --port 3000] */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { serveStatic } = require('./lib/static-server');

const ROOT = path.join(__dirname, '..');
const DIST_SITE = path.join(ROOT, 'dist', 'site');

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? Number(process.argv[portArg + 1]) : 3000;

function say(msg) { process.stdout.write('[dev] ' + msg + '\n'); }

function build() {
  say('building site...');
  // Without an API URL the Partitura y tablatura page is not generated; this
  // placeholder shows it locally (processing a score needs a real backend).
  const env = { PARTITURA_API_URL: 'https://api.partitura.test', ...process.env };
  const result = spawnSync('node', [path.join(__dirname, 'build-site.js'), '--local-ascii-tabs', '--dev'], { cwd: ROOT, stdio: 'inherit', env });
  if (result.status !== 0) {
    say('build failed');
  } else {
    say('build ok');
  }
}

function serve() {
  serveStatic(DIST_SITE, PORT).then(() => {
    say(`serving ${path.relative(ROOT, DIST_SITE)} at http://localhost:${PORT}`);
  });
}

// Heavy generated or binary files: editing them never needs a page rebuild.
const IGNORED_EXT = new Set(['.pdf', '.svg', '.png', '.webp', '.jpg', '.json']);
const ASSETS_DIST = path.join(DIST_SITE, 'assets');

/* Copies a changed client file into dist/site/assets when build-site.js ships
   it unchanged (same basename already present there). Returns false when the
   change needs a full build. */
function fastCopy(file) {
  const ext = path.extname(file);
  if (ext !== '.js' && ext !== '.css') return false;
  const rel = path.relative(path.join(ROOT, 'src', 'site', 'css'), file);
  if (!rel.startsWith('..')) {
    const { readSiteCss } = require('./lib/site-css');
    fs.writeFileSync(path.join(ASSETS_DIST, 'site.css'), readSiteCss(), 'utf8');
    return true;
  }
  const inSite = path.dirname(file) === path.join(ROOT, 'src', 'site');
  const inShared = path.dirname(file) === path.join(ROOT, 'src', 'shared');
  const dst = path.join(ASSETS_DIST, path.basename(file));
  if (!(inSite || inShared) || !fs.existsSync(dst)) return false;
  fs.copyFileSync(file, dst);
  return true;
}

function watch() {
  const dirs = ['src/site', 'src/shared', 'src/i18n', 'scripts/lib'].map((d) => path.join(ROOT, d));
  let pending = false;
  const trigger = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      build();
    }, 150);
  };
  const onChange = (dir) => (event, filename) => {
    if (!filename) return trigger();
    const file = path.join(dir, filename);
    if (IGNORED_EXT.has(path.extname(file)) && !file.startsWith(path.join(ROOT, 'src', 'i18n'))) return;
    try {
      if (fastCopy(file)) {
        say('copied ' + path.relative(ROOT, file));
        return;
      }
    } catch (e) {
      // fall through to a full build
    }
    trigger();
  };
  for (const dir of dirs) {
    fs.watch(dir, { recursive: true }, onChange(dir));
  }
  // Poll through the symlink so edits and atomic replacements of its target
  // both rebuild the site. This also notices a link created after dev starts.
  const localAsciiTabs = path.join(ROOT, 'vendor', 'ascii-tabs.local.js');
  fs.watchFile(localAsciiTabs, { interval: 500 }, trigger);
  say('watching for changes in ' + dirs.map((d) => path.relative(ROOT, d)).join(', '));
  say('watching local ascii-tabs at ' + path.relative(ROOT, localAsciiTabs));
}

build();
serve();
watch();
