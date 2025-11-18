/**
 * Input Validation and Sanitization Module
 * Validates and sanitizes all user inputs to prevent injection attacks
 * and ensure data integrity
 */

import validator from 'validator';
import sanitizeHtml from 'sanitize-html';

/**
 * Validation errors
 */
class ValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.userMessage = `Invalid ${field}: ${message}`;
  }
}

/**
 * Username validation rules
 */
const USERNAME_RULES = {
  minLength: 1,
  maxLength: 100,
  // Allow alphanumeric, dots, underscores, hyphens
  pattern: /^[a-zA-Z0-9._-]+$/,
  // Prevent SQL keywords (defensive, though we don't use SQL)
  blacklist: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE', 'SCRIPT', 'JAVASCRIPT'],
  // Prevent path traversal
  pathTraversal: /\.\./
};

/**
 * UUID validation rules
 */
const UUID_RULES = {
  minLength: 5,
  maxLength: 50,
  pattern: /^[a-zA-Z0-9-]+$/
};

/**
 * Validates a username input
 * @param {string} username - Username to validate
 * @returns {string} - Sanitized username
 * @throws {ValidationError} - If validation fails
 */
function validateUsername(username) {
  if (!username) {
    throw new ValidationError('username', 'Username is required');
  }

  if (typeof username !== 'string') {
    throw new ValidationError('username', 'Username must be a string');
  }

  // Trim whitespace
  username = username.trim();

  // Check length
  if (username.length < USERNAME_RULES.minLength) {
    throw new ValidationError('username', `Username must be at least ${USERNAME_RULES.minLength} character`);
  }

  if (username.length > USERNAME_RULES.maxLength) {
    throw new ValidationError('username', `Username cannot exceed ${USERNAME_RULES.maxLength} characters`);
  }

  // Check pattern (alphanumeric, dots, underscores, hyphens only)
  if (!USERNAME_RULES.pattern.test(username)) {
    throw new ValidationError('username', 'Username can only contain letters, numbers, dots, underscores, and hyphens');
  }

  // Check for path traversal attempts
  if (USERNAME_RULES.pathTraversal.test(username)) {
    throw new ValidationError('username', 'Invalid username format');
  }

  // Check blacklist (case-insensitive)
  const upperUsername = username.toUpperCase();
  for (const blocked of USERNAME_RULES.blacklist) {
    if (upperUsername.includes(blocked)) {
      throw new ValidationError('username', 'Username contains blocked keywords');
    }
  }

  return username;
}

/**
 * Validates multiple usernames (comma-separated)
 * @param {string} usernames - Comma-separated usernames
 * @returns {string[]} - Array of sanitized usernames
 * @throws {ValidationError} - If any validation fails
 */
function validateUsernames(usernames) {
  if (!usernames) {
    throw new ValidationError('usernames', 'At least one username is required');
  }

  if (typeof usernames !== 'string') {
    throw new ValidationError('usernames', 'Usernames must be a string');
  }

  // Split by comma
  const usernameList = usernames.split(',').map(u => u.trim()).filter(u => u);

  if (usernameList.length === 0) {
    throw new ValidationError('usernames', 'At least one valid username is required');
  }

  if (usernameList.length > 50) {
    throw new ValidationError('usernames', 'Maximum 50 usernames allowed per request');
  }

  // Validate each username
  return usernameList.map((username, index) => {
    try {
      return validateUsername(username);
    } catch (err) {
      throw new ValidationError('usernames', `Username #${index + 1} is invalid: ${err.userMessage}`);
    }
  });
}

/**
 * Validates a UUID
 * @param {string} uuid - UUID to validate
 * @returns {string} - Sanitized UUID
 * @throws {ValidationError} - If validation fails
 */
function validateUUID(uuid) {
  if (!uuid) {
    throw new ValidationError('uuid', 'UUID is required');
  }

  if (typeof uuid !== 'string') {
    throw new ValidationError('uuid', 'UUID must be a string');
  }

  // Trim whitespace
  uuid = uuid.trim();

  // Check length
  if (uuid.length < UUID_RULES.minLength || uuid.length > UUID_RULES.maxLength) {
    throw new ValidationError('uuid', 'Invalid UUID format');
  }

  // Check pattern
  if (!UUID_RULES.pattern.test(uuid)) {
    throw new ValidationError('uuid', 'UUID can only contain letters, numbers, and hyphens');
  }

  // Check for path traversal
  if (USERNAME_RULES.pathTraversal.test(uuid)) {
    throw new ValidationError('uuid', 'Invalid UUID format');
  }

  return uuid;
}

