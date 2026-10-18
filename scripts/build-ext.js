#!/usr/bin/env node
'use strict';
/* Assemble and package explicitly configured products under dist/extensions/.
   Usage: node scripts/build-ext.js [product] [--out-dir directory] */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const products = require('./lib/extension-products');
const ROOT = path.resolve(__dirname, '..');

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
function copyDir(source, target) {
  fs.cpSync(source, target, { recursive: true });
}
function copy(source, target) {
  if (fs.statSync(source).isDirectory()) copyDir(source, target);
  else copyFile(source, target);
}
function build(id, outputRoot) {
  const config = products[id];
  const output = path.join(outputRoot, id);
  const archive = path.join(outputRoot, id + '.zip');
  // Validate required sources before replacing the previous package.
  for (const file of config.files) fs.accessSync(path.join(ROOT, config.source, file));
  for (const resource of config.resources) fs.accessSync(path.join(ROOT, resource.from));
  console.log('==> Building ' + id + '...');
  fs.rmSync(output, { recursive: true, force: true });
  fs.rmSync(archive, { force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const file of config.files) copy(path.join(ROOT, config.source, file), path.join(output, file));
  for (const resource of config.resources) copy(path.join(ROOT, resource.from), path.join(output, resource.to));
  if (config.prepare) config.prepare({ root: ROOT, output });

  const icons = config.icons;
  const iconsDir = path.join(output, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });
  let hasRsvg = false;
  try { execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' }); hasRsvg = true; } catch { /* use local fallback */ }
  for (const size of [16, 32, 48, 128]) {
    const target = path.join(iconsDir, 'icon-' + size + '.png');
    if (hasRsvg) execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), path.join(ROOT, icons.source), '-o', target]);
    else icons.fallback(size, target);
  }
  // Packaging is required: propagate failures and never leave a partial archive.
  try {
    execFileSync('zip', ['-qr', archive, '.'], { cwd: output, stdio: 'pipe' });
    if (!fs.statSync(archive).size) throw new Error('Empty ZIP: ' + archive);
  } catch (error) {
    fs.rmSync(archive, { force: true });
    throw error;
  }
  console.log('==> Done: ' + output + ' + ' + archive);
}

try {
  const args = process.argv.slice(2);
  let outputRoot = path.join(ROOT, 'dist', 'extensions');
  let product;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--out-dir') {
      if (!args.length) throw new Error('--out-dir requires a directory');
      outputRoot = path.resolve(args.shift());
    } else if (!product && Object.hasOwn(products, arg)) product = arg;
    else throw new Error('Unknown extension or argument: ' + arg);
  }
  for (const id of product ? [product] : Object.keys(products)) build(id, outputRoot);
} catch (error) {
  console.error('ERROR: Extension build failed: ' + error.message);
  process.exitCode = 1;
}
