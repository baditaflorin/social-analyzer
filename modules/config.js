/**
 * Configuration Module
 * Loads and validates environment-driven configuration with graceful failure handling
 * Follows least-privilege and secure defaults principles
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration validation schema
 */
const CONFIG_SCHEMA = {
  PORT: {
    type: 'number',
    default: 9005,
    min: 1024,
    max: 65535,
    description: 'Server port number'
  },
  HOST: {
    type: 'string',
    default: 'localhost',
    pattern: /^(localhost|127\.0\.0\.1|0\.0\.0\.0|[\w\.-]+)$/,
    description: 'Server host address'
  },
  VERBOSE: {
    type: 'boolean',
    default: false,
    description: 'Enable verbose debug logging'
  },
  GOOGLE_API_KEY: {
    type: 'string',
    default: '',
    optional: true,
    description: 'Google Custom Search API key'
  },
  GOOGLE_API_CS: {
    type: 'string',
    default: '',
    optional: true,
    description: 'Google Custom Search Engine ID'
  },
  SELENIUM_GRID_URL: {
    type: 'string',
    default: '',
    optional: true,
    pattern: /^(https?:\/\/.+|)$/,
    description: 'Selenium Grid URL'
  },
  HTTP_PROXY: {
    type: 'string',
    default: '',
    optional: true,
    pattern: /^(https?:\/\/.+|)$/,
    description: 'HTTP/HTTPS proxy URL'
  },
  USER_AGENT: {
    type: 'string',
    default: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0',
    description: 'User-Agent string for HTTP requests'
  },
  SESSION_SECRET: {
    type: 'string',
    default: '',
    minLength: 32,
    description: 'Session secret for CSRF protection',
    required: process.env.NODE_ENV === 'production'
  },
  ENABLE_CORS: {
    type: 'boolean',
    default: false,
    description: 'Enable CORS'
  },
  CORS_ORIGINS: {
    type: 'array',
    default: ['http://localhost:3000'],
    separator: ',',
    description: 'Allowed CORS origins'
  },
  RATE_LIMIT_MAX: {
    type: 'number',
    default: 100,
    min: 1,
    max: 10000,
    description: 'Maximum requests per IP per window'
  },
  RATE_LIMIT_WINDOW: {
    type: 'number',
    default: 15,
    min: 1,
    max: 1440,
    description: 'Rate limit window in minutes'
  },
  DETECTION_LEVEL: {
    type: 'string',
    default: 'high',
    enum: ['extreme', 'high', 'normal', 'low'],
    description: 'Detection sensitivity level'
  },
  MAX_FAST_WORKERS: {
    type: 'number',
    default: 15,
    min: 1,
    max: 50,
    description: 'Maximum concurrent fast scans'
  },
  MAX_SLOW_WORKERS: {
    type: 'number',
    default: 8,
    min: 1,
    max: 20,
    description: 'Maximum concurrent slow scans'
  },
  MAX_SPECIAL_WORKERS: {
    type: 'number',
    default: 5,
    min: 1,
    max: 20,
    description: 'Maximum concurrent special scans'
  },
  REQUEST_TIMEOUT: {
    type: 'number',
    default: 5,
    min: 1,
    max: 60,
    description: 'HTTP request timeout in seconds'
  },
  ENABLE_FILE_LOGGING: {
    type: 'boolean',
    default: true,
    description: 'Enable file logging'
  },
  LOG_DIR: {
    type: 'string',
    default: './logs',
    description: 'Log directory path'
  },
  LOG_LEVEL: {
    type: 'string',
    default: 'info',
    enum: ['error', 'warn', 'info', 'debug'],
    description: 'Logging level'
  },
  SITES_DATA_PATH: {
    type: 'string',
    default: './data/sites.json',
    description: 'Path to sites.json'
  },
  NAMES_DATA_PATH: {
    type: 'string',
    default: './data/names.json',
    description: 'Path to names.json'
  },
  LANGUAGES_DATA_PATH: {
    type: 'string',
    default: './data/languages.json',
    description: 'Path to languages.json'
  },
  DICT_DATA_PATH: {
    type: 'string',
    default: './data/dict.json',
    description: 'Path to dict.json'
  },
  COUNTRIES_DATA_PATH: {
    type: 'string',
    default: './data/countries.json',
    description: 'Path to countries.json'
  }
};

/**
 * Validation errors
 */
