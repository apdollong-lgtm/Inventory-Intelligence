/**
 * Inventory Intelligence — Google Apps Script backend
 * วิเคราะห์สต็อก + Automation ด้วย Google Workspace
 *
 * ไฟล์ในโปรเจกต์: Code.gs (ไฟล์นี้) + Index.html
 * ฐานข้อมูล: Google Sheets (สร้างชีตให้อัตโนมัติ)
 */

const SHEETS = { P: 'Products', T: 'Transactions', A: 'Alerts', PO: 'PurchaseOrders', S: 'Settings' };

const HEADERS = {
  Products: ['SKU', 'ชื่อสินค้า', 'หมวดหมู่', 'หน่วย', 'ต้นทุน/หน่วย', 'ราคาขาย', 'คงเหลือ', 'จุดสั่งซื้อ', 'สต็อกสูงสุด', 'LeadTime(วัน)', 'ผู้จำหน่าย', 'รับเข้าล่าสุด', 'อัปเดตล่าสุด'],
  Transactions: ['วันที่', 'เลขที่', 'ประเภท', 'SKU', 'จำนวน', 'ต้นทุน/หน่วย', 'อ้างอิง', 'หมายเหตุ', 'ผู้บันทึก'],
  Alerts: ['เวลา', 'ประเภท', 'SKU', 'ข้อความ'],
  PurchaseOrders: ['เลขที่ PO', 'วันที่', 'SKU', 'ชื่อสินค้า', 'จำนวน', 'ต้นทุน/หน่วย', 'ผู้จำหน่าย', 'สถานะ', 'วันที่รับ'],
  Settings: ['Key', 'Value']
};

const KEYS = {
  Products: ['sku', 'name', 'category', 'unit', 'cost', 'price', 'stock', 'rop', 'max', 'lead', 'supplier', 'lastReceived', 'updated'],
  Transactions: ['date', 'id', 'type', 'sku', 'qty', 'cost', 'ref', 'note', 'user'],
  Alerts: ['time', 'type', 'sku', 'message'],
  PurchaseOrders: ['id', 'date', 'sku', 'name', 'qty', 'cost', 'supplier', 'status', 'receivedAt']
};

const DEFAULT_SETTINGS = { companyName: 'My Company', alertEmail: '', emailAlerts: 'false', lookbackDays: '400' };
const PO_PENDING = 'รอรับ';
const PO_DONE = 'รับแล้ว';

/* ------------------------------------------------------------------ */
/* Web app & menu                                                       */
/* ------------------------------------------------------------------ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Inventory Intelligence')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('📦 Inventory')
      .addItem('ติดตั้งระบบ + ข้อมูลตัวอย่าง', 'setupWithSample')
      .addItem('ติดตั้งระบบ (ชีตว่าง)', 'setupEmpty')
      .addSeparator()
      .addItem('ตรวจสต็อก + ส่งแจ้งเตือนตอนนี้', 'checkStockAlerts')
      .addItem('สร้างรายงานประจำเดือน', 'generateMonthlyReport')
      .addItem('ติดตั้ง Trigger อัตโนมัติ', 'installTriggers')
      .addToUi();
  } catch (e) { /* not bound to a spreadsheet */ }
}

/* ------------------------------------------------------------------ */
/* Spreadsheet helpers                                                  */
/* ------------------------------------------------------------------ */

function ss_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  ss = SpreadsheetApp.create('Inventory Intelligence DB');
  props.setProperty('SS_ID', ss.getId());
  return ss;
}

function sheet_(name) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const head = HEADERS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setFontWeight('bold').setBackground('#0b1f4d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (name === SHEETS.S) {
      const rows = Object.keys(DEFAULT_SETTINGS).map(k => [k, DEFAULT_SETTINGS[k]]);
      sh.getRange(2, 1, rows.length, 2).setValues(rows);
    }
  }
  return sh;
}

function ensureSheets_() { Object.values(SHEETS).forEach(sheet_); }

function toPlain_(v) { return v instanceof Date ? v.toISOString() : v; }

function readRows_(name) {
  const sh = sheet_(name);
  const keys = KEYS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, keys.length).getValues();
  return vals.filter(r => r[0] !== '' && r[0] !== null).map(r => {
    const o = {};
    keys.forEach((k, i) => o[k] = toPlain_(r[i]));
    return o;
  });
}

function findRow_(sh, col, value) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return -1;
}

function getSettings_() {
  const sh = sheet_(SHEETS.S);
  const s = Object.assign({}, DEFAULT_SETTINGS);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).getValues().forEach(r => { if (r[0]) s[r[0]] = String(r[1]); });
  return s;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function user_() {
  try { return Session.getActiveUser().getEmail() || 'system'; } catch (e) { return 'system'; }
}

function num_(v) { const n = Number(v); return isFinite(n) ? n : 0; }

function text_(v) {
  const s = String(v == null ? '' : v).trim();
  return /^[=+@\-\t\r]/.test(s) ? "'" + s : s;
}

function nonnegative_(v, label, fallback) {
  if (v === '' || v == null) return fallback == null ? 0 : fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  return n;
}

