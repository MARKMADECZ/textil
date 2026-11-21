const fs = require('node:fs');
const path = require('node:path');

function readServerPrices() {
  const file = path.join(__dirname, '..', 'server-prices.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function printTable(policy) {
  const { sizes, tiers, inq } = policy || {};
  if (!Array.isArray(sizes) || sizes.length !== 3 ||
      !sizes.every((size) => typeof size === 'string' && size.trim()) ||
      !Array.isArray(tiers) || tiers.length !== 4 || inq !== 100 ||
      !tiers.every((tier, i) => Array.isArray(tier) && tier[0] === [5, 10, 20, 50][i] &&
        Array.isArray(tier[1]) && tier[1].length === sizes.length &&
        tier[1].every((price) => Number.isInteger(price) && price > 0))) {
    throw new Error('Serverový ceník potisku chybí nebo má neplatná pásma.');
  }
  return {
    cols: sizes,
    rows: tiers.map(([from, vals], i) => ({ range: `${from}–${(tiers[i + 1]?.[0] ?? inq) - 1}`, vals })),
  };
}

function sizeKey(label) {
  return label.trim().toUpperCase().replace(/\s+/g, '').replaceAll('×', 'X').replace(/CM$/, '');
}

function applyPrintPrices(parsed, server) {
  const indexOf = (size) => {
    const value = sizeKey(size);
    return server.cols.findIndex((label) => {
      const key = sizeKey(label);
      const [format, dimensions] = key.split('(');
      return value === key || value === format ||
        (dimensions && value === sizeKey(dimensions.slice(0, -1)));
    });
  };
  const indices = [...new Set(parsed.print.cols.map(indexOf).filter((i) => i >= 0))].sort((a, b) => a - b);
  parsed.print = {
    cols: indices.map((i) => server.cols[i]),
    rows: indices.length ? server.rows.map(({ range, vals }) => ({ range, vals: indices.map((i) => vals[i]) })) : [],
  };
  for (const placement of parsed.placements) {
    const index = indexOf(placement.size);
    placement.net = index < 0 ? null : server.rows[0].vals[index];
  }
}

module.exports = { readServerPrices, printTable, applyPrintPrices };
