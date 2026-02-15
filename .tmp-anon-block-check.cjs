const { chromium } = require('playwright');
(async()=>{
 const browser = await chromium.launch({ headless: false });
 const ctx = await browser.newContext();
 const page = await ctx.newPage();
 const id='room-anon-check-'+Date.now();
 await page.goto(`http://localhost:3000/rooms/${id}`, { waitUntil:'domcontentloaded', timeout:60000 });
 await page.waitForTimeout(6000);
 const hadAnon = await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('auth-token')));
 await page.goto(`http://localhost:3000/room/${id}`, { waitUntil:'domcontentloaded', timeout:60000 });
 await page.waitForTimeout(3000);
 const url = page.url();
 const body = await page.locator('body').innerText();
 console.log(JSON.stringify({ hadAnon, redirected:url==='http://localhost:3000/' || url.startsWith('http://localhost:3000/?'), hasClientView: body.includes('Remote View'), hasSignIn: body.includes('Sign In') }, null, 2));
 await browser.close();
})();
