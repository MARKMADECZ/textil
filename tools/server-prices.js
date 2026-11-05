// Stáhne ze serveru souhrnné ceny textilu všech modelů (cena „od“ = nejlevnější objednatelná varianta, množstevní pásma)
// a uloží je do ../server-prices.json. build.js jimi přepíše ceny přečtené z detailu katalogu (ten ukazuje výchozí barvu,
// ne nejlevnější – audit 5. 11. 2026). Při chybě nebo neúplných datech skončí chybou, aby se nenasadil web s jinými cenami.
const fs = require('fs'), path = require('path');
const API = (process.env.CATALOG_API || 'https://console.markmade.cz/integrations/website/catalog').replace(/\/$/, '');

(async () => {
  const meta = await (await fetch(API)).json();
  const out = { revision: meta.revision, tiers: meta.tiers, models: {} };
  for (let offset = 0, more = true, guard = 0; more && guard < 200; guard++) {
    let page;
    for (let attempt = 0; attempt < 3 && !page; attempt++) {
      try {
        const r = await fetch(`${API}/page?offset=${offset}&limit=48`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        page = await r.json();
      } catch (e) { if (attempt === 2) throw e; await new Promise((s) => setTimeout(s, 2000)); }
    }
    if (page.revision !== out.revision) throw new Error('Ceny se během stahování změnily – spusťte znovu.');
    for (const m of page.models) if (Array.isArray(m._pk) && m._pk.every((v) => v == null || v > 0)) out.models[m.i] = m._pk;
    offset += page.models.length; more = page.more && page.models.length > 0;
    out.total = page.total;
  }
  const n = Object.keys(out.models).length;
  if (!Array.isArray(out.tiers) || out.tiers.length !== 4 || n < 1500 || n < out.total - 50) throw new Error(`Neúplná data ze serveru: ${n} z ${out.total} modelů`);
  fs.writeFileSync(path.join(__dirname, '..', 'server-prices.json'), JSON.stringify(out), 'utf8');
  console.log(`server-prices.json: ${n} modelů, revize ${String(out.revision).slice(0, 12)}, pásma ${out.tiers.join('/')}`);
})().catch((e) => { console.error('Ceny ze serveru nelze stáhnout:', e.message); process.exit(1); });
