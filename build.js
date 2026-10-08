// Generátor statických produktových stránek pro textil.markmade.cz
// Vstup: raw.json (z scrape.js, data čtená přímo z online katalogu). Výstup: složka OUT.
const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE || 'https://textil.markmade.cz').replace(/\/$/, '');
const MAIN = 'https://www.markmade.cz';
const OUT = process.env.OUT || path.join(__dirname, 'out');
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);

const mk = (name, h1, slug, noun, landing) => ({ name, h1, slug, noun, main: landing ? MAIN + '/' + landing + '/' : null, catalog: MAIN + '/onlinekatalog/?kategorie=' + slug });
// klíč = pole "c" v datech katalogu
const CATS = {
  'Trička': mk('Trička', 'Trička s potiskem', 'tricka', 'trička', 'tricka-s-potiskem'),
  'Mikiny': mk('Mikiny', 'Mikiny s potiskem', 'mikiny', 'mikiny', 'mikiny-s-potiskem'),
  'Polokošile': mk('Polokošile', 'Polokošile s potiskem', 'polokosile', 'polokošile', 'polokosile-s-potiskem'),
  'Čepice': mk('Čepice a kšiltovky', 'Čepice a kšiltovky s potiskem', 'cepice', 'čepice a kšiltovky', 'cepice-s-potiskem'),
  'Bundy-vesty': mk('Bundy a vesty', 'Bundy a vesty s potiskem', 'bundy-vesty', 'bundy a vesty', null),
  'Fleece': mk('Fleece', 'Fleecové mikiny a bundy s potiskem', 'fleece', 'fleecové mikiny a bundy', null),
  'Kalhoty-šortky': mk('Kalhoty a šortky', 'Kalhoty a šortky s potiskem', 'kalhoty-sortky', 'kalhoty a šortky', null),
  'Košile': mk('Košile', 'Košile s potiskem', 'kosile', 'košile', null),
  'Froté': mk('Froté', 'Froté zboží s potiskem', 'frote', 'froté zboží', null),
  'Tašky': mk('Tašky', 'Tašky s potiskem', 'tasky', 'tašky', null),
  'Doplňkový sortiment': mk('Doplňky', 'Doplňky s potiskem', 'doplnkovy-sortiment', 'doplňky', null),
  'Ostatní': mk('Ostatní textil', 'Ostatní textil s potiskem', 'ostatni', 'ostatní textil', null),
};
// tematické přehledy (jen odkazují na produkty, žádný duplicitní obsah)
const HUBS = [
  { tag: 'u:pra', slug: 'pracovni-odevy', name: 'Pracovní oděvy', h1: 'Pracovní oděvy s potiskem a logem', main: MAIN + '/pracovni-odevy-s-potiskem/', catalog: MAIN + '/onlinekatalog/?pouziti=pracovni', intro: 'Pracovní trička, mikiny, bundy, kalhoty a vesty, které vydrží praní i provoz. Vyberte model a zjistěte cenu textilu i potisku loga od 5 kusů.' },
  { tag: 'u:spo', slug: 'sportovni-textil', name: 'Sportovní textil', h1: 'Sportovní a funkční textil s potiskem', main: null, catalog: MAIN + '/onlinekatalog/?pouziti=sport-a-funkcni', intro: 'Sportovní trička, funkční mikiny a týmové oblečení pro kluby, závody a akce. Potisk od 5 kusů z vlastní dílny.' },
  { tag: 'u:det', slug: 'detsky-textil', name: 'Dětský textil', h1: 'Dětské oblečení s potiskem', main: null, catalog: MAIN + '/onlinekatalog/?pohlavi=detske', intro: 'Dětská trička, mikiny a čepice pro školy, školky, kroužky a rodiny. Potisk od 5 kusů, ceny hned u každého modelu.' },
];
const PER_PAGE = 48;
const USED_TITLES = new Set();
// kategorie, kde je gramáž smysluplný údaj pro výběr (u bund se uvádí gramáž svrchní látky, což klame)
const GRAM_CATS = new Set(['Trička', 'Mikiny', 'Polokošile', 'Košile', 'Froté', 'Fleece']);

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const kc = (n) => new Intl.NumberFormat('cs-CZ').format(Math.round(n)).replace(/ /g, ' ') + ' Kč';
const lcFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const trunc = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// ---------- parsování ----------
function parse(r) {
  const t = r.text.replace(/[   ]/g, ' ');
  r.ddesc = r.ddesc.replace(/[   ]/g, ' ');
  const tiers = [];
  const num = (s) => parseInt(String(s).replace(/\s/g, ''), 10);
  for (const m of t.matchAll(/^(\d+)(?:–(\d+)|\+) ks\t(od )?(\d[\d ]*) Kč\t(?:od )?(\d[\d ]*) Kč$/gm)) {
    tiers.push({ from: +m[1], to: m[2] ? +m[2] : null, net: num(m[4]), gross: num(m[5]), from_: !!m[3] });
  }
  // ceník potisku
  const print = { cols: [], rows: [] };
  const pi = t.indexOf('Počet kusů');
  if (pi >= 0) {
    const seg = t.slice(pi, t.indexOf('Firmám', pi) > 0 ? t.indexOf('Firmám', pi) : pi + 1500);
    const hdr = seg.split('\n')[0].split('\t').slice(1).map((s) => s.trim()).filter(Boolean);
    print.cols = hdr;
    for (const m of seg.matchAll(/(\d+–\d+) ks\s*\t\s*\n?([\s\S]*?)(?=\n\d+–\d+ ks|\n\d+\+ ks|$)/g)) {
      const nums = [...m[2].matchAll(/(\d[\d ]*) Kč(?! s DPH)/g)].map((x) => num(x[1]));
      if (nums.length >= hdr.length) print.rows.push({ range: m[1], vals: nums.slice(0, hdr.length) });
    }
  }
  const placements = [];
  const seenP = new Set();
  for (const m of t.matchAll(/^([^\n(]+?) \(([^)\n]+)\)\n(\d[\d ]*) Kč bez DPH · (\d[\d ]*) Kč s DPH \/ ks/gm)) {
    const k = m[1] + m[2];
    if (!seenP.has(k)) { seenP.add(k); placements.push({ name: m[1].trim(), size: m[2], net: num(m[3]) }); }
  }
  const sizes = (r.ddesc.match(/velikosti ([^.]+)\./) || [])[1] || '';
  const techs = (r.ddesc.match(/Vhodné pro potisk: ([^.]+)\./) || [])[1] || '';
  const stock = (t.match(/Skladem u dodavatele(?: \(([\d\s]+) ks\))?/) || [])[0] || '';
  return { tiers, print, placements, sizes, techs, stock };
}

