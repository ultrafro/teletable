const { chromium } = require('playwright');
(async()=>{
 const base='http://localhost:3000';
 const room='room-log-'+Date.now();
 const browser=await chromium.launch({headless:false});
 const hostCtx=await browser.newContext({permissions:['camera','microphone']});
 const host=await hostCtx.newPage();
 host.on('console',m=>{const t=m.text(); if(t.includes('camera')||t.includes('call')||t.includes('MultiCam')||t.includes('peer')) console.log('HOST',t)});
 const clientCtx=await browser.newContext({permissions:['camera','microphone']});
 const client=await clientCtx.newPage();
 client.on('console',m=>{const t=m.text(); if(t.includes('camera')||t.includes('call')||t.includes('MultiCam')||t.includes('peer')) console.log('CLIENT',t)});

 await host.goto(`${base}/room/${room}`,{waitUntil:'domcontentloaded'});
 await host.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')),{timeout:60000});
 const auth=await host.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const p=JSON.parse(localStorage.getItem(key));return {token:p.access_token,userId:p.user.id};});
 await host.evaluate(async ({room,hostId,token})=>{await fetch('/api/createRoom',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId:room,hostId})});},{room,hostId:auth.userId,token:auth.token});
 await host.goto(`${base}/host/${room}`,{waitUntil:'domcontentloaded'});
 await host.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
 await host.waitForTimeout(5000);
 const cbs=host.locator('input[type="checkbox"]');
 const n=await cbs.count();
 for(let i=0;i<Math.min(2,n);i++){ await cbs.nth(i).check({force:true}); await host.waitForTimeout(500);}  

 await client.goto(`${base}/room/${room}`,{waitUntil:'domcontentloaded'});
 await client.getByRole('button',{name:'Request Control'}).waitFor({timeout:60000});
 await client.getByRole('button',{name:'Request Control'}).click();
 await host.getByRole('button',{name:'Approve'}).first().waitFor({timeout:60000});
 await host.getByRole('button',{name:'Approve'}).first().click();
 await client.getByText('You have control').waitFor({timeout:60000});
 await client.waitForTimeout(10000);
 console.log('videos', await client.locator('video').count());
 await browser.close();
})();
