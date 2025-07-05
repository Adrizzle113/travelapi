const puppeteer = require('puppeteer-core');

async function createRateHawkSubagent(signupData) {
  console.log('===== STARTING RATEHAWK SIGNUP =====');
  console.log(`📧 Generated Email: ${signupData.generatedEmail}`);
  console.log(`👤 User: ${signupData.firstName} ${signupData.lastName}`);
  
  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&--window-size=1920,1080`
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

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fill login form
    console.log('✍️ Filling login form...');
    await page.focus('input[name="email"]');
    await page.type('input[name="email"]', process.env.RATEHAWK_MASTER_EMAIL, { delay: 100 });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await page.focus('input[name="pass"]');
    await page.type('input[name="pass"]', process.env.RATEHAWK_MASTER_PASSWORD, { delay: 150 });
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Submit login
    console.log('🚀 Submitting login form...');
    await page.click('button[type="submit"]');

    // Wait for login response
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check authentication status by looking at cookies and user info
    const authCheck = await page.evaluate(() => {
      const cookies = document.cookie;
      return {
        url: window.location.href,
        cookies: cookies,
        hasAuthCookie: cookies.includes('is_auth=1'),
        hasUserIdCookie: cookies.includes('userid='),
        userInfo: {
          email: document.body.innerText.includes('@') ? 
            document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] : null,
          hasUserData: document.body.innerText.toLowerCase().includes('bougie backpacker') ||
                      document.body.innerText.includes('areahna')
        }
      };
    });

    console.log('🔍 Auth Check:', JSON.stringify(authCheck, null, 2));

    // NEW LOGIC: If we have auth cookies and user data, consider login successful
    const isAuthenticated = authCheck.hasAuthCookie && authCheck.hasUserIdCookie && authCheck.userInfo.hasUserData;

    if (!isAuthenticated) {
      return {
        success: false,
        error: 'Authentication failed - no auth cookies detected',
        authCheck: authCheck
      };
    }

    console.log('✅ Authentication successful! Proceeding to subagent creation...');

    // Now navigate directly to subagent creation page
    console.log('📍 Navigating to subagent management page...');
    await page.goto('https://www.ratehawk.com/my/settings/?tab=sub_agents', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Analyze the subagent page
    const subagentPageAnalysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        isSettingsPage: window.location.href.includes('/my/settings/'),
        hasSubagentTab: document.body.innerText.toLowerCase().includes('sub') && 
                       document.body.innerText.toLowerCase().includes('agent'),
        addButtons: Array.from(document.querySelectorAll('button, a')).filter(btn => {
          const text = (btn.innerText || '').toLowerCase();
          return text.includes('add') || text.includes('create') || text.includes('new');
        }).map(btn => ({
          text: btn.innerText.substring(0, 50),
          tag: btn.tagName,
          class: btn.className,
          href: btn.href || null
        })),
        allButtons: Array.from(document.querySelectorAll('button, a')).map(btn => ({
          text: btn.innerText.substring(0, 30),
          tag: btn.tagName
        })).slice(0, 20),
        bodyPreview: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('📄 Subagent Page Analysis:', JSON.stringify(subagentPageAnalysis, null, 2));

    // Look for the "Add Subagent" functionality
    if (!subagentPageAnalysis.isSettingsPage) {
      return {
        success: false,
        error: 'Did not reach settings page - may need different navigation',
        subagentPageAnalysis: subagentPageAnalysis
      };
    }

    // Try to find and click the add subagent button
    console.log('🔍 Looking for add subagent functionality...');
    const addButtonSearch = await page.evaluate(() => {
      // Look for buttons/links with subagent-related text
      const allClickable = document.querySelectorAll('button, a, [onclick], [class*="btn"]');
      
      for (const element of allClickable) {
        const text = (element.innerText || element.textContent || '').toLowerCase();
        const className = (element.className || '').toLowerCase();
        
        // Check for add subagent related text
        if ((text.includes('add') && (text.includes('subagent') || text.includes('sub-agent') || text.includes('agent'))) ||
            (text.includes('create') && text.includes('agent')) ||
            text.includes('new agent') ||
            className.includes('add') && className.includes('agent')) {
          
          // Try to click it
          element.click();
          return {
            success: true,
            clickedText: text.substring(0, 50),
            clickedElement: element.tagName,
            clickedClass: element.className
          };
        }
      }
      
      // If no specific button found, look for any "Add" button
      for (const element of allClickable) {
        const text = (element.innerText || element.textContent || '').toLowerCase();
        if (text.trim() === 'add' || text.includes('add new') || text.includes('create new')) {
          element.click();
          return {
            success: true,
            clickedText: text.substring(0, 50),
            clickedElement: element.tagName,
            fallback: true
          };
        }
      }
      
      return {
        success: false,
        error: 'No add button found'
      };
    });

    console.log('🖱️ Add Button Search:', JSON.stringify(addButtonSearch, null, 2));

    if (!addButtonSearch.success) {
      // Take a screenshot to see what's actually on the page
      try {
        await page.screenshot({ path: 'subagent-page.png', fullPage: true });
        console.log('📸 Screenshot saved: subagent-page.png');
      } catch (e) {}
      
      return {
        success: false,
        error: 'Could not find add subagent button',
        subagentPageAnalysis: subagentPageAnalysis,
        addButtonSearch: addButtonSearch,
        suggestion: 'Check subagent-page.png screenshot to see the actual page layout'
      };
    }

    // Wait for any modal/form to appear
    console.log('⏳ Waiting for subagent creation form...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check what appeared after clicking
    const afterClickAnalysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        hasModal: !!document.querySelector('.modal, [class*="modal"], .popup, [class*="popup"]'),
        hasForm: !!document.querySelector('form'),
        newInputs: Array.from(document.querySelectorAll('input')).map(inp => ({
          name: inp.name,
          type: inp.type,
          placeholder: inp.placeholder,
          visible: inp.offsetParent !== null
        })).filter(inp => inp.visible),
        visibleText: document.body.innerText.substring(0, 800)
      };
    });

    console.log('📋 After Click Analysis:', JSON.stringify(afterClickAnalysis, null, 2));

    // For now, return success with the current progress
    return {
      success: true,
      message: 'Successfully authenticated and reached subagent management area',
      progress: {
        loginSuccessful: true,
        reachedSettingsPage: true,
        foundAddButton: addButtonSearch.success,
        nextStep: 'Form filling automation needed'
      },
      authCheck: authCheck,
      subagentPageAnalysis: subagentPageAnalysis,
      addButtonSearch: addButtonSearch,
      afterClickAnalysis: afterClickAnalysis,
      generatedEmail: signupData.generatedEmail,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('💥 Signup automation error:', error.message);
    
    return {
      success: false,
      error: `Signup automation failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
    console.log('===== END RATEHAWK SIGNUP =====');
  }
}