const gramNum = (r) => parseInt((r.spec['Gramáž'] || '').match(/\d+/) || [0], 10);

function slugs(p) {
  if (!CATS[p.cat]) throw new Error('neznámá kategorie ' + p.cat + ' u ' + p.id);
  p.catSlug = CATS[p.cat].slug;
  p.brandSlug = slugify(p.brand);
  p.slug = slugify(p.name + ' ' + p.id);
  p.path = `/${p.catSlug}/${p.brandSlug}/${p.slug}/`;
  p.url = BASE + p.path;
  p.full = `${p.brand} ${p.name}`;
  p.type = lcFirst(p.sub || CATS[p.cat].noun);
  p.catalogUrl = `${MAIN}/onlinekatalog/#produkt-${p.id}`;
}

// ---------- texty ----------
function intro(p) {
  const g = gramNum(p);
  const cat = p.cat;
  const mat = (p.spec['Materiál'] || '').replace(/\s*%/g, ' %').replace(/\s+/g, ' ');
  const weight = g ? (g < 140 ? 'lehčím materiálům' : g < 175 ? 'středně silným materiálům' : g < 230 ? 'silnějším materiálům' : 'těžkým materiálům') : '';
  const bits = [];
  bits.push(`${cap(p.type)} ${p.full} (kód ${p.id}) ${mat ? 'z materiálu ' + lcFirst(mat) : 'je vhodný textil k potisku'}${g ? ` s gramáží ${g} g/m²` : ''}${p.colors.length ? `, k dispozici v ${p.colors.length} ${plural(p.colors.length, 'barvě', 'barvách', 'barvách')}` : ''}${p.x.sizes ? ` a velikostech ${p.x.sizes}` : ''}.`);
  const useMap = {
    'Trička': g < 160 ? 'Hodí se na akce, do kanceláře i jako týmové nebo reklamní tričko.' : 'Odolá častému praní, takže se hodí i na pracovní a každodenní nošení.',
    'Mikiny': 'Hodí se jako týmová, firemní nebo školní mikina na chladnější měsíce.',
    'Polokošile': 'Hodí se jako reprezentativní firemní oblečení pro obchod, služby i zákaznický servis.',
    'Bundy-vesty': 'Hodí se jako firemní, týmová nebo pracovní vrstva na ven.',
    'Fleece': 'Hodí se jako teplá firemní nebo týmová vrstva na chladnější dny.',
    'Kalhoty-šortky': 'Hodí se jako součást pracovního nebo firemního oblečení.',
    'Košile': 'Hodí se jako reprezentativní firemní oblečení.',
  };
  if (cat === 'Čepice') {
    bits.push('Hodí se na týmový merch, akce, firemní kolekce i dárkové balíčky.');
  } else if (weight && GRAM_CATS.has(cat)) {
    bits.push(`Gramáž ${g} g/m² řadíme k ${weight}. ${useMap[cat] || ''}`.trim());
  } else if (useMap[cat]) {
    bits.push(useMap[cat]);
  }
  if ((p.tags || []).includes('u:pra')) bits.push('Model je určený do provozu, kde se oblečení často nosí a pere.');
  if (p.x.techs) bits.push(`Potisk provádíme ve vlastní dílně technologií: ${p.x.techs.replace(/, /g, ', ')}. Pomůžeme vybrat tu nejvhodnější pro váš motiv a počet kusů.`);
  return bits;
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

function printCols(p) { return p.x.print; }

function exampleRows(p) {
  // Orientační cena hotového kusu: textil + potisk A (10×10) a případně B (A4)
  const pr = p.x.print;
  if (!pr.rows.length) return [];
  const small = 0;
  const a4 = pr.cols.findIndex((c) => /A4/.test(c));
  const useBack = p.cat !== 'Čepice' && a4 >= 0;
  const rows = [];
  const qs = [5, 10, 25, 50];
  for (const q of qs) {
    const tier = p.x.tiers.find((t) => q >= t.from && (t.to == null || q <= t.to));
    const prow = pr.rows.find((r) => { const [a, b] = r.range.split('–').map(Number); return q >= a && q <= b; });
    if (!tier || !prow) continue;
    const per = tier.net + prow.vals[small] + (useBack ? prow.vals[a4] : 0);
    rows.push({ q, textil: tier.net, p1: prow.vals[small], p2: useBack ? prow.vals[a4] : null, per, total: per * q });
  }
  return rows;
}

// ---------- šablony ----------
const CSS = `
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--line:#e3e3e3;--acc:#111;--soft:#f6f6f4;--cta:#b4231a}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--fg);background:var(--bg)}
a{color:inherit}a:hover{color:var(--cta)}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
header.site{border-bottom:1px solid var(--line)}header.site .wrap{display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding-top:12px;padding-bottom:12px}
.logo{font-weight:800;font-size:20px;text-decoration:none;letter-spacing:.3px}
nav.top{display:flex;gap:16px;flex-wrap:wrap;font-size:15px}nav.top a{text-decoration:none;color:var(--mut)}
.bc{font-size:14px;color:var(--mut);margin:14px 0}.bc a{color:var(--mut)}
h1{font-size:clamp(24px,4vw,34px);line-height:1.2;margin:8px 0 14px}h2{font-size:22px;margin:32px 0 10px}h3{font-size:17px;margin:20px 0 6px}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
@media(max-width:800px){.grid2{grid-template-columns:1fr}}
.pic{background:var(--soft);border-radius:8px;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden}.pic img{width:100%;height:100%;object-fit:contain}
.th{display:flex;gap:8px;margin-top:8px}.th img{width:72px;height:72px;object-fit:contain;background:var(--soft);border-radius:6px}
.badge{display:inline-block;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:13px;margin:0 6px 6px 0}
.price{font-size:28px;font-weight:800}.price small{font-size:14px;font-weight:400;color:var(--mut)}
.btn{display:inline-block;background:var(--cta);color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;margin:6px 8px 6px 0}.btn:hover{color:#fff;opacity:.9}
.btn.alt{background:#fff;color:var(--fg);border:1px solid var(--fg)}.btn.alt:hover{color:var(--fg)}
table{border-collapse:collapse;width:100%;font-size:15px;margin:8px 0 4px}th,td{border:1px solid var(--line);padding:7px 10px;text-align:right}th:first-child,td:first-child{text-align:left}thead th{background:var(--soft)}
.sw{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:8px 0}.sw li{display:flex;align-items:center;gap:6px;font-size:14px;border:1px solid var(--line);border-radius:999px;padding:3px 10px 3px 4px}.sw i{width:18px;height:18px;border-radius:50%;border:1px solid #bbb;display:inline-block}
dl.spec{display:grid;grid-template-columns:150px 1fr;gap:4px 14px;margin:8px 0}dl.spec dt{color:var(--mut)}dl.spec dd{margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;list-style:none;padding:0;margin:14px 0}
.card{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}.card a{display:block;text-decoration:none}.card .pic{border-radius:0}.card .t{padding:10px 12px 12px;font-size:15px}.card b{display:block}.card span{color:var(--mut);font-size:14px}
footer.site{margin-top:48px;border-top:1px solid var(--line);background:var(--soft);padding:24px 0;font-size:14px;color:var(--mut)}footer.site a{color:var(--mut)}
.note{font-size:13px;color:var(--mut)}
details{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0}summary{cursor:pointer;font-weight:600}
`;

function layout({ title, desc, canonical, body, ld, ogImage, ogType }) {
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:locale" content="cs_CZ">
<meta property="og:type" content="${ogType || 'website'}">
<meta property="og:site_name" content="Markmade">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="https://1f508b567d.clvaw-cdnwnd.com/a42d0468d92fb184fba4b0c1a5aef5bd/200000188-4fac74fac9/mm512.png?ph=1f508b567d">
<link rel="stylesheet" href="/style.css">
${(ld || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<header class="site"><div class="wrap">
<a class="logo" href="${MAIN}/">Markmade</a>
<nav class="top" aria-label="Hlavní menu">
<a href="${BASE}/">Katalog textilu</a>
<a href="${MAIN}/onlinekatalog/">Online katalog s cenami</a>
<a href="${MAIN}/technologie-potisku/">Technologie potisku</a>
<a href="${MAIN}/nase-prace/">Naše práce</a>
<a href="${MAIN}/faq/">Časté dotazy</a>
<a href="${MAIN}/kontakt/">Kontakt</a>
</nav></div></header>
<main class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
<p><b>Markmade s.r.o.</b> · IČO 23564695 · potisk textilu z vlastní tiskové výroby od 5 kusů · <a href="tel:+420608505181">+420 608 505 181</a> · <a href="mailto:info@markmade.cz">info@markmade.cz</a></p>
<p><a href="${MAIN}/">Hlavní web</a> · <a href="${MAIN}/onlinekatalog/">Online katalog</a> · <a href="${MAIN}/kontakt/">Poptávka</a> · <a href="${MAIN}/gdpr/">Ochrana osobních údajů</a></p>
</div></footer>
</body></html>`;
}

function breadcrumbs(items) {
  const html = `<nav class="bc" aria-label="Drobečková navigace">${items.map((it, i) => (i < items.length - 1 ? `<a href="${it.url}">${esc(it.name)}</a>` : `<span>${esc(it.name)}</span>`)).join(' › ')}</nav>`;
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })) };
  return { html, ld };
}

const card = (p) => {
  const t5 = p.x.tiers[0];
  return `<li class="card"><a href="${p.path}"><div class="pic"><img src="${p.thumbs[0] || p.img}" alt="${esc(p.full + ' – ' + p.type)}" width="400" height="400" loading="lazy"></div><div class="t"><b>${esc(p.name)}</b><span>${esc(p.brand)} · ${esc(p.sub)}</span><br><span>${t5 ? 'textil od ' + kc(t5.net) : ''}</span></div></a></li>`;
};

function productPage(p, all) {
  const t = p.x.tiers;
  const t5 = t[0];
  const tMin = t.reduce((m, x) => Math.min(m, x.net), Infinity);
  const printMin = p.x.print.rows.length ? Math.min(...p.x.print.rows.map((r) => r.vals[0])) : null;
  let title = [
    `${cap(p.type)} ${p.full} s potiskem od 5 ks | Markmade`,
    `${cap(p.type)} ${p.full} s potiskem | Markmade`,
    `${cap(p.type)} ${p.full} | Markmade`,
    `${p.full} s potiskem od 5 ks | Markmade`,
    `${p.full} s potiskem | Markmade`,
  ].find((x) => x.length <= 62) || `${p.full} | Markmade`;
  if (USED_TITLES.has(title)) title = title.replace(' | Markmade', ` ${p.id} | Markmade`);
  USED_TITLES.add(title);
  const g = gramNum(p);
  const descParts = [`${cap(p.type)} ${p.full}`, [g && GRAM_CATS.has(p.cat) ? g + ' g/m²' : '', (p.spec['Materiál'] || '')].filter(Boolean).join(', '), p.colors.length + ' ' + plural(p.colors.length, 'barva', 'barvy', 'barev'), t5 ? `textil od ${kc(t5.net)} bez DPH` : '', printMin ? `potisk od ${kc(printMin)}` : '', 'od 5 ks, vlastní dílna'];
  const desc = trunc(descParts.filter(Boolean).join(' · ') + '.', 158);
  const c = CATS[p.cat];
  const bc = breadcrumbs([
    { name: 'Katalog textilu', url: BASE + '/' },
    { name: c.name, url: `${BASE}/${p.catSlug}/` },
    { name: p.brand, url: `${BASE}/${p.catSlug}/${p.brandSlug}/` },
    { name: p.full, url: p.url },
  ]);
  const ex = exampleRows(p);
  const exHasBack = ex.length && ex[0].p2 != null;
  const a4i = p.x.print.cols.findIndex((c2) => /A4/.test(c2));
  const related = [...all.filter((x) => x.id !== p.id && x.cat === p.cat && x.brand === p.brand), ...all.filter((x) => x.id !== p.id && x.cat === p.cat && x.brand !== p.brand)].slice(0, 6);
  const imgs = [p.img, ...p.thumbs.slice(1).map((u) => u.replace('~w400', '~w800'))].filter(Boolean);

  const ld = [
    bc.ld,
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${p.full} – ${p.type}`,
      sku: p.id,
      mpn: p.id,
      brand: { '@type': 'Brand', name: p.brand },
      category: c.name,
      image: imgs,
      description: p.ddesc.replace(/\s+/g, ' ').trim(),
      url: p.url,
      additionalProperty: [
        g && GRAM_CATS.has(p.cat) ? { '@type': 'PropertyValue', name: 'Gramáž', value: g + ' g/m²' } : null,
        p.spec['Materiál'] ? { '@type': 'PropertyValue', name: 'Materiál', value: p.spec['Materiál'] } : null,
      ].filter(Boolean),
      offers: t5 ? {
        '@type': 'AggregateOffer', priceCurrency: 'CZK', lowPrice: tMin, highPrice: t5.net, offerCount: t.length,
        availability: 'https://schema.org/InStock', url: p.url,
        seller: { '@type': 'Organization', name: 'Markmade s.r.o.', url: MAIN + '/' },
      } : undefined,
    },
  ];

  const tiersTable = t.length ? `<table><thead><tr><th>Množství (stejný model)</th><th>Cena za kus bez DPH</th><th>Cena za kus s DPH</th></tr></thead><tbody>${t.map((x) => `<tr><td>${x.from}${x.to ? '–' + x.to : '+'} ks</td><td>${x.from_ ? 'od ' : ''}${kc(x.net)}</td><td>${x.from_ ? 'od ' : ''}${kc(x.gross)}</td></tr>`).join('')}<tr><td>100+ ks</td><td colspan="2">individuální nabídka</td></tr></tbody></table>` : '';
  const printTable = p.x.print.rows.length ? `<table><thead><tr><th>Počet stejných potisků</th>${p.x.print.cols.map((c2) => `<th>${esc(c2)}</th>`).join('')}</tr></thead><tbody>${p.x.print.rows.map((r) => `<tr><td>${r.range} ks</td>${r.vals.map((v) => `<td>${kc(v)}</td>`).join('')}</tr>`).join('')}<tr><td>100+ ks</td><td colspan="${p.x.print.cols.length}">individuální nabídka</td></tr></tbody></table>` : '';
  const exTable = ex.length ? `<table><thead><tr><th>Počet kusů</th><th>Textil</th><th>Potisk ${esc(p.x.print.cols[0] || '')}</th>${exHasBack ? `<th>Potisk ${esc(p.x.print.cols[a4i])}</th>` : ''}<th>Cena kusu</th><th>Celkem bez DPH</th></tr></thead><tbody>${ex.map((r) => `<tr><td>${r.q} ks</td><td>${kc(r.textil)}</td><td>${kc(r.p1)}</td>${exHasBack ? `<td>${kc(r.p2)}</td>` : ''}<td><b>${kc(r.per)}</b></td><td>${kc(r.total)}</td></tr>`).join('')}</tbody></table>` : '';
  const placeList = p.x.placements.length ? `<ul>${p.x.placements.map((x) => `<li>${esc(x.name)} (${esc(x.size)}) – od ${kc(x.net)} bez DPH za kus</li>`).join('')}</ul>` : '';
  const specs = Object.entries(p.spec).filter(([k]) => k !== 'Kód modelu').map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') + `<dt>Kód modelu</dt><dd>${esc(p.id)}</dd>` + (p.x.sizes ? `<dt>Velikosti</dt><dd>${esc(p.x.sizes)}</dd>` : '') + (p.x.techs ? `<dt>Vhodné pro potisk</dt><dd>${esc(p.x.techs)}</dd>` : '');
  const sw = p.colors.map((x) => `<li><i style="background:${esc(x.bg)}"></i>${esc(x.name)}</li>`).join('');

  const body = `${bc.html}
<div class="grid2">
<div>
<div class="pic"><img src="${esc(p.img)}" alt="${esc(p.full + ' – ' + p.type + ', ' + (p.colors[0] ? p.colors[0].name : ''))}" width="800" height="800" fetchpriority="high"></div>
<div class="th">${p.thumbs.slice(0, 5).map((u, i) => `<img src="${esc(u)}" alt="${esc(p.full)} – fotka ${i + 1}" width="72" height="72" loading="lazy">`).join('')}</div>
</div>
<div>
<h1>${esc(cap(p.type))} ${esc(p.full)} s potiskem od 5 kusů</h1>
<p><span class="badge">${esc(p.brand)}</span><span class="badge">kód ${esc(p.id)}</span>${g && GRAM_CATS.has(p.cat) ? `<span class="badge">${g} g/m²</span>` : ''}<span class="badge">${p.colors.length} ${plural(p.colors.length, 'barva', 'barvy', 'barev')}</span></p>
${t5 ? `<p class="price">od ${kc(t5.net)} <small>za kus textilu bez DPH při odběru ${t5.from}–${t5.to} ks</small></p>` : ''}
${intro(p).map((s) => `<p>${esc(s)}</p>`).join('\n')}
<p><a class="btn" href="${p.catalogUrl}">Vybrat barvy a poptat v katalogu</a><a class="btn alt" href="${MAIN}/kontakt/">Nezávazná poptávka</a></p>
<p class="note">Cena textilu je uvedena od nejlevnější barvy a platí za kus bez DPH a bez potisku. Přesnou cenu podle barvy a velikostí vidíte v online katalogu. Zakázky realizujeme od 5 kusů od každého modelu a barvy, velikosti lze kombinovat.</p>
</div>
</div>

<h2>Parametry produktu</h2>
<dl class="spec">${specs}</dl>
${p.specp ? `<p>${esc(p.specp)}</p>` : ''}

<h2>Dostupné barvy</h2>
<ul class="sw">${sw}</ul>

<h2>Cena textilu podle množství</h2>
${tiersTable}
<p class="note">Množstevní cena textilu se počítá podle počtu kusů stejného modelu. Ceny jsou orientační; přesnou cenu potvrdíme v nabídce.</p>

${exTable ? `<h2>Orientační cena hotového kusu s potiskem</h2>
<p>Příklad: ${esc(p.full)} s jedním potiskem ${esc(p.x.print.cols[0] || '')}${exHasBack ? ` a jedním potiskem ${esc(p.x.print.cols[a4i])} na zádech` : ''}. Ceny za kus bez DPH, potisk se počítá podle počtu stejných aplikací.</p>
${exTable}` : ''}

${(placeList || printTable) ? `<h2>Ceník potisku</h2>
${placeList ? `<h3>Možná umístění</h3>${placeList}` : ''}
${printTable}` : `<h2>Potisk</h2>
<p>Cenu potisku pro tento model potvrdíme v nezávazné nabídce. Potisk provádíme ve vlastní dílně od 5 kusů.</p>`}
<p class="note">Grafická příprava tiskových dat je zdarma od 25 kusů s potiskem. Firmám (B2B) a objednávkám od 100 kusů potisk naceníme na míru.</p>

<h2>Časté dotazy k ${esc(p.full)}</h2>
<details><summary>Od kolika kusů ${esc(p.full)} s potiskem vyrobíte?</summary><p>Od 5 kusů od každého modelu a barvy. Velikosti můžete libovolně kombinovat.</p></details>
<details><summary>Jakou technologií bude potisk proveden?</summary><p>${p.x.techs ? `Tento model je vhodný pro: ${esc(p.x.techs)}.` : ''} Podle motivu, materiálu a počtu kusů doporučíme nejvhodnější z technologií sítotisk, DTF a DTG – viz <a href="${MAIN}/technologie-potisku/">technologie potisku</a>.</p></details>
<details><summary>Jsou ceny konečné?</summary><p>Ceny jsou orientační. Přesnou cenu včetně potisku a termínu potvrdíme v nezávazné nabídce, obvykle do 24 hodin.</p></details>

${related.length ? `<h2>Podobné modely</h2><ul class="cards">${related.map(card).join('')}</ul>` : ''}
<p><a href="/${p.catSlug}/">Všechny modely: ${esc(c.noun)}</a>${c.main ? ` · <a href="${c.main}">Více o potisku: ${esc(c.noun)}</a>` : ''} · <a href="${c.catalog}">Celá kategorie v online katalogu</a></p>`;

  // FAQ ld
  ld.push({
    '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: `Od kolika kusů ${p.full} s potiskem vyrobíte?`, acceptedAnswer: { '@type': 'Answer', text: 'Od 5 kusů od každého modelu a barvy. Velikosti můžete libovolně kombinovat.' } },
      { '@type': 'Question', name: 'Jsou ceny konečné?', acceptedAnswer: { '@type': 'Answer', text: 'Ceny jsou orientační. Přesnou cenu včetně potisku a termínu potvrdíme v nezávazné nabídce, obvykle do 24 hodin.' } },
    ],
  });
  return layout({ title, desc, canonical: p.url, body, ld, ogImage: p.img, ogType: 'website' });
}

