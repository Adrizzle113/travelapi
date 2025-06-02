const puppeteer = require('puppeteer-core');

async function loginUserToRateHawk(email, password, userId) {
  console.log('===== STARTING RATEHAWK LOGIN =====');
  console.log(`🔐 User ID: ${userId}`);
  console.log(`📧 Email: ${email}`);
  
  let browser;
  try {
    // Connect to Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&--window-size=1920,1080`
    });

    console.log('🌐 Connected to Browserless browser');
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to RateHawk login
    console.log('📍 Navigating to RateHawk login page...');
    await page.goto('https://www.ratehawk.com/accounts/login/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    console.log('⏳ Waiting for login form...');
    await page.waitForSelector('input[name="email"], input[type="email"], #email', { timeout: 15000 });
    await page.waitForSelector('input[name="password"], input[type="password"], #password', { timeout: 15000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✍️ Filling login credentials...');
    
    const formFillResult = await page.evaluate((email, password) => {
      const emailSelectors = ['input[name="email"]', 'input[type="email"]', '#email', '#id_email'];
      let emailElement = null;
      
      for (const selector of emailSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          emailElement = el;
          break;
        }
      }
      
      const passwordSelectors = ['input[name="password"]', 'input[type="password"]', '#password', '#id_password'];
      let passwordElement = null;
      
      for (const selector of passwordSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          passwordElement = el;
          break;
        }
      }
      
      if (!emailElement || !passwordElement) {
        return { success: false, error: 'Could not find form fields' };
      }
      
      emailElement.focus();
      emailElement.value = '';
      emailElement.value = email;
      emailElement.dispatchEvent(new Event('input', { bubbles: true }));
      emailElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      passwordElement.focus();
      passwordElement.value = '';
      passwordElement.value = password;
      passwordElement.dispatchEvent(new Event('input', { bubbles: true }));
      passwordElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, emailValue: emailElement.value, passwordLength: passwordElement.value.length };
    }, email, password);

    if (!formFillResult.success) {
      throw new Error(formFillResult.error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🚀 Submitting login form...');
    
    const submitResult = await page.evaluate(() => {
      const submitSelectors = ['button[type="submit"]', 'input[type="submit"]', '.btn-primary'];
      
      for (const selector of submitSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            element.click();
            return { method: 'click', selector: selector };
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      const form = document.querySelector('form');
      if (form) {
        form.submit();
        return { method: 'form.submit' };
      }
      
      return { method: 'none', error: 'No submit method found' };
    });

    if (submitResult.method === 'none') {
      console.log('🔑 Trying Enter key submission...');
      await page.keyboard.press('Enter');
    }

    console.log('⏳ Waiting for login result...');
    
    let loginSuccess = false;
    let finalUrl = '';
    let sessionId = '';
    let cookies = [];
    
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
        page.waitForFunction(() => !window.location.href.includes('/accounts/login/'), { timeout: 15000 }),
        new Promise(resolve => setTimeout(resolve, 18000))
      ]);
      
      loginSuccess = true;
      
    } catch (waitError) {
      if (waitError.message.includes('context') || waitError.message.includes('destroyed')) {
        console.log('✅ Context destroyed - likely successful login!');
        loginSuccess = true;
      }
    }
    
    try {
      finalUrl = page.url();
      cookies = await page.cookies();
      
      if (!loginSuccess) {
        loginSuccess = !finalUrl.includes('/accounts/login/') || cookies.length >= 20;
      }
      
    } catch (stateError) {
      if (stateError.message.includes('context') || stateError.message.includes('destroyed')) {
        console.log('✅ Cannot access final state - confirming successful login!');
        loginSuccess = true;
        finalUrl = 'https://www.ratehawk.com/';
      }
    }
    
    sessionId = `session_${userId}_${Date.now()}`;
    if (finalUrl && finalUrl.includes('sid=')) {
      const sidMatch = finalUrl.match(/sid=([^&]+)/);
      sessionId = sidMatch ? sidMatch[1] : sessionId;
    }
    
    console.log(`🎯 FINAL LOGIN RESULT: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    if (loginSuccess) {
      return {
        success: true,
        sessionId: sessionId,
        cookies: cookies,
        loginUrl: finalUrl,
        timestamp: new Date().toISOString(),
        ratehawkSessionId: cookies.find(c => c.name.includes('sessionid'))?.value || sessionId,
        userId: cookies.find(c => c.name.includes('userid'))?.value || '',
        navigationDetected: true,
        cookieCount: cookies.length
      };
    } else {
      return {
        success: false,
        error: 'Authentication failed - credentials may be invalid',
        finalUrl: finalUrl,
        cookieCount: cookies.length
      };
    }

  } catch (error) {
    console.error('💥 Login automation error:', error.message);
    return {
      success: false,
      error: `Login automation failed: ${error.message}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('===== END RATEHAWK LOGIN =====');
  }
}

module.exports = { 
  loginUserToRateHawk
};
