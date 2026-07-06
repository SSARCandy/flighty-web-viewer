// Downloads FlightAware airline logos (Jxck-S/airline-logos) for every ICAO in airlines.js
const fs = require('fs');
const vm = require('vm');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/airlines.js', 'utf8') + ';this.A=AIRLINES;', ctx);
const icaos = Object.keys(ctx.A);
fs.mkdirSync(__dirname + '/logos_raw', { recursive: true });

async function main() {
  let hit = 0, miss = [];
  for (const icao of icaos) {
    const url = `https://raw.githubusercontent.com/Jxck-S/airline-logos/main/flightaware_logos/${icao}.png`;
    const res = await fetch(url);
    if (!res.ok) { miss.push(icao); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(`${__dirname}/logos_raw/${icao}.png`, buf);
    hit++;
  }
  console.log('downloaded:', hit, '/', icaos.length);
  console.log('missing:', miss.join(' ') || 'none');
}
main();