class ConfigValidationError extends Error {
  constructor(errors) {
    super(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

/**
 * Validates a single configuration value
 */
function validateValue(key, value, schema) {
  const errors = [];

  // Check if required
  if (schema.required && (!value || value === '')) {
    errors.push(`${key} is required but not set`);
    return { valid: false, errors, value: schema.default };
  }

  // Use default if not set and optional
  if (!value || value === '') {
    return { valid: true, errors: [], value: schema.default };
  }

  // Type validation
  switch (schema.type) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${key} must be a number, got: ${value}`);
      } else {
        if (schema.min !== undefined && num < schema.min) {
          errors.push(`${key} must be >= ${schema.min}, got: ${num}`);
        }
        if (schema.max !== undefined && num > schema.max) {
          errors.push(`${key} must be <= ${schema.max}, got: ${num}`);
        }
        value = num;
      }
      break;

    case 'boolean':
      if (typeof value === 'string') {
        value = value.toLowerCase() === 'true' || value === '1';
      } else {
        value = Boolean(value);
      }
      break;

    case 'string':
      value = String(value);
      if (schema.minLength && value.length < schema.minLength) {
        errors.push(`${key} must be at least ${schema.minLength} characters, got: ${value.length}`);
      }
      if (schema.pattern && !schema.pattern.test(value)) {
        errors.push(`${key} has invalid format`);
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${key} must be one of: ${schema.enum.join(', ')}, got: ${value}`);
      }
      break;

    case 'array':
      if (typeof value === 'string') {
        value = value.split(schema.separator || ',').map(v => v.trim()).filter(v => v);
      } else if (!Array.isArray(value)) {
        errors.push(`${key} must be an array or comma-separated string`);
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    value
  };
}

/**
 * Loads and validates configuration from environment variables
 */
async function loadConfig() {
  // Load .env file if it exists (for development)
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch (err) {
    // dotenv not installed or .env not found - continue with process.env
  }

  const config = {};
  const errors = [];
  const warnings = [];

  // Validate each configuration value
  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    const envValue = process.env[key];
    const result = validateValue(key, envValue, schema);

    if (!result.valid) {
      errors.push(...result.errors);
    }

    config[key] = result.value;

    // Warn about using defaults for important settings
    if (!envValue && schema.required && schema.default) {
      warnings.push(`${key} not set, using default: ${schema.default}`);
    }
  }

  // Throw if validation failed
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  // Log warnings if verbose
  if (config.VERBOSE && warnings.length > 0) {
    console.warn('Configuration warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  // Validate file paths exist
  const dataPaths = [
    'SITES_DATA_PATH',
    'NAMES_DATA_PATH',
    'LANGUAGES_DATA_PATH',
    'DICT_DATA_PATH',
    'COUNTRIES_DATA_PATH'
  ];

  const missingFiles = [];
  for (const pathKey of dataPaths) {
    const filePath = path.resolve(config[pathKey]);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(`${pathKey}: ${filePath}`);
    }
  }

  if (missingFiles.length > 0) {
    throw new ConfigValidationError([
      'Required data files not found:',
      ...missingFiles
    ]);
  }

  // Create log directory if it doesn't exist
  if (config.ENABLE_FILE_LOGGING) {
    const logDir = path.resolve(config.LOG_DIR);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
      } catch (err) {
        throw new ConfigValidationError([`Cannot create log directory: ${logDir}`]);
      }
    }
  }

  // Warn about missing SESSION_SECRET in production
  if (process.env.NODE_ENV === 'production' && !config.SESSION_SECRET) {
    throw new ConfigValidationError([
      'SESSION_SECRET is required in production',
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    ]);
  }

  // Generate session secret for development if not set
  if (!config.SESSION_SECRET) {
    config.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
    if (config.VERBOSE) {
      console.warn('Generated temporary SESSION_SECRET for development');
    }
  }

  return Object.freeze(config); // Make config immutable
}

/**
 * Get configuration value safely
 */
function get(key) {
  if (!config) {
    throw new Error('Configuration not initialized. Call loadConfig() first.');
  }
  return config[key];
}

/**
 * Get all configuration (read-only)
 */
function getAll() {
  if (!config) {
    throw new Error('Configuration not initialized. Call loadConfig() first.');
  }
  return config;
}

/**
 * Get sanitized configuration for API responses (removes secrets)
 */
function getSanitized() {
  if (!config) {
    throw new Error('Configuration not initialized. Call loadConfig() first.');
  }

  const sanitized = { ...config };

  // Mask sensitive values
  if (sanitized.GOOGLE_API_KEY) {
    sanitized.GOOGLE_API_KEY = maskSecret(sanitized.GOOGLE_API_KEY);
  }
  if (sanitized.SESSION_SECRET) {
    sanitized.SESSION_SECRET = '***HIDDEN***';
  }
  if (sanitized.HTTP_PROXY) {
    sanitized.HTTP_PROXY = maskUrl(sanitized.HTTP_PROXY);
  }

  return sanitized;
}

/**
 * Mask secret strings (show first 10 chars only)
 */
function maskSecret(secret) {
  if (!secret || secret.length <= 10) {
    return '***';
  }
  return secret.substring(0, 10) + '*'.repeat(secret.length - 10);
}

/**
 * Mask URLs (hide credentials)
 */
function maskUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      return `${parsed.protocol}//***.***@${parsed.host}${parsed.pathname}`;
    }
    return url;
  } catch (err) {
    return '***';
  }
}

/**
 * Print configuration help
 */
function printHelp() {
  console.log('Social Analyzer - Configuration Options\n');
  console.log('Copy .env.example to .env and configure your settings.\n');
  console.log('Available configuration options:\n');

  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    console.log(`${key}:`);
    console.log(`  Description: ${schema.description}`);
    console.log(`  Type: ${schema.type}`);
    console.log(`  Default: ${schema.default}`);
    if (schema.required) {
      console.log(`  Required: yes`);
    }
    if (schema.enum) {
      console.log(`  Options: ${schema.enum.join(', ')}`);
    }
    console.log();
  }
}

// Initialize configuration
let config;

// Export initialization function
export async function initConfig() {
  try {
    config = await loadConfig();
    return config;
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error('❌ Configuration Error:\n');
      console.error(err.message);
      console.error('\nPlease check your .env file or environment variables.');
      console.error('Run with --config-help to see all available options.\n');
      process.exit(1);
    }
    throw err;
  }
}

export {
  ConfigValidationError,
  get,
  getAll,
  getSanitized,
  printHelp
};

export default {
  initConfig,
  get,
  getAll,
  getSanitized,
  printHelp,
  ConfigValidationError
};
