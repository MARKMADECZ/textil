// Dodatečné zpracování hotového webu (spouští se po build.js):
//  1) map.json – mapa "kód modelu" -> adresa stránky (používá skript v katalogu na markmade.cz)
//  2) stránka /cenik-potisku/ (statický ceník potisku z dat katalogu)
//  3) měření návštěv (Google Analytics) až po souhlasu s cookies – soubor analytics.js
//  4) odkazy na ceník v menu a u produktů, záznam ceníku v sitemapě
const fs = require('fs');
const path = require('path');

const OUT = process.env.OUT || path.join(__dirname, 'out');
const BASE = (process.env.BASE || 'https://textil.markmade.cz').replace(/\/$/, '');
const MAIN = 'https://www.markmade.cz';
const GA_ID = process.env.GA_ID || 'G-YJM27BHX89';
const TODAY = new Date().toISOString().slice(0, 10);

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kc = (n) => new Intl.NumberFormat('cs-CZ').format(Math.round(n)).replace(/ /g, ' ') + ' Kč';

// ---------- 1) map.json ----------
const map = {};
for (const f of walk(OUT).filter((x) => x.endsWith('index.html'))) {
  const h = fs.readFileSync(f, 'utf8');
  const m = h.match(/"@type":"Product".*?"sku":"([^"]+)"/);
  const c = h.match(/<link rel="canonical" href="([^"]+)"/);
  if (m && c) map[m[1]] = c[1].replace(BASE, '');
}
fs.writeFileSync(path.join(OUT, 'map.json'), JSON.stringify(map), 'utf8');
console.log('map.json:', Object.keys(map).length, 'modelů');

// ---------- 2) Ceník potisku ----------
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw.json'), 'utf8'));
function printTable(r) {
  const t = r.text.replace(/[   ]/g, ' ');
  const pi = t.indexOf('Počet kusů');
  if (pi < 0) return null;
  const end = t.indexOf('Firmám', pi);
  const seg = t.slice(pi, end > 0 ? end : pi + 1500);
  const cols = seg.split('\n')[0].split('\t').slice(1).map((s) => s.trim()).filter(Boolean);
  const rows = [];
  for (const m of seg.matchAll(/(\d+–\d+) ks\s*\t\s*\n?([\s\S]*?)(?=\n\d+–\d+ ks|\n\d+\+ ks|$)/g)) {
    const nums = [...m[2].matchAll(/(\d[\d ]*) Kč(?! s DPH)/g)].map((x) => parseInt(x[1].replace(/\s/g, ''), 10));
    if (nums.length >= cols.length) rows.push({ range: m[1], vals: nums.slice(0, cols.length) });
  }
  return rows.length ? { cols, rows } : null;
}
let pt = null;
for (const r of raw) { if (r.cat === 'Trička') { pt = printTable(r); if (pt && pt.cols.length === 3) break; } }
if (!pt) throw new Error('Ceník potisku nenalezen v datech katalogu');
const sizeName = (c) => (/A3/.test(c) ? 'A3 (28,5 × 42 cm)' : /A4/.test(c) ? 'A4 (21 × 28,5 cm)' : '10 × 10 cm');
const vat = (n) => Math.round(n * 1.21);
const tab = `<table><thead><tr><th>Počet stejných potisků</th>${pt.cols.map((c) => `<th>${esc(sizeName(c))}</th>`).join('')}</tr></thead><tbody>${pt.rows.map((r) => `<tr><td>${r.range} ks</td>${r.vals.map((v) => `<td>${kc(v)}<br><small>${kc(vat(v))} s DPH</small></td>`).join('')}</tr>`).join('')}<tr><td>100+ ks</td><td colspan="${pt.cols.length}">individuální nabídka</td></tr></tbody></table>`;
const price = (rowIdx, colIdx) => pt.rows[rowIdx].vals[colIdx];
const small5 = price(0, 0), a4_5 = price(0, 1), a3_5 = price(0, 2);
const small50 = price(pt.rows.length - 1, 0);
const ex10 = price(1, 0) + price(1, 1);

