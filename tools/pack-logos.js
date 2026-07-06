// Packs a curated subset of resized FlightAware logos into logos.gen.js (ICAO -> data URI).
const fs = require('fs');

// 資料中的 23 家 + 常用航空（其餘 → 字母徽章後備）
const WANT = (
  'AEE ANA ANZ AXM CAL CPA CXA DAC ETD EVA IBE ICE JJA JST LNI MAS PAL RYR SJX TGW TTW TWB VOE ' +
  'MDA UIA JAL KAL AAR APJ JJP TZP HKE AMU CRK CCA CES CSN CQH DKH CSZ ' +
  'SIA JSA THA AIQ NOK HVN VJC CEB GIA AWQ BTK ' +
  'QFA VOZ FJI UAE QTR THY BAW DLH AFR KLM VLG EZY ' +
  'UAL AAL DAL ACA'
).split(/\s+/);

const out = {};
let total = 0, miss = [];
for (const icao of WANT) {
  const p = `${__dirname}/logos_small/${icao}.png`;
  if (!fs.existsSync(p)) { miss.push(icao); continue; }
  const b64 = fs.readFileSync(p).toString('base64');
  out[icao] = 'data:image/png;base64,' + b64;
  total += b64.length;
}
console.log('packed:', Object.keys(out).length, 'missing:', miss.join(' ') || 'none');
console.log('total base64 KB:', (total / 1024).toFixed(1));
fs.writeFileSync(__dirname + '/logos.gen.js', 'const LOGO_URIS=' + JSON.stringify(out) + ';\n');
