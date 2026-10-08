const fs = require('fs'), path = require('path');
const OUT = process.env.OUT;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const files = walk(OUT).filter((f) => f.endsWith('index.html'));
const titles = {}, descs = {}, probs = [];
let ldN = 0, longT = 0, longD = 0, shortD = 0;
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8'); const rel = path.relative(OUT, f);
  const t = dec((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const d = dec((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  if (t.length > 70) { longT++; probs.push('title ' + t.length + ' ' + rel); }
  if (d.length > 165) { longD++; probs.push('desc ' + d.length + ' ' + rel); }
  if (d.length < 60) { shortD++; probs.push('desc krátký ' + d.length + ' ' + rel); }
  (titles[t] = titles[t] || []).push(rel); (descs[d] = descs[d] || []).push(rel);
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); ldN++; } catch (e) { probs.push('badLD ' + rel); } }
  if ((h.match(/<h1/g) || []).length !== 1) probs.push('h1 count ' + rel);
  for (const m of h.matchAll(/href="(\/[^"#?]*)"/g)) { const p = m[1]; if (p === '/style.css') continue; const fp = path.join(OUT, p, p.endsWith('/') ? 'index.html' : ''); if (!fs.existsSync(fp)) probs.push('broken ' + p + ' in ' + rel); }
}
console.log('pages', files.length, 'ldBlocks', ldN, 'title>70', longT, 'desc>165', longD, 'desc<60', shortD);
console.log('dup titles', Object.values(titles).filter((a) => a.length > 1).length, 'dup descs', Object.values(descs).filter((a) => a.length > 1).length);
const sm = fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8'); const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const miss = locs.filter((u) => !fs.existsSync(path.join(OUT, new URL(u).pathname, 'index.html')));
console.log('sitemap', locs.length, 'missing', miss.length, 'sitemap KB', Math.round(sm.length / 1024));
const total = walk(OUT).reduce((a, f) => a + fs.statSync(f).size, 0);
console.log('celkem MB', (total / 1048576).toFixed(1));
console.log(probs.slice(0, 15).join('\n') || 'no problems');
if (probs.some((p) => /^(badLD|broken|h1 count)/.test(p)) || miss.length) process.exit(1);