/**
 * Generate a unique email for RateHawk signup
 */
function generateRateHawkEmail(userId) {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `rh_${userId}_${timestamp}_${randomSuffix}@sandbox9692cf05acbb4af6b12bec82387cae21.mailgun.org`;
}

/**
 * Password reset automation for newly created account
 */
async function resetRateHawkPassword(email, newPassword) {
  console.log('===== STARTING PASSWORD RESET =====');
  console.log(`📧 Email: ${email}`);
  
  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://production-sfo.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&--window-size=1920,1080`
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://www.ratehawk.com/accounts/login/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    await page.waitForSelector('a[href*="reset"], a[href*="forgot"], .forgot-password', { timeout: 15000 });
    await page.click('a[href*="reset"], a[href*="forgot"], .forgot-password');

    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 15000 });

    await page.evaluate((email) => {
      const emailInput = document.querySelector('input[name="email"], input[type="email"]');
      if (emailInput) {
        emailInput.focus();
        emailInput.value = email;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, email);

    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
      } else {
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });

    console.log('✅ Password reset email requested');
    
    return {
      success: true,
      email: email,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('💥 Password reset error:', error.message);
    return {
      success: false,
      error: error.message,
      email: email
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('===== END PASSWORD RESET =====');
  }
}

module.exports = {
  createRateHawkSubagent,
  generateRateHawkEmail,
  resetRateHawkPassword
};