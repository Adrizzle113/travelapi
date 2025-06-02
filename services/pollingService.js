// ================================
// POLLING SERVICE
// Handles search result polling from RateHawk
// ================================

const {
  buildPollingHeaders,
  transformHotelData,
  createDelay,
  handleAPIError
} = require('../utils');

/**
 * Poll search results from RateHawk API
 */
async function pollSearchResults(searchSessionId, cookies, maxAttempts = 15) {
  console.log('🔄 Starting search result polling...');
  console.log('🔗 Session ID:', searchSessionId);
  console.log('🔢 Max attempts:', maxAttempts);
  
  let allHotels = [];
  let totalHotels = 0;
  let availableHotels = 0;
  let metadata = {};
  let searchComplete = false;
  
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`📡 Polling attempt ${attempt}/${maxAttempts}...`);
      
      const pollUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/serp?session=${searchSessionId}`;
      console.log('🌐 Polling URL:', pollUrl);
      
      const response = await fetch(pollUrl, {
        method: 'GET',
        headers: buildPollingHeaders(cookies)
      });
      
      console.log(`📨 Polling response ${attempt}: ${response.status}`);
      
      if (!response.ok) {
        console.log(`⚠️ Non-OK response: ${response.status} ${response.statusText}`);
        await createDelay(attempt, 2000);
        continue;
      }
      
      const data = await response.json();
      console.log(`📊 Polling response ${attempt}:`, JSON.stringify(data, null, 2));
      
      // ✅ ENHANCED: Handle different error types
      if (data.error) {
        console.log(`⚠️ Polling error in attempt ${attempt}:`, data.error);
        
        // Handle EOF as search completion
        if (data.error === 'EOF' || data.err?.code === 'invalid_request_format') {
          console.log('✅ Search completed - EOF indicates search finished');
          console.log('📊 Final status: Search completed, using accumulated results');
          searchComplete = true;
          break;
        }
        
        // Handle other specific errors
        if (data.error === 'session_expired' || data.error === 'invalid_session') {
          console.log('❌ Session expired during polling');
          break;
        }
        
        // Handle timeout errors
        if (data.error === 'timeout' || data.error === 'request_timeout') {
          console.log('⏰ Polling timeout, continuing...');
          await createDelay(attempt, 3000);
          continue;
        }
        
        // For other errors, continue polling for a few more attempts
        if (attempt < maxAttempts - 3) {
          console.log('🔄 Continuing polling despite error...');
          await createDelay(attempt, 2000);
          continue;
        } else {
          console.log('❌ Too many errors, stopping polling');
          break;
        }
      }
      
      // ✅ ENHANCED: Process successful response data
      if (data.data) {
        const responseData = data.data;
        
        // Update counters from response
        if (typeof responseData.total_hotels === 'number') {
          totalHotels = responseData.total_hotels;
          console.log('📊 Updated total hotels:', totalHotels);
        }
        
        if (typeof responseData.available_hotels === 'number') {
          availableHotels = responseData.available_hotels;
          console.log('📊 Updated available hotels:', availableHotels);
        }
        
        // Collect new hotels
        if (responseData.hotels && Array.isArray(responseData.hotels) && responseData.hotels.length > 0) {
          const newHotels = responseData.hotels;
          console.log(`📨 Received ${newHotels.length} new hotels in attempt ${attempt}`);
          
          // Add new hotels to collection (avoid duplicates)
          newHotels.forEach(hotel => {
            const hotelId = hotel.id || hotel.hotel_id;
            const existingHotel = allHotels.find(h => (h.id || h.hotel_id) === hotelId);
            if (!existingHotel) {
              allHotels.push(hotel);
            }
          });
          
          console.log(`🏨 Total unique hotels collected: ${allHotels.length}`);
        } else {
          console.log(`📭 No hotels in response ${attempt}`);
        }
        
        // ✅ ENHANCED: Check completion status
        if (responseData.search_finished === true || 
            responseData.finished === true || 
            responseData.complete === true) {
          console.log('✅ Search marked as finished by RateHawk');
          searchComplete = true;
          break;
        }
        
        // Check if we have results and no more are coming
        if (allHotels.length > 0 && 
            (!responseData.hotels || responseData.hotels.length === 0) &&
            attempt > 5) {
          console.log('✅ No new hotels received, search appears complete');
          searchComplete = true;
          break;
        }
        
        // Store metadata
        if (responseData.metadata) {
          metadata = { ...metadata, ...responseData.metadata };
        }
      } else {
        console.log(`📭 No data in response ${attempt}`);
      }
      
      // ✅ ENHANCED: Smart completion detection
      // If we have good results and it's taking too long, consider it complete
      if (allHotels.length > 0 && attempt > 8) {
        console.log('⏰ Good results collected, considering search complete');
        searchComplete = true;
        break;
      }
      
      // Wait before next attempt (with exponential backoff)
      if (attempt < maxAttempts && !searchComplete) {
        await createDelay(attempt, 2000);
      }
      
    } catch (fetchError) {
      console.error(`💥 Polling attempt ${attempt} failed:`, fetchError.message);
      
      // Continue polling on network errors, but with longer delay
      if (attempt < maxAttempts - 2) {
        console.log('🔄 Network error, retrying with longer delay...');
        await createDelay(attempt, 3000);
        continue;
      } else {
        console.log('❌ Too many network errors, stopping polling');
        break;
      }
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ Polling completed after ${duration}ms (${Math.round(duration/1000)}s)`);
  console.log('📊 Final polling results:', {
    hotelsCollected: allHotels.length,
    totalHotels: totalHotels,
    availableHotels: availableHotels,
    searchComplete: searchComplete,
    duration: `${Math.round(duration/1000)}s`
  });
  
  return {
    hotels: allHotels,
    totalHotels: totalHotels,
    availableHotels: availableHotels,
    metadata: {
      ...metadata,
      pollingAttempts: maxAttempts,
      duration: duration,
      searchComplete: searchComplete
    }
  };
}

