const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ permissions: ['camera','microphone'] });
  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const res = await page.evaluate(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const tracks = s.getVideoTracks().map(t => t.label);
      s.getTracks().forEach(t => t.stop());
      return { ok: true, tracks };
    } catch (e) {
      return { ok: false, msg: String(e && e.message ? e.message : e) };
    }
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
