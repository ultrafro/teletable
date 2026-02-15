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

(async () => {
  const result = {
    roomId: null,
    host: { camerasDetected: 0, broadcastingRows: 0, startingRows: 0, notBroadcastingRows: 0 },
    client: { requested: false, approved: false, inControl: false, videos: 0, establishingRows: 0 },
    errors: [],
  };

  const browser = await chromium.launch({ headless: false });
  const hostCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const clientCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const hostPage = await hostCtx.newPage();
  const clientPage = await clientCtx.newPage();

  try {
    const ts = Date.now();
    await signUpAndGoHome(hostPage, `hoste2e${ts}@example.com`, 'CodexPass123!');
    await hostPage.getByRole('button', { name: /Create New Room|Creating Room/ }).click();
    await hostPage.waitForURL('**/host/**', { timeout: 60000 });
    result.roomId = hostPage.url().split('/').pop();

    await hostPage.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await hostPage.waitForTimeout(4000);

    const cbs = hostPage.locator('input[type="checkbox"]');
    result.host.camerasDetected = await cbs.count();
    for (let i = 0; i < result.host.camerasDetected; i++) {
      await cbs.nth(i).click({ force: true });
      await hostPage.waitForTimeout(2500);
    }

    await hostPage.waitForTimeout(5000);
    result.host.broadcastingRows = await hostPage.locator('text=Broadcasting').count();
    result.host.startingRows = await hostPage.locator('text=Starting...').count();
    result.host.notBroadcastingRows = await hostPage.locator('text=Not broadcasting').count();

    await signUpAndGoHome(clientPage, `cliente2e${ts}@example.com`, 'CodexPass123!');
    await clientPage.goto(`http://localhost:3000/room/${result.roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await clientPage.getByRole('button', { name: 'Request Control' }).waitFor({ timeout: 60000 });
    await clientPage.getByRole('button', { name: 'Request Control' }).click();
    result.client.requested = true;

    await hostPage.getByRole('button', { name: 'Approve' }).first().waitFor({ timeout: 60000 });
    await hostPage.getByRole('button', { name: 'Approve' }).first().click();
    result.client.approved = true;

    await clientPage.getByText('You have control').waitFor({ timeout: 60000 });
    result.client.inControl = true;

    await clientPage.waitForTimeout(10000);
    result.client.videos = await clientPage.locator('video').count();
    result.client.establishingRows = await clientPage.locator('text=Establishing connection...').count();
  } catch (e) {
    result.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await hostCtx.close();
    await clientCtx.close();
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
})();
