export const ErrorCategories = {
  VALIDATION: 'validation_error',
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit_exceeded',
  EXTERNAL_API: 'external_api_error',
  DATABASE: 'database_error',
  TIMEOUT: 'timeout_error',
  SERVER: 'server_error',
  NETWORK: 'network_error'
};

export const ErrorMessages = {
  [ErrorCategories.VALIDATION]: 'The request contains invalid data',
  [ErrorCategories.AUTHENTICATION]: 'Authentication required',
  [ErrorCategories.AUTHORIZATION]: 'You do not have permission to access this resource',
  [ErrorCategories.NOT_FOUND]: 'The requested resource was not found',
  [ErrorCategories.RATE_LIMIT]: 'Too many requests. Please try again later',
  [ErrorCategories.EXTERNAL_API]: 'External service is temporarily unavailable',
  [ErrorCategories.DATABASE]: 'Database operation failed',
  [ErrorCategories.TIMEOUT]: 'Request timed out. Please try again',
  [ErrorCategories.SERVER]: 'An unexpected error occurred',
  [ErrorCategories.NETWORK]: 'Network connection failed'
};

export const RetryableErrors = new Set([
  ErrorCategories.TIMEOUT,
  ErrorCategories.EXTERNAL_API,
  ErrorCategories.NETWORK
]);

export class ApiError extends Error {
  constructor(category, message, statusCode = 500, details = null, isRetryable = false) {
    super(message);
    this.name = 'ApiError';
    this.category = category;
    this.statusCode = statusCode;
    this.details = details;
    this.isRetryable = isRetryable;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: {
        category: this.category,
        message: this.message,
        statusCode: this.statusCode,
        isRetryable: this.isRetryable,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details })
      }
    };
  }
}

export function categorizeError(error) {
  if (!error) {
    return {
      category: ErrorCategories.SERVER,
      statusCode: 500,
      isRetryable: false
    };
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      category: ErrorCategories.TIMEOUT,
      statusCode: 504,
      isRetryable: true,
      message: 'Request timed out. The server may be experiencing high load'
    };
  }

  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
    return {
      category: ErrorCategories.NETWORK,
      statusCode: 503,
      isRetryable: true,
      message: 'Network connection failed. Please check your connection'
    };
  }

  if (error.response) {
    const status = error.response.status;

    if (status === 400) {
      return {
        category: ErrorCategories.VALIDATION,
        statusCode: 400,
        isRetryable: false,
        message: error.response.data?.message || 'Invalid request parameters'
      };
    }

    if (status === 401) {
      return {
        category: ErrorCategories.AUTHENTICATION,
        statusCode: 401,
        isRetryable: false,
        message: 'Authentication required'
      };
    }

    if (status === 403) {
      return {
        category: ErrorCategories.AUTHORIZATION,
        statusCode: 403,
        isRetryable: false,
        message: 'Access denied'
      };
    }

    if (status === 404) {
      return {
        category: ErrorCategories.NOT_FOUND,
        statusCode: 404,
        isRetryable: false,
        message: 'Resource not found'
      };
    }

    if (status === 429) {
      return {
        category: ErrorCategories.RATE_LIMIT,
        statusCode: 429,
        isRetryable: true,
        message: 'Rate limit exceeded. Please try again later'
      };
    }

    if (status >= 500) {
      return {
        category: ErrorCategories.EXTERNAL_API,
        statusCode: 503,
        isRetryable: true,
        message: 'External service temporarily unavailable'
      };
    }
  }

  if (error.name === 'PrismaClientKnownRequestError' || error.name === 'PrismaClientInitializationError') {
    return {
      category: ErrorCategories.DATABASE,
      statusCode: 503,
      isRetryable: false,
      message: 'Database operation failed'
    };
  }

  if (error.message && error.message.toLowerCase().includes('timeout')) {
    return {
      category: ErrorCategories.TIMEOUT,
      statusCode: 504,
      isRetryable: true,
      message: 'Operation timed out'
    };
  }

  return {
    category: ErrorCategories.SERVER,
    statusCode: 500,
    isRetryable: false,
    message: error.message || 'An unexpected error occurred'
  };
}

export function formatErrorResponse(error, requestId = null) {
  const categorized = categorizeError(error);

  const response = {
    success: false,
    error: {
      category: categorized.category,
      message: categorized.message,
      statusCode: categorized.statusCode,
      isRetryable: categorized.isRetryable,
      timestamp: new Date().toISOString()
    }
  };

  if (requestId) {
    response.error.requestId = requestId;
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.error.stack = error.stack;
  }

  if (categorized.isRetryable) {
    response.error.retryAfter = categorized.category === ErrorCategories.RATE_LIMIT ? 60 : 5;
    response.error.suggestion = 'This is a temporary error. Please try again in a few moments';
  }

  return response;
}

export function handleApiError(error, req, res) {
  const requestId = req.requestId || 'unknown';
  const errorResponse = formatErrorResponse(error, requestId);

  console.error(`🚨 API Error [${requestId}]:`, {
    category: errorResponse.error.category,
    message: errorResponse.error.message,
    path: req.path,
    method: req.method,
    statusCode: errorResponse.error.statusCode
  });

  res.status(errorResponse.error.statusCode).json(errorResponse);
}

export default {
  ApiError,
  ErrorCategories,
  ErrorMessages,
  RetryableErrors,
  categorizeError,
  formatErrorResponse,
  handleApiError
};
