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
    host: { broadcasting: 0 },
    client: { videosDesktop: 0, enteredXR: false },
    logs: {
      hostStreamOps: [],
      xrVideo: [],
      multiCam: []
    },
    errors: []
  };

  const browser = await chromium.launch({ headless: false });
  const hostCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const clientCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const host = await hostCtx.newPage();
  const client = await clientCtx.newPage();

  host.on('console', (m) => {
    const t = m.text();
    if (/Adding camera stream|Removing camera stream|Switching stream/.test(t)) {
      out.logs.hostStreamOps.push(t);
    }
  });

  client.on('console', (m) => {
    const t = m.text();
    if (t.includes('[XRVideo]')) out.logs.xrVideo.push(t);
    if (t.includes('[MultiCam Client]')) out.logs.multiCam.push(t);
  });

  try {
    const ts = Date.now();
    await signUpAndGoHome(host, `hostxr${ts}@example.com`, 'CodexPass123!');
    await host.getByRole('button', { name: /Create New Room|Creating Room/ }).click();
    await host.waitForURL('**/host/**', { timeout: 60000 });
    out.roomId = host.url().split('/').pop();

    await host.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await host.waitForTimeout(4000);

    const cbs = host.locator('input[type="checkbox"]');
    const n = await cbs.count();
    for (let i = 0; i < n; i++) {
      if (!(await cbs.nth(i).isChecked())) {
        await cbs.nth(i).click({ force: true });
        await host.waitForTimeout(2500);
      }
    }
    await host.waitForTimeout(4000);
    out.host.broadcasting = await host.locator('text=Broadcasting').count();

    await signUpAndGoHome(client, `clientxr${ts}@example.com`, 'CodexPass123!');
    await client.goto(`http://localhost:3000/room/${out.roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await client.getByRole('button', { name: 'Request Control' }).waitFor({ timeout: 60000 });
    await client.getByRole('button', { name: 'Request Control' }).click();

    await host.getByRole('button', { name: 'Approve' }).first().waitFor({ timeout: 60000 });
    await host.getByRole('button', { name: 'Approve' }).first().click();

    await client.getByText('You have control').waitFor({ timeout: 60000 });
    await client.waitForTimeout(10000);
    out.client.videosDesktop = await client.locator('video').count();

    await client.getByRole('button', { name: 'Enter XR' }).click();
    out.client.enteredXR = true;
    await client.waitForTimeout(10000);
  } catch (e) {
    out.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await hostCtx.close();
    await clientCtx.close();
    await browser.close();
  }

  console.log(JSON.stringify(out, null, 2));
})();
