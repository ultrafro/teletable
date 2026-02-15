const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://localhost:3000';
  const roomId = `room-realcam-${Date.now()}`;

  const browser = await chromium.launch({ headless: false });

  const hostContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const hostPage = await hostContext.newPage();

  const result = {
    roomId,
    host: {
      cameraDevices: [],
      toggledFirstCamera: false,
      broadcastingSeen: false,
    },
    client: {
      requestedControl: false,
      gotControl: false,
      remoteVideos: 0,
      activeStreamsTextSeen: false,
    },
    errors: [],
  };

  try {
    // anonymous auth + room create
    await hostPage.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await hostPage.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')), { timeout: 45000 });

    const hostAuth = await hostPage.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const parsed = JSON.parse(localStorage.getItem(key));
      return { token: parsed.access_token, userId: parsed.user.id };
    });

    const create = await hostPage.evaluate(async ({ roomId, hostId, token }) => {
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

    // host page
    await hostPage.goto(`${baseUrl}/host/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await hostPage.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 45000 });
    await hostPage.waitForTimeout(2500);

    // collect camera labels
    result.host.cameraDevices = await hostPage.evaluate(() => {
      return Array.from(document.querySelectorAll('p.text-sm.text-foreground.truncate')).map(el => el.textContent?.trim()).filter(Boolean);
    });

    const cb = hostPage.locator('input[type="checkbox"]').first();
    if (await cb.count()) {
      await cb.check({ force: true });
      result.host.toggledFirstCamera = true;
      await hostPage.getByText('Broadcasting').first().waitFor({ timeout: 20000 });
      result.host.broadcastingSeen = true;
    }

    // client page
    const clientContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const clientPage = await clientContext.newPage();
    await clientPage.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const req = clientPage.getByRole('button', { name: 'Request Control' });
    await req.waitFor({ timeout: 45000 });
    await req.click();
    result.client.requestedControl = true;

    // Wait for either control granted, pending shown on host, or timeout
    const controlPromise = clientPage.getByText('You have control').waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    const approvePromise = hostPage.getByRole('button', { name: 'Approve' }).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);

    const [gotControl, sawApprove] = await Promise.all([controlPromise, approvePromise]);
    result.client.gotControl = gotControl;

    if (sawApprove && !gotControl) {
      await hostPage.getByRole('button', { name: 'Approve' }).first().click();
      const gotAfterApprove = await clientPage.getByText('You have control').waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
      result.client.gotControl = gotAfterApprove;
    }

    if (result.client.gotControl) {
      result.client.activeStreamsTextSeen = await clientPage.getByText(/stream(s)? active/i).first().isVisible().catch(() => false);
      result.client.remoteVideos = await clientPage.locator('video').count();
    }

    await clientContext.close();
  } catch (e) {
    result.errors.push(String(e && e.stack ? e.stack : e));
  } finally {
    await hostContext.close();
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
})();
