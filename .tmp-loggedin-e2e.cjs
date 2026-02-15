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
    host: { camerasDetected: 0, enabled: 0, startingRows: 0, broadcastingRows: 0, previewVideos: 0 },
    client: { requested: false, approved: false, inControl: false, videos: 0, establishing: null },
    errors: [],
  };

  const browser = await chromium.launch({ headless: false });

  const hostCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const hostPage = await hostCtx.newPage();

  const clientCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const clientPage = await clientCtx.newPage();

  try {
    const ts = Date.now();
    await signUpAndGoHome(hostPage, `host${ts}@example.com`, 'CodexPass123!');

    await hostPage.getByRole('button', { name: /Create New Room|Creating Room/ }).click();
    await hostPage.waitForURL('**/host/**', { timeout: 60000 });

    const hostUrl = hostPage.url();
    result.roomId = hostUrl.split('/').pop();

    await hostPage.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await hostPage.waitForTimeout(5000);

    const checkboxes = hostPage.locator('input[type="checkbox"]');
    result.host.camerasDetected = await checkboxes.count();

    const toEnable = Math.min(2, result.host.camerasDetected);
    for (let i = 0; i < toEnable; i++) {
      await checkboxes.nth(i).check({ force: true });
      result.host.enabled += 1;
      await hostPage.waitForTimeout(1500);
    }

    await hostPage.waitForTimeout(5000);
    result.host.startingRows = await hostPage.locator('text=Starting...').count();
    result.host.broadcastingRows = await hostPage.locator('text=Broadcasting').count();
    result.host.previewVideos = await hostPage.locator('video').count();

    await signUpAndGoHome(clientPage, `client${ts}@example.com`, 'CodexPass123!');
    await clientPage.goto(`http://localhost:3000/room/${result.roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const req = clientPage.getByRole('button', { name: 'Request Control' });
    await req.waitFor({ timeout: 60000 });
    await req.click();
    result.client.requested = true;

    const approve = hostPage.getByRole('button', { name: 'Approve' }).first();
    await approve.waitFor({ timeout: 60000 });
    await approve.click();
    result.client.approved = true;

    await clientPage.getByText('You have control').waitFor({ timeout: 60000 });
    result.client.inControl = true;

    await clientPage.waitForTimeout(10000);
    result.client.videos = await clientPage.locator('video').count();
    result.client.establishing = await clientPage.locator('text=Establishing connection...').count();
  } catch (e) {
    result.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await hostCtx.close();
    await clientCtx.close();
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
})();
