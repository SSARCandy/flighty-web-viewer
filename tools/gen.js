// Generates embedded datasets for index.html:
//  1. AIRPORTS: IATA -> [lat, lon, utcOffsetHours, city, iso2]
//  2. COUNTRY_NAMES: iso2 -> English name
//  3. LAND_PATH: precomputed equirectangular SVG path (viewBox 0 0 1000 500)
const fs = require('fs');

// --- minimal RFC4180 parser ---
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// --- required airports: everything appearing in the user's CSV ---
const REQUIRED = 'TPE HKG SUB JOG DPS KIX NRT FUK MFM OKJ BKI MYY MZV KCH TSA HND AKL CHC NSN SIN ATH JTR CHQ PFO LCA IBR XMN MEL AYQ GMP PUS SZX ICN MNL TAG KYD TTT AUH FCO BCN KEF'.split(' ');

// spec appendix A verified coordinates (subset) for cross-checking
const SPEC_A = {
  AKL: [-37.008, 174.792, 12], ATH: [37.936, 23.947, 2], AYQ: [-25.186, 130.976, 9.5],
  BKI: [5.937, 116.051, 8], CHC: [-43.489, 172.532, 12], CHQ: [35.532, 24.150, 2],
  DPS: [-8.748, 115.167, 8], FUK: [33.586, 130.451, 9], GMP: [37.558, 126.791, 9],
  HKG: [22.308, 113.918, 8], HND: [35.549, 139.780, 9], IBR: [36.181, 140.415, 9],
  ICN: [37.469, 126.451, 9], JOG: [-7.788, 110.432, 7], JTR: [36.399, 25.479, 2],
  KCH: [1.485, 110.347, 8], KIX: [34.427, 135.244, 9], LCA: [34.875, 33.625, 2],
  MEL: [-37.669, 144.841, 10], MFM: [22.150, 113.592, 8], MYY: [4.322, 113.987, 8],
  MZV: [4.048, 114.805, 8], NRT: [35.772, 140.393, 9], NSN: [-41.298, 173.221, 12],
  OKJ: [34.757, 133.855, 9], PFO: [34.718, 32.486, 2], PUS: [35.180, 128.938, 9],
  SIN: [1.350, 103.994, 8], SUB: [-7.380, 112.787, 7], SZX: [22.639, 113.811, 8],
  TPE: [25.078, 121.233, 8], TSA: [25.069, 121.552, 8], XMN: [24.544, 118.128, 8],
};

// --- 1. OpenFlights: IATA -> UTC offset (standard time) ---
const ofRows = parseCSV(fs.readFileSync('openflights.dat', 'utf8'));
const tzByIata = {};
for (const r of ofRows) {
  if (r.length < 10) continue;
  const iata = r[4], off = parseFloat(r[9]);
  if (/^[A-Z]{3}$/.test(iata) && Number.isFinite(off) && off >= -12 && off <= 14) tzByIata[iata] = off;
}
console.log('openflights offsets:', Object.keys(tzByIata).length);

// --- 2. OurAirports ---
const oa = parseCSV(fs.readFileSync('airports.csv', 'utf8'));
const head = oa[0];
const col = n => head.indexOf(n);
const cType = col('type'), cLat = col('latitude_deg'), cLon = col('longitude_deg'),
  cCountry = col('iso_country'), cCity = col('municipality'), cSched = col('scheduled_service'),
  cIata = col('iata_code'), cName = col('name');
const typeRank = { large_airport: 3, medium_airport: 2, small_airport: 1 };

