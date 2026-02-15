const { chromium } = require('playwright');
(async()=>{
 const browser = await chromium.launch({ headless: false });
 const ctx = await browser.newContext();
 const page = await ctx.newPage();
 await page.goto('http://localhost:3000/room/room-test-auth-'+Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
 await page.waitForTimeout(4000);
 const url = page.url();
 const body = await page.locator('body').innerText();
 const keys = await page.evaluate(() => Object.keys(localStorage));
 console.log(JSON.stringify({ url, hasSignInButton: body.includes('Sign In'), hasClientView: body.includes('Remote View'), hasAuthToken: keys.some(k => k.includes('auth-token')) }, null, 2));
 await browser.close();
})();
