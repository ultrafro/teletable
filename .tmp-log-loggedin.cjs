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
 host.on('console',m=>{const t=m.text(); if(/camera|call|peer|MultiCam|stream/i.test(t)) console.log('HOST',t)});
 client.on('console',m=>{const t=m.text(); if(/camera|call|peer|MultiCam|stream/i.test(t)) console.log('CLIENT',t)});
 const ts=Date.now();
 await signUpAndGoHome(host,`hostlog${ts}@example.com`,'CodexPass123!');
 await host.getByRole('button',{name:/Create New Room|Creating Room/}).click();
 await host.waitForURL('**/host/**',{timeout:60000});
 const room=host.url().split('/').pop();
 await host.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
 await host.waitForTimeout(4000);
 const cbs=host.locator('input[type="checkbox"]');
 const n=await cbs.count();
 for(let i=0;i<n;i++){ await cbs.nth(i).click({force:true}); await host.waitForTimeout(2000); }
 await host.waitForTimeout(3000);
 console.log('host rows', await host.locator('text=Broadcasting').count(), await host.locator('text=Starting...').count());

 await signUpAndGoHome(client,`clientlog${ts}@example.com`,'CodexPass123!');
 await client.goto(`http://localhost:3000/room/${room}`,{waitUntil:'domcontentloaded',timeout:60000});
 await client.getByRole('button',{name:'Request Control'}).waitFor({timeout:60000});
 await client.getByRole('button',{name:'Request Control'}).click();
 await host.getByRole('button',{name:'Approve'}).first().waitFor({timeout:60000});
 await host.getByRole('button',{name:'Approve'}).first().click();
 await client.getByText('You have control').waitFor({timeout:60000});
 await client.waitForTimeout(12000);
 console.log('client videos', await client.locator('video').count());
 await browser.close();
})();