function listPage({ title, desc, canonical, h1, introHtml, crumbs, items, extraHtml, pagerHtml, offset }) {
  const bc = breadcrumbs(crumbs);
  const ld = [bc.ld, { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: (offset || 0) + i + 1, url: p.url, name: p.full + ' – ' + p.type })) }];
  const body = `${bc.html}<h1>${esc(h1)}</h1>${introHtml}${extraHtml || ''}<ul class="cards">${items.map(card).join('')}</ul>${pagerHtml || ''}`;
  return layout({ title, desc, canonical, body, ld, ogImage: items[0] && items[0].img });
}

// zapíše stránkovaný výpis (base např. "/tricka/"), vrací URL pro sitemapu
function writeList(base, cfg, pri) {
  const chunks = [];
  for (let i = 0; i < Math.max(1, Math.ceil(cfg.items.length / PER_PAGE)); i++) chunks.push(cfg.items.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
  const out = [];
  chunks.forEach((chunk, i) => {
    const pth = i ? `${base}strana-${i + 1}/` : base;
    const pager = chunks.length > 1 ? `<nav class="bc" aria-label="Stránkování" style="margin-top:20px">${chunks.map((_, j) => (j === i ? `<b>${j + 1}</b>` : `<a href="${j ? `${base}strana-${j + 1}/` : base}">${j + 1}</a>`)).join(' · ')}</nav>` : '';
    const suffix = i ? ` – strana ${i + 1}` : '';
    const crumbs = cfg.crumbs.slice();
    if (i) crumbs.push({ name: `Strana ${i + 1}`, url: BASE + pth });
    write(pth.slice(1) + 'index.html', listPage({
      title: (() => { let t = cfg.title.replace(' | Markmade', suffix + ' | Markmade'); if (t.length > 66) t = t.replace(' od 5 kusů', '').replace(' od 5 ks', ''); return t.length > 66 ? t.replace(' s potiskem', '') : t; })(), desc: i ? trunc(cfg.desc + suffix, 158) : cfg.desc,
      canonical: BASE + pth, h1: cfg.h1 + suffix, introHtml: i ? '' : cfg.introHtml, extraHtml: i ? '' : cfg.extraHtml,
      crumbs, items: chunk, pagerHtml: pager, offset: i * PER_PAGE,
    }));
    out.push({ loc: BASE + pth, pri: i ? '0.4' : pri });
  });
  return out;
}

// ---------- build ----------
function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content, 'utf8');
}

