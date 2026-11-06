// Otisk dat, ze kterých je web sestavený (6. 11. 2026). Bez argumentu vypíše otisk z ../server-prices.json.
// S argumentem URL porovná s otiskem nasazeného webu (build-state.json) a vypíše, co je potřeba:
//   none   – na serveru se nic nezměnilo
//   prices – změnily se jen ceny textilu → stačí přestavět web z posledních stažených detailů (pár minut)
//   full   – přibyl/ubyl model nebo se změnil ceník potisku → znovu stáhnout detaily z katalogu (30–40 min)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const sha = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

function current() {
  const sp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server-prices.json'), 'utf8'));
  const models = Object.keys(sp.models).sort().map((k) => [k, sp.models[k]]);
  return { prices: sha([sp.tiers, models]), ids: sha([...new Set(sp.ids || [])].sort()), print: sha(sp.print || null), revision: sp.revision };
}

(async () => {
  const cur = current();
  const url = process.argv[2];
  if (!url) { process.stdout.write(JSON.stringify(cur)); return; }
  let dep = null;
  try {
    const r = await fetch(url + '?t=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } });
    if (r.ok) dep = await r.json();
  } catch (e) {}
  let mode = 'none';
  if (!dep || dep.ids !== cur.ids || dep.print !== cur.print) mode = 'full';
  else if (dep.prices !== cur.prices) mode = 'prices';
  console.error('nasazeno:', JSON.stringify(dep), '\nserver:  ', JSON.stringify(cur), '\n→', mode);
  process.stdout.write(mode);
})();
