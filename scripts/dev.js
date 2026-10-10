#!/usr/bin/env node
'use strict';
/* dev.js — Builds the site, serves dist/site on localhost, and rebuilds
   on changes to src/site, src/shared, src/i18n, or the local ascii-tabs symlink.
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
  const result = spawnSync('node', [path.join(__dirname, 'build-site.js'), '--local-ascii-tabs'], { cwd: ROOT, stdio: 'inherit' });
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

function watch() {
  const dirs = ['src/site', 'src/shared', 'src/i18n'].map((d) => path.join(ROOT, d));
  let pending = false;
  const trigger = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      build();
    }, 150);
  };
  for (const dir of dirs) {
    fs.watch(dir, { recursive: true }, trigger);
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
