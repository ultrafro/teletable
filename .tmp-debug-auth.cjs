const { chromium } = require('playwright');
(async()=>{
 const browser = await chromium.launch({headless:true});
 const page = await browser.newPage();
 await page.goto('http://localhost:3000', {waitUntil:'domcontentloaded'});
 console.log('url', page.url());
 const signInVisible = await page.getByRole('button', {name:'Sign In'}).isVisible().catch(()=>false);
 console.log('signInVisible', signInVisible);
 if(signInVisible){
   await page.getByRole('button', {name:'Sign In'}).click();
   await page.waitForTimeout(1000);
   const texts = await page.locator('button').allTextContents();
   console.log('buttons', texts);
 }
 await page.screenshot({path:'c:/side/teletable/.tmp-signin-debug.png', fullPage:true});
 await browser.close();
})();
