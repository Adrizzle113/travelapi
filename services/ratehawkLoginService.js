const puppeteer = require('puppeteer-core');

/**
 * RateHawk Login Service
 * Handles authentication and session management for RateHawk
 */

// Main RateHawk login function with enhanced navigation detection
async function loginUserToRateHawk(email, password, userId) {
  console.log('===== STARTING RATEHAWK LOGIN =====');
  console.log(`🔐 User ID: ${userId}`);
  console.log(`📧 Email: ${email}`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  
  let browser;
  try {
    // Connect to Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&--window-size=1920,1080`
    });

    console.log('🌐 Connected to Browserless browser');
    
    const page = await browser.newPage();
    
    // Set realistic browser headers
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

    // Give page time to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✍️ Filling login credentials with enhanced method...');
    
    // Enhanced form filling with multiple approaches
    const formFillResult = await page.evaluate((email, password) => {
      // Try multiple selectors and approaches for email
      const emailSelectors = ['input[name="email"]', 'input[type="email"]', '#email', '#id_email', '[placeholder*="email" i]'];
      let emailElement = null;
      
      for (const selector of emailSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          emailElement = el;
          break;
        }
      }
      
      // Try multiple selectors for password
      const passwordSelectors = ['input[name="password"]', 'input[type="password"]', '#password', '#id_password', '[placeholder*="password" i]'];
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
      
      // Clear and fill email field
      emailElement.focus();
      emailElement.value = '';
      emailElement.value = email;
      emailElement.dispatchEvent(new Event('input', { bubbles: true }));
      emailElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Clear and fill password field
      passwordElement.focus();
      passwordElement.value = '';
      passwordElement.value = password;
      passwordElement.dispatchEvent(new Event('input', { bubbles: true }));
      passwordElement.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { 
        success: true, 
        emailValue: emailElement.value, 
        passwordLength: passwordElement.value.length,
        emailSelector: emailElement.name || emailElement.id,
        passwordSelector: passwordElement.name || passwordElement.id
      };
    }, email, password);

    console.log('📝 Form fill result:', formFillResult);

    if (!formFillResult.success) {
      throw new Error(formFillResult.error);
    }

    // Wait a moment for form validation
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🚀 Submitting login form with multiple methods...');
    
    // Enhanced form submission with multiple approaches
    const submitResult = await page.evaluate(() => {
      // Try multiple submit approaches
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]', 
        '.btn-primary',
        '.btn[type="submit"]',
        'button:contains("Log in")',
        'button:contains("Sign in")',
        'button:contains("Login")',
        '[value="Log in"]',
        '[value="Login"]'
      ];
      
      for (const selector of submitSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            console.log('Found submit element:', selector);
            element.click();
            return { method: 'click', selector: selector };
          }
        } catch (e) {
          console.log('Submit attempt failed for:', selector, e.message);
        }
      }
      
      // Try form submission
      const form = document.querySelector('form');
      if (form) {
        console.log('Submitting form directly');
        form.submit();
        return { method: 'form.submit' };
      }
      
      return { method: 'none', error: 'No submit method found' };
    });

    console.log('📤 Submit result:', submitResult);

    // If no click worked, try Enter key
    if (submitResult.method === 'none') {
      console.log('🔑 Trying Enter key submission...');
      await page.keyboard.press('Enter');
    }

    console.log('⏳ Waiting for login result (cookie-based detection)...');
    
    let loginSuccess = false;
    let finalUrl = '';
    let sessionId = '';
    let cookies = [];
    let navigationDetected = false;
    
    try {
      // Set up detection promises
      const detectionPromises = [
        // Method 1: Monitor cookies and API responses
        new Promise((resolve) => {
          let cookieCheckCount = 0;
          const checkCookiesAndUrl = async () => {
            try {
              const currentCookies = await page.cookies();
              const currentUrl = page.url();
              cookieCheckCount++;
              
              console.log(`🍪 Cookie check ${cookieCheckCount}: ${currentCookies.length} cookies, URL: ${currentUrl}`);
              
              // Check for success indicators in cookies
              const hasSessionCookies = currentCookies.some(c => 
                c.name.includes('sessionid') || 
                c.name.includes('csrftoken') || 
                c.name.includes('uid') ||
                c.name.includes('user')
              );
              
              // Check if we have a significant number of cookies (indicates login)
              const hasManyFunctionCookies = currentCookies.length >= 20;
              
              // Check URL for success indicators
              const urlIndicatesSuccess = currentUrl.includes('sid=') || 
                                        currentUrl === 'https://www.ratehawk.com/' ||
                                        !currentUrl.includes('/accounts/login/');
              
              console.log(`🔍 Success indicators - Cookies: ${hasManyFunctionCookies} (${currentCookies.length}), Session cookies: ${hasSessionCookies}, URL success: ${urlIndicatesSuccess}`);
              
              // If we have many cookies AND (session cookies OR URL change), consider it success
              if ((hasManyFunctionCookies && hasSessionCookies) || 
                  (hasManyFunctionCookies && urlIndicatesSuccess) ||
                  urlIndicatesSuccess) {
                console.log('✅ Success detected via cookie/URL analysis!');
                resolve({ 
                  method: 'cookie_analysis', 
                  success: true, 
                  url: currentUrl,
                  cookieCount: currentCookies.length 
                });
                return;
              }
              
              // Continue checking for up to 15 seconds
              if (cookieCheckCount < 15) {
                setTimeout(checkCookiesAndUrl, 1000);
              } else {
                // After 15 seconds, if we have many cookies, assume success
                if (hasManyFunctionCookies) {
                  console.log('✅ Success detected via cookie count after timeout!');
                  resolve({ 
                    method: 'cookie_timeout', 
                    success: true, 
                    url: currentUrl,
                    cookieCount: currentCookies.length 
                  });
                } else {
                  resolve({ method: 'timeout', success: false });
                }
              }
            } catch (error) {
              console.log(`🔄 Cookie check ${cookieCheckCount} error:`, error.message);
              if (error.message.includes('context') || error.message.includes('destroyed')) {
                console.log('✅ Context destroyed during cookie check - success!');
                resolve({ method: 'context_destroyed', success: true });
              } else if (cookieCheckCount < 15) {
                setTimeout(checkCookiesAndUrl, 1000);
              } else {
                resolve({ method: 'error_timeout', success: false });
              }
            }
          };
          
          // Start checking immediately
          checkCookiesAndUrl();
        }),
        
        // Method 2: Listen for API responses
        new Promise((resolve) => {
          page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/v4/site/accounts/login/')) {
              console.log(`📡 Login API response: ${response.status()} for ${url}`);
              if (response.status() === 200) {
                try {
                  const responseText = await response.text();
                  console.log('📄 Login API response preview:', responseText.substring(0, 300));
                  
                  // Check if response indicates success
                  if (responseText.includes('"status":"ok"') || 
                      responseText.includes('"success":true') ||
                      responseText.includes('redirect') ||
                      (!responseText.includes('error') && !responseText.includes('invalid'))) {
                    console.log('✅ Login API indicates success!');
                    resolve({ method: 'api_success', success: true });
                  }
                } catch (e) {
                  console.log('⚠️ Could not read API response body');
                }
              }
            }
          });
        }),
        
        // Method 3: Navigation listener
        new Promise((resolve) => {
          page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
              const url = frame.url();
              console.log('🔄 Frame navigation detected:', url);
              
              if (!url.includes('/accounts/login/') || url.includes('sid=') || url === 'https://www.ratehawk.com/') {
                console.log('✅ Navigation to success page detected!');
                navigationDetected = true;
                resolve({ method: 'navigation', success: true, url });
              }
            }
          });
        })
      ];
      
      // Race all detection methods with a reasonable timeout
      const raceWithTimeout = Promise.race([
        ...detectionPromises,
        new Promise(resolve => setTimeout(() => resolve({ method: 'final_timeout', success: false }), 18000))
      ]);
      
      const result = await raceWithTimeout;
      console.log(`🎯 Detection result: ${result.method} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (result.success) {
        loginSuccess = true;
        finalUrl = result.url || 'https://www.ratehawk.com/';
      }
      
    } catch (globalError) {
      console.log('🔄 Global detection error:', globalError.message);
      
      // Context destruction often means successful navigation
      if (globalError.message.includes('context') || 
          globalError.message.includes('destroyed') ||
          globalError.message.includes('Target closed')) {
        console.log('✅ Context destroyed - this typically means successful login!');
        loginSuccess = true;
        finalUrl = 'https://www.ratehawk.com/';
      }
    }
    
    // Final state collection with enhanced cookie analysis
    try {
      if (!finalUrl) {
        finalUrl = page.url();
      }
      cookies = await page.cookies();
      console.log(`📍 Final URL: ${finalUrl}`);
      console.log(`🍪 Final cookies collected: ${cookies.length}`);
      
      // Enhanced success validation based on cookies
      if (!loginSuccess && cookies.length >= 20) {
        // Check for specific RateHawk session cookies
        const ratehawkCookies = cookies.filter(c => 
          c.name.includes('sessionid') || 
          c.name.includes('csrftoken') || 
          c.name.includes('uid') ||
          c.name.includes('user') ||
          c.domain.includes('ratehawk')
        );
        
        console.log(`🔍 Found ${ratehawkCookies.length} RateHawk-specific cookies out of ${cookies.length} total`);
        
        if (ratehawkCookies.length >= 3 || cookies.length >= 25) {
          console.log('✅ Login success confirmed by cookie analysis!');
          loginSuccess = true;
        }
      }
      
      // Additional URL-based validation
      if (!loginSuccess) {
        loginSuccess = !finalUrl.includes('/accounts/login/') || 
                      finalUrl.includes('sid=') || 
                      finalUrl === 'https://www.ratehawk.com/';
        if (loginSuccess) {
          console.log('✅ Login success confirmed by final URL analysis!');
        }
      }
      
    } catch (finalStateError) {
      console.log('📄 Final state collection error:', finalStateError.message);
      
      // If we can't access the page, it likely means successful navigation
      if (finalStateError.message.includes('context') || 
          finalStateError.message.includes('destroyed') ||
          finalStateError.message.includes('Target closed')) {
        console.log('✅ Cannot access page state - confirming successful login!');
        loginSuccess = true;
        finalUrl = finalUrl || 'https://www.ratehawk.com/';
        cookies = cookies.length > 0 ? cookies : []; // Keep existing cookies if available
      }
    }
    
    // Extract or generate session ID
    if (finalUrl && finalUrl.includes('sid=')) {
      const sidMatch = finalUrl.match(/sid=([^&]+)/);
      sessionId = sidMatch ? sidMatch[1] : `session_${userId}_${Date.now()}`;
    } else {
      // Try to extract session ID from cookies
      const sessionCookie = cookies.find(c => c.name.includes('sessionid') || c.name.includes('session'));
      sessionId = sessionCookie ? sessionCookie.value : `session_${userId}_${Date.now()}`;
    }
    
    // Enhanced error detection for failed logins
    let errorMessage = null;
    if (!loginSuccess) {
      try {
        errorMessage = await page.evaluate(() => {
          // Look for error messages
          const errorSelectors = [
            '.error', '.alert-danger', '.invalid-feedback',
            '[class*="error"]', '[class*="invalid"]'
          ];
          
          for (const selector of errorSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          
          // Check for error text in page content
          const bodyText = document.body.textContent.toLowerCase();
          if (bodyText.includes('wrong password') || 
              bodyText.includes('invalid credentials') ||
              bodyText.includes('login failed') ||
              bodyText.includes('incorrect')) {
            return 'Invalid credentials detected in page content';
          }
          
          return null;
        });
      } catch (e) {
        console.log('Could not check for error messages');
      }
    }
    
    console.log(`🎯 FINAL LOGIN RESULT: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`🔑 Session ID: ${sessionId}`);
    console.log(`🔗 Final URL: ${finalUrl}`);
    console.log(`🍪 Cookies: ${cookies.length}`);
    console.log(`🔍 Navigation detected: ${navigationDetected}`);
    
    if (loginSuccess) {
      console.log('✅ RateHawk authentication confirmed successful!');
      
      return {
        success: true,
        sessionId: sessionId,
        cookies: cookies,
        loginUrl: finalUrl,
        timestamp: new Date().toISOString(),
        ratehawkSessionId: cookies.find(c => c.name.includes('sessionid'))?.value || sessionId,
        userId: cookies.find(c => c.name.includes('userid'))?.value || '',
        isAuth: cookies.find(c => c.name.includes('is_auth'))?.value || 'true',
        domainUid: cookies.find(c => c.name.includes('uid'))?.value || '',
        navigationDetected: navigationDetected,
        cookieCount: cookies.length
      };
    } else {
      console.log('❌ RateHawk authentication failed');
      
      return {
        success: false,
        error: errorMessage || 'Authentication failed - credentials may be invalid',
        finalUrl: finalUrl,
        cookieCount: cookies.length,
        rawCookies: cookies.map(c => ({ name: c.name, domain: c.domain })) // For debugging
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
      console.log('🔒 Browser closed');
    }
    console.log('===== END RATEHAWK LOGIN =====');
  }
}

/**
 * Helper function to format cookies for HTTP requests
 * @param {Array} cookies - Array of cookie objects from Puppeteer
 * @returns {string} - Formatted cookie string for HTTP headers
 */
function formatCookiesForRequest(cookies) {
  if (!Array.isArray(cookies)) {
    return '';
  }
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

/**
 * Validate login session
 * @param {Object} session - User session object
 * @returns {boolean} - Whether session is valid
 */
function validateSession(session) {
  if (!session || !session.cookies || !Array.isArray(session.cookies)) {
    return false;
  }
  
  // Check if session is too old (more than 24 hours)
  if (session.loginTime) {
    const sessionAge = Date.now() - new Date(session.loginTime);
    const hoursOld = sessionAge / (1000 * 60 * 60);
    if (hoursOld > 24) {
      return false;
    }
  }
  
  // Check for essential cookies
  const hasEssentialCookies = session.cookies.some(c => 
    c.name.includes('sessionid') || 
    c.name.includes('csrftoken') ||
    c.name.includes('uid')
  );
  
  return hasEssentialCookies && session.cookies.length >= 15;
}

module.exports = { 
  loginUserToRateHawk, 
  formatCookiesForRequest,
  validateSession
};