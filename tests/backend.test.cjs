const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function backend() {
  const sheets = new Map();
  class Sheet {
    constructor(name) { this.name = name; this.rows = []; }
    getLastRow() { return this.rows.length; }
    getRange(row, col, nr = 1, nc = 1) {
      const sh = this;
      const range = {
        getValues: () => Array.from({length: nr}, (_, i) => Array.from({length: nc}, (_, j) => sh.rows[row - 1 + i]?.[col - 1 + j] ?? '')),
        getValue: () => sh.rows[row - 1]?.[col - 1] ?? '',
        setValues(values) { values.forEach((r, i) => r.forEach((v, j) => { sh.rows[row - 1 + i] ??= []; sh.rows[row - 1 + i][col - 1 + j] = v; })); return range; },
        setValue(v) { return range.setValues([[v]]); },
      };
      for (const key of ['setFontWeight', 'setBackground', 'setFontColor', 'setNumberFormat']) range[key] = () => range;
      return range;
    }
    appendRow(r) { this.rows.push(r); }
    setFrozenRows() {}
    deleteRow(r) { this.rows.splice(r - 1, 1); }
  }
  const ss = {getSheetByName: n => sheets.get(n), insertSheet(n) { const sh = new Sheet(n); sheets.set(n, sh); return sh; }, getUrl: () => 'https://docs.google.com/spreadsheets/d/test', getId: () => 'test'};
  const context = vm.createContext({console, Date, Set, SpreadsheetApp: {getActiveSpreadsheet: () => ss}, LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})}, Session: {getActiveUser: () => ({getEmail: () => 'owner@example.com'}), getScriptTimeZone: () => 'Asia/Bangkok'}, Utilities: {getUuid: () => require('node:crypto').randomUUID(), formatDate: d => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Bangkok', year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}});
  vm.runInContext(fs.readFileSync('Code.js', 'utf8'), context);
  return {context, sheets};
}
const product = (more = {}) => ({sku: 'TEST-1', name: 'Test', cost: 10, price: 20, stock: 10, rop: 2, max: 20, lead: 7, ...more});
test('opening stock, weighted cost, outgoing and negative adjustments reconcile', () => {
  const {context: c} = backend();
  c.saveProduct(product(), true);
  c.recordTransaction({type: 'IN', sku: 'TEST-1', qty: 10, cost: 20});
  c.recordTransaction({type: 'OUT', sku: 'TEST-1', qty: 3});
  const d = c.recordTransaction({type: 'ADJ', sku: 'TEST-1', qty: -2});
  assert.equal(d.products[0].stock, 15); assert.equal(d.products[0].cost, 15);
  assert.equal(d.txns.reduce((sum, t) => sum + (t.type === 'OUT' ? -t.qty : t.qty), 0), 15);
  assert.equal(new Set(d.txns.map(t => t.id)).size, 4);
});
test('invalid input and overselling leave stock unchanged', () => {
  const {context: c} = backend(); c.saveProduct(product(), true);
  for (const t of [{type:'OUT',qty:11}, {type:'ADJ',qty:-11}, {type:'IN',qty:'NaN'}, {type:'IN',qty:Infinity}, {type:'BOGUS',qty:1}, {type:'IN',qty:1,cost:-1}, {type:'IN',qty:1,date:'2099-01-01'}, {type:'IN',qty:1,date:'2026-02-30'}]) assert.throws(() => c.recordTransaction({sku:'TEST-1', ...t}));
  assert.equal(c.getInitData().products[0].stock, 10);
});
test('product validation, duplicate SKUs and audit protection', () => {
  const {context: c} = backend();
  for (const p of [product({sku:'=SUM(A1)'}), product({cost:-1}), product({price:'oops'}), product({max:1})]) assert.throws(() => c.saveProduct(p, true));
  c.saveProduct(product(), true);
  assert.throws(() => c.saveProduct(product(), true));
  assert.throws(() => c.deleteProduct('TEST-1'));
  assert.throws(() => c.setupWithSample());
});
test('PO validates all lines before write and receipt is not repeatable', () => {
  const {context: c} = backend(); c.saveProduct(product(), true);
  assert.throws(() => c.createPurchaseOrder([{sku:'TEST-1',qty:2}, {sku:'MISSING',qty:3}]));
  assert.equal(c.getInitData().pos.length, 0);
  assert.throws(() => c.createPurchaseOrder([{sku:'TEST-1',qty:2},{sku:'TEST-1',qty:2}]));
  const po = c.createPurchaseOrder([{sku:'TEST-1',qty:2}]).pos[0];
  assert.equal(c.receivePurchaseOrder(po.id).products[0].stock, 12);
  assert.throws(() => c.receivePurchaseOrder(po.id));
});
test('missing PO product cannot be marked received', () => {
  const {context: c, sheets} = backend(); c.saveProduct(product(), true);
  const id = c.createPurchaseOrder([{sku:'TEST-1',qty:2}]).pos[0].id;
  sheets.get('Products').deleteRow(2);
  assert.throws(() => c.receivePurchaseOrder(id));
  assert.equal(c.getInitData().pos[0].status, 'รอรับ');
});
test('formula text is escaped and settings are validated', () => {
  const {context: c} = backend();
  assert.equal(c.saveProduct(product({name:'=IMPORTXML("x")'}), true).products[0].name[0], "'");
  c.recordTransaction({type:'IN',sku:'TEST-1',qty:1,ref:'=1+1'});
  assert.equal(c.getInitData().txns.at(-1).ref, "'=1+1");
  for (const s of [{bad:'x'}, {lookbackDays:1}, {lookbackDays:Infinity}, {emailAlerts:'yes'}, {emailAlerts:'true',alertEmail:''}, {alertEmail:'invalid'}]) assert.throws(() => c.saveSettings(s));
  assert.equal(c.saveSettings({lookbackDays:'400',companyName:'Test'}).settings.companyName, 'Test');
});
test('frontend inline script parses and CSV cells neutralize formulas', () => {
  const html = fs.readFileSync('Index.html','utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach(s => new vm.Script(s));
  const source = scripts.join('\n').match(/function csvCell\(v\) \{[^\n]+/)[0];
  const c = vm.createContext({}); vm.runInContext(source, c);
  assert.equal(c.csvCell(' =1+1'), "' =1+1"); assert.equal(c.csvCell(-5), '-5');
});
