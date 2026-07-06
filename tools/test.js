// Verifies the logic block actually shipped inside index.html.
const fs = require('fs');
const vm = require('vm');

const REPO = 'C:/Users/ssarc/Documents/GitHub/flighty-web-viewer';
const html = fs.readFileSync(REPO + '/index.html', 'utf8');
const logic = html.split('/*__LOGIC_START__*/')[1].split('/*__LOGIC_END__*/')[0];
const datasets = fs.readFileSync(__dirname + '/datasets.gen.js', 'utf8');
let csv = fs.readFileSync(REPO + '/FlightyExport-2026-07-05.csv', 'utf8');
if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);

const ctx = { console, Date, Math, JSON };
vm.createContext(ctx);
vm.runInContext(datasets + '\n' + logic +
  '\nthis.api={parseCSV,tsToMin,normalizeFlights,haversineKm,greatCirclePoints,splitAntimeridian,flightHours,computeStats,topN,AIRPORTS,COUNTRY_NAMES};', ctx);
const { parseCSV, tsToMin, normalizeFlights, haversineKm, greatCirclePoints,
  splitAntimeridian, flightHours, computeStats, AIRPORTS, COUNTRY_NAMES } = ctx.api;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; }
  else { fail++; console.log(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}`, extra === undefined ? '' : extra); }
}

// ---- 1. RFC 4180 ----
eq('rfc4180 quoted comma', parseCSV('a,"b,c",d'), [['a', 'b,c', 'd']]);
eq('rfc4180 escaped quote', parseCSV('a,"he said ""hi""",c'), [['a', 'he said "hi"', 'c']]);
eq('rfc4180 quoted newline', parseCSV('a,"line1\nline2",c\r\nx,y,z'), [['a', 'line1\nline2', 'c'], ['x', 'y', 'z']]);
eq('rfc4180 crlf + trailing newline', parseCSV('a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]);

// ---- 2. timestamps ----
eq('ts basic', tsToMin('2014-08-16T08:55') !== null, true);
ok('ts with seconds', Math.abs(tsToMin('2023-10-06T08:25:59') - tsToMin('2023-10-06T08:25') - 59 / 60) < 1e-6);
eq('ts invalid', tsToMin('n/a'), null);
eq('ts null', tsToMin(null), null);

// ---- 3. default CSV baseline ----
const res = normalizeFlights(parseCSV(csv));
ok('header ok', res.ok);
eq('flights', res.flights.length, 66);
eq('skipped', res.skipped, 0);
const st = computeStats(res.flights, AIRPORTS);
eq('total', st.total, 66);
eq('canceled', st.canceled, 0);
eq('dateMin', st.dateMin, '2014-08-16');
eq('dateMax', st.dateMax, '2026-08-19');
eq('airports', st.airports.size, 41);
eq('unknown airports', st.unknownAirports.size, 0);
eq('airlines', st.airlines.size, 23);
eq('countries', st.countries.size, 18);
console.log('aircraft types:', st.aircraft.size);
eq('years', Object.fromEntries(st.yearRange),
  { 2014: 5, 2015: 4, 2016: 6, 2017: 0, 2018: 2, 2019: 6, 2020: 0, 2021: 0, 2022: 2, 2023: 12, 2024: 10, 2025: 5, 2026: 14 });
ok('yearly sums to total', st.yearRange.reduce((a, [, n]) => a + n, 0) === 66);
console.log('distanceKm:', Math.round(st.distanceKm), 'loops:', (st.distanceKm / 40075).toFixed(2));
console.log('hours:', st.hours.toFixed(1), 'bySrc:', JSON.stringify(st.hoursBySrc), 'excluded:', st.hoursExcluded);
console.log('dep samples:', st.depDelays.length, 'arr samples:', st.arrDelays.length);
console.log('avgDep:', st.avgDep && st.avgDep.toFixed(1), 'avgArr:', st.avgArr && st.avgArr.toFixed(1),
  'onTime:', st.onTime && (st.onTime * 100).toFixed(1) + '%');
console.log('maxArrDelay:', st.maxArrDelay && `${st.maxArrDelay.min}min ${st.maxArrDelay.f.date} ${st.maxArrDelay.f.airlineIcao}${st.maxArrDelay.f.flightNumber} ${st.maxArrDelay.f.from}->${st.maxArrDelay.f.effectiveTo}`);
console.log('top routes:', ctx.api.topN(st.routes, 5));
console.log('top airlines:', ctx.api.topN(st.airlineCount, 5));
console.log('top airports:', ctx.api.topN(st.airportCount, 5));
// row 1: CPA471 dep sched 08:55 actual 11:22 = +147
const f0 = res.flights[0];
eq('CPA471 dep delay', tsToMin(f0.times.gateDepActual) - tsToMin(f0.times.gateDepSched), 147);
// no NaN anywhere in stats
const scan = JSON.stringify({ d: st.distanceKm, h: st.hours, a: st.avgDep, b: st.avgArr, o: st.onTime, y: st.yearRange, dd: st.depDelays, ad: st.arrDelays });
ok('no NaN in stats', !scan.includes('NaN') && !scan.includes('null,null'));

// ---- 4. NaN robustness: rows with missing actuals / times ----
const hdr = 'Date,Airline,Flight,From,To,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number';
const csv2 = hdr + '\n' +
  '2024-01-01,EVA,100,TPE,HKG,false,,2024-01-01T10:00,,,,,,2024-01-01T12:00,,Airbus A321,\n' + // no actuals at all
  '2024-02-01,EVA,101,HKG,TPE,True,,2024-02-01T10:00,,,,,,2024-02-01T12:00,,Airbus A321,\n' +  // canceled
  '2024-03-01,EVA,102,TPE,XXX,false,,,,,,,,,,Boeing 777-300 ER,\n' +                             // unknown airport, no times
  '2024-04-01,EVA,103,TPE,KIX,false,OKJ,2024-04-01T09:00,2024-04-01T09:05,,,,,2024-04-01T13:00,2024-04-01T13:30,Boeing 777-300 ER,';
const res2 = normalizeFlights(parseCSV(csv2));
eq('robust rows', res2.flights.length, 4);
const st2 = computeStats(res2.flights, AIRPORTS);
eq('robust total excludes canceled', st2.total, 3);
eq('robust canceled', st2.canceled, 1);
eq('robust unknown', [...st2.unknownAirports], ['XXX']);
eq('robust distExcluded', st2.distExcluded, 1);
eq('diverted effectiveTo', res2.flights[3].effectiveTo, 'OKJ');
ok('diverted route uses OKJ', st2.routes.has('OKJ-TPE'));
eq('robust dep samples', st2.depDelays.length, 1);
eq('robust arr samples', st2.arrDelays.length, 1);
const scan2 = JSON.stringify({ d: st2.distanceKm, h: st2.hours, a: st2.avgDep, b: st2.avgArr, o: st2.onTime });
ok('no NaN in robust stats', !scan2.includes('NaN'), scan2);
// canceled=True (spec casing) parsed
eq('canceled True parsed', res2.flights[1].canceled, true);

// ---- 5. header validation ----
const bad = normalizeFlights(parseCSV('Foo,Bar\n1,2'));
eq('bad header rejected', bad.ok, false);
eq('bad header missing list', bad.missing, ['Date', 'Airline', 'Flight', 'From', 'To']);

// ---- 6. antimeridian ----
const pts = greatCirclePoints([35.77, 140.39], [33.94, -118.4], 64); // NRT->LAX
const segs = splitAntimeridian(pts);
eq('antimeridian segments', segs.length, 2);
ok('all lons in range', segs.flat().every(p => p[1] >= -180 && p[1] <= 180));
const endA = segs[0][segs[0].length - 1], startB = segs[1][0];
ok('split at edge', Math.abs(Math.abs(endA[1]) - 180) < 1e-6 && Math.abs(Math.abs(startB[1]) - 180) < 1e-6);
ok('lat continuous at split', Math.abs(endA[0] - startB[0]) < 1e-6);
// non-crossing route stays single segment
eq('TPE-AKL segments', splitAntimeridian(greatCirclePoints([25.078, 121.233], [-37.008, 174.792], 64)).length, 1);

// ---- 7. distance sanity ----
const tpehkg = haversineKm([25.078, 121.233], [22.308, 113.918]);
ok('TPE-HKG ~800km', tpehkg > 750 && tpehkg < 850, tpehkg);
const tpeakl = haversineKm([25.078, 121.233], [-37.008, 174.792]);
ok('TPE-AKL ~8900km', tpeakl > 8500 && tpeakl < 9300, tpeakl);

// ---- 8. flight hours tiers ----
const fBlock = res.flights.find(f => f.times.gateDepActual && f.times.gateArrActual);
ok('block-tier used for gate actuals', flightHours(fBlock, AIRPORTS).src === 'block');
const fh0 = flightHours(res.flights[0], AIRPORTS); // CPA471 TPE->HKG gate actuals 11:22 -> 13:14 same offset
ok('CPA471 block ~1.87h', Math.abs(fh0.h - (112 / 60)) < 0.01, fh0);

// ---- summary ----
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