function validateProduct_(p) {
  if (!p || typeof p !== 'object') throw new Error('ข้อมูลสินค้าไม่ถูกต้อง');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(String(p.sku || '').trim())) throw new Error('SKU ใช้ A-Z, 0-9, จุด, ขีดกลาง หรือขีดล่าง สูงสุด 64 ตัว');
  ['cost', 'price', 'stock', 'rop', 'max', 'lead'].forEach(k => nonnegative_(p[k], k));
  if (num_(p.max) > 0 && num_(p.max) < num_(p.rop)) throw new Error('สต็อกสูงสุดต้องไม่น้อยกว่าจุดสั่งซื้อ');
}

function escHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function logAlert_(type, sku, message) {
  sheet_(SHEETS.A).appendRow([new Date(), type, sku || '', message]);
}

function statusOf_(p) {
  const s = num_(p.stock);
  if (s <= 0) return 'out';
  if (s <= num_(p.rop)) return 'low';
  if (num_(p.max) > 0 && s > num_(p.max)) return 'over';
  return 'ok';
}

function logStatusAlert_(p, before, after) {
  if (after === before) return;
  const stock = num_(p.stock);
  if (after === 'low') logAlert_('LOW', p.sku, p.name + ' (' + p.sku + ') เหลือ ' + stock + ' ' + p.unit + ' ต่ำกว่าจุดสั่งซื้อ');
  if (after === 'out') logAlert_('OUT', p.sku, p.name + ' (' + p.sku + ') หมดสต็อก');
  if (after === 'over') logAlert_('OVER', p.sku, p.name + ' (' + p.sku + ') เกินสต็อกสูงสุด (' + stock + '/' + p.max + ')');
}

/* ------------------------------------------------------------------ */
/* API — called from Index.html via google.script.run                    */
/* ------------------------------------------------------------------ */

function getInitData() {
  ensureSheets_();
  const settings = getSettings_();
  const since = Date.now() - num_(settings.lookbackDays || 400) * 86400000;
  const txns = readRows_(SHEETS.T).filter(t => new Date(t.date).getTime() >= since);
  const alerts = readRows_(SHEETS.A).slice(-100);
  return {
    products: readRows_(SHEETS.P),
    txns: txns,
    alerts: alerts,
    pos: readRows_(SHEETS.PO),
    settings: settings,
    user: user_(),
    ssUrl: ss_().getUrl(),
    serverTime: new Date().toISOString()
  };
}

function saveProduct(p, isNew) {
  return withLock_(() => {
    validateProduct_(p);
    const sku = String(p.sku || '').trim().toUpperCase();
    if (!sku) throw new Error('กรุณาระบุ SKU');
    if (!String(p.name || '').trim()) throw new Error('กรุณาระบุชื่อสินค้า');
    const sh = sheet_(SHEETS.P);
    const row = findRow_(sh, 1, sku);
    if (isNew && row > 0) throw new Error('SKU ' + sku + ' มีอยู่แล้ว');
    if (!isNew && row < 0) throw new Error('ไม่พบ SKU ' + sku);
    const existing = row > 0 ? sh.getRange(row, 1, 1, KEYS.Products.length).getValues()[0] : null;
    const prevObj = existing ? {} : null;
    if (existing) KEYS.Products.forEach((k, i) => prevObj[k] = existing[i]);
    const before = prevObj ? statusOf_(prevObj) : null;

    const leadVal = p.lead !== '' && p.lead != null && isFinite(Number(p.lead)) ? Math.max(0, num_(p.lead)) : 7;
    const initStock = Math.max(0, num_(p.stock));
    const costVal = Math.max(0, num_(p.cost));
    const priceVal = Math.max(0, num_(p.price));
    const ropVal = Math.max(0, num_(p.rop));
    const maxVal = Math.max(0, num_(p.max));

    const values = [
      sku, text_(p.name), text_(p.category || 'ทั่วไป'), text_(p.unit || 'ชิ้น'),
      costVal, priceVal,
      existing ? existing[6] : initStock,
      ropVal, maxVal, leadVal, text_(p.supplier),
      existing ? existing[11] : (initStock > 0 ? new Date() : ''),
      new Date()
    ];
    const curObj = {}; KEYS.Products.forEach((k, i) => curObj[k] = values[i]);
    const after = statusOf_(curObj);

    if (row > 0) {
      sh.getRange(row, 1, 1, values.length).setValues([values]);
      logStatusAlert_(curObj, before, after);
    } else {
      sh.appendRow(values);
      if (initStock > 0) {
        sheet_(SHEETS.T).appendRow([new Date(), txnId_(), 'IN', sku, initStock, costVal, 'OPENING', 'ยอดยกมา', user_()]);
      }
      logAlert_('UPDATE', sku, 'เพิ่มสินค้าใหม่ ' + values[1] + ' (' + sku + ')');
      if (after !== 'ok') logStatusAlert_(curObj, 'ok', after);
    }
    return getInitData();
  });
}

