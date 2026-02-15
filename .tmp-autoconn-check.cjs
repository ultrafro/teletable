const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://localhost:3000';
  const roomId = `room-autoconn-${Date.now()}`;
  const result = { roomId, hostDevices: 0, hostBroadcasting: 0, clientVisibleCameras: null, clientVideoCount: 0, errors: [] };

  const browser = await chromium.launch({ headless: false });
  const hostCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const host = await hostCtx.newPage();

  try {
    await host.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await host.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')), { timeout: 45000 });

    const auth = await host.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const parsed = JSON.parse(localStorage.getItem(key));
      return { token: parsed.access_token, userId: parsed.user.id };
    });

    await host.evaluate(async ({ roomId, hostId, token }) => {
      await fetch('/api/createRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId, hostId }),
      });
    }, { roomId, hostId: auth.userId, token: auth.token });

    await host.goto(`${baseUrl}/host/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await host.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 45000 });
    await host.waitForTimeout(2500);

    const cbs = host.locator('input[type="checkbox"]');
    result.hostDevices = await cbs.count();
    for (let i = 0; i < result.hostDevices; i++) {
      await cbs.nth(i).check({ force: true });
      await host.waitForTimeout(500);
    }

    result.hostBroadcasting = await host.locator('text=Broadcasting').count();

    const clientCtx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const client = await clientCtx.newPage();
    await client.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    await client.getByRole('heading', { name: 'Remote View' }).waitFor({ timeout: 45000 });
    await client.waitForTimeout(12000);

    const camBadge = client.locator('text=/\\d+ camera(s)?/i').first();
    if (await camBadge.count()) {
      result.clientVisibleCameras = await camBadge.textContent();
    }
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