(function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw.json'), 'utf8'));
  const all = raw.map((r) => { const p = { ...r }; p.x = parse(r); slugs(p); return p; }).filter((p) => p.x.tiers.length);
  console.log(`vstup ${raw.length} záznamů, ${all.length} s cenou textilu, ${all.filter((p) => !p.x.print.rows.length).length} bez ceníku potisku`);
  fs.rmSync(OUT, { recursive: true, force: true });
  write('style.css', CSS.trim());
  write('CNAME', BASE.replace(/^https?:\/\//, ''));
  write('.nojekyll', '');
  const urls = [{ loc: BASE + '/', pri: '1.0' }];

  // produkty
  for (const p of all) { write(p.path.slice(1) + 'index.html', productPage(p, all)); urls.push({ loc: p.url, pri: '0.8' }); }

  // kategorie + značky
  for (const [key, c] of Object.entries(CATS)) {
    const items = all.filter((p) => p.cat === key);
    if (!items.length) continue;
    const brands = [...new Set(items.map((p) => p.brand))];
    const brandLinks = `<p>${brands.map((b) => `<a class="badge" href="/${c.slug}/${slugify(b)}/">${esc(b)} (${items.filter((p) => p.brand === b).length})</a>`).join('')}</p>`;
    urls.push(...writeList(`/${c.slug}/`, {
      title: `${c.h1} od 5 kusů | Markmade`,
      desc: trunc(`${c.h1} od 5 kusů. ${items.length} modelů, ceny textilu i potisku u každého. Sítotisk, DTF i DTG z vlastní dílny.`, 158),
      h1: c.h1,
      introHtml: `<p>Vyberte si ${esc(c.noun)} z nabídky značek ${esc(brands.join(', '))}. U každého modelu najdete parametry, barvy, ceny textilu podle množství i ceník potisku. Zakázky realizujeme od 5 kusů ve vlastní tiskové výrobě.</p><p>${c.main ? `<a href="${c.main}">Více o potisku: ${esc(c.noun)}</a> · ` : ''}<a href="${c.catalog}">Celá kategorie v online katalogu s filtry</a></p>`,
      extraHtml: `<h2>Značky</h2>${brandLinks}<h2>Modely</h2>`,
      crumbs: [{ name: 'Katalog textilu', url: BASE + '/' }, { name: c.name, url: `${BASE}/${c.slug}/` }], items,
    }, '0.9'));
    for (const b of brands) {
      const bi = items.filter((p) => p.brand === b);
      urls.push(...writeList(`/${c.slug}/${slugify(b)}/`, {
        title: [`${c.name} ${b} s potiskem od 5 kusů | Markmade`, `${c.name} ${b} s potiskem | Markmade`, `${c.name} ${b} | Markmade`].find((x) => x.length <= 62),
        desc: trunc(`${c.name} značky ${b} s potiskem od 5 kusů. ${bi.length} ${plural(bi.length, 'model', 'modely', 'modelů')}, ceny textilu i potisku hned. Sítotisk, DTF a DTG z vlastní dílny.`, 158),
        h1: `${c.name} ${b} s potiskem`,
        introHtml: `<p>Nabízíme ${bi.length} ${plural(bi.length, 'model', 'modely', 'modelů')} značky ${esc(b)} v kategorii ${esc(c.name.toLowerCase())}. Vyberte si a zjistěte cenu textilu podle množství i cenu potisku.</p>`,
        crumbs: [{ name: 'Katalog textilu', url: BASE + '/' }, { name: c.name, url: `${BASE}/${c.slug}/` }, { name: b, url: `${BASE}/${c.slug}/${slugify(b)}/` }], items: bi,
      }, '0.7'));
    }
  }

  // tematické přehledy
  for (const h of HUBS) {
    const items = all.filter((p) => (p.tags || []).includes(h.tag));
    if (!items.length) continue;
    h.n = items.length;
    urls.push(...writeList(`/${h.slug}/`, {
      title: `${h.h1.replace(' a logem', '')} od 5 kusů | Markmade`.replace(/^(.{0,200})$/, '$1'),
      desc: trunc(`${h.h1} od 5 kusů. ${items.length} modelů, ceny textilu i potisku u každého. Vlastní dílna: sítotisk, DTF a DTG.`, 158),
      h1: h.h1,
      introHtml: `<p>${esc(h.intro)}</p><p>${h.main ? `<a href="${h.main}">Více o službě na hlavním webu</a> · ` : ''}<a href="${h.catalog}">Filtrovat v online katalogu</a></p>`,
      extraHtml: '<h2>Modely</h2>',
      crumbs: [{ name: 'Katalog textilu', url: BASE + '/' }, { name: h.name, url: `${BASE}/${h.slug}/` }], items,
    }, '0.8'));
  }

  // úvodní stránka
  const catCards = Object.entries(CATS).map(([k, c]) => {
    const n = all.filter((p) => p.cat === k).length; const first = all.find((p) => p.cat === k);
    return n ? `<li class="card"><a href="/${c.slug}/"><div class="pic"><img src="${first.thumbs[0] || first.img}" alt="${esc(c.h1)}" width="400" height="400" loading="lazy"></div><div class="t"><b>${esc(c.h1)}</b><span>${n} ${plural(n, 'model', 'modely', 'modelů')} v přehledu</span></div></a></li>` : '';
  }).join('');
  const hb = breadcrumbs([{ name: 'Katalog textilu', url: BASE + '/' }]);
  write('index.html', layout({
    title: 'Katalog textilu k potisku od 5 kusů | Markmade',
    desc: 'Trička, mikiny, polokošile, pracovní oděvy a čepice k potisku od 5 kusů. Ceny textilu i potisku u každého modelu, vlastní tisková výroba.',
    canonical: BASE + '/', ogImage: all[0].img,
    ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Markmade – katalog textilu k potisku', url: BASE + '/', publisher: { '@type': 'Organization', name: 'Markmade s.r.o.', url: MAIN + '/' } }],
    body: `<h1>Katalog textilu k potisku od 5 kusů</h1>
<p>Vyberte trička, mikiny, polokošile, bundy, čepice nebo pracovní oděvy – celkem ${all.length} modelů. U každého najdete parametry, barvy, ceny textilu podle množství a ceník potisku. Potisk provádíme ve vlastní dílně sítotiskem, DTF i DTG.</p>
<p><a class="btn" href="${MAIN}/onlinekatalog/">Otevřít online katalog s filtry</a><a class="btn alt" href="${MAIN}/kontakt/">Nezávazná poptávka</a></p>
<ul class="cards">${catCards}</ul>
<h2>Podle použití</h2>
<p>${HUBS.filter((h) => h.n).map((h) => `<a class="badge" href="/${h.slug}/">${esc(h.name)} (${h.n})</a>`).join('')}</p>`,
  }));

  // sitemap, robots, 404
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
  write('404.html', layout({ title: 'Stránka nenalezena | Markmade', desc: 'Stránka nebyla nalezena.', canonical: BASE + '/', body: '<h1>Stránka nenalezena</h1><p><a href="/">Zpět do katalogu textilu</a></p>' }).replace('<meta name="robots" content="index,follow,max-image-preview:large">', '<meta name="robots" content="noindex">'));

  console.log(`hotovo: ${all.length} produktů, ${urls.length} URL v sitemapě, výstup ${OUT}`);
})();
