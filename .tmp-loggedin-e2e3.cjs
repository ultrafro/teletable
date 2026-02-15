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
 const res={room:null,host:{cams:0,broadcasting:0,starting:0},client:{videos:0,establishing:0,inControl:false},errors:[]};
 try{
  const ts=Date.now();
  await signUpAndGoHome(host,`hostset${ts}@example.com`,'CodexPass123!');
  await host.getByRole('button',{name:/Create New Room|Creating Room/}).click();
  await host.waitForURL('**/host/**',{timeout:60000});
  res.room=host.url().split('/').pop();
  await host.getByRole('heading',{name:'Host Camera Feeds'}).waitFor({timeout:60000});
  await host.waitForTimeout(4000);
  const cbs=host.locator('input[type="checkbox"]');
  res.host.cams=await cbs.count();
  for(let i=0;i<res.host.cams;i++){
    const isChecked=await cbs.nth(i).isChecked();
    if(!isChecked){
      await cbs.nth(i).click({force:true});
      await host.waitForTimeout(2500);
    }
  }
  await host.waitForTimeout(6000);
  res.host.broadcasting=await host.locator('text=Broadcasting').count();
  res.host.starting=await host.locator('text=Starting...').count();

  await signUpAndGoHome(client,`clientset${ts}@example.com`,'CodexPass123!');
  await client.goto(`http://localhost:3000/room/${res.room}`,{waitUntil:'domcontentloaded',timeout:60000});
  await client.getByRole('button',{name:'Request Control'}).waitFor({timeout:60000});
  await client.getByRole('button',{name:'Request Control'}).click();
  await host.getByRole('button',{name:'Approve'}).first().waitFor({timeout:60000});
  await host.getByRole('button',{name:'Approve'}).first().click();
  await client.getByText('You have control').waitFor({timeout:60000});
  res.client.inControl=true;
  await client.waitForTimeout(10000);
  res.client.videos=await client.locator('video').count();
  res.client.establishing=await client.locator('text=Establishing connection...').count();
 }catch(e){res.errors.push(String(e&&e.stack?e.stack:e));}
 finally{await hostCtx.close();await clientCtx.close();await browser.close();}
 console.log(JSON.stringify(res,null,2));
})();
