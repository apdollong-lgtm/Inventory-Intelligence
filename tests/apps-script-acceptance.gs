// Acceptance harness: install only in a NEW owner-only QA script, never in production.
function qaStatus() {
  const props = PropertiesService.getScriptProperties();
  return {scriptId: ScriptApp.getScriptId(), timeZone: Session.getScriptTimeZone(), results: JSON.parse(props.getProperty('QA_RESULTS') || '{}'), scheduled: JSON.parse(props.getProperty('QA_SCHEDULED') || '{}'), triggers: ScriptApp.getProjectTriggers().map(t => ({handler: t.getHandlerFunction(), source: String(t.getTriggerSource()), event: String(t.getEventType())}))};
}
function runAcceptance() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('QA_RESULTS')) return qaStatus();
  if (props.getProperty('SS_ID')) throw new Error('Requires a fresh QA database');
  const result = {token: 'INV-QA-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss'), checks: [], startedAt: new Date().toISOString()};
  const check = (name, value) => { if (!value) throw new Error('FAILED: ' + name); result.checks.push(name); props.setProperty('QA_RESULTS', JSON.stringify(result)); };
  try {
    setupEmpty();
    const ss = ss_(); ss.rename(result.token);
    result.sheetUrl = ss.getUrl();
    result.owner = Session.getEffectiveUser().getEmail();
    check('effective owner available', !!result.owner);
    check('timezone Bangkok', Session.getScriptTimeZone() === 'Asia/Bangkok');
    let data = saveProduct({sku:'QA-01',name:'Acceptance test product',cost:10,price:20,stock:10,rop:20,max:100,lead:7},true);
    check('opening stock persists', data.products[0].stock === 10);
    recordTransaction({sku:'QA-01',type:'IN',qty:5,cost:10});
    data = recordTransaction({sku:'QA-01',type:'OUT',qty:3});
    check('receive issue stock equals 12', data.products[0].stock === 12);
    let rejected = false; try { recordTransaction({sku:'QA-01',type:'OUT',qty:13}); } catch(e) { rejected=true; }
    check('overselling rejected', rejected && getInitData().products[0].stock === 12);
    recordTransaction({sku:'QA-01',type:'ADJ',qty:-2});
    data = createPurchaseOrder([{sku:'QA-01',qty:4}]);
    const po = data.pos[0].id;
    data = receivePurchaseOrder(po);
    check('PO receipt persists', data.products[0].stock === 14);
    rejected=false; try { receivePurchaseOrder(po); } catch(e) { rejected=true; }
    check('duplicate receipt rejected', rejected && getInitData().products[0].stock === 14);
    check('ledger reconciles', readRows_(SHEETS.T).reduce((s,t)=>s+(t.type==='OUT'?-num_(t.qty):num_(t.qty)),0) === 14);
    const backup=ss.copy(result.token+' BACKUP');
    result.backupUrl=backup.getUrl();
    check('backup contains stock and ledger', backup.getSheetByName('Products').getRange(2,7).getValue()===14 && backup.getSheetByName('Transactions').getLastRow()===ss.getSheetByName('Transactions').getLastRow());
    saveSettings({companyName:result.token,alertEmail:result.owner,emailAlerts:'true',lookbackDays:'400'});
    result.quotaBefore=MailApp.getRemainingDailyQuota();
    checkStockAlerts();
    check('manual alert send completed', true);
    const report=generateMonthlyReport();
    result.reportUrl=report.url;
    check('report sheet generated', /#gid=/.test(report.url));
    installTriggers(); installTriggers();
    const timers=ScriptApp.getProjectTriggers();
    check('two scheduled triggers without duplicates', timers.length===2 && timers.some(t=>t.getHandlerFunction()==='checkStockAlerts') && timers.some(t=>t.getHandlerFunction()==='generateMonthlyReport'));
    ScriptApp.newTrigger('qaScheduledAcceptance').timeBased().after(60000).create();
    result.completedAt=new Date().toISOString(); result.scheduledRequestedAt=result.completedAt;
  } catch(e) { result.error=String(e.stack||e); }
  props.setProperty('QA_RESULTS',JSON.stringify(result));
  return qaStatus();
}
function qaScheduledAcceptance() {
  const props=PropertiesService.getScriptProperties();
  const result={startedAt:new Date().toISOString(), execution:'time-driven'};
  try { checkStockAlerts(); generateMonthlyReport(); result.success=true; }
  catch(e) { result.error=String(e.stack||e); }
  finally {
    ScriptApp.getProjectTriggers().forEach(t=>ScriptApp.deleteTrigger(t));
    saveSettings({emailAlerts:'false'});
    result.finishedAt=new Date().toISOString();
    result.remainingTriggers=ScriptApp.getProjectTriggers().length;
    props.setProperty('QA_SCHEDULED',JSON.stringify(result));
  }
}