function deleteProduct(sku) {
  return withLock_(() => {
    const sh = sheet_(SHEETS.P);
    const row = findRow_(sh, 1, sku);
    if (row < 0) throw new Error('ไม่พบ SKU ' + sku);
    if (num_(sh.getRange(row, 7).getValue()) !== 0) throw new Error('ต้องปรับสต็อกให้เป็น 0 ก่อนลบสินค้า');
    if (readRows_(SHEETS.T).some(t => String(t.sku) === String(sku)) || readRows_(SHEETS.PO).some(p => String(p.sku) === String(sku))) throw new Error('สินค้ามีประวัติรายการหรือ PO ไม่สามารถลบได้');
    sh.deleteRow(row);
    // ลบรายการ PO ที่ยังค้างรับของ SKU นี้เพื่อไม่ให้ค้างตอนกดรับสินค้า
    const poSh = sheet_(SHEETS.PO);
    const lastPo = poSh.getLastRow();
    if (lastPo >= 2) {
      const poVals = poSh.getRange(2, 1, lastPo - 1, KEYS.PurchaseOrders.length).getValues();
      for (let i = poVals.length - 1; i >= 0; i--) {
        if (String(poVals[i][2]) === String(sku) && poVals[i][7] === PO_PENDING) {
          poSh.deleteRow(i + 2);
        }
      }
    }
    logAlert_('UPDATE', sku, 'ลบสินค้า ' + sku);
    return getInitData();
  });
}

function txnId_() {
  return 'TX-' + Utilities.getUuid();
}

