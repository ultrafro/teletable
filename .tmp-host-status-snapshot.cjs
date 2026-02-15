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

function snapshotExpr() {
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  const rows = checkboxes.map((cb, idx) => {
    const row = cb.closest('div.flex.items-center.gap-3') || cb.parentElement?.parentElement || null;
    const labelEl = row ? row.querySelector('p.text-sm') : null;
    const statusEl = row ? row.querySelector('p.text-xs') : null;
    return {
      index: idx,
      checked: cb.checked,
      label: labelEl ? labelEl.textContent?.trim() : null,
      status: statusEl ? statusEl.textContent?.trim() : null,
    };
  });

  const body = document.body.innerText;
  return {
    rows,
    connectionCamerasLine: body.includes('Cameras') ? (body.match(/Cameras\s*\n\s*[^\n]+/m)?.[0] || null) : null,
  };
}

(async()=>{
  const out = { roomId: null, beforeReload: null, afterReload: null, errors: [] };
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();

  try {
    const ts = Date.now();
    await signUpAndGoHome(page, `hostsnap${ts}@example.com`, 'CodexPass123!');
    await page.getByRole('button', { name: /Create New Room|Creating Room/ }).click();
    await page.waitForURL('**/host/**', { timeout: 60000 });
    out.roomId = page.url().split('/').pop();

    await page.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(4000);

    const cbs = page.locator('input[type="checkbox"]');
    const n = await cbs.count();
    for (let i = 0; i < n; i++) {
      if (!(await cbs.nth(i).isChecked())) {
        await cbs.nth(i).click({ force: true });
        await page.waitForTimeout(2500);
      }
    }

    await page.waitForTimeout(8000);
    out.beforeReload = await page.evaluate(snapshotExpr);

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(12000);
    out.afterReload = await page.evaluate(snapshotExpr);
  } catch (e) {
    out.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await ctx.close();
    await browser.close();
  }

  console.log(JSON.stringify(out, null, 2));
})();
