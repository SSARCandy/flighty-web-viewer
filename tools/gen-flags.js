// Downloads flag-icons (https://flagicons.lipis.dev) 1x1 SVGs and emits flags.gen.js
// (FLAG_SVGS: ISO2 -> minified svg markup). Countries not in the list fall back to
// the geometric flags / letter circles at runtime.
const fs = require('fs');

const COUNTRIES = (
  'TW JP KR CN HK MO SG MY TH VN PH ID IN LK NP BD PK KH LA MM BN ' +
  'AE QA SA TR IL EG OM KW JO BH ' +
  'GB FR DE IT ES PT NL BE CH AT GR CY IS NO SE DK FI IE PL CZ HU RU UA RO HR MT LU MC ' +
  'AU NZ FJ PG ' +
  'US CA MX BR AR CL PE CO ' +
  'ZA KE ET MA TN MU MV KZ MN UZ GE'
).split(/\s+/);

async function main() {
  const out = {};
  let total = 0;
  const sizes = [];
  for (const cc of COUNTRIES) {
    const url = `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${cc.toLowerCase()}.svg`;
    const res = await fetch(url);
    if (!res.ok) { console.log('MISS', cc, res.status); continue; }
    let svg = await res.text();
    svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
    out[cc] = svg;
    total += svg.length;
    sizes.push([cc, svg.length]);
  }
  sizes.sort((a, b) => b[1] - a[1]);
  console.log('largest:', sizes.slice(0, 12).map(([c, n]) => `${c}:${(n / 1024).toFixed(1)}K`).join(' '));
  console.log('countries:', Object.keys(out).length, 'total KB:', (total / 1024).toFixed(1));
  fs.writeFileSync(__dirname + '/flags.gen.js', 'const FLAG_SVGS=' + JSON.stringify(out) + ';\n');
}
main();
