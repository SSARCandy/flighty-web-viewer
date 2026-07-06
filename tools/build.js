// Assembles the self-contained index.html:
// template + datasets.gen.js + airlines.js + raw Flighty CSV (JSON-encoded),
// then minifies HTML + inline CSS + inline JS into a single self-contained file.
//
//   node tools/build.js            production build (minified)
//   node tools/build.js --no-min   dev build (readable, still single-file)
//
// Minification keeps the two /*__LOGIC_*__*/ marker comments so test.js can
// still slice the pure-logic block out of the shipped index.html.
const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

const SCRATCH = __dirname;
const REPO = path.resolve(__dirname, '..');
const NO_MIN = process.argv.includes('--no-min');

const template = fs.readFileSync(path.join(SCRATCH, 'index.template.html'), 'utf8');
const datasets = fs.readFileSync(path.join(SCRATCH, 'datasets.gen.js'), 'utf8');
const airlines = fs.readFileSync(path.join(SCRATCH, 'airlines.js'), 'utf8');
const flags = fs.readFileSync(path.join(SCRATCH, 'flags.gen.js'), 'utf8');
const logos = fs.readFileSync(path.join(SCRATCH, 'logos.gen.js'), 'utf8');
let csv = fs.readFileSync(path.join(REPO, 'demo.csv'), 'utf8');
if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1); // strip BOM

// Inlined Preact + htm runtime (UMD builds from node_modules, load order matters:
// preact defines global `preact`, hooks reads it, htm is standalone). A small glue
// exposes html()/render()/hooks as globals for the app script. Kept a separate
// <script> so these globals exist before the app runs. Stays 100% self-contained.
// Read UMD builds by direct path (their package "exports" fields block require.resolve).
const NM = path.join(REPO, 'node_modules');
const req = p => fs.readFileSync(path.join(NM, p), 'utf8');
const runtime = [
  req('preact/dist/preact.umd.js'),
  req('preact/hooks/dist/hooks.umd.js'),
  req('htm/dist/htm.umd.js'),
  `(function(g){var p=g.preact,hk=g.preactHooks;g.html=g.htm.bind(p.h);g.render=p.render;` +
  `g.Fragment=p.Fragment;g.useState=hk.useState;g.useRef=hk.useRef;` +
  `g.useLayoutEffect=hk.useLayoutEffect;g.useEffect=hk.useEffect;g.useMemo=hk.useMemo;})(window);`,
].join('\n');

// JSON-encode CSV; escape "</script" so it can't terminate the script block
const csvJs = JSON.stringify(csv).replace(/<\//g, '<\\/');

let out = template
  .replace('/*__DATASETS__*/', datasets + '\n' + airlines + '\n' + flags + '\n' + logos)
  .replace('/*__DEFAULT_CSV__*/""', csvJs)
  .replace('/*__RUNTIME__*/', () => runtime);

if (out.includes('__DATASETS__') || out.includes('__DEFAULT_CSV__') || out.includes('__RUNTIME__')) {
  console.error('marker replacement failed'); process.exit(1);
}

// Keep the LOGIC markers alive through JS minification so test.js keeps working;
// drop every other comment.
const keepLogicMarkers = (node, comment) => /__LOGIC_(START|END)__/.test(comment.value);

const minifyOptions = {
  collapseWhitespace: true,
  conservativeCollapse: false,
  collapseBooleanAttributes: true,
  removeComments: true,           // HTML comments (marker comments live inside <script>)
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  sortAttributes: true,
  sortClassName: true,
  minifyCSS: true,                // clean-css on <style> blocks + style="" attrs
  minifyJS: {
    // toplevel mangling stays OFF (terser default) so function names referenced
    // from inline handlers / the SVG-share code / test.js survive.
    compress: { passes: 2 },
    mangle: true,
    format: { comments: keepLogicMarkers },
  },
};

async function main() {
  const raw = out;
  let result = raw;
  if (!NO_MIN) {
    result = await minify(raw, minifyOptions);
    if (!/__LOGIC_START__/.test(result) || !/__LOGIC_END__/.test(result)) {
      console.error('minify dropped the LOGIC markers — test.js would break'); process.exit(1);
    }
  }
  fs.writeFileSync(path.join(REPO, 'index.html'), result);

  const rawKB = (Buffer.byteLength(raw) / 1024).toFixed(0);
  const outKB = (Buffer.byteLength(result) / 1024).toFixed(0);
  if (NO_MIN) {
    console.log(`index.html written (dev, unminified): ${outKB} KB`);
  } else {
    const saved = (100 * (1 - Buffer.byteLength(result) / Buffer.byteLength(raw))).toFixed(1);
    console.log(`index.html written (minified): ${rawKB} KB -> ${outKB} KB (-${saved}%)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
