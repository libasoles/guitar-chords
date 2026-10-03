#!/usr/bin/env node
'use strict';
/* lighthouse.js — Builds the site, serves dist/site on a free local port and
   runs Lighthouse (mobile by default) against it, using the Chromium found by
   scripts/lib/chrome-path.js. Works offline once `npm ci` ran.
   Writes the full report to dist/lighthouse/<name>.json and prints scores.
   Usage: npm run lighthouse [-- /path] [--desktop] [--runs 3] [--skip-build] */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { serveStatic } = require('./lib/static-server');
const { chromePath } = require('./lib/chrome-path');

const ROOT = path.join(__dirname, '..');
const DIST_SITE = path.join(ROOT, 'dist', 'site');
const OUT_DIR = path.join(ROOT, 'dist', 'lighthouse');
const LIGHTHOUSE = path.join(ROOT, 'node_modules', '.bin', 'lighthouse');

const args = process.argv.slice(2);
const desktop = args.includes('--desktop');
const skipBuild = args.includes('--skip-build');
const runsArg = args.indexOf('--runs');
const runs = runsArg !== -1 ? Number(args[runsArg + 1]) : 1;
const urlPath = args.find((a, i) => a.startsWith('/') && args[i - 1] !== '--runs') || '/';

const METRICS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
];

function say(msg) { process.stdout.write('[lighthouse] ' + msg + '\n'); }

// Async on purpose: the static server lives in this process, so a sync
// spawn would block it and Lighthouse would hang waiting for the page.
function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
  });
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function main() {
  if (!skipBuild) {
    const build = spawnSync('node', [path.join(__dirname, 'build-site.js')], { cwd: ROOT, stdio: 'inherit' });
    if (build.status !== 0) process.exit(build.status || 1);
  }

  const chrome = chromePath();
  if (!chrome) {
    say('no Chromium found: set CHROME_PATH or run `npx playwright install chromium`');
    process.exit(1);
  }

  process.env.CHROME_PATH = chrome;
  const server = await serveStatic(DIST_SITE, 0);
  const url = `http://localhost:${server.address().port}${urlPath}`;
  const name = (urlPath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home') + (desktop ? '-desktop' : '-mobile');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  say(`${desktop ? 'desktop' : 'mobile'} audit of ${url} with ${chrome}`);

  const reports = [];
  try {
    for (let i = 0; i < runs; i += 1) {
      const outPath = path.join(OUT_DIR, runs > 1 ? `${name}-${i + 1}.json` : `${name}.json`);
      const code = await run(LIGHTHOUSE, [
        url,
        '--chrome-path=' + chrome,
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
        '--output=json',
        '--output-path=' + outPath,
        '--quiet',
        ...(desktop ? ['--preset=desktop'] : []),
      ]);
      if (code !== 0) throw new Error('lighthouse exited with code ' + code);
      reports.push(JSON.parse(fs.readFileSync(outPath, 'utf8')));
      say('report: ' + path.relative(ROOT, outPath));
    }
  } finally {
    server.close();
  }

  const categories = Object.keys(reports[0].categories);
  for (const id of categories) {
    const score = median(reports.map((r) => r.categories[id].score)) * 100;
    say(`${reports[0].categories[id].title}: ${Math.round(score)}`);
  }
  for (const id of METRICS) {
    const audit = reports[0].audits[id];
    if (!audit) continue;
    const value = median(reports.map((r) => r.audits[id].numericValue));
    const shown = id === 'cumulative-layout-shift' ? value.toFixed(3) : Math.round(value) + ' ms';
    say(`${audit.title}: ${shown}`);
  }
  if (runs > 1) say(`median of ${runs} runs`);
}

main().catch((err) => {
  say(err.stack || String(err));
  process.exit(1);
});
