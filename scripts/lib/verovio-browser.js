'use strict';
// Split the embedded WASM out of the pinned vendor build. The original stays
// intact for Node/build-time rendering; browsers download and compile the binary.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function splitVerovio(source) {
  const opening = "function findWasmBinary(){return binaryDecode('";
  const start = source.indexOf(opening);
  if (start < 0) throw new Error('Verovio embedded WASM changed; update verovio-browser.js');
  let end = start + opening.length;
  while (end < source.length && source[end] !== "'") end += source[end] === '\\' ? 2 : 1;
  if (end >= source.length || source.slice(end, end + 3) !== "')}") throw new Error('Invalid Verovio WASM literal');
  const literal = source.slice(start + opening.length - 1, end + 1);
  const decoded = vm.runInNewContext(literal, Object.create(null), { timeout: 10000 });
  const wasm = Buffer.from(Uint8Array.from(decoded, ch => (~ch.charCodeAt(0) >> 8) & ch.charCodeAt(0)));
  if (!wasm.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) throw new Error('Invalid WASM header');
  source = source.slice(0, start) + "function findWasmBinary(){return ''" + source.slice(end + 2);
  const original = 'async function instantiateAsync(binary,binaryFile,imports){return instantiateArrayBuffer(binaryFile,imports)}';
  if (!source.includes(original)) throw new Error('Verovio WASM loader changed; update verovio-browser.js');
  // Capture currentScript while the script executes: WASM starts asynchronously.
  source = 'var verovioWasmUrl=new URL("verovio-toolkit.wasm",document.currentScript.src).href;\n' + source.replace(original,
    'async function instantiateAsync(binary,binaryFile,imports){' +
    'var response=await fetch(verovioWasmUrl);' +
    'if(!response.ok)throw new Error("Verovio WASM HTTP "+response.status);' +
    'if(WebAssembly.instantiateStreaming){try{return await WebAssembly.instantiateStreaming(response.clone(),imports)}catch(e){}}' +
    'return WebAssembly.instantiate(await response.arrayBuffer(),imports)}');
  return { source, wasm };
}

function writeVerovioBrowser(input, outDir) {
  const result = splitVerovio(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'verovio-toolkit-wasm.js'), result.source);
  fs.writeFileSync(path.join(outDir, 'verovio-toolkit.wasm'), result.wasm);
}
module.exports = { splitVerovio, writeVerovioBrowser };