/** core stock movement (no lock) */
function applyTxn_(t) {
  if (!t || typeof t !== 'object') throw new Error('ข้อมูลรายการไม่ถูกต้อง');
  const type = String(t.type || '').toUpperCase();
  if (['IN', 'OUT', 'ADJ'].indexOf(type) < 0) throw new Error('ประเภทไม่ถูกต้อง');
  const qty = Number(t.qty);
  if (!Number.isFinite(qty)) throw new Error('จำนวนต้องเป็นตัวเลขที่ถูกต้อง');
  if (t.cost !== '' && t.cost != null) nonnegative_(t.cost, 'ต้นทุน');
  if (t.date) {
    const d = String(t.date);
    const parsed = new Date(d + 'T00:00:00+07:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(parsed.getTime()) || Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd') !== d || d > Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')) throw new Error('วันที่ไม่ถูกต้องหรือเป็นวันในอนาคต');
  }
  if (type !== 'ADJ' && qty <= 0) throw new Error('จำนวนต้องมากกว่า 0');
  if (type === 'ADJ' && qty === 0) throw new Error('จำนวนปรับปรุงต้องไม่เป็น 0');

  const sh = sheet_(SHEETS.P);
  const row = findRow_(sh, 1, t.sku);
  if (row < 0) throw new Error('ไม่พบ SKU ' + t.sku);
  const r = sh.getRange(row, 1, 1, KEYS.Products.length).getValues()[0];
  const p = {}; KEYS.Products.forEach((k, i) => p[k] = r[i]);
  const before = statusOf_(p);
  let stock = num_(p.stock);
  let cost = num_(p.cost);
  const inCost = t.cost !== '' && t.cost != null ? Math.max(0, num_(t.cost)) : cost;

  if (type === 'IN') {
    const baseStock = Math.max(0, stock);
    if (baseStock + qty > 0 && inCost >= 0) {
      cost = Math.round(((baseStock * cost + qty * inCost) / (baseStock + qty)) * 100) / 100;
    }
    stock += qty;
  } else if (type === 'OUT') {
    if (qty > stock) throw new Error('สต็อก ' + t.sku + ' ไม่พอ (คงเหลือ ' + stock + ')');
    stock -= qty;
  } else {
    if (stock + qty < 0) throw new Error('ปรับปรุงแล้วสต็อกติดลบ');
    stock += qty;
  }

  const now = new Date();
  let when = now;
  if (t.date) {
    const parsed = new Date(t.date + 'T' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss') + '+07:00');
    if (!isNaN(parsed.getTime())) when = parsed;
  }
  sh.getRange(row, 5).setValue(cost);
  sh.getRange(row, 7).setValue(stock);
  if (type === 'IN' || (!p.lastReceived && stock > 0)) {
    const prevRec = p.lastReceived ? new Date(p.lastReceived).getTime() : 0;
    if (!prevRec || when.getTime() >= prevRec) {
      sh.getRange(row, 12).setValue(when);
    }
  }
  sh.getRange(row, 13).setValue(now);

  sheet_(SHEETS.T).appendRow([when, txnId_(), type, p.sku, qty, type === 'IN' ? inCost : cost, text_(t.ref), text_(t.note), user_()]);

  p.stock = stock;
  const after = statusOf_(p);
  logStatusAlert_(p, before, after);
  return p;
}

function recordTransaction(t) {
  return withLock_(() => { applyTxn_(t); return getInitData(); });
}

function nextPoId_(pos, year) {
  const prefix = 'PO-' + year + '-';
  let maxNum = 0;
  pos.forEach(p => {
    const id = String(p.id || '');
    if (id.indexOf(prefix) === 0) {
      const n = parseInt(id.slice(prefix.length), 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return prefix + String(maxNum + 1).padStart(4, '0');
}

function createPurchaseOrder(items) {
  return withLock_(() => {
    if (!Array.isArray(items) || !items.length) throw new Error('ยังไม่ได้เลือกสินค้า');
    const products = readRows_(SHEETS.P);
    const map = Object.create(null); products.forEach(p => map[p.sku] = p);
    const seen = new Set();
    items.forEach(i => {
      if (!i || !map[i.sku] || !Number.isFinite(Number(i.qty)) || Number(i.qty) <= 0 || seen.has(i.sku)) throw new Error('สินค้า/จำนวนสั่งซื้อไม่ถูกต้อง หรือมี SKU ซ้ำ');
      seen.add(i.sku);
    });
    const pos = readRows_(SHEETS.PO);
    const year = new Date().getFullYear();
    const id = nextPoId_(pos, year);
    const now = new Date();
    const rows = items.filter(i => num_(i.qty) > 0 && map[i.sku]).map(i => {
      const p = map[i.sku];
      return [id, now, p.sku, p.name, num_(i.qty), num_(p.cost), p.supplier || '', PO_PENDING, ''];
    });
    if (!rows.length) throw new Error('จำนวนสั่งซื้อไม่ถูกต้อง');
    const sh = sheet_(SHEETS.PO);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    logAlert_('REORDER', '', 'สร้างใบสั่งซื้อ ' + id + ' (' + rows.length + ' รายการ)');
    return getInitData();
  });
}

function receivePurchaseOrder(poId) {
  return withLock_(() => {
    const sh = sheet_(SHEETS.PO);
    const last = sh.getLastRow();
    if (last < 2) throw new Error('ไม่พบใบสั่งซื้อ');
    const vals = sh.getRange(2, 1, last - 1, KEYS.PurchaseOrders.length).getValues();
    const pSh = sheet_(SHEETS.P);
    vals.filter(r => r[0] === poId && r[7] === PO_PENDING).forEach(r => {
      if (findRow_(pSh, 1, r[2]) < 0 || !Number.isFinite(Number(r[4])) || Number(r[4]) <= 0 || !Number.isFinite(Number(r[5])) || Number(r[5]) < 0) throw new Error('ข้อมูล PO ไม่ครบหรือไม่พบสินค้า ' + r[2]);
    });
    let count = 0;
    vals.forEach((r, i) => {
      if (r[0] === poId && r[7] === PO_PENDING) {
        if (findRow_(pSh, 1, r[2]) > 0) {
          applyTxn_({ type: 'IN', sku: r[2], qty: r[4], cost: r[5], ref: poId, note: 'รับตามใบสั่งซื้อ' });
        }
        sh.getRange(i + 2, 8, 1, 2).setValues([[PO_DONE, new Date()]]);
        count++;
      }
    });
    if (!count) throw new Error('ใบสั่งซื้อนี้รับครบแล้ว');
    logAlert_('UPDATE', '', 'รับสินค้าเข้า ' + poId + ' เรียบร้อย (' + count + ' รายการ)');
    return getInitData();
  });
}

function saveSettings(s) {
  return withLock_(() => {
    if (!s || typeof s !== 'object' || Object.keys(s).some(k => !Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k))) throw new Error('การตั้งค่าไม่ถูกต้อง');
    if (s.lookbackDays != null && (!Number.isInteger(Number(s.lookbackDays)) || Number(s.lookbackDays) < 365 || Number(s.lookbackDays) > 3650)) throw new Error('ช่วงประวัติต้องเป็น 365–3650 วัน');
    if (s.emailAlerts != null && !['true', 'false'].includes(String(s.emailAlerts))) throw new Error('ค่าการแจ้งเตือนไม่ถูกต้อง');
    if (s.alertEmail && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(s.alertEmail))) throw new Error('อีเมลไม่ถูกต้อง');
    if (String(s.emailAlerts) === 'true' && !s.alertEmail) throw new Error('กรุณาระบุอีเมลแจ้งเตือน');
    const sh = sheet_(SHEETS.S);
    Object.keys(s || {}).forEach(k => {
      const row = findRow_(sh, 1, k);
      if (row > 0) sh.getRange(row, 2).setValue(text_(s[k]));
      else sh.appendRow([k, text_(s[k])]);
    });
    return getInitData();
  });
}

/* ------------------------------------------------------------------ */
/* Automation                                                           */
/* ------------------------------------------------------------------ */

/** ตรวจสต็อก ส่งอีเมลแจ้งเตือน (ใช้กับ Trigger รายวัน) */
function checkStockAlerts() {
  const products = readRows_(SHEETS.P);
  const settings = getSettings_();
  const low = products.filter(p => ['low', 'out'].indexOf(statusOf_(p)) >= 0);
  const over = products.filter(p => statusOf_(p) === 'over');
  logAlert_('CHECK', '', 'ตรวจสต็อกอัตโนมัติ: ต่ำกว่าเกณฑ์ ' + low.length + ' รายการ, ล้นสต็อก ' + over.length + ' รายการ');

  if (settings.emailAlerts === 'true' && settings.alertEmail && (low.length || over.length)) {
    const row = p => '<tr><td>' + escHtml_(p.sku) + '</td><td>' + escHtml_(p.name) + '</td><td align="right">' + num_(p.stock) + '</td><td align="right">' + num_(p.rop) + '</td><td align="right">' + num_(p.max) + '</td></tr>';
    const table = (title, list) => list.length ? '<h3>' + escHtml_(title) + ' (' + list.length + ')</h3><table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif"><tr style="background:#0b1f4d;color:#fff"><th>SKU</th><th>สินค้า</th><th>คงเหลือ</th><th>จุดสั่งซื้อ</th><th>สูงสุด</th></tr>' + list.map(row).join('') + '</table>' : '';
    MailApp.sendEmail({
      to: settings.alertEmail,
      subject: '[Inventory] แจ้งเตือนสต็อก ' + settings.companyName + ' — ต่ำกว่าเกณฑ์ ' + low.length + ' รายการ',
      htmlBody: '<p>สรุปสถานะสต็อก ณ ' + escHtml_(new Date().toLocaleString('th-TH')) + '</p>' +
        table('สินค้าต่ำกว่าเกณฑ์ / หมดสต็อก', low) + table('สินค้าล้นสต็อก', over) +
        '<p><a href="' + escHtml_(ss_().getUrl()) + '">เปิด Google Sheets</a></p>'
    });
  }
  return getInitData();
}

/** สร้างรายงานประจำเดือน (เดือนก่อนหน้า) ลงชีตใหม่ */
function generateMonthlyReport() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const label = Utilities.formatDate(start, tz, 'yyyy-MM');
  const products = readRows_(SHEETS.P);
  const map = {}; products.forEach(p => map[p.sku] = p);
  const txns = readRows_(SHEETS.T).filter(t => { const d = new Date(t.date); return d >= start && d < end; });

  let inVal = 0, outVal = 0; const usage = {};
  txns.forEach(t => {
    const v = num_(t.qty) * num_(t.cost);
    if (t.type === 'IN') inVal += v;
    if (t.type === 'OUT') { outVal += v; usage[t.sku] = (usage[t.sku] || 0) + v; }
  });
  const stockVal = products.reduce((s, p) => s + num_(p.stock) * num_(p.cost), 0);
  const cnt = st => products.filter(p => statusOf_(p) === st).length;
  const top = Object.keys(usage).sort((a, b) => usage[b] - usage[a]).slice(0, 10);

  const ss = ss_();
  const name = 'Report ' + label;
  let sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name);
  const rows = [
    ['รายงานสต็อกประจำเดือน ' + label, ''],
    ['สร้างเมื่อ', Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm')],
    ['', ''],
    ['จำนวน SKU', products.length],
    ['มูลค่าสินค้าคงคลัง (บาท)', stockVal],
    ['มูลค่ารับเข้าในเดือน (บาท)', inVal],
    ['มูลค่าเบิกออกในเดือน (บาท)', outVal],
    ['สินค้าปกติ', cnt('ok')],
    ['สินค้าต่ำกว่าเกณฑ์', cnt('low')],
    ['สินค้าหมดสต็อก', cnt('out')],
    ['สินค้าล้นสต็อก', cnt('over')],
    ['', ''],
    ['Top 10 สินค้าเคลื่อนไหวสูง (มูลค่าเบิก)', '']
  ];
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  sh.getRange(13, 1).setFontWeight('bold');
  if (top.length) {
    const t = top.map(s => [s, map[s] ? map[s].name : '', usage[s]]);
    sh.getRange(14, 1, 1, 3).setValues([['SKU', 'สินค้า', 'มูลค่าเบิก']]).setFontWeight('bold').setBackground('#e8efff');
    sh.getRange(15, 1, t.length, 3).setValues(t);
  }
  sh.getRange('B4').setNumberFormat('#,##0');
  sh.getRange('B5:B7').setNumberFormat('#,##0.00');
  sh.getRange('B8:B11').setNumberFormat('#,##0');
  sh.getRange('C15:C30').setNumberFormat('#,##0.00');
  sh.autoResizeColumns(1, 3);

  const url = ss.getUrl() + '#gid=' + sh.getSheetId();
  logAlert_('REPORT', '', 'รายงานรายเดือนพร้อมใช้งาน: สรุปสต็อกประจำเดือน ' + label);
  const settings = getSettings_();
  if (settings.emailAlerts === 'true' && settings.alertEmail) {
    MailApp.sendEmail(settings.alertEmail, '[Inventory] รายงานสต็อกประจำเดือน ' + label,
      'มูลค่าคงคลัง: ' + stockVal.toLocaleString() + ' บาท\nเบิกออก: ' + outVal.toLocaleString() + ' บาท\nเปิดรายงาน: ' + url);
  }
  return { data: getInitData(), url: url };
}

/** ติดตั้ง Trigger: ตรวจสต็อกทุกวัน 08:00 + รายงานทุกวันที่ 1 */
function installTriggers() {
  const handlers = ['checkStockAlerts', 'generateMonthlyReport'];
  ScriptApp.getProjectTriggers().forEach(t => { if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkStockAlerts').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('generateMonthlyReport').timeBased().onMonthDay(1).atHour(7).create();
  logAlert_('UPDATE', '', 'ติดตั้ง Automation: ตรวจสต็อกทุกวัน 08:00 และรายงานทุกวันที่ 1');
  return 'ติดตั้ง Trigger สำเร็จ: ตรวจสต็อกทุกวัน 08:00 น. และสร้างรายงานทุกวันที่ 1 ของเดือน';
}

/* ------------------------------------------------------------------ */
/* Setup                                                                */
/* ------------------------------------------------------------------ */

function setupEmpty() {
  ensureSheets_();
  return getInitData();
}

/** ล้างข้อมูลและใส่ข้อมูลตัวอย่าง 12 เดือน */
function setupWithSample() {
  return withLock_(() => {
    if ([SHEETS.P, SHEETS.T, SHEETS.PO].some(n => readRows_(n).length > 0)) throw new Error('โหลดตัวอย่างได้เฉพาะฐานข้อมูลว่าง เพื่อป้องกันข้อมูลจริงสูญหาย');
    const ss = ss_();
    sheet_(SHEETS.S); // สร้างชีต Settings ไว้ก่อนเสมอ ป้องกัน Error ลบชีตสุดท้ายของไฟล์
    [SHEETS.P, SHEETS.T, SHEETS.A, SHEETS.PO].forEach(n => { const s = ss.getSheetByName(n); if (s) ss.deleteSheet(s); });
    ensureSheets_();
    const sample = buildSample_();
    const put = (name, rows) => {
      if (!rows.length) return;
      const sh = sheet_(name);
      sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    };
    put(SHEETS.P, sample.products.map(p => KEYS.Products.map(k => p[k])));
    put(SHEETS.T, sample.txns.map(t => KEYS.Transactions.map(k => t[k])));
    put(SHEETS.PO, sample.pos.map(t => KEYS.PurchaseOrders.map(k => t[k])));
    put(SHEETS.A, sample.alerts.map(t => KEYS.Alerts.map(k => t[k])));
    sheet_(SHEETS.P).getRange('E:F').setNumberFormat('#,##0.00');
    sheet_(SHEETS.T).getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    // remove default "Sheet1"/"แผ่น1" if empty
    ss.getSheets().forEach(s => { if (Object.values(SHEETS).indexOf(s.getName()) < 0 && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s); });
    return getInitData();
  });
}

const SAMPLE_CATALOG = [
  // sku, name, category, unit, cost, price, usage/day, rop, max, lead, supplier, flag
  ['ST001', 'กระดาษ A4 80 แกรม', 'เครื่องเขียน', 'รีม', 115, 145, 4, 40, 250, 5, 'บจก. ออฟฟิศเมท', 'low'],
  ['ST002', 'ปากกาลูกลื่น สีน้ำเงิน', 'เครื่องเขียน', 'ด้าม', 6, 10, 8, 100, 600, 4, 'บจก. ออฟฟิศเมท', ''],
  ['ST003', 'แฟ้มเอกสาร 3 นิ้ว', 'เครื่องเขียน', 'เล่ม', 55, 79, 1.2, 20, 120, 7, 'บจก. ออฟฟิศเมท', ''],
  ['ST004', 'กระดาษโน้ต 3x3', 'เครื่องเขียน', 'แพ็ค', 35, 49, 1.5, 25, 150, 5, 'บจก. ออฟฟิศเมท', ''],
  ['ST005', 'ลวดเย็บกระดาษ No.10', 'เครื่องเขียน', 'กล่อง', 12, 18, 0.06, 10, 60, 7, 'บจก. ออฟฟิศเมท', 'slow'],
  ['INK001', 'หมึก Canon PG-47', 'หมึกพิมพ์', 'ตลับ', 390, 490, 0.3, 6, 30, 7, 'หจก. พรินท์โปร', ''],
  ['INK002', 'หมึกพิมพ์ HP 678', 'หมึกพิมพ์', 'ตลับ', 420, 520, 0.6, 30, 120, 7, 'หจก. พรินท์โปร', 'low'],
  ['INK003', 'โทนเนอร์ Brother TN-2380', 'หมึกพิมพ์', 'ตลับ', 1450, 1890, 0.15, 4, 20, 10, 'หจก. พรินท์โปร', ''],
  ['INK004', 'หมึก Epson 003', 'หมึกพิมพ์', 'ขวด', 180, 250, 0.6, 10, 60, 5, 'หจก. พรินท์โปร', ''],
  ['PKG001', 'กล่องพัสดุ Size S', 'บรรจุภัณฑ์', 'ใบ', 4, 7, 25, 300, 2000, 3, 'บจก. แพ็คดี', ''],
  ['PKG006', 'กล่องพัสดุ Size M', 'บรรจุภัณฑ์', 'ใบ', 6, 10, 18, 200, 1200, 3, 'บจก. แพ็คดี', 'over'],
  ['PKG003', 'เทปแพ็คกล่อง ใส', 'บรรจุภัณฑ์', 'ม้วน', 28, 39, 3, 60, 300, 4, 'บจก. แพ็คดี', 'low'],
  ['PKG004', 'บับเบิ้ลกันกระแทก', 'บรรจุภัณฑ์', 'ม้วน', 290, 390, 0.2, 3, 15, 7, 'บจก. แพ็คดี', ''],
  ['PKG005', 'ถุงไปรษณีย์ 25x35', 'บรรจุภัณฑ์', 'แพ็ค', 45, 69, 1, 15, 100, 5, 'บจก. แพ็คดี', ''],
  ['SAF001', 'แว่นตานิรภัย', 'อุปกรณ์เซฟตี้', 'ชิ้น', 85, 120, 0.2, 10, 50, 10, 'บจก. เซฟตี้เฟิร์ส', ''],
  ['SAF002', 'หน้ากาก N95', 'อุปกรณ์เซฟตี้', 'กล่อง', 450, 590, 0.3, 5, 30, 7, 'บจก. เซฟตี้เฟิร์ส', ''],
  ['SAF003', 'รองเท้าเซฟตี้', 'อุปกรณ์เซฟตี้', 'คู่', 690, 890, 0.03, 3, 15, 14, 'บจก. เซฟตี้เฟิร์ส', 'slow'],
  ['SAF004', 'หมวกนิรภัย', 'อุปกรณ์เซฟตี้', 'ใบ', 120, 165, 0.6, 40, 150, 7, 'บจก. เซฟตี้เฟิร์ส', 'low'],
  ['SAF007', 'ถุงมือเซฟตี้', 'อุปกรณ์เซฟตี้', 'คู่', 35, 49, 2, 30, 200, 5, 'บจก. เซฟตี้เฟิร์ส', 'low'],
  ['CLN001', 'น้ำยาถูพื้น 3.8L', 'ทำความสะอาด', 'แกลลอน', 159, 199, 0.4, 6, 30, 5, 'บจก. คลีนพลัส', ''],
  ['CLN002', 'กระดาษทิชชู่ม้วนใหญ่', 'ทำความสะอาด', 'แพ็ค', 210, 259, 1, 10, 60, 4, 'บจก. คลีนพลัส', ''],
  ['CLN003', 'ถุงขยะดำ 30x40', 'ทำความสะอาด', 'แพ็ค', 55, 75, 1.5, 20, 120, 4, 'บจก. คลีนพลัส', 'over'],
  ['CLN004', 'แอลกอฮอล์เจล 500ml', 'ทำความสะอาด', 'ขวด', 89, 120, 0.5, 10, 60, 5, 'บจก. คลีนพลัส', ''],
  ['IT001', 'เมาส์ไร้สาย', 'ไอที', 'ชิ้น', 290, 390, 0.1, 5, 25, 7, 'บจก. ไอทีซัพพลาย', ''],
  ['IT002', 'คีย์บอร์ด USB', 'ไอที', 'ชิ้น', 350, 450, 0.03, 3, 15, 7, 'บจก. ไอทีซัพพลาย', 'slow'],
  ['IT003', 'สาย HDMI 2 ม.', 'ไอที', 'เส้น', 150, 220, 0.05, 5, 30, 7, 'บจก. ไอทีซัพพลาย', 'slow'],
  ['IT004', 'แฟลชไดรฟ์ 64GB', 'ไอที', 'ชิ้น', 190, 259, 0.15, 5, 40, 7, 'บจก. ไอทีซัพพลาย', 'out'],
  ['IT005', 'จอมอนิเตอร์ 24 นิ้ว', 'ไอที', 'เครื่อง', 3900, 4590, 0.02, 2, 8, 14, 'บจก. ไอทีซัพพลาย', 'over'],
  ['FUR001', 'เก้าอี้สำนักงาน', 'เฟอร์นิเจอร์', 'ตัว', 2490, 3290, 0.01, 2, 10, 14, 'บจก. ออฟฟิศเฟอร์นิช', 'slow'],
  ['FUR002', 'ชั้นวางเหล็ก 5 ชั้น', 'เฟอร์นิเจอร์', 'ชุด', 1890, 2490, 0.01, 1, 6, 14, 'บจก. ออฟฟิศเฟอร์นิช', 'slow']
];

/** จำลองการเคลื่อนไหวสต็อก 365 วัน (อัลกอริทึมเดียวกับโหมดตัวอย่างใน Index.html) */
function buildSample_() {
  let seed = 20241231;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const DAYS = 365, DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (DAYS - 1) * DAY;
  const at = (d) => new Date(start + d * DAY + (8 + Math.floor(rnd() * 9)) * 3600000 + Math.floor(rnd() * 60) * 60000);
  const txns = []; let seq = 1;
  const add = (date, type, p, qty, ref, note) => txns.push({ date: date, id: 'TX' + ('00000' + (seq++)).slice(-6), type: type, sku: p.sku, qty: qty, cost: p.cost, ref: ref || '', note: note || '', user: 'sample' });

  const products = SAMPLE_CATALOG.map(c => ({
    sku: c[0], name: c[1], category: c[2], unit: c[3], cost: c[4], price: c[5], rate: c[6], rop: c[7], max: c[8], lead: c[9], supplier: c[10], flag: c[11],
    stock: 0, lastReceived: null, pending: null
  }));

  products.forEach(p => {
    p.stock = Math.round(p.max * (p.flag === 'slow' ? 0.5 : 0.6));
    const back = p.flag === 'slow' ? 200 + Math.floor(rnd() * 150) : Math.floor(rnd() * 40);
    p.lastReceived = new Date(start - back * DAY);
    add(p.lastReceived, 'IN', p, p.stock, 'OPENING', 'ยอดยกมา');
  });

  for (let d = 0; d < DAYS; d++) {
    const dow = new Date(start + d * DAY).getDay();
    const wk = (dow === 0 || dow === 6) ? 0.35 : 1;
    const season = 1 + 0.25 * Math.sin((d / DAYS) * Math.PI * 2);
    products.forEach(p => {
      if (p.pending && p.pending.day === d) {
        const dt = at(d); p.stock += p.pending.qty; p.lastReceived = dt;
        add(dt, 'IN', p, p.pending.qty, p.pending.ref, 'รับตามใบสั่งซื้อ'); p.pending = null;
      }
      const batch = Math.max(1, Math.round(p.rate * 3));
      const prob = Math.min(0.95, p.rate * wk * season / batch);
      if (rnd() < prob && p.stock > 0) {
        const q = Math.min(p.stock, Math.max(1, Math.round(batch * (0.5 + rnd()))));
        p.stock -= q; add(at(d), 'OUT', p, q, '', 'เบิกใช้งาน');
      }
      if (!p.pending && p.flag !== 'slow' && p.stock <= p.rop) {
        p.pending = { day: d + p.lead, qty: Math.max(1, p.max - p.stock), ref: 'PO-' + new Date(start + d * DAY).getFullYear() + '-' + ('000' + (seq % 9000)).slice(-4) };
      }
    });
  }

  const last = DAYS - 1;
  products.forEach(p => {
    if (p.flag === 'over') { const q = Math.round(p.max * 0.9); const dt = at(last - 3); p.stock += q; p.lastReceived = dt; add(dt, 'IN', p, q, 'PO-PROMO', 'ซื้อโปรโมชั่นล็อตใหญ่'); }
    if (p.flag === 'low') { p.pending = null; const target = Math.max(1, Math.round(p.rop * 0.3)); if (p.stock > target) { add(at(last), 'OUT', p, p.stock - target, '', 'เบิกใช้งาน'); p.stock = target; } }
    if (p.flag === 'out') { p.pending = null; if (p.stock > 0) { add(at(last), 'OUT', p, p.stock, '', 'เบิกใช้งาน'); p.stock = 0; } }
  });

  txns.sort((a, b) => a.date - b.date);
  const now = new Date();
  const pos = [];
  const pk = products.find(p => p.sku === 'PKG003');
  if (pk) pos.push({ id: 'PO-' + now.getFullYear() + '-0001', date: new Date(now.getTime() - 2 * 3600000), sku: pk.sku, name: pk.name, qty: 250, cost: pk.cost, supplier: pk.supplier, status: PO_PENDING, receivedAt: '' });

  const alerts = [];
  products.forEach(p => {
    const st = statusOf_(p);
    if (st === 'low') alerts.push({ time: new Date(now.getTime() - rnd() * 8 * 3600000), type: 'LOW', sku: p.sku, message: p.name + ' (' + p.sku + ') เหลือ ' + p.stock + ' ' + p.unit });
    if (st === 'out') alerts.push({ time: new Date(now.getTime() - rnd() * 8 * 3600000), type: 'OUT', sku: p.sku, message: p.name + ' (' + p.sku + ') หมดสต็อก' });
    if (st === 'over') alerts.push({ time: new Date(now.getTime() - rnd() * 8 * 3600000), type: 'OVER', sku: p.sku, message: p.name + ' (' + p.sku + ') เกิน ' + p.max + ' ' + p.unit });
  });
  alerts.push({ time: new Date(now.getTime() - 26 * 3600000), type: 'REPORT', sku: '', message: 'รายงานรายเดือนพร้อมใช้งาน: สรุปสต็อกประจำเดือน' });
  alerts.sort((a, b) => a.time - b.time);

  return {
    products: products.map(p => ({ sku: p.sku, name: p.name, category: p.category, unit: p.unit, cost: p.cost, price: p.price, stock: p.stock, rop: p.rop, max: p.max, lead: p.lead, supplier: p.supplier, lastReceived: p.lastReceived, updated: now })),
    txns: txns, pos: pos, alerts: alerts
  };
}