const best = {}; // iata -> {rank, sched, lat, lon, city, country}
for (let i = 1; i < oa.length; i++) {
  const r = oa[i];
  const iata = r[cIata];
  if (!/^[A-Z]{3}$/.test(iata)) continue;
  const rank = typeRank[r[cType]] || 0;
  if (!rank) continue;
  const sched = r[cSched] === 'yes' ? 1 : 0;
  const required = REQUIRED.includes(iata);
  // inclusion rule: all large, any size with scheduled service, or required
  if (!(rank === 3 || sched || required)) continue;
  const lat = parseFloat(r[cLat]), lon = parseFloat(r[cLon]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const cand = { rank, sched, lat, lon, city: r[cCity] || r[cName].replace(/ (International )?Airport$/, ''), country: r[cCountry] };
  const prev = best[iata];
  if (!prev || cand.sched * 10 + cand.rank > prev.sched * 10 + prev.rank) best[iata] = cand;
}
console.log('airports selected:', Object.keys(best).length);

// offsets: openflights, else longitude estimate (rounded to 1h)
let estCount = 0;
for (const [iata, a] of Object.entries(best)) {
  let off = tzByIata[iata];
  if (off === undefined) { off = Math.max(-12, Math.min(14, Math.round(a.lon / 15))); estCount++; }
  a.off = off;
}
console.log('offsets estimated from longitude:', estCount);

// cross-check required airports
let fail = 0;
for (const iata of REQUIRED) {
  const a = best[iata];
  if (!a) { console.log('MISSING REQUIRED:', iata); fail++; continue; }
  const s = SPEC_A[iata];
  if (s) {
    const dLat = Math.abs(a.lat - s[0]), dLon = Math.abs(a.lon - s[1]), dOff = Math.abs(a.off - s[2]);
    if (dLat > 0.25 || dLon > 0.25 || dOff > 0.01)
      console.log(`CHECK ${iata}: got [${a.lat.toFixed(3)},${a.lon.toFixed(3)},${a.off}] spec [${s}] (d=${dLat.toFixed(3)},${dLon.toFixed(3)},${dOff})`), fail++;
  } else {
    console.log(`new airport ${iata}: [${a.lat.toFixed(3)},${a.lon.toFixed(3)},${a.off}] ${a.city}, ${a.country}`);
  }
}
console.log('cross-check failures:', fail);

// force spec appendix A values for the verified 33 (spec says these are the authoritative minimum set)
for (const [iata, s] of Object.entries(SPEC_A)) {
  const a = best[iata];
  if (a) { a.lat = s[0]; a.lon = s[1]; a.off = s[2]; }
}

// --- 3. countries ---
const cRows = parseCSV(fs.readFileSync('countries.csv', 'utf8'));
const cHead = cRows[0], ccCode = cHead.indexOf('code'), ccName = cHead.indexOf('name');
const usedCountries = new Set(Object.values(best).map(a => a.country));
const countryNames = {};
for (let i = 1; i < cRows.length; i++) {
  const r = cRows[i];
  if (usedCountries.has(r[ccCode])) countryNames[r[ccCode]] = r[ccName];
}
console.log('countries:', Object.keys(countryNames).length);

// --- emit compact JS ---
const esc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const rnd = (x, p) => parseFloat(x.toFixed(p));
const airportEntries = Object.keys(best).sort().map(iata => {
  const a = best[iata];
  return `${iata}:[${rnd(a.lat, 3)},${rnd(a.lon, 3)},${a.off},"${esc(a.city)}","${a.country}"]`;
});
const airportsJs = 'const AIRPORTS={' + airportEntries.join(',') + '};';
const countriesJs = 'const COUNTRY_NAMES=' + JSON.stringify(countryNames) + ';';

// --- 4. land path (equirectangular, viewBox 0 0 1000 500) ---
const land = JSON.parse(fs.readFileSync('land110m.json', 'utf8'));
const W = 1000, H = 500;
const px = lon => rnd((lon + 180) / 360 * W, 1);
const py = lat => rnd((90 - lat) / 180 * H, 1);
let path = '';
let ringCount = 0;
for (const f of land.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      ringCount++;
      let d = '', lx = null, ly = null;
      for (let i = 0; i < ring.length; i++) {
        const x = px(ring[i][0]), y = py(ring[i][1]);
        if (x === lx && y === ly) continue; // drop dup after rounding
        d += (i === 0 ? `M${x} ${y}` : `L${x} ${y}`);
        lx = x; ly = y;
      }
      path += d + 'Z';
    }
  }
}
const landJs = 'const LAND_PATH="' + path + '";';
console.log('land rings:', ringCount, 'path chars:', path.length);

fs.writeFileSync('datasets.gen.js', airportsJs + '\n' + countriesJs + '\n' + landJs + '\n');
console.log('sizes (KB): airports', (airportsJs.length / 1024).toFixed(1), 'countries', (countriesJs.length / 1024).toFixed(1), 'land', (landJs.length / 1024).toFixed(1));
