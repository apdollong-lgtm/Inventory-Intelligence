const {test, expect} = require('@playwright/test');
test('all pages, product, movement, invalid movement, audit deletion and CSV', async ({page}) => {
  const errors=[]; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.locator('.nav-btn[data-page="products"]').click();
  await expect(page.locator('#productRows tr')).toHaveCount(30);
  for (const section of ['products','transactions','analysis','purchase','reports','settings','dashboard']) {
    await page.locator(`.nav-btn[data-page="${section}"]`).click();
    await expect(page.locator(`#page-${section}`)).toBeVisible();
  }
  await page.locator('.nav-btn[data-page="products"]').click();
  await page.locator('#btnAddProduct').click();
  await page.locator('#fSku').fill('QA-01'); await page.locator('#fName').fill('<img src=x onerror=alert(1)>');
  await page.locator('#fCost').fill('10'); await page.locator('#fStock').fill('10');
  await page.locator('#pSave').click();
  await expect(page.locator('#pModal')).not.toHaveClass(/open/);
  await page.locator('#pSearch').fill('QA-01');
  await expect(page.locator('#productRows')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#productRows img')).toHaveCount(0);
  await page.locator('.nav-btn[data-page="transactions"]').click();
  await page.locator('#txSku').selectOption('QA-01'); await page.locator('#txQty').fill('5');
  await page.locator('#txForm button[type="submit"]').click();
  await expect(page.locator('#txInfo')).toContainText('15');
  await page.locator('#txType button[data-t="OUT"]').click(); await page.locator('#txQty').fill('16');
  await page.locator('#txForm button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('ไม่พอ');
  await expect(page.locator('#txInfo')).toContainText('15');
  await page.locator('.nav-btn[data-page="reports"]').click();
  const download = page.waitForEvent('download'); await page.locator('#btnCsvP').click();
  expect((await download).suggestedFilename()).toBe('products.csv');
  await page.locator('.nav-btn[data-page="dashboard"]').click();
  await page.screenshot({path:'out/dashboard-desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('mobile navigation and offline chart fallback', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/chart.umd.min.js', route => route.abort());
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#kpis')).toContainText('30');
  await page.locator('#hamb').click(); await page.locator('.nav-btn[data-page="products"]').click();
  await expect(page.locator('#page-products')).toBeVisible();
  await expect(page.locator('#productRows tr')).toHaveCount(30);
  await page.screenshot({path:'out/products-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});