/**
 * Poll single search result
 */
async function pollSingleResult(searchSessionId, cookies, timeout = 30000) {
  console.log('🔍 Polling single result...');
  
  const startTime = Date.now();
  
  try {
    const pollUrl = `https://www.ratehawk.com/hotel/search/v2/b2bsite/serp?session=${searchSessionId}`;
    
    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: buildPollingHeaders(cookies),
      signal: AbortSignal.timeout(timeout)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      data: data,
      duration: duration,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: error.message,
      duration: duration,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Test polling connectivity
 */
async function testPollingConnectivity(cookies) {
  console.log('🧪 Testing polling connectivity...');
  
  // Use a dummy session ID for testing
  const testSessionId = 'test-session-' + Date.now();
  
  try {
    const result = await pollSingleResult(testSessionId, cookies, 5000);
    
    return {
      success: true,
      canConnect: result.success,
      responseReceived: !!result.data,
      error: result.error || null,
      duration: result.duration,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced polling with retry logic
 */
async function pollWithRetry(searchSessionId, cookies, options = {}) {
  const {
    maxAttempts = 15,
    initialDelay = 2000,
    maxDelay = 10000,
    retryOnError = true,
    timeoutPerAttempt = 30000
  } = options;
  
  console.log('🔄 Starting enhanced polling with retry...');
  
  let lastError = null;
  
  for (let retry = 1; retry <= 3; retry++) {
    try {
      console.log(`🔄 Polling retry ${retry}/3...`);
      
      const result = await pollSearchResults(searchSessionId, cookies, maxAttempts);
      
      // If we got some results, consider it successful
      if (result.hotels.length > 0 || result.totalHotels > 0) {
        console.log('✅ Polling successful with results');
        return result;
      }
      
      // If no results but no error, still return the result
      console.log('✅ Polling completed without errors (no results found)');
      return result;
      
    } catch (error) {
      console.error(`💥 Polling retry ${retry} failed:`, error);
      lastError = error;
      
      if (!retryOnError || retry === 3) {
        break;
      }
      
      // Wait before retry
      await createDelay(retry, 5000);
    }
  }
  
  // If all retries failed, return error result
  console.error('❌ All polling retries failed');
  return handleAPIError(lastError, 'Polling with Retry');
}

module.exports = {
  pollSearchResults,
  pollSingleResult,
  testPollingConnectivity,
  pollWithRetry
};