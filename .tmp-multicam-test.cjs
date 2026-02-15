const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://localhost:3000';
  const roomId = `room-codex-${Date.now()}`;

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const hostContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const hostPage = await hostContext.newPage();

  const result = {
    baseUrl,
    roomId,
    host: {
      anonymousSignedIn: false,
      roomCreated: false,
      cameraCount: 0,
      enabledCamera: false,
      broadcastingTextSeen: false,
      approveClicked: false,
    },
    client: {
      requestClicked: false,
      gotControl: false,
      remoteVideoCount: 0,
      activeStreamTextSeen: false,
    },
    errors: [],
  };

  try {
    // Trigger anonymous auth on room page
    await hostPage.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Wait for Supabase auth token in localStorage
    await hostPage.waitForFunction(() => {
      const keys = Object.keys(localStorage);
      return keys.some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    }, { timeout: 45000 });

    const authData = await hostPage.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (!key) return null;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        accessToken: parsed?.access_token || null,
        userId: parsed?.user?.id || null,
      };
    });

    if (!authData?.accessToken || !authData?.userId) {
      throw new Error('Failed to retrieve anonymous auth token/user from localStorage');
    }
    result.host.anonymousSignedIn = true;

    const createRoomResponse = await hostPage.evaluate(async ({ roomId, hostId, token }) => {
      const res = await fetch('/api/createRoom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, hostId }),
      });
      let body = null;
      try { body = await res.json(); } catch {}
      return { ok: res.ok, status: res.status, body };
    }, { roomId, hostId: authData.userId, token: authData.accessToken });

    if (!createRoomResponse.ok && createRoomResponse.status !== 409) {
      throw new Error(`createRoom failed: ${JSON.stringify(createRoomResponse)}`);
    }
    result.host.roomCreated = true;

    // Open actual host view
    await hostPage.goto(`${baseUrl}/host/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await hostPage.getByRole('heading', { name: 'Host Camera Feeds' }).waitFor({ timeout: 45000 });

    const checkboxes = hostPage.locator('input[type="checkbox"]');
    const cameraCount = await checkboxes.count();
    result.host.cameraCount = cameraCount;

    if (cameraCount > 0) {
      await checkboxes.nth(0).check({ force: true });
      result.host.enabledCamera = true;
      await hostPage.getByText('Broadcasting').first().waitFor({ timeout: 20000 });
      result.host.broadcastingTextSeen = true;
    }

    // Client in isolated context
    const clientContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const clientPage = await clientContext.newPage();

    await clientPage.goto(`${baseUrl}/room/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const requestButton = clientPage.getByRole('button', { name: 'Request Control' });
    await requestButton.waitFor({ timeout: 45000 });
    await requestButton.click();
    result.client.requestClicked = true;

    const approveButton = hostPage.getByRole('button', { name: 'Approve' }).first();
    await approveButton.waitFor({ timeout: 45000 });
    await approveButton.click();
    result.host.approveClicked = true;

    await clientPage.getByText('You have control').waitFor({ timeout: 60000 });
    result.client.gotControl = true;

    await clientPage.getByText(/stream(s)? active/i).first().waitFor({ timeout: 45000 });
    result.client.activeStreamTextSeen = true;

    result.client.remoteVideoCount = await clientPage.locator('video').count();

    await hostPage.screenshot({ path: 'c:/side/teletable/.tmp-host.png', fullPage: true, timeout: 0 });
    await clientPage.screenshot({ path: 'c:/side/teletable/.tmp-client.png', fullPage: true, timeout: 0 });

    await clientContext.close();
  } catch (err) {
    result.errors.push(String(err && err.stack ? err.stack : err));
    try { await hostPage.screenshot({ path: 'c:/side/teletable/.tmp-host-error.png', fullPage: true, timeout: 0 }); } catch {}
  } finally {
    await hostContext.close();
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
})();
