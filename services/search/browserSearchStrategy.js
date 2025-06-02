// ================================
// BROWSER SEARCH STRATEGY
// Browser automation for complex searches
// ================================

const puppeteer = require('puppeteer-core');
const {
  formatGuestsForRateHawk,
  getDestinationInfo,
  validateSearchParams,
  validateUserSession,
  handleAPIError,
  createSuccessResponse,
  delay
} = require('../utils');

/**
 * Execute hotel search using browser automation
 */
async function executeBrowserSearch(searchParams) {
  console.log('🌐 Starting browser search strategy...');
  
  const { userSession, destination, checkin, checkout, guests, residency, currency } = searchParams;
  
  // Validate inputs
  const sessionValidation = validateUserSession(userSession);
  if (!sessionValidation.isValid) {
    return handleAPIError(new Error(sessionValidation.error), 'Session Validation');
  }
  
  const paramValidation = validateSearchParams({ destination, checkin, checkout, guests });
  if (!paramValidation.isValid) {
    return handleAPIError(new Error(paramValidation.errors.join(', ')), 'Parameter Validation');
  }
  
  let browser;
  try {
    // Format data
    const formattedGuests = formatGuestsForRateHawk(guests);
    const destinationInfo = getDestinationInfo(destination);
    
    console.log('🚀 Connecting to Browserless...');
    
    // Connect to Browserless
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&--window-size=1920,1080`
    });
    
    const page = await browser.newPage();
    
    // Set cookies from user session
    if (userSession.cookies && userSession.cookies.length > 0) {
      console.log('🍪 Setting session cookies...');
      await page.setCookie(...userSession.cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.ratehawk.com',
        path: cookie.path || '/'
      })));
    }
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36');
    
    console.log('📍 Navigating to RateHawk search page...');
    
    // Navigate to RateHawk search page
    await page.goto('https://www.ratehawk.com/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for search form
    console.log('⏳ Waiting for search form...');
    await page.waitForSelector('[data-testid="destination-input"], #destination, input[name="destination"]', { 
      timeout: 15000 
    });
    
    console.log('✍️ Filling search form...');
    
    // Fill destination
    const destinationSelector = '[data-testid="destination-input"], #destination, input[name="destination"]';
    await page.click(destinationSelector);
    await page.keyboard.selectAll();
    await page.type(destinationSelector, destinationInfo.name);
    await delay(1000);
    
    // Select destination from dropdown if available
    try {
      const dropdownOption = await page.$(`[data-value="${destinationInfo.id}"], .destination-option:contains("${destinationInfo.name}")`);
      if (dropdownOption) {
        await dropdownOption.click();
        await delay(1000);
      }
    } catch (e) {
      console.log('📝 Destination dropdown not found, continuing...');
    }
    
    // Fill check-in date
    const checkinSelector = '[data-testid="checkin-input"], #checkin, input[name="checkin"]';
    await page.click(checkinSelector);
    await page.keyboard.selectAll();
    await page.type(checkinSelector, checkin);
    await delay(500);
    
    // Fill check-out date
    const checkoutSelector = '[data-testid="checkout-input"], #checkout, input[name="checkout"]';
    await page.click(checkoutSelector);
    await page.keyboard.selectAll();
    await page.type(checkoutSelector, checkout);
    await delay(500);
    
    // Handle guests
    if (formattedGuests.length > 0) {
      const guestsSelector = '[data-testid="guests-input"], #guests, input[name="guests"]';
      try {
        await page.click(guestsSelector);
        await delay(500);
        
        // Set number of guests
        const totalGuests = formattedGuests.reduce((sum, room) => sum + room.adults, 0);
        await page.keyboard.selectAll();
        await page.type(guestsSelector, totalGuests.toString());
        await delay(500);
      } catch (e) {
        console.log('👥 Guests input not found, using default...');
      }
    }
    
    console.log('🔍 Submitting search...');
    
    // Submit search
    const searchButtonSelector = '[data-testid="search-button"], button[type="submit"], .search-button, #search';
    await page.click(searchButtonSelector);
    
    // Wait for search results or search completion
    console.log('⏳ Waiting for search results...');
    
    let searchResults = [];
    let searchComplete = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (!searchComplete && attempts < maxAttempts) {
      attempts++;
      await delay(1000);
      
      try {
        // Check if search is complete
        const hasResults = await page.$('.hotel-result, .hotel-card, [data-testid="hotel-item"]');
        const hasNoResults = await page.$('.no-results, .no-hotels, [data-testid="no-results"]');
        const hasError = await page.$('.error-message, .search-error');
        
        if (hasResults) {
          console.log('✅ Hotel results found, extracting data...');
          
          // Extract hotel data
          searchResults = await page.evaluate(() => {
            const hotels = [];
            const hotelElements = document.querySelectorAll('.hotel-result, .hotel-card, [data-testid="hotel-item"]');
            
            hotelElements.forEach((element, index) => {
              try {
                const nameElement = element.querySelector('.hotel-name, .hotel-title, h3, h4');
                const priceElement = element.querySelector('.price, .hotel-price, .rate');
                const ratingElement = element.querySelector('.rating, .stars, .hotel-rating');
                const imageElement = element.querySelector('img');
                
                const hotel = {
                  id: element.getAttribute('data-hotel-id') || index.toString(),
                  name: nameElement ? nameElement.textContent.trim() : `Hotel ${index + 1}`,
                  price: priceElement ? priceElement.textContent.trim() : 'Price not available',
                  rating: ratingElement ? ratingElement.textContent.trim() : '0',
                  image: imageElement ? imageElement.src : '/placeholder-hotel.jpg',
                  location: 'Location from browser'
                };
                
                hotels.push(hotel);
              } catch (e) {
                console.log('Error extracting hotel data:', e);
              }
            });
            
            return hotels;
          });
          
          searchComplete = true;
        } else if (hasNoResults) {
          console.log('📭 No results found');
          searchComplete = true;
        } else if (hasError) {
          const errorMessage = await page.$eval('.error-message, .search-error', el => el.textContent);
          throw new Error(`Search error: ${errorMessage}`);
        }
        
        // Check for search progress indicators
        const searchInProgress = await page.$('.searching, .loading, .search-progress');
        if (!searchInProgress && attempts > 10) {
          console.log('⏰ Search appears to be complete (no progress indicators)');
          searchComplete = true;
        }
        
      } catch (e) {
        console.log(`🔄 Search check attempt ${attempts}:`, e.message);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('⏰ Search timeout reached');
    }
    
    console.log(`✅ Browser search completed: ${searchResults.length} hotels found`);
    
    return createSuccessResponse({
      hotels: searchResults,
      totalHotels: searchResults.length,
      availableHotels: searchResults.length,
      searchSessionId: `browser_${Date.now()}`,
      searchParams: {
        destination: destinationInfo.name,
        destinationId: destinationInfo.id,
        guests: formattedGuests,
        checkin: checkin,
        checkout: checkout
      },
      metadata: {
        strategy: 'browser',
        attempts: attempts,
        duration: `${attempts}s`
      }
    });
    
  } catch (error) {
    console.error('💥 Browser search failed:', error);
    return handleAPIError(error, 'Browser Search');
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

/**
 * Test browser connectivity
 */
async function testBrowserConnectivity() {
  let browser;
  try {
    console.log('🧪 Testing browser connectivity...');
    
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&timeout=30000`
    });
    
    const page = await browser.newPage();
    await page.goto('https://www.ratehawk.com/', { timeout: 15000 });
    
    const title = await page.title();
    
    return {
      success: true,
      title: title,
      browserless: !!process.env.BROWSERLESS_TOKEN,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      browserless: !!process.env.BROWSERLESS_TOKEN,
      timestamp: new Date().toISOString()
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  executeBrowserSearch,
  testBrowserConnectivity
};