const faq = [
  ['Kolik stojí potisk jednoho místa na triku?', `Potisk 10 × 10 cm stojí od ${kc(small50)} za kus při 50 a více stejných potiscích, při 5–9 kusech ${kc(small5)}. Větší motiv A4 vychází na ${kc(a4_5)} při 5–9 kusech a motiv A3 na ${kc(a3_5)}. Ceny jsou bez DPH.`],
  ['Počítá se cena potisku podle počtu kusů, nebo podle počtu stejných potisků?', 'Podle počtu stejných potisků v celé zakázce. Pokud potisknete stejným logem 35 kusů různých modelů, použije se pásmo 20–49 ks. Každé místo potisku (hruď, záda, rukáv) se počítá zvlášť.'],
  ['Je grafická příprava zdarma?', 'Ano, od 25 kusů s potiskem je příprava tiskových dat zdarma. U menších zakázek a při větší úpravě nebo překreslení loga se domluvíme na individuální ceně.'],
  ['Od kolika kusů potisk děláte?', 'Od 5 kusů od každého modelu a barvy, velikosti lze libovolně kombinovat. Pro zakázky od 100 kusů připravíme individuální nabídku.'],
];
const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
const crumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Katalog textilu', item: BASE + '/' }, { '@type': 'ListItem', position: 2, name: 'Ceník potisku', item: BASE + '/cenik-potisku/' }] };

const body = `<nav class="bc" aria-label="Drobečková navigace"><a href="${BASE}/">Katalog textilu</a> › <span>Ceník potisku</span></nav>
<h1>Ceník potisku textilu – sítotisk, DTF, DTG</h1>
<p>Cena potisku se počítá za každé místo potisku a klesá podle počtu stejných potisků v objednávce. Níže najdete orientační ceny za jeden potisk bez DPH i s DPH. Cenu textilu vidíte u každého modelu v <a href="${BASE}/">katalogu textilu</a>.</p>

<h2>Ceny za jeden potisk podle velikosti a množství</h2>
${tab}
<p class="note">Maximální šířka potisku je 28,5 cm. Pro 100 a více kusů a pro firmy (B2B) potisk naceníme na míru. Ceny jsou orientační, přesnou cenu potvrdíme v nabídce.</p>

<h2>Jak se cena skládá</h2>
<ul>
<li><b>Textil:</b> cena modelu podle počtu kusů stejného modelu (viz katalog).</li>
<li><b>Potisk:</b> cena za každé místo potisku zvlášť a podle počtu stejných potisků v celé zakázce.</li>
<li><b>Grafika:</b> příprava tiskových dat je zdarma od 25 kusů s potiskem.</li>
</ul>
<h3>Příklad</h3>
<p>10 triček s malým logem na hrudi (10 × 10 cm) a velkým logem na zádech (A4): potisk vychází na ${kc(price(1, 0))} + ${kc(price(1, 1))} = <b>${kc(ex10)} za kus</b> bez DPH, k tomu cena textilu. Celkem tedy například při textilu 79 Kč ${kc(79 + ex10)} za kus, ${kc((79 + ex10) * 10)} za 10 kusů bez DPH.</p>

<h2>Možná umístění potisku</h2>
<table><thead><tr><th>Umístění</th><th>Velikost</th><th>Cena při 5–9 ks</th></tr></thead><tbody>
<tr><td>Levá nebo pravá hruď</td><td>10 × 10 cm</td><td>${kc(small5)}</td></tr>
<tr><td>Střed hrudi</td><td>A4</td><td>${kc(a4_5)}</td></tr>
<tr><td>Celý předek</td><td>A3</td><td>${kc(a3_5)}</td></tr>
<tr><td>Rukáv</td><td>10 × 10 cm</td><td>${kc(small5)}</td></tr>
<tr><td>Pod límcem na zádech</td><td>10 × 10 cm</td><td>${kc(small5)}</td></tr>
<tr><td>Záda</td><td>A4</td><td>${kc(a4_5)}</td></tr>
<tr><td>Celá záda</td><td>A3</td><td>${kc(a3_5)}</td></tr>
</tbody></table>

<h2>Technologie potisku</h2>
<p>Podle motivu, materiálu a počtu kusů doporučíme nejvhodnější technologii: <a href="${MAIN}/technologie-potisku/#mm-card-sito">sítotisk</a> pro větší série, <a href="${MAIN}/technologie-potisku/#mm-card-dtf">DTF</a> pro plnobarevné motivy a menší počty, <a href="${MAIN}/technologie-potisku/#mm-card-dtg">DTG</a> pro detailní fotografické motivy. Více na stránce <a href="${MAIN}/technologie-potisku/">technologie potisku</a>.</p>

<h2>Časté dotazy k ceně potisku</h2>
${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}

<p><a class="btn" href="${MAIN}/onlinekatalog/">Vybrat textil v katalogu</a><a class="btn alt" href="${MAIN}/kontakt/">Nezávazná poptávka</a></p>`;

