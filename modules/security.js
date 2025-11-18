/**
 * Security Middleware Module
 * Provides CSRF protection, security headers, and rate limiting
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { doubleCsrf } from 'csrf-csrf';
import { get as getConfig } from './config.js';

/**
 * Configure Helmet security headers
 */
export function setupSecurityHeaders(app) {
  const enableCors = getConfig('ENABLE_CORS');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Required for inline scripts - consider nonces in production
            'https://cdn.jsdelivr.net',
            'https://code.jquery.com',
            'https://cdnjs.cloudflare.com'
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Required for inline styles
            'https://cdn.jsdelivr.net',
            'https://maxcdn.bootstrapcdn.com',
            'https://cdnjs.cloudflare.com'
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          connectSrc: ["'self'"],
          fontSrc: [
            "'self'",
            'https://cdnjs.cloudflare.com',
            'https://maxcdn.bootstrapcdn.com'
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false, // Allow loading external resources
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin images
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
      hidePoweredBy: true
    })
  );

  // CORS setup if enabled
  if (enableCors) {
    const corsOrigins = getConfig('CORS_ORIGINS');
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      next();
    });
  }
}

/**
 * Configure session management
 */
export function setupSession(app) {
  const sessionSecret = getConfig('SESSION_SECRET');
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction, // Require HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      },
      name: 'social-analyzer.sid' // Custom session name
    })
  );
}

/**
 * Configure CSRF protection
 */
export function setupCsrfProtection(app) {
  const {
    generateToken, // Use this in routes to generate a token
    doubleCsrfProtection // Use this middleware to protect routes
  } = doubleCsrf({
    getSecret: () => getConfig('SESSION_SECRET'),
    cookieName: 'x-csrf-token',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      path: '/'
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS']
  });

  // Add CSRF token to response locals for templates
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req, res);
    next();
  });

  // Endpoint to get CSRF token
  app.get('/api/csrf-token', (req, res) => {
    res.json({
      csrfToken: generateToken(req, res)
    });
  });

  return { generateToken, csrfProtection: doubleCsrfProtection };
}

/**
 * Configure rate limiting
 */
export function setupRateLimit(app) {
  const maxRequests = getConfig('RATE_LIMIT_MAX');
  const windowMinutes = getConfig('RATE_LIMIT_WINDOW');
  const verbose = getConfig('VERBOSE');

  // Global rate limiter
  const globalLimiter = rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      error: true,
      message: 'Too many requests from this IP, please try again later',
      type: 'rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      if (verbose) {
        console.warn(`Rate limit exceeded for IP: ${req.ip}`);
      }
      res.status(429).json({
        error: true,
        message: 'Too many requests, please try again later',
        type: 'rate_limit_exceeded',
        retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      });
    }
  });

  // Strict rate limiter for sensitive endpoints
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: {
      error: true,
      message: 'Too many requests to this endpoint, please try again later',
      type: 'rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Analysis rate limiter (more lenient for main functionality)
  const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 analysis requests per 15 minutes
    message: {
      error: true,
      message: 'Too many analysis requests, please try again later',
      type: 'rate_limit_exceeded'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
  });

  // Apply global rate limiter
  app.use(globalLimiter);

  return {
    globalLimiter,
    strictLimiter,
    analysisLimiter
  };
}

/**
 * Setup all security middleware
 */
export function setupSecurity(app) {
  // Security headers
  setupSecurityHeaders(app);

  // Session management
  setupSession(app);

  // CSRF protection
  const { generateToken, csrfProtection } = setupCsrfProtection(app);

  // Rate limiting
  const { globalLimiter, strictLimiter, analysisLimiter } = setupRateLimit(app);

  return {
    generateToken,
    csrfProtection,
    globalLimiter,
    strictLimiter,
    analysisLimiter
  };
}

/**
 * Request sanitization middleware
 * Removes potentially dangerous characters from request parameters
 */
export function sanitizeRequest(req, res, next) {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        // Remove null bytes
        req.query[key] = req.query[key].replace(/\0/g, '');
      }
    }
  }

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remove null bytes
        req.body[key] = req.body[key].replace(/\0/g, '');
      }
    }
  }

  next();
}

/**
 * Security-focused request logger
 * Logs suspicious requests
 */
export function securityLogger(req, res, next) {
  const verbose = getConfig('VERBOSE');

  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\./g, // Path traversal
    /<script/gi, // XSS attempts
    /javascript:/gi, // XSS attempts
    /on\w+\s*=/gi, // Event handler injection
    /eval\(/gi, // Code injection
    /union.*select/gi, // SQL injection (defensive, though we don't use SQL)
    /insert.*into/gi,
    /drop.*table/gi
  ];

  const requestString = JSON.stringify({
    url: req.url,
    query: req.query,
    body: req.body
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      console.warn(`⚠️ Suspicious request detected from ${req.ip}:`);
      console.warn(`  Method: ${req.method}`);
      console.warn(`  URL: ${req.url}`);
      console.warn(`  Pattern: ${pattern}`);

      if (verbose) {
        console.warn(`  Headers: ${JSON.stringify(req.headers)}`);
        console.warn(`  Body: ${JSON.stringify(req.body)}`);
      }
      break;
    }
  }

  next();
}

export default {
  setupSecurity,
  setupSecurityHeaders,
  setupSession,
  setupCsrfProtection,
  setupRateLimit,
  sanitizeRequest,
  securityLogger
};
