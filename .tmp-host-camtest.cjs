const { chromium } = require('playwright');
(async()=>{
 const base='http://localhost:3000';
 const roomId='room-cam-'+Date.now();
 const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const ctx=await browser.newContext({permissions:['camera','microphone']});
 const page=await ctx.newPage();
 await page.goto(`${base}/room/${roomId}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.includes('auth-token')),{timeout:45000});
 const auth=await page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.includes('auth-token'));const p=JSON.parse(localStorage.getItem(k));return {token:p.access_token,userId:p.user.id};});
 await page.evaluate(async ({roomId,hostId,token})=>{await fetch('/api/createRoom',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId,hostId})});},{roomId,hostId:auth.userId,token:auth.token});
 await page.goto(`${base}/host/${roomId}`,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:45000});
 await page.waitForTimeout(2000);
 const cbCount = await page.locator('input').evaluateAll(els => els.filter(e => e.type === 'checkbox').length);
 console.log('checkboxes', cbCount);
 if(cbCount>0){
   await page.locator('input[type="checkbox"]').first().check({force:true});
   await page.waitForTimeout(1500);
 }
 const body = await page.locator('body').innerText();
 console.log('hasBroadcasting', body.includes('Broadcasting'));
 console.log('hasCamerasActive', body.includes('1 Active') || body.includes('Active'));
 await page.screenshot({path:'c:/side/teletable/.tmp-host-cam.png',fullPage:true,timeout:0});
 await browser.close();
})();
