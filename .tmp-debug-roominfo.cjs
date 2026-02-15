const { chromium } = require('playwright');
(async()=>{
 const base='http://localhost:3000';
 const roomId='room-codex-debug-'+Date.now();
 const browser=await chromium.launch({headless:true});
 const hostCtx=await browser.newContext();
 const host=await hostCtx.newPage();
 await host.goto(`${base}/room/${roomId}`,{waitUntil:'domcontentloaded'});
 await host.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')),{timeout:45000});
 const hostAuth=await host.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const p=JSON.parse(localStorage.getItem(k));return {token:p.access_token,userId:p.user.id};});
 await host.evaluate(async ({roomId,hostId,token})=>{await fetch('/api/createRoom',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId,hostId})});},{roomId,hostId:hostAuth.userId,token:hostAuth.token});
 await host.goto(`${base}/host/${roomId}`,{waitUntil:'domcontentloaded'});

 const clientCtx=await browser.newContext();
 const client=await clientCtx.newPage();
 await client.goto(`${base}/room/${roomId}`,{waitUntil:'domcontentloaded'});
 await client.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')),{timeout:45000});
 const clientAuth=await client.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const p=JSON.parse(localStorage.getItem(k));return {token:p.access_token,userId:p.user.id};});
 const req=await client.evaluate(async ({roomId,clientId,token})=>{const r=await fetch('/api/requestControl',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId,clientId,pw:''})});return {status:r.status,body:await r.json()};},{roomId,clientId:clientAuth.userId,token:clientAuth.token});
 console.log('request',req);

 await host.waitForTimeout(2000);
 const hostInfo=await host.evaluate(async ({roomId,userId,token})=>{const r=await fetch(`/api/getBasicRoomInfo?roomId=${roomId}&userId=${userId}`,{headers:{Authorization:`Bearer ${token}`}});return {status:r.status,body:await r.json()};},{roomId,userId:hostAuth.userId,token:hostAuth.token});
 console.log('hostInfo', JSON.stringify(hostInfo));

 const clientInfo=await client.evaluate(async ({roomId,userId,token})=>{const r=await fetch(`/api/getBasicRoomInfo?roomId=${roomId}&userId=${userId}`,{headers:{Authorization:`Bearer ${token}`}});return {status:r.status,body:await r.json()};},{roomId,userId:clientAuth.userId,token:clientAuth.token});
 console.log('clientInfo', JSON.stringify(clientInfo));
 await browser.close();
})();