/**
 * Validates a URL
 * @param {string} url - URL to validate
 * @param {object} options - Validation options
 * @returns {string} - Sanitized URL
 * @throws {ValidationError} - If validation fails
 */
function validateUrl(url, options = {}) {
  if (!url) {
    if (options.optional) {
      return '';
    }
    throw new ValidationError('url', 'URL is required');
  }

  if (typeof url !== 'string') {
    throw new ValidationError('url', 'URL must be a string');
  }

  url = url.trim();

  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    allow_underscores: true
  })) {
    throw new ValidationError('url', 'Invalid URL format');
  }

  // Additional security checks
  try {
    const parsed = new URL(url);

    // Prevent localhost/private IPs in production (SSRF protection)
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase();
      const privatePatterns = [
        /^localhost$/i,
        /^127\.\d+\.\d+\.\d+$/,
        /^10\.\d+\.\d+\.\d+$/,
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
        /^192\.168\.\d+\.\d+$/,
        /^::1$/,
        /^fe80:/i
      ];

      for (const pattern of privatePatterns) {
        if (pattern.test(hostname)) {
          throw new ValidationError('url', 'Private/internal URLs are not allowed');
        }
      }
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new ValidationError('url', 'Invalid URL format');
  }

  return url;
}

/**
 * Validates a detection mode
 * @param {string} mode - Detection mode
 * @returns {string} - Validated mode
 * @throws {ValidationError} - If validation fails
 */
function validateMode(mode) {
  const validModes = ['fast', 'slow', 'special'];

  if (!mode) {
    return 'fast'; // Default
  }

  if (typeof mode !== 'string') {
    throw new ValidationError('mode', 'Mode must be a string');
  }

  mode = mode.trim().toLowerCase();

  if (!validModes.includes(mode)) {
    throw new ValidationError('mode', `Mode must be one of: ${validModes.join(', ')}`);
  }

  return mode;
}

/**
 * Validates an option value
 * @param {string} option - Option to validate
 * @returns {string} - Validated option
 * @throws {ValidationError} - If validation fails
 */
function validateOption(option) {
  const validOptions = ['FindUserProfilesFast', 'FindUserProfilesSlow', 'FindUserProfilesSpecial', 'ShowUserInfo'];

  if (!option) {
    throw new ValidationError('option', 'Option is required');
  }

  if (typeof option !== 'string') {
    throw new ValidationError('option', 'Option must be a string');
  }

  option = option.trim();

  if (!validOptions.includes(option)) {
    throw new ValidationError('option', `Invalid option. Must be one of: ${validOptions.join(', ')}`);
  }

  return option;
}

/**
 * Validates a User-Agent string
 * @param {string} userAgent - User-Agent to validate
 * @returns {string} - Sanitized User-Agent
 * @throws {ValidationError} - If validation fails
 */
function validateUserAgent(userAgent) {
  if (!userAgent) {
    return 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0';
  }

  if (typeof userAgent !== 'string') {
    throw new ValidationError('userAgent', 'User-Agent must be a string');
  }

  userAgent = userAgent.trim();

  if (userAgent.length < 10 || userAgent.length > 500) {
    throw new ValidationError('userAgent', 'User-Agent has invalid length');
  }

  // Remove any control characters
  userAgent = userAgent.replace(/[\x00-\x1F\x7F]/g, '');

  return userAgent;
}

/**
 * Validates API key
 * @param {string} apiKey - API key to validate
 * @returns {string} - Sanitized API key
 * @throws {ValidationError} - If validation fails
 */
function validateApiKey(apiKey, options = {}) {
  if (!apiKey) {
    if (options.optional) {
      return '';
    }
    throw new ValidationError('apiKey', 'API key is required');
  }

  if (typeof apiKey !== 'string') {
    throw new ValidationError('apiKey', 'API key must be a string');
  }

  apiKey = apiKey.trim();

  if (apiKey.length < 10 || apiKey.length > 200) {
    throw new ValidationError('apiKey', 'API key has invalid length');
  }

  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
    throw new ValidationError('apiKey', 'API key contains invalid characters');
  }

  return apiKey;
}

