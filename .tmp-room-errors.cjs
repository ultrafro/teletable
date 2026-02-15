const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=(await browser.newContext().then(c=>c.newPage()));
 page.on('console', m=>console.log('console', m.type(), m.text()));
 page.on('pageerror', e=>console.log('pageerror', e.message, e.stack));
 await page.goto('http://localhost:3000/room/debug-'+Date.now(), {waitUntil:'domcontentloaded', timeout:60000});
 await page.waitForTimeout(5000);
 await browser.close();
})();
