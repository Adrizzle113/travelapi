import axios from 'axios';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 1000;
const DEFAULT_MAX_DELAY = 10000;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const RETRYABLE_ERROR_CODES = ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt, initialDelay, maxDelay) {
  const exponentialDelay = initialDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

function isRetryable(error) {
  if (!error) return false;

  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }

  if (error.response && RETRYABLE_STATUS_CODES.includes(error.response.status)) {
    return true;
  }

  return false;
}

export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelay = DEFAULT_INITIAL_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    onRetry = null,
    context = 'operation'
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoffDelay = calculateBackoff(attempt - 1, initialDelay, maxDelay);
        console.log(`⏳ [${context}] Retry ${attempt}/${maxRetries} after ${Math.round(backoffDelay)}ms`);

        if (onRetry) {
          onRetry(attempt, backoffDelay);
        }

        await delay(backoffDelay);
      }

      const result = await fn();

      if (attempt > 0) {
        console.log(`✅ [${context}] Succeeded on retry ${attempt}/${maxRetries}`);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (!isRetryable(error)) {
        console.log(`❌ [${context}] Non-retryable error: ${error.message}`);
        throw error;
      }

      if (attempt === maxRetries) {
        console.log(`❌ [${context}] Max retries (${maxRetries}) exceeded`);
        break;
      }

      const statusCode = error.response?.status || 'N/A';
      const errorCode = error.code || 'N/A';
      console.log(`⚠️ [${context}] Attempt ${attempt + 1} failed (status: ${statusCode}, code: ${errorCode})`);
    }
  }

  const enhancedError = new Error(`${context} failed after ${maxRetries} retries: ${lastError.message}`);
  enhancedError.originalError = lastError;
  enhancedError.retries = maxRetries;
  throw enhancedError;
}

export function createAxiosWithRetry(baseConfig = {}) {
  const instance = axios.create(baseConfig);

  instance.interceptors.response.use(
    response => response,
    async error => {
      const config = error.config;

      if (!config || config.__isRetryRequest) {
        return Promise.reject(error);
      }

      if (!isRetryable(error)) {
        return Promise.reject(error);
      }

      const retryCount = config.__retryCount || 0;
      const maxRetries = config.maxRetries || DEFAULT_MAX_RETRIES;

      if (retryCount >= maxRetries) {
        console.log(`❌ Max retries (${maxRetries}) reached for ${config.url}`);
        return Promise.reject(error);
      }

      config.__retryCount = retryCount + 1;
      config.__isRetryRequest = true;

      const backoffDelay = calculateBackoff(retryCount, DEFAULT_INITIAL_DELAY, DEFAULT_MAX_DELAY);
      console.log(`⏳ Retrying request to ${config.url} (${config.__retryCount}/${maxRetries}) after ${Math.round(backoffDelay)}ms`);

      await delay(backoffDelay);

      return instance(config);
    }
  );

  return instance;
}

export function attachRetryToRequest(req, res, next) {
  req.retry = (fn, options) => retryWithBackoff(fn, {
    ...options,
    context: options?.context || `${req.method} ${req.path}`
  });

  next();
}

export default {
  retryWithBackoff,
  createAxiosWithRetry,
  attachRetryToRequest
};