/**
 * Sanitizes HTML content
 * @param {string} html - HTML to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHtmlContent(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return sanitizeHtml(html, {
    allowedTags: [], // Strip all HTML tags
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape'
  });
}

/**
 * Sanitizes text for safe display (XSS prevention)
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove control characters
  text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // HTML entity encode
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Escapes special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates file path (prevents path traversal)
 * @param {string} filePath - File path to validate
 * @returns {string} - Sanitized file path
 * @throws {ValidationError} - If validation fails
 */
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('filePath', 'File path is required');
  }

  // Remove any path traversal attempts
  if (filePath.includes('..') || filePath.includes('~')) {
    throw new ValidationError('filePath', 'Invalid file path');
  }

  // Only allow alphanumeric, dots, hyphens, underscores, forward slashes
  if (!/^[a-zA-Z0-9._/-]+$/.test(filePath)) {
    throw new ValidationError('filePath', 'File path contains invalid characters');
  }

  return filePath;
}

/**
 * Validates JSON input
 * @param {string} jsonString - JSON string to validate
 * @returns {object} - Parsed JSON object
 * @throws {ValidationError} - If validation fails
 */
function validateJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    throw new ValidationError('json', 'JSON input is required');
  }

  try {
    return JSON.parse(jsonString);
  } catch (err) {
    throw new ValidationError('json', 'Invalid JSON format');
  }
}

/**
 * Validates detection level
 * @param {string} level - Detection level
 * @returns {string} - Validated level
 * @throws {ValidationError} - If validation fails
 */
function validateDetectionLevel(level) {
  const validLevels = ['extreme', 'high', 'normal', 'low'];

  if (!level) {
    return 'high'; // Default
  }

  if (typeof level !== 'string') {
    throw new ValidationError('detectionLevel', 'Detection level must be a string');
  }

  level = level.trim().toLowerCase();

  if (!validLevels.includes(level)) {
    throw new ValidationError('detectionLevel', `Detection level must be one of: ${validLevels.join(', ')}`);
  }

  return level;
}

/**
 * Validates and sanitizes request body for analyze_string endpoint
 * @param {object} body - Request body
 * @returns {object} - Sanitized request body
 * @throws {ValidationError} - If validation fails
 */
function validateAnalyzeRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('request', 'Invalid request body');
  }

  const sanitized = {};

  // Required fields
  sanitized.uuid = validateUUID(body.uuid);
  sanitized.string = body.string && body.string.includes(',')
    ? validateUsernames(body.string)
    : [validateUsername(body.string)];

  // Optional fields
  if (body.option) {
    sanitized.option = validateOption(body.option);
  }

  if (body.mode) {
    sanitized.mode = validateMode(body.mode);
  }

  return sanitized;
}

/**
 * Validates and sanitizes settings
 * @param {object} settings - Settings object
 * @returns {object} - Sanitized settings
 * @throws {ValidationError} - If validation fails
 */
function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new ValidationError('settings', 'Invalid settings object');
  }

  const sanitized = {};

  if (settings.google_api_key !== undefined) {
    sanitized.google_api_key = validateApiKey(settings.google_api_key, { optional: true });
  }

  if (settings.google_api_cs !== undefined) {
    sanitized.google_api_cs = validateApiKey(settings.google_api_cs, { optional: true });
  }

  if (settings.user_agent !== undefined) {
    sanitized.user_agent = validateUserAgent(settings.user_agent);
  }

  if (settings.proxy !== undefined) {
    sanitized.proxy = validateUrl(settings.proxy, { optional: true });
  }

  if (settings.grid_url !== undefined) {
    sanitized.grid_url = validateUrl(settings.grid_url, { optional: true });
  }

  return sanitized;
}

export {
  // Error class
  ValidationError,

  // Validation functions
  validateUsername,
  validateUsernames,
  validateUUID,
  validateUrl,
  validateMode,
  validateOption,
  validateUserAgent,
  validateApiKey,
  validateFilePath,
  validateJson,
  validateDetectionLevel,
  validateAnalyzeRequest,
  validateSettings,

  // Sanitization functions
  sanitizeHtmlContent,
  sanitizeText,
  escapeRegex
};

export default {
  ValidationError,
  validateUsername,
  validateUsernames,
  validateUUID,
  validateUrl,
  validateMode,
  validateOption,
  validateUserAgent,
  validateApiKey,
  validateFilePath,
  validateJson,
  validateDetectionLevel,
  validateAnalyzeRequest,
  validateSettings,
  sanitizeHtmlContent,
  sanitizeText,
  escapeRegex
};
