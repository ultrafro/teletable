const { chromium } = require('playwright');

async function signUpAndGoHome(page, email, password) {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.waitForURL('**/home', { timeout: 60000 });
}

(async()=>{
 const browser=await chromium.launch({headless:false});
 const ctx=await browser.newContext({permissions:['camera','microphone']});
 const page=await ctx.newPage();
 const ts=Date.now();
 await signUpAndGoHome(page,`hostinspect${ts}@example.com`,'CodexPass123!');
 await page.getByRole('button',{name:/Create New Room|Creating Room/}).click();
 await page.waitForURL('**/host/**',{timeout:60000});
 await page.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
 await page.waitForTimeout(5000);
 let snapshot = await page.evaluate(()=>{
   const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
   const rows = cbs.map((cb)=>{ const row=cb.closest('div.flex.items-center.gap-3'); return {checked:cb.checked, text:row?.textContent?.replace(/\s+/g,' ').trim()};});
   const body=document.body.innerText;
   return {count:cbs.length, rows, hasErr:body.includes('Camera Error:'), err:(body.match(/Camera Error:[^\n]*/)||[])[0]||null};
 });
 console.log('before', JSON.stringify(snapshot,null,2));
 const cbs=page.locator('input[type="checkbox"]');
 const n=await cbs.count();
 for(let i=0;i<n;i++){ await cbs.nth(i).click({force:true}); await page.waitForTimeout(3000); }
 snapshot = await page.evaluate(()=>{
   const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
   const rows = cbs.map((cb)=>{ const row=cb.closest('div.flex.items-center.gap-3'); return {checked:cb.checked, text:row?.textContent?.replace(/\s+/g,' ').trim()};});
   const body=document.body.innerText;
   return {count:cbs.length, rows, hasErr:body.includes('Camera Error:'), err:(body.match(/Camera Error:[^\n]*/)||[])[0]||null};
 });
 console.log('after', JSON.stringify(snapshot,null,2));
 await browser.close();
})();
