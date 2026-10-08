// Převede tools/raw-all.jsonl na ../raw.json (vstup pro build.js). Při příliš malém počtu modelů skončí chybou,
// aby se nikdy nenasadil rozbitý web.
const fs = require('fs'), path = require('path');
const rows = fs.readFileSync(path.join(__dirname, 'raw-all.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
if (rows.length < 1500) { console.error('Stažen jen ' + rows.length + ' modelů, nasazení se zastavuje.'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '..', 'raw.json'), JSON.stringify(rows), 'utf8');
console.log('raw.json:', rows.length, 'modelů');