const idx = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
const mainOpen = idx.indexOf('<main class="wrap">');
const mainClose = idx.indexOf('</main>');
let head = idx.slice(0, mainOpen);
const tail = idx.slice(mainClose);
const title = 'Ceník potisku textilu od 5 kusů – sítotisk, DTF, DTG | Markmade';
const desc = `Ceník potisku textilu: potisk 10 × 10 cm od ${kc(small50)}, A4 od ${kc(price(pt.rows.length - 1, 1))}. Ceny podle počtu stejných potisků, grafika zdarma od 25 ks.`;
const canonical = BASE + '/cenik-potisku/';
head = head
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
  .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
  .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
  .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
head = head.replace('</head>', [crumbLd, faqLd].map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n') + '\n</head>');
fs.mkdirSync(path.join(OUT, 'cenik-potisku'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'cenik-potisku', 'index.html'), head + '<main class="wrap">\n' + body + '\n' + tail, 'utf8');
console.log('cenik-potisku: vytvořeno');

// ---------- 3) měření návštěv se souhlasem ----------
const analytics = `(function () {
  var ID = '${GA_ID}', K = 'mm_consent';
  function load() {
    if (window.__mmGa) return; window.__mmGa = true;
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', ID, { anonymize_ip: true });
  }
  var c = null; try { c = localStorage.getItem(K); } catch (e) {}
  function footerLink() {
    var p = document.querySelector('footer.site .wrap p:last-child'); if (!p || document.getElementById('mm-cookie-set')) return;
    p.insertAdjacentHTML('beforeend', ' · <a href="#" id="mm-cookie-set">Nastavení cookies</a>');
    document.getElementById('mm-cookie-set').addEventListener('click', function (e) { e.preventDefault(); try { localStorage.removeItem(K); } catch (x) {} location.reload(); });
  }
  function banner() {
    var d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Souhlas s cookies');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1a1a1a;color:#fff;padding:14px 16px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,.25)';
    d.innerHTML = '<div style="max-width:1100px;margin:0 auto;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span style="flex:1 1 360px">Používáme analytické cookies (Google Analytics), abychom zjistili, jak web používáte a mohli jej zlepšovat. Bez vašeho souhlasu se nic neměří. <a href="${MAIN}/gdpr/" style="color:#fff;text-decoration:underline">Zásady ochrany osobních údajů</a></span><button id="mm-c-yes" style="background:#b4231a;color:#fff;border:0;border-radius:6px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer">Povolit</button><button id="mm-c-no" style="background:transparent;color:#fff;border:1px solid #fff;border-radius:6px;padding:9px 18px;font:inherit;cursor:pointer">Odmítnout</button></div>';
    document.body.appendChild(d);
    function set(v) { try { localStorage.setItem(K, v); } catch (e) {} d.remove(); if (v === 'yes') load(); }
    document.getElementById('mm-c-yes').onclick = function () { set('yes'); };
    document.getElementById('mm-c-no').onclick = function () { set('no'); };
  }
  function init() { footerLink(); if (c === 'yes') load(); else if (c !== 'no') banner(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
`;
fs.writeFileSync(path.join(OUT, 'analytics.js'), analytics, 'utf8');

// ---------- 4) odkazy na ceník, měření, sitemapa ----------
let n = 0;
for (const f of walk(OUT).filter((x) => x.endsWith('.html'))) {
  let h = fs.readFileSync(f, 'utf8');
  if (h.includes('/analytics.js')) continue;
  h = h.replace(`<a href="${BASE}/">Katalog textilu</a>`, `<a href="${BASE}/">Katalog textilu</a>\n<a href="/cenik-potisku/">Ceník potisku</a>`);
  h = h.replace('<h2>Ceník potisku</h2>', '<h2>Ceník potisku</h2>\n<p><a href="/cenik-potisku/">Kompletní ceník potisku a příklad výpočtu</a></p>');
  h = h.replace('</body>', '<script src="/analytics.js" defer></script>\n</body>');
  fs.writeFileSync(f, h, 'utf8');
  n++;
}
const smf = path.join(OUT, 'sitemap.xml');
let sm = fs.readFileSync(smf, 'utf8');
if (!sm.includes('/cenik-potisku/')) sm = sm.replace('</urlset>', `<url><loc>${BASE}/cenik-potisku/</loc><lastmod>${TODAY}</lastmod><priority>0.9</priority></url>\n</urlset>`);
fs.writeFileSync(smf, sm, 'utf8');
console.log('upraveno stránek:', n, '; sitemapa doplněna o ceník');
