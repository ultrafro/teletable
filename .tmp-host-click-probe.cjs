const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:false});
 const ctx=await browser.newContext({permissions:['camera','microphone']});
 const page=await ctx.newPage();
 const ts=Date.now();
 await page.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Sign In'}).click();
 await page.getByRole('button',{name:"Don't have an account? Sign up"}).click();
 await page.getByLabel('Email address').fill(`hostprobe${ts}@example.com`);
 await page.getByLabel('Password').fill('CodexPass123!');
 await page.getByRole('button',{name:'Sign Up'}).click();
 await page.waitForURL('**/home',{timeout:60000});
 await page.getByRole('button',{name:/Create New Room|Creating Room/}).click();
 await page.waitForURL('**/host/**',{timeout:60000});
 await page.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
 await page.waitForTimeout(3000);
 const cbs=page.locator('input[type="checkbox"]');
 const n=await cbs.count();
 for(let i=0;i<n;i++){
   await cbs.nth(i).click({force:true});
   await page.waitForTimeout(2500);
 }
 const data=await page.evaluate(()=>{
   const txt=document.body.innerText;
   return {
     starting:(txt.match(/Starting\.\.\./g)||[]).length,
     broadcasting:(txt.match(/Broadcasting/g)||[]).length,
     notBroadcasting:(txt.match(/Not broadcasting/g)||[]).length,
     errorLine:(txt.match(/Camera Error:[^\n]*/g)||[])[0]||null,
     videos:document.querySelectorAll('video').length,
   };
 });
 console.log(JSON.stringify(data,null,2));
 await browser.close();
})();
