const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:false});
 const ctx=await browser.newContext({permissions:['camera','microphone']});
 const page=await ctx.newPage();
 const room='room-hostprobe-'+Date.now();
 await page.goto('http://localhost:3000/room/'+room,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')),{timeout:60000});
 const auth=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));const p=JSON.parse(localStorage.getItem(key));return {token:p.access_token,userId:p.user.id};});
 await page.evaluate(async ({room,hostId,token})=>{await fetch('/api/createRoom',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({roomId:room,hostId})});},{room,hostId:auth.userId,token:auth.token});
 await page.goto('http://localhost:3000/host/'+room,{waitUntil:'domcontentloaded',timeout:60000});
 await page.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
 await page.waitForTimeout(15000);
 const data=await page.evaluate(()=>{
  const checkboxes=document.querySelectorAll('input[type="checkbox"]').length;
  const body=document.body.innerText;
  return {checkboxes, hasNoCameras: body.includes('No cameras available'), hasCameraError: body.includes('Camera Error:'), bodySnippet: body.slice(body.indexOf('Host Camera Feeds'), body.indexOf('Connection Status'))};
 });
 console.log(JSON.stringify(data,null,2));
 await page.screenshot({path:'c:/side/teletable/.tmp-hostprobe.png', fullPage:true, timeout:0});
 await browser.close();
})();
