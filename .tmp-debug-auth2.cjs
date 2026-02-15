const { chromium } = require('playwright');
(async()=>{
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage();
 await page.goto('http://localhost:3000', {waitUntil:'domcontentloaded', timeout:60000});
 await page.waitForTimeout(3000);
 console.log('url', page.url());
 const countText = await page.locator('text=Sign In').count();
 const countBtn = await page.locator('button').count();
 const btnTexts = await page.locator('button').allTextContents();
 console.log({countText,countBtn,btnTexts});
 await browser.close();
})();
