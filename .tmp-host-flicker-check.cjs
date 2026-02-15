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
  const out = { roomId: null, cameras: 0, checked: 0, statuses: [], videoEvents: null, errors: [] };
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const page = await ctx.newPage();

  try {
    const ts = Date.now();
    await signUpAndGoHome(page, `hostflicker${ts}@example.com`, 'CodexPass123!');
    await page.getByRole('button', { name: /Create New Room|Creating Room/ }).click();
    await page.waitForURL('**/host/**', { timeout: 60000 });
    out.roomId = page.url().split('/').pop();

    await page.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await page.waitForTimeout(4000);

    const cbs = page.locator('input[type="checkbox"]');
    out.cameras = await cbs.count();
    for (let i = 0; i < out.cameras; i++) {
      if (!(await cbs.nth(i).isChecked())) {
        await cbs.nth(i).click({ force: true });
        await page.waitForTimeout(2500);
      }
    }
    out.checked = await page.locator('input[type="checkbox"]:checked').count();

    await page.evaluate(() => {
      const counters = { loadedmetadata: 0, playing: 0, waiting: 0, stalled: 0, emptied: 0, error: 0 };
      (window).__hostVideoCounters = counters;
      const videos = Array.from(document.querySelectorAll('video'));
      videos.forEach((v) => {
        v.addEventListener('loadedmetadata', () => counters.loadedmetadata++);
        v.addEventListener('playing', () => counters.playing++);
        v.addEventListener('waiting', () => counters.waiting++);
        v.addEventListener('stalled', () => counters.stalled++);
        v.addEventListener('emptied', () => counters.emptied++);
        v.addEventListener('error', () => counters.error++);
      });
    });

    await page.waitForTimeout(12000);

    out.videoEvents = await page.evaluate(() => (window).__hostVideoCounters || null);
    out.statuses = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('input[type="checkbox"]')).map((cb) => {
        const row = cb.closest('div.flex.items-center.gap-3');
        const status = row?.querySelector('p.text-xs')?.textContent?.trim() || '';
        const label = row?.querySelector('p.text-sm')?.textContent?.trim() || '';
        return { label, status, checked: cb.checked };
      });
      return rows;
    });
  } catch (e) {
    out.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await ctx.close();
    await browser.close();
  }

  console.log(JSON.stringify(out, null, 2));
})();
