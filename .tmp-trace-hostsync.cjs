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
 const hostCtx=await browser.newContext({permissions:['camera','microphone']});
 const clientCtx=await browser.newContext({permissions:['camera','microphone']});
 const host=await hostCtx.newPage();
 const client=await clientCtx.newPage();
 const logs=[];
 host.on('console',m=>{const t=m.text(); if(t.includes('[HostCamSync]')||t.includes('incoming call')||t.includes('No camera streams')||t.includes('Answered initial call')||t.includes('Calling client')) {logs.push('HOST '+t); console.log('HOST',t);} });
 client.on('console',m=>{const t=m.text(); if(t.includes('[MultiCam Client]')||t.includes('[XRVideo]')) {logs.push('CLIENT '+t); console.log('CLIENT',t);} });
 const ts=Date.now();
 await signUpAndGoHome(host,`hosttrace${ts}@example.com`,'CodexPass123!');
 await host.getByRole('button',{name:/Create New Room|Creating Room/}).click();
 await host.waitForURL('**/host/**',{timeout:60000});
 const room=host.url().split('/').pop();
 await host.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
 await host.waitForTimeout(4000);
 const cbs=host.locator('input[type="checkbox"]');
 const n=await cbs.count();
 for(let i=0;i<n;i++){
  if(!(await cbs.nth(i).isChecked())){ await cbs.nth(i).click({force:true}); await host.waitForTimeout(2500); }
 }
 await host.waitForTimeout(4000);
 await signUpAndGoHome(client,`clienttrace${ts}@example.com`,'CodexPass123!');
 await client.goto(`http://localhost:3000/room/${room}`,{waitUntil:'domcontentloaded',timeout:60000});
 await client.getByRole('button',{name:'Request Control'}).waitFor({timeout:60000});
 await client.getByRole('button',{name:'Request Control'}).click();
 await host.getByRole('button',{name:'Approve'}).first().waitFor({timeout:60000});
 await host.getByRole('button',{name:'Approve'}).first().click();
 await client.getByText('You have control').waitFor({timeout:60000});
 await client.waitForTimeout(10000);
 console.log('SUMMARY', JSON.stringify({room, videos: await client.locator('video').count(), logsCount: logs.length}, null, 2));
 await browser.close();
})();
