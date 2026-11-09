"use strict";
// Worker entry for tesseract.js under Node 22.
//
// tesseract.js 7 picks its wasm core with wasm-feature-detect, whose 1.10
// build contains an `import.source(...)` probe that Node 22 cannot parse
// (SyntaxError at require time). We pre-seed the require cache with a stub
// that reports SIMD (supported by Node 22) and no relaxed SIMD, then load
// the stock worker script. OCR behaviour is unchanged: the SIMD LSTM core is
// the one tesseract.js would choose on this Node anyway.
const Module = require("node:module");
const path = require("node:path");

const tesseractRoot = path.dirname(require.resolve("tesseract.js/package.json", { paths: [process.cwd()] }));
const getCorePath = path.join(tesseractRoot, "src/worker-script/node/getCore.js");
const detectPath = Module.createRequire(getCorePath).resolve("wasm-feature-detect");

const stub = new Module(detectPath);
stub.filename = detectPath;
stub.loaded = true;
stub.exports = {
  simd: async () => true,
  relaxedSimd: async () => false,
};
require.cache[detectPath] = stub;

require(path.join(tesseractRoot, "src/worker-script/node/index.js"));
