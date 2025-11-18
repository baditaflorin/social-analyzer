/**
 * Secure Error Handling Module
 * Provides non-leaking error messages and proper error logging
 * Implements least-privilege error disclosure
 */

import fs from 'fs';
import path from 'path';
import { get as getConfig } from './config.js';

/**
 * Application error types
 */
const ErrorTypes = {
  VALIDATION: 'validation_error',
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit_exceeded',
  INTERNAL: 'internal_error',
  CONFIGURATION: 'configuration_error',
  NETWORK: 'network_error',
  TIMEOUT: 'timeout_error'
};

/**
 * Application error class
 */
class AppError extends Error {
  constructor(type, message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Creates a safe error response for the client
 * Hides internal details in production
 */
function createErrorResponse(err, req = null) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const verbose = getConfig('VERBOSE');

  // Default safe response
  const response = {
    error: true,
    message: 'An error occurred',
    type: ErrorTypes.INTERNAL,
    timestamp: new Date().toISOString()
  };

  // Handle validation errors (safe to expose)
  if (err.name === 'ValidationError') {
    response.message = err.userMessage || err.message;
    response.type = ErrorTypes.VALIDATION;
    response.statusCode = 400;
    return response;
  }

  // Handle application errors
  if (err instanceof AppError) {
    response.message = err.message;
    response.type = err.type;
    response.statusCode = err.statusCode;

    // Include details only in development
    if (isDevelopment && err.details) {
      response.details = err.details;
    }

    return response;
  }

  // Handle known error types with safe messages
  if (err.code === 'ECONNREFUSED') {
    response.message = 'Service temporarily unavailable';
    response.type = ErrorTypes.NETWORK;
    response.statusCode = 503;
    return response;
  }

  if (err.code === 'ETIMEDOUT' || err.name === 'TimeoutError') {
    response.message = 'Request timeout';
    response.type = ErrorTypes.TIMEOUT;
    response.statusCode = 504;
    return response;
  }

  if (err.code === 'ENOENT') {
    response.message = 'Resource not found';
    response.type = ErrorTypes.NOT_FOUND;
    response.statusCode = 404;
    return response;
  }

  // For unknown errors, log but don't expose
  if (isDevelopment || verbose) {
    response.message = err.message;
    response.stack = err.stack;
    response.details = {
      name: err.name,
      code: err.code
    };
  }

  response.statusCode = err.statusCode || 500;

  return response;
}

/**
 * Logs error to file and console
 */
function logError(err, req = null, context = {}) {
  const verbose = getConfig('VERBOSE');
  const enableFileLogging = getConfig('ENABLE_FILE_LOGGING');
  const logLevel = getConfig('LOG_LEVEL');

  // Skip logging if log level is error and this is a warning
  if (logLevel === 'error' && context.level !== 'error') {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: context.level || 'error',
    message: err.message,
    type: err.type || 'unknown',
    name: err.name,
    code: err.code,
    statusCode: err.statusCode
  };

  // Add request context if available
  if (req) {
    logEntry.request = {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: getClientIp(req),
      userAgent: req.get('user-agent')
    };

    // Don't log sensitive headers
    const safeHeaders = { ...req.headers };
    delete safeHeaders.authorization;
    delete safeHeaders.cookie;
    logEntry.headers = safeHeaders;
  }

  // Add custom context
  if (context && Object.keys(context).length > 0) {
    logEntry.context = context;
  }

  // Add stack trace in development/verbose mode
  if (verbose || process.env.NODE_ENV !== 'production') {
    logEntry.stack = err.stack;
  }

  // Console logging
  if (verbose) {
    console.error('--- Error Log ---');
    console.error(JSON.stringify(logEntry, null, 2));
    console.error('-----------------');
  }

  // File logging
  if (enableFileLogging) {
    try {
      const logDir = path.resolve(getConfig('LOG_DIR'));
      const logFile = path.join(logDir, 'error.log');

      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (fileErr) {
      console.error('Failed to write error log:', fileErr.message);
    }
  }
}

/**
 * Gets client IP address from request
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Express error handling middleware
 */
function errorMiddleware(err, req, res, next) {
  // Log the error
  logError(err, req);

  // Create safe response
  const errorResponse = createErrorResponse(err, req);

  // Send response
  res.status(errorResponse.statusCode || 500).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler middleware
 */
function notFoundHandler(req, res) {
  const error = new AppError(
    ErrorTypes.NOT_FOUND,
    'Endpoint not found',
    404
  );

  logError(error, req, { level: 'warn' });

  res.status(404).json(createErrorResponse(error, req));
}

/**
 * Handles uncaught exceptions
 */
function handleUncaughtException(err) {
  console.error('--- Uncaught Exception ---');
  console.error(err);

  logError(err, null, {
    level: 'critical',
    type: 'uncaught_exception'
  });

  // Give time for log to write, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

/**
 * Handles unhandled promise rejections
 */
function handleUnhandledRejection(reason, promise) {
  const err = reason instanceof Error ? reason : new Error(String(reason));

  console.error('--- Unhandled Rejection ---');
  console.error(err);

  logError(err, null, {
    level: 'critical',
    type: 'unhandled_rejection',
    promise: String(promise)
  });
}

/**
 * Registers global error handlers
 */
function registerGlobalHandlers() {
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}

/**
 * Creates validation error
 */
function validationError(field, message) {
  return new AppError(
    ErrorTypes.VALIDATION,
    message,
    400,
    { field }
  );
}

/**
 * Creates not found error
 */
function notFoundError(resource) {
  return new AppError(
    ErrorTypes.NOT_FOUND,
    `${resource} not found`,
    404
  );
}

/**
 * Creates rate limit error
 */
function rateLimitError(retryAfter = null) {
  const details = retryAfter ? { retryAfter } : null;
  return new AppError(
    ErrorTypes.RATE_LIMIT,
    'Too many requests, please try again later',
    429,
    details
  );
}

/**
 * Creates internal error
 */
function internalError(message = 'Internal server error') {
  return new AppError(
    ErrorTypes.INTERNAL,
    message,
    500
  );
}

/**
 * Creates configuration error
 */
function configurationError(message) {
  return new AppError(
    ErrorTypes.CONFIGURATION,
    message,
    500
  );
}

/**
 * Creates network error
 */
function networkError(message = 'Network request failed') {
  return new AppError(
    ErrorTypes.NETWORK,
    message,
    503
  );
}

/**
 * Creates timeout error
 */
function timeoutError(message = 'Request timeout') {
  return new AppError(
    ErrorTypes.TIMEOUT,
    message,
    504
  );
}

/**
 * Safe JSON stringify that handles circular references
 */
function safeStringify(obj, indent = 0) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    },
    indent
  );
}

export {
  // Error types
  ErrorTypes,

  // Error classes
  AppError,

  // Middleware
  errorMiddleware,
  asyncHandler,
  notFoundHandler,

  // Error creation
  validationError,
  notFoundError,
  rateLimitError,
  internalError,
  configurationError,
  networkError,
  timeoutError,

  // Error handling
  createErrorResponse,
  logError,
  registerGlobalHandlers,

  // Utilities
  getClientIp,
  safeStringify
};

export default {
  ErrorTypes,
  AppError,
  errorMiddleware,
  asyncHandler,
  notFoundHandler,
  validationError,
  notFoundError,
  rateLimitError,
  internalError,
  configurationError,
  networkError,
  timeoutError,
  createErrorResponse,
  logError,
  registerGlobalHandlers,
  getClientIp,
  safeStringify
};
