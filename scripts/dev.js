#!/usr/bin/env node
'use strict';
/* dev.js — Builds the site, serves dist/site on localhost, and rebuilds
   on changes to src/site, src/shared, or src/i18n.
   Usage: npm run dev [-- --port 3000] */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST_SITE = path.join(ROOT, 'dist', 'site');

const portArg = process.argv.indexOf('--port');
const PORT = portArg !== -1 ? Number(process.argv[portArg + 1]) : 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function say(msg) { process.stdout.write('[dev] ' + msg + '\n'); }

function build() {
  say('building site...');
  const result = spawnSync('node', [path.join(__dirname, 'build-site.js')], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    say('build failed');
  } else {
    say('build ok');
  }
}

function serve() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    let filePath = path.join(DIST_SITE, urlPath);

    if (!filePath.startsWith(DIST_SITE)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Fallback: try appending .html (for extensionless routes like /en)
        fs.readFile(filePath + '.html', (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(data2);
        });
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(PORT, () => {
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
  say('watching for changes in ' + dirs.map((d) => path.relative(ROOT, d)).join(', '));
}

build();
serve();
watch();
