const { chromium } = require('playwright');
(async()=>{
 const browser = await chromium.launch({headless:false});
 const ctx = await browser.newContext();
 const page = await ctx.newPage();
 await page.goto('http://localhost:3000/room/debug-'+Date.now(), {waitUntil:'domcontentloaded', timeout:60000});
 await page.waitForTimeout(8000);
 const url = page.url();
 const text = await page.locator('body').innerText();
 const keys = await page.evaluate(()=>Object.keys(localStorage));
 console.log('url', url);
 console.log('keys', keys);
 console.log('textSample', text.slice(0,300));
 await browser.close();
})();
