// Stáhne data všech modelů z online katalogu markmade.cz (otevírá detail každého modelu).
// Výstup: raw-all.jsonl (1 záznam = 1 řádek). Lze přerušit a spustit znovu – naváže.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prohlížeč: proměnná CHROME_PATH (v GitHub Actions /usr/bin/google-chrome), jinak Microsoft Edge na Windows
const BROWSER = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTF = path.join(__dirname, 'raw-all.jsonl');

async function loadCatalog() {
  // Soubor s daty katalogu má v názvu hash, proto se jeho adresa čte přímo ze stránky katalogu
  const html = await (await fetch('https://www.markmade.cz/onlinekatalog/')).text();
  const m = html.match(/https:\/\/markmadecz\.github\.io\/katalog-foto\/data\/katalog-[0-9a-f]+\.json/);
  if (!m) throw new Error('Adresa JSON katalogu nenalezena na stránce /onlinekatalog/');
  const t = await (await fetch(m[0])).text();
  return JSON.parse(t.replace(/^\uFEFF/, '')).m;
}

(async () => {
  const cat = await loadCatalog();
  const meta = new Map(cat.map((m) => [m.i, { cat: m.c, tags: m.k || [] }]));
  const done = new Set();
  if (fs.existsSync(OUTF)) for (const l of fs.readFileSync(OUTF, 'utf8').split('\n')) { if (l.trim()) { try { done.add(JSON.parse(l).id); } catch (e) {} } }
  const todo = cat.map((m) => m.i).filter((i) => !done.has(i));
  console.log(`celkem ${cat.length}, hotovo ${done.size}, zbývá ${todo.length}`);
  const b = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  let p;
  const open = async () => {
    if (p) { try { await p.close(); } catch (e) {} }
    p = await b.newPage();
    await p.setViewport({ width: 1400, height: 1000 });
    await p.goto('https://www.markmade.cz/onlinekatalog/', { waitUntil: 'networkidle2', timeout: 120000 });
    await sleep(2500);
  };
  await open();
  const failed = [];
  let n = 0;
  for (const id of todo) {
    if (n && n % 250 === 0) await open();
    n++;
    let d = null;
    for (let attempt = 0; attempt < 2 && !d; attempt++) {
      try {
        await p.evaluate((i) => { location.hash = ''; location.hash = 'produkt-' + i; }, id);
        let ok = false;
        for (let t = 0; t < 30; t++) {
          await sleep(150);
          ok = await p.evaluate((i) => {
            const ov = document.getElementById('mmc-ov');
            if (!ov || !ov.classList.contains('is-on')) return false;
            const code = [...ov.querySelectorAll('.mmc-spec dt')].find((x) => /Kód modelu/.test(x.textContent));
            return !!code && code.nextElementSibling.textContent.trim() === i;
          }, id);
          if (ok) break;
        }
        if (!ok) continue;
        await p.evaluate(() => {
          const ov = document.getElementById('mmc-ov');
          const s = [...ov.querySelectorAll('summary,button,a')].find((e) => /Ceník potisku/.test(e.textContent) && !/Jak se slevy/.test(e.textContent));
          if (s) s.click();
          ov.querySelectorAll('details').forEach((x) => { x.open = true; });
        });
        await sleep(200);
        d = await p.evaluate(() => {
          const ov = document.getElementById('mmc-ov');
          const q = (s) => { const e = ov.querySelector(s); return e ? e.textContent.trim() : ''; };
          const title = document.getElementById('mmc-dt');
          const small = title.querySelector('small');
          const spec = {};
          ov.querySelectorAll('.mmc-spec dt').forEach((dt) => { spec[dt.textContent.trim()] = dt.nextElementSibling.textContent.trim(); });
          return {
            brand: q('.mmc-brand'),
            name: [...title.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim(),
            sub: small ? small.textContent.trim() : '',
            comp: q('.mmc-comp'), ddesc: q('.mmc-ddesc'), specp: q('.mmc-specp'), spec,
            colors: [...ov.querySelectorAll('.mmc-sw button')].map((x) => ({ name: x.title, bg: x.style.backgroundColor })),
            img: (document.getElementById('mmc-mimg') || {}).src || '',
            thumbs: [...ov.querySelectorAll('.mmc-gth img')].map((x) => x.src),
            text: ov.innerText,
          };
        });
      } catch (e) {
        console.log('  chyba', id, e.message.slice(0, 80));
        try { await open(); } catch (e2) {}
      }
    }
    if (!d) { failed.push(id); console.log('  SKIP', id); continue; }
    d.id = id; d.cat = meta.get(id).cat; d.tags = meta.get(id).tags;
    fs.appendFileSync(OUTF, JSON.stringify(d) + '\n', 'utf8');
    if (n % 50 === 0) console.log(`  ${n}/${todo.length} ${new Date().toLocaleTimeString()}`);
  }
  console.log('hotovo; přeskočeno:', failed.join(','));
  await b.close();
})();
