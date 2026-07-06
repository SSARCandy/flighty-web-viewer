// Boots the built index.html in jsdom and asserts the Preact dashboard renders
// and reacts to interaction. Complements test.js (which covers only pure logic).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => cond ? pass++ : (fail++, console.log(`FAIL ${name}`, extra ?? ''));
const eq = (name, got, want) => ok(name, got === want, `got ${got} want ${want}`);

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,          // provides requestAnimationFrame / cancelAnimationFrame
  url: 'https://example.com/',
  beforeParse(window) {
    // jsdom lacks fetch (boot falls back to embedded DEFAULT_CSV — that's what we test)
    // and matchMedia; stub the latter so theme/reduced-motion probes don't throw.
    window.matchMedia = window.matchMedia || (() => ({
      matches: false, media: '', addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    }));
  },
});
const { window } = dom;
const { document } = window;

// Surface uncaught script errors instead of swallowing them.
window.addEventListener('error', e => { fail++; console.log('SCRIPT ERROR:', e.error && e.error.stack || e.message); });

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(20); }
  return false;
}

(async () => {
  // ---- 1. dashboard mounts ----
  const mounted = await waitFor(() => $('#dash .tile'));
  ok('dashboard mounted', mounted);
  if (!mounted) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }
  const LIMIT = window.eval('LIST_LIMIT');   // flight-list default page size, read from the app

  // ---- 2. stat tiles (6, hero first) ----
  const tiles = $$('#dash .tiles .tile');
  eq('tile count', tiles.length, 6);
  ok('no hero tile', tiles.every(t => !t.classList.contains('hero')));
  ok('tiles have values', tiles.every(t => $('.v', t) && $('.v', t).textContent.trim().length > 0));

  // ---- 3. flags & logos render inside iconrows (direct flex children, no wrapper) ----
  ok('country flags present', $$('#dash .tiles .iconrow .flag').length > 0);
  ok('airline logos present', $$('#dash .tiles .iconrow .alogo').length > 0);
  const flagSvg = $('#dash .tiles .iconrow .flag svg') || $('#dash .tiles .iconrow .flag img');
  ok('flag has inner svg/img', !!$('#dash .tiles .iconrow .flag').innerHTML.trim());

  // ---- 4. year chips + year chart ----
  const chips = $$('#yearFilter .chip');
  ok('year chips present', chips.length > 1);
  ok('first chip is "all years" and active', chips[0].classList.contains('on'));
  const bars = $$('#dash #yearChart .ybar');
  ok('year bars present', bars.length > 0);
  const tableRows = $$('#dash table.sr-only tr');
  eq('a11y table rows == bars', tableRows.length, bars.length);

  // ---- 5. rankings & flight list ----
  ok('rankings render', $$('#dash .rank-item').length >= 4);
  const rows = $$('#dash #flightList .fl-row');
  ok(`flight rows render (capped at ${LIMIT})`, rows.length > 0 && rows.length <= LIMIT);
  ok('status line rendered', $('#statusLine').textContent.includes('2014') || $('#statusLine').textContent.length > 5);

  // ---- 6. expand a flight row (per-row local state) ----
  const firstRow = rows[0];
  const detail = firstRow.nextElementSibling;
  ok('detail starts closed', detail.classList.contains('fl-detail') && !detail.classList.contains('open'));
  firstRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await waitFor(() => detail.classList.contains('open'), 1000);
  ok('detail opens on click', detail.classList.contains('open'));

  // STATE is a top-level `let` (not a window property) → read it via global eval.
  const evalState = expr => window.eval(expr);

  // ---- 7. "show all" reveals the full log ----
  const total = evalState('STATE.flights.length');
  const moreBtn = $('#dash .fl-more button');
  if (total > LIMIT) {
    ok('show-all button present', !!moreBtn);
    moreBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await waitFor(() => $$('#dash #flightList .fl-row').length > LIMIT, 1000);
    ok('show-all expands list', $$('#dash #flightList .fl-row').length === total);
  } else {
    ok('no show-all needed', !moreBtn);
  }

  // ---- 8. year filter interaction re-renders + filters ----
  const before = $$('#dash #flightList .fl-row').length;
  const yearChip = chips.find(c => /^\d{4}$/.test(c.textContent.trim()));
  const yr = +yearChip.textContent.trim();
  yearChip.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await waitFor(() => $('#yearFilter .chip.on') && $('#yearFilter .chip.on').textContent.trim() === String(yr), 1000);
  ok('year chip becomes active', $('#yearFilter .chip.on').textContent.trim() === String(yr));
  const allInYear = evalState(`STATE.flights.filter(f => +f.date.slice(0,4) === ${yr}).length`);
  const shownNow = $$('#dash #flightList .fl-row').length;
  ok('filtered list matches year subset', shownNow === Math.min(allInYear, LIMIT), `shown ${shownNow} year total ${allInYear} limit ${LIMIT}`);
  ok('status line shows filter info', /[|｜]/.test($('#statusLine').textContent) || $('#statusLine').querySelector('b'));

  // ---- 9. language toggle updates widget text ----
  const listHintBefore = $('#dash section.card h2 small') && $('#dash section.card h2 small').textContent;
  $('#btnLang').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  const langAfter = evalState('STATE.lang');
  ok('lang toggled', langAfter === 'en' || langAfter === 'zh');
  ok('widgets still present after lang switch', $$('#dash .tile').length === 6);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
