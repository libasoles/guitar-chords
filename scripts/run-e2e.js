#!/usr/bin/env node
/* Runs e2e files in parallel, a few at a time, and prints one line per file
   with its time; the output of a failing file is shown in full.
   Usage: node scripts/run-e2e.js [--jobs N] <test file or prefix>...
   A prefix like `articles` runs every test/articles-*.e2e.js. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEST_DIR = path.join(__dirname, '..', 'test');

function parseArgs(argv) {
  let jobs = Math.max(2, Math.min(4, os.cpus().length >> 1));
  const names = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--jobs') jobs = Number(argv[++i]);
    else names.push(argv[i]);
  }
  return { jobs, names };
}

function resolveFiles(names) {
  const all = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.e2e.js'));
  const files = new Set();
  for (const name of names) {
    const base = path.basename(name).replace(/\.e2e\.js$/, '');
    const matches = all.filter((f) => f === base + '.e2e.js' || f.startsWith(base + '-'));
    if (!matches.length) throw new Error('no e2e test matches ' + name);
    matches.forEach((f) => files.add(f));
  }
  return [...files].sort();
}

function runFile(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(TEST_DIR, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log((code === 0 ? 'ok   ' : 'FAIL ') + file + ' ' + seconds + 's');
      resolve({ file, code, output });
    });
  });
}

async function main() {
  const { jobs, names } = parseArgs(process.argv.slice(2));
  const queue = resolveFiles(names);
  const results = [];
  const worker = async () => {
    while (queue.length) results.push(await runFile(queue.shift()));
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const failed = results.filter((r) => r.code !== 0);
  for (const { file, output } of failed) console.error('\n--- ' + file + ' ---\n' + output);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
