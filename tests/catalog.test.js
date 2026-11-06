#!/usr/bin/env node
/**
 * Focused catalog + history-safety checks for arpero-shop quoting.
 * Run: node tests/catalog.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const live = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-products.fixture.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected-products.json'), 'utf8'));

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 1; }
function ok(msg) { console.log('OK:', msg); }

// --- Parse PRODUCTS + PRICES_AS_OF from index.html ---
const m = html.match(/const PRODUCTS=(\[[\s\S]*?\]),PRICES_AS_OF='([^']*)';/);
assert(m, 'PRODUCTS / PRICES_AS_OF declaration missing');
let PRODUCTS;
try {
  PRODUCTS = eval(m[1]); // trusted local source
} catch (e) {
  fail('PRODUCTS failed to eval: ' + e.message);
  process.exit(1);
}
const PRICES_AS_OF = m[2];

ok(`parsed PRODUCTS (${PRODUCTS.length} rows), PRICES_AS_OF=${PRICES_AS_OF}`);

// --- Shape ---
assert(Array.isArray(PRODUCTS) && PRODUCTS.length > 0, 'PRODUCTS empty');
for (const row of PRODUCTS) {
  assert(Array.isArray(row) && row.length === 2, 'row must be [name, price]');
  assert(typeof row[0] === 'string' && row[0].length, 'name required');
  assert(typeof row[1] === 'number' && Number.isFinite(row[1]), 'price must be finite number');
}

// --- Exact match to live fixture (variant names + prices) ---
function baseTitle(title) {
  return title.replace(/ - Arpero Woodworks$/, '').trim();
}
function liveRows(liveList) {
  const rows = [];
  for (const p of liveList) {
    const base = baseTitle(p.title);
    for (const v of p.variants) {
      const attrs = v.attributes || {};
      const keys = Object.keys(attrs);
      const name = keys.length
        ? base + ' — ' + keys.map(k => k + ': ' + attrs[k]).join(', ')
        : base;
      rows.push([name, parseFloat(v.price)]);
    }
  }
  return rows;
}

const fromLive = liveRows(live);
assert.strictEqual(PRODUCTS.length, fromLive.length, `row count ${PRODUCTS.length} !== live ${fromLive.length}`);
assert.strictEqual(PRODUCTS.length, expected.length, `row count !== expected fixture`);

const families = new Set(live.map(p => baseTitle(p.title)));
assert.strictEqual(families.size, 46, `expected 46 live families, got ${families.size}`);
assert.strictEqual(fromLive.length, 141, `expected 141 live rows, got ${fromLive.length}`);

for (let i = 0; i < fromLive.length; i++) {
  const [en, ep] = fromLive[i];
  const [an, ap] = PRODUCTS[i];
  assert.strictEqual(an, en, `name mismatch at ${i}:\n  app:  ${an}\n  live: ${en}`);
  assert.strictEqual(ap, ep, `price mismatch at ${i} (${an}): app=${ap} live=${ep}`);
  assert.strictEqual(an, expected[i][0]);
  assert.strictEqual(ap, expected[i][1]);
}
ok('PRODUCTS exact match to live store fixture (names, order, prices)');

// Coaster prices specifically ($100 / $125)
const coasters = PRODUCTS.filter(([n]) => /Coaster Set|Ranch Brand Coaster/i.test(n));
assert.strictEqual(coasters.length, 6, 'expected 6 coaster variants');
for (const [n, p] of coasters) {
  if (/Coasters only/.test(n)) assert.strictEqual(p, 100);
  if (/With wooden holder box/.test(n)) assert.strictEqual(p, 125);
}
ok('coaster variants use live $100 / $125 holder pricing');

assert.strictEqual(PRICES_AS_OF, '2026-11-06', 'PRICES_AS_OF should be snapshot date');
ok('PRICES_AS_OF updated');

// --- Cache bump ---
assert(/arpero-shop-v25/.test(sw), 'sw.js cache must be v25');
assert(!/arpero-shop-v24/.test(sw), 'old v24 cache name must be gone');
ok('PWA cache bumped to arpero-shop-v25');

// --- History / storage safety: quote items store name+price values; keys unchanged ---
assert(/const K='arperoShop1'/.test(html), 'localStorage key arperoShop1 must stay');
assert(/localStorage\.setItem\(K,JSON\.stringify\(S\)\)/.test(html), 'save() localStorage write must stay');
// qRead embeds PRODUCTS name/price into quote items (historical values independent of later catalog edits)
assert(/return\{name:p\[0\],price:p\[1\],qty:/.test(html), 'quote items must snapshot name+price from PRODUCTS');
// projects store product name string, not catalog index
assert(/p\.product=prodSel\.value===''\?''\:PRODUCTS\[prodSel\.value\]\[0\]/.test(html), 'project.product stores name string');
// no new migration inventing costs / rewriting quotes
assert(/function mig\(d\)\{if\(!Array\.isArray\(d\.quotes\)\)d\.quotes=\[\];\(d\.projects\|\|\[\]\)\.forEach\(p=>\{if\(!Array\.isArray\(p\.materialsUsed\)\)p\.materialsUsed=\[\]\}\);if\(!Array\.isArray\(d\.layout\)\)d\.layout=\[\]/.test(html),
  'mig() must remain quotes/materialsUsed/layout-only (no catalog/cost rewrite)');
ok('storage schema, quote snapshotting, and mig() unchanged');

// --- Narrow change: legacy tracker not required for live app ---
const legacy = fs.readFileSync(path.join(root, 'arpero-shop-tracker.html'), 'utf8');
assert(!/href=["']arpero-shop-tracker\.html/.test(html), 'index must not link legacy tracker');
assert(/arpero-shop-tracker\.html/.test(fs.readdirSync(root).join('\n'))); // still present, untouched by design
ok('canonical entry is index.html; legacy left unused/untouched');

if (process.exitCode) {
  console.error('\nSome catalog tests failed.');
  process.exit(1);
}
console.log('\nAll catalog tests passed.');
console.log(JSON.stringify({ families: families.size, rows: PRODUCTS.length, pricesAsOf: PRICES_AS_OF, cache: 'arpero-shop-v25' }));
