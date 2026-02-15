const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://localhost:3000';
  const roomId = `room-approve-${Date.now()}`;
  const result = {
    roomId,
    hostDetectedCameras: 0,
    hostEnabledCameras: 0,
    hostBroadcastingRows: 0,
    clientRequested: false,
    hostApproved: false,
    clientInControl: false,
    clientVideoCount: 0,
    targetFeeds: 2,
    errors: [],
  };

  const browser = await chromium.launch({ headless: false });
  const hostCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const host = await hostCtx.newPage();

  try {
    await host.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await host.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')), { timeout: 60000 });

    const hostAuth = await host.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const parsed = JSON.parse(localStorage.getItem(key));
      return { token: parsed.access_token, userId: parsed.user.id };
    });

    const create = await host.evaluate(async ({ roomId, hostId, token }) => {
      const r = await fetch('/api/createRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId, hostId }),
      });
      return { status: r.status, body: await r.json() };
    }, { roomId, hostId: hostAuth.userId, token: hostAuth.token });

    if (!(create.status === 200 || create.status === 409)) {
      throw new Error(`createRoom failed: ${JSON.stringify(create)}`);
    }

    await host.goto(`${baseUrl}/host/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await host.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 60000 });
    await host.waitForTimeout(4000);

    const cbs = host.locator('input[type="checkbox"]');
    result.hostDetectedCameras = await cbs.count();
    if (result.hostDetectedCameras < 2) {
      throw new Error(`Expected at least 2 host cameras, got ${result.hostDetectedCameras}`);
    }

    const enableCount = Math.min(2, result.hostDetectedCameras);
    for (let i = 0; i < enableCount; i++) {
      await cbs.nth(i).check({ force: true });
      await host.waitForTimeout(800);
      result.hostEnabledCameras += 1;
    }

    await host.waitForTimeout(2000);
    result.hostBroadcastingRows = await host.locator('text=Broadcasting').count();

    const clientCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const client = await clientCtx.newPage();
    await client.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const reqBtn = client.getByRole('button', { name: 'Request Control' });
    await reqBtn.waitFor({ timeout: 60000 });
    await reqBtn.click();
    result.clientRequested = true;

    const approveBtn = host.getByRole('button', { name: 'Approve' }).first();
    await approveBtn.waitFor({ timeout: 60000 });
    await approveBtn.click();
    result.hostApproved = true;

    await client.getByText('You have control').waitFor({ timeout: 60000 });
    result.clientInControl = true;

    await client.waitForTimeout(10000);
    result.clientVideoCount = await client.locator('video').count();

    await clientCtx.close();
  } catch (e) {
    result.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await hostCtx.close();
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
})();
