// Assembles the self-contained index.html:
// template + datasets.gen.js + airlines.js + raw Flighty CSV (JSON-encoded)
const fs = require('fs');
const path = require('path');

const SCRATCH = __dirname;
const REPO = 'C:/Users/ssarc/Documents/GitHub/flighty-web-viewer';

const template = fs.readFileSync(path.join(SCRATCH, 'index.template.html'), 'utf8');
const datasets = fs.readFileSync(path.join(SCRATCH, 'datasets.gen.js'), 'utf8');
const airlines = fs.readFileSync(path.join(SCRATCH, 'airlines.js'), 'utf8');
const flags = fs.readFileSync(path.join(SCRATCH, 'flags.gen.js'), 'utf8');
const logos = fs.readFileSync(path.join(SCRATCH, 'logos.gen.js'), 'utf8');
let csv = fs.readFileSync(path.join(REPO, 'FlightyExport-2026-07-05.csv'), 'utf8');
if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1); // strip BOM

// JSON-encode CSV; escape "</script" so it can't terminate the script block
const csvJs = JSON.stringify(csv).replace(/<\//g, '<\\/');

let out = template
  .replace('/*__DATASETS__*/', datasets + '\n' + airlines + '\n' + flags + '\n' + logos)
  .replace('/*__DEFAULT_CSV__*/""', csvJs);

if (out.includes('__DATASETS__') || out.includes('__DEFAULT_CSV__')) {
  console.error('marker replacement failed'); process.exit(1);
}
fs.writeFileSync(path.join(REPO, 'index.html'), out);
console.log('index.html written:', (out.length / 1024).toFixed(0), 'KB');
