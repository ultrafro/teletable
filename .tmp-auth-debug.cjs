const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  console.log('url', page.url());

  const buttonsBefore = await page.locator('button').allTextContents();
  console.log('buttonsBefore', buttonsBefore);

  const signIn = page.locator('button:has-text("Sign In")').first();
  console.log('signInCount', await signIn.count());

  if (await signIn.count()) {
    await signIn.click();
    await page.waitForTimeout(1000);
    const buttonsAfter = await page.locator('button').allTextContents();
    console.log('buttonsAfter', buttonsAfter);
    const emailField = page.locator('input[type="email"]');
    console.log('emailCount', await emailField.count());
  }

  await page.screenshot({ path: 'c:/side/teletable/.tmp-auth-debug.png', fullPage: true, timeout: 0 });
  await browser.close();
})();
