const { chromium } = require('playwright');

async function signUpAndGoHome(page, email, password) {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.waitForURL('**/home', { timeout: 60000 });
}

(async()=>{
  const out = {
    roomId: null,
    beforeReload: { checked: 0, starting: 0, broadcasting: 0, noneActive: false },
    afterReload: { checked: 0, starting: 0, broadcasting: 0, noneActive: false },
    errors: [],
  };

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();

  try {
    const ts = Date.now();
    await signUpAndGoHome(page, `hostverify${ts}@example.com`, 'CodexPass123!');

    await page.getByRole('button', { name: /Create New Room|Creating Room/ }).click();
    await page.waitForURL('**/host/**', { timeout: 60000 });
    out.roomId = page.url().split('/').pop();

    await page.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(4000);

    const cbs = page.locator('input[type="checkbox"]');
    const camCount = await cbs.count();
    for (let i = 0; i < camCount; i++) {
      if (!(await cbs.nth(i).isChecked())) {
        await cbs.nth(i).click({ force: true });
        await page.waitForTimeout(2000);
      }
    }

    await page.waitForTimeout(8000);
    out.beforeReload.checked = await page.locator('input[type="checkbox"]:checked').count();
    out.beforeReload.starting = await page.locator('text=Starting...').count();
    out.beforeReload.broadcasting = await page.locator('text=Broadcasting').count();
    out.beforeReload.noneActive = (await page.locator('text=None Active').count()) > 0;

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(12000);

    out.afterReload.checked = await page.locator('input[type="checkbox"]:checked').count();
    out.afterReload.starting = await page.locator('text=Starting...').count();
    out.afterReload.broadcasting = await page.locator('text=Broadcasting').count();
    out.afterReload.noneActive = (await page.locator('text=None Active').count()) > 0;
  } catch (e) {
    out.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await ctx.close();
    await browser.close();
  }

  console.log(JSON.stringify(out, null, 2));
})();
