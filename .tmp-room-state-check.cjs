const { chromium } = require('playwright');
(async()=>{
 const url='http://localhost:3000/room/room-J6IXJn7x';
 const browser=await chromium.launch({headless:false});
 const ctx=await browser.newContext({permissions:['camera','microphone']});
 const page=await ctx.newPage();
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(8000);
 const state=await page.evaluate(()=>{
  const txt=document.body.innerText;
  const hasReq=txt.includes('Request Control');
  const inControl=txt.includes('You have control')||txt.includes('In Control');
  const peerConnected=txt.includes('PeerJS')&&txt.includes('Connected');
  const streamLine=(txt.match(/\d+ stream[s]? active|Establishing connection|Inactive/g)||[]);
  const camBadge=(txt.match(/\d+ camera[s]?/g)||[]);
  return {hasReq,inControl,peerConnected,streamLine,camBadge,snippet:txt.slice(txt.indexOf('Remote View'), txt.indexOf('Connection Status')>0?txt.indexOf('Connection Status'):txt.length)};
 });
 console.log(JSON.stringify(state,null,2));
 await page.screenshot({path:'c:/side/teletable/.tmp-user-room-state.png',fullPage:true,timeout:0});
 await browser.close();
})();
