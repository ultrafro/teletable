const { chromium } = require('playwright');
(async()=>{
 const base='http://localhost:3000';
 const roomId='room-codex-debug-'+Date.now();
 const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const hostCtx=await browser.newContext();
 const host=await hostCtx.newPage();
 await host.goto(`${base}/room/${roomId}`,{waitUntil:'domcontentloaded'});
 await host.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')),{timeout:45000});
 const hostAuth=await host.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const p=JSON.parse(localStorage.getItem(k));return {token:p.access_token,userId:p.user.id};});
 console.log('hostAuth',hostAuth);
 const create=await host.evaluate(async ({roomId,hostId,token})=>{const r=await fetch('/api/createRoom',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId,hostId})});return {status:r.status,body:await r.json()};},{roomId,hostId:hostAuth.userId,token:hostAuth.token});
 console.log('create',create);
 await host.goto(`${base}/host/${roomId}`,{waitUntil:'domcontentloaded'});
 await host.waitForTimeout(2000);

 const clientCtx=await browser.newContext();
 const client=await clientCtx.newPage();
 await client.goto(`${base}/room/${roomId}`,{waitUntil:'domcontentloaded'});
 await client.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')),{timeout:45000});
 const clientAuth=await client.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const p=JSON.parse(localStorage.getItem(k));return {token:p.access_token,userId:p.user.id};});
 console.log('clientAuth',clientAuth);
 const req=await client.evaluate(async ({roomId,clientId,token})=>{const r=await fetch('/api/requestControl',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId,clientId,pw:''})});return {status:r.status,body:await r.json()};},{roomId,clientId:clientAuth.userId,token:clientAuth.token});
 console.log('request',req);

 await host.waitForTimeout(5000);
 const hostTexts=await host.locator('body').innerText();
 console.log('hostHasPending', hostTexts.includes('Pending Requests'));
 console.log('hostHasApprove', hostTexts.includes('Approve'));
 console.log('hostHasControlling', hostTexts.includes('is controlling'));

 await host.screenshot({path:'c:/side/teletable/.tmp-debug-host2.png',fullPage:true,timeout:0});
 await client.screenshot({path:'c:/side/teletable/.tmp-debug-client2.png',fullPage:true,timeout:0});
 await browser.close();
})();
