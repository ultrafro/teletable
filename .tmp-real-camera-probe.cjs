const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ permissions: ['camera','microphone'] });
  const page = await context.newPage();
  const result = { url: 'http://localhost:3000', devices: [], getUserMedia: null, error: null };
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const probe = await page.evaluate(async () => {
      const out = { devices: [], getUserMedia: null, error: null };
      try {
        const list1 = await navigator.mediaDevices.enumerateDevices();
        out.devices = list1.filter(d => d.kind === 'videoinput').map(d => ({deviceId: d.deviceId, label: d.label}));
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          out.getUserMedia = { ok: true, tracks: stream.getVideoTracks().map(t => ({ label: t.label, readyState: t.readyState })) };
          stream.getTracks().forEach(t => t.stop());
          const list2 = await navigator.mediaDevices.enumerateDevices();
          out.devices = list2.filter(d => d.kind === 'videoinput').map(d => ({deviceId: d.deviceId, label: d.label}));
        } catch (e) {
          out.getUserMedia = { ok: false, message: String(e && e.message ? e.message : e) };
        }
      } catch (e) {
        out.error = String(e && e.message ? e.message : e);
      }
      return out;
    });
    result.devices = probe.devices;
    result.getUserMedia = probe.getUserMedia;
    result.error = probe.error;
  } catch (e) {
    result.error = String(e && e.stack ? e.stack : e);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
