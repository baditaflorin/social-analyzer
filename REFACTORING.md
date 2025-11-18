# Social Analyzer - Security & Resilience Refactoring

## Overview

This document describes the comprehensive security and resilience refactoring performed on Social Analyzer, focusing on secure coding practices, clean architecture, and defensive programming.

## Executive Summary

### What Was Changed

✅ **Security Hardening**
- Input validation and sanitization
- CSRF protection with double-submit cookies
- Security headers (CSP, HSTS, etc.)
- Rate limiting (3-tier system)
- Non-leaking error messages

✅ **Configuration Management**
- Environment-driven configuration
- Validation with graceful failures
- Type checking and range validation
- Secure secrets handling

✅ **Code Quality**
- ES6 module system
- SOLID principles
- DRY implementation
- Single-responsibility components

✅ **Testing Infrastructure**
- Unit tests
- Integration tests
- Security tests (injection attempts)
- Test harness GUI

✅ **Deployment**
- Secure Dockerfile
- Makefile for automation
- Health checks
- Non-root user execution

### Impact

**Security**: Significantly hardened against common attack vectors
**Maintainability**: Modular, testable, documented code
**Reliability**: Graceful error handling, validation, monitoring
**Usability**: Test harness for safe experimentation

---

## Detailed Changes

### 1. Security Modules

#### Input Validation (`modules/validation.js`)

**Purpose**: Validate and sanitize all user inputs

**Features**:
- Username validation (alphanumeric + . _ -)
- UUID validation (prevents path traversal)
- URL validation (prevents SSRF)
- Mode/option validation (enum checking)
- Text sanitization (XSS prevention)
- Regex escaping

**Usage**:
```javascript
import { validateUsername, sanitizeText } from './modules/validation.js';

try {
  const username = validateUsername(req.body.username);
  const safe = sanitizeText(userInput);
} catch (err) {
  // Handle ValidationError
}
```

#### Configuration Management (`modules/config.js`)

**Purpose**: Load, validate, and manage environment-driven configuration

**Features**:
- Schema-based validation
- Type checking (string, number, boolean, array)
- Range validation (min/max)
- Enum validation
- Required vs optional fields
- Default values
- File path validation
- Graceful error messages

**Usage**:
```javascript
import { initConfig, get } from './modules/config.js';

await initConfig();
const port = get('PORT');
const verbose = get('VERBOSE');
```

#### Error Handling (`modules/error-handler.js`)

**Purpose**: Secure, non-leaking error handling

**Features**:
- Error type categorization
- Safe error responses (no stack traces in production)
- Comprehensive logging
- Request context capture
- Global exception handlers
- Async error wrapping

**Usage**:
```javascript
import { asyncHandler, AppError, ErrorTypes } from './modules/error-handler.js';

app.post('/endpoint', asyncHandler(async (req, res) => {
  if (!isValid) {
    throw new AppError(ErrorTypes.VALIDATION, 'Invalid input', 400);
  }
  // ... handle request
}));
```

#### Security Middleware (`modules/security.js`)

**Purpose**: Comprehensive security middleware stack

**Features**:
- **Helmet.js**: Security headers (CSP, HSTS, etc.)
- **CSRF Protection**: Double-submit cookie pattern
- **Rate Limiting**: 3-tier system (global, analysis, strict)
- **Session Management**: Secure cookies, SameSite
- **Request Sanitization**: Null byte removal
- **Security Logging**: Suspicious pattern detection

**Usage**:
```javascript
import { setupSecurity } from './modules/security.js';

const { csrfProtection, analysisLimiter } = setupSecurity(app);

// Protect endpoint
app.post('/analyze', csrfProtection, analysisLimiter, asyncHandler(async (req, res) => {
  // ... handle request
}));
```

### 2. Test Infrastructure

#### Test Directory Structure

```
tests/
├── unit/           # Unit tests for modules
│   └── validation.test.js
├── integration/    # Integration tests
│   └── api.test.js
└── security/       # Security tests
    └── injection.test.js
```

#### Security Tests (`tests/security/injection.test.js`)

**Test Coverage**:
- ✓ XSS injection attempts
- ✓ SQL injection attempts (defensive)
- ✓ Path traversal attempts
- ✓ Command injection attempts
- ✓ LDAP injection attempts
- ✓ NoSQL injection attempts
- ✓ XML injection attempts
- ✓ Template injection attempts
- ✓ SSRF attempts
- ✓ Length-based attacks
- ✓ Unicode/homograph attacks

**Run Tests**:
```bash
npm test                # All tests
npm run test:unit       # Unit tests
npm run test:security   # Security tests
```

### 3. Test Harness GUI

#### Location
`public/test-harness.html`

#### Features

**Configuration Management**:
- Load/save settings
- Input validation
- Secure credential storage

**API Testing**:
- Username analysis
- Detection mode selection
- Real-time response viewing

**Security Testing**:
- XSS injection test
- Path traversal test
- Invalid input test
- Rate limit test
- Run all tests button

**Monitoring**:
- Request/response metrics
- Success/error counts
- Average response time
- Request log with timestamps

**Security**:
- CSRF token integration
- Sanitized error messages
- No sensitive data exposure

#### Access

```
http://localhost:9005/test-harness.html
```

### 4. Configuration System

#### Environment Variables (`.env`)

**Required**:
```env
SESSION_SECRET=your-generated-secret
```

**Optional**:
```env
PORT=9005
HOST=localhost
VERBOSE=false

GOOGLE_API_KEY=
GOOGLE_API_CS=

RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15

DETECTION_LEVEL=high
```

#### Validation

All configuration values are:
- Type-checked
- Range-validated
- Pattern-matched
- Enum-validated (where applicable)

#### Error Messages

Clear, actionable error messages:

```
❌ Configuration Error:

Configuration validation failed:
  - SESSION_SECRET is required but not set
  - PORT must be >= 1024, got: 80
  - DETECTION_LEVEL must be one of: extreme, high, normal, low, got: invalid

Please check your .env file or environment variables.
```

### 5. Deployment Tools

#### Makefile

**Common Commands**:

```bash
make help           # Show all commands
make install        # Install dependencies
make test           # Run tests
make lint           # Run linter
make dev            # Start development server
make docker-build   # Build Docker image
make security-check # Check vulnerabilities
```

**Full List**: Run `make help`

#### Secure Dockerfile

**Features**:
- Multi-stage build (smaller image)
- Non-root user execution
- Minimal attack surface
- Health checks
- Read-only filesystem (except logs)
- Proper signal handling (dumb-init)

**Build**:
```bash
docker build -f Dockerfile.secure -t social-analyzer:secure .
```

**Run**:
```bash
docker run -d \
  -p 9005:9005 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your-secret \
  --read-only \
  --tmpfs /app/logs:rw \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  social-analyzer:secure
```

### 6. Documentation

#### New Documents

1. **SECURITY.md**: Comprehensive security guidelines
   - Security features
   - Configuration security
   - Deployment security
   - Incident response
   - Security checklist

2. **REFACTORING.md**: This document
   - Overview of changes
   - Migration guide
   - Breaking changes
   - Best practices

3. **.env.example**: Configuration template
   - All available settings
   - Descriptions
   - Default values
   - Security notes

---

## Migration Guide

### For Existing Deployments

#### Step 1: Update Dependencies

```bash
npm install
```

#### Step 2: Create `.env` File

```bash
cp .env.example .env
```

Edit `.env` and set:
```env
SESSION_SECRET=<generate-strong-secret>
NODE_ENV=production
```

Generate secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 3: Update Code (if customized)

If you have custom code that imports modules:

**Old**:
```javascript
const helper = require('./modules/helper.js');
```

**New**:
```javascript
import { initConfig, get } from './modules/config.js';
import { validateUsername } from './modules/validation.js';

await initConfig();
const port = get('PORT');
```

#### Step 4: Test

```bash
# Run tests
npm test

# Start in development
npm run dev

# Access test harness
open http://localhost:9005/test-harness.html
```

#### Step 5: Deploy

```bash
# Set production environment
export NODE_ENV=production

# Start application
npm start
```

Or use Docker:

```bash
docker build -f Dockerfile.secure -t social-analyzer:secure .
docker run -d -p 9005:9005 --env-file .env social-analyzer:secure
```

---

## Breaking Changes

### 1. Configuration

**Before**: Hardcoded in `helper.js`
```javascript
const verbose = false;
const google_api_key = '';
```

**After**: Environment variables
```env
VERBOSE=false
GOOGLE_API_KEY=
```

**Migration**: Create `.env` file with desired settings

### 2. Error Responses

**Before**: Verbose error messages
```json
{
  "error": "SyntaxError: Unexpected token...",
  "stack": "Error: at..."
}
```

**After**: Safe error messages
```json
{
  "error": true,
  "message": "Invalid input",
  "type": "validation_error"
}
```

**Migration**: Update error handling in client code if needed

### 3. Module System

**Before**: CommonJS (`require`)
```javascript
const helper = require('./modules/helper.js');
```

**After**: ES6 modules (`import`)
```javascript
import { initConfig } from './modules/config.js';
```

**Migration**: Update imports in custom code

### 4. POST Endpoints

**Before**: No CSRF protection
```javascript
fetch('/save_settings', {
  method: 'POST',
  body: JSON.stringify(data)
})
```

**After**: CSRF token required
```javascript
// Get token first
const token = await fetch('/api/csrf-token').then(r => r.json());

fetch('/save_settings', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token.csrfToken
  },
  body: JSON.stringify(data)
})
```

**Migration**: Update client code to fetch and include CSRF tokens

---

## Best Practices

### Input Validation

**Always validate user inputs**:

```javascript
import { validateUsername } from './modules/validation.js';

try {
  const username = validateUsername(req.body.username);
  // Use validated username
} catch (err) {
  // Handle validation error
  res.status(400).json({
    error: true,
    message: err.userMessage
  });
}
```

### Error Handling

**Use async handlers**:

```javascript
import { asyncHandler } from './modules/error-handler.js';

app.post('/endpoint', asyncHandler(async (req, res) => {
  // Errors are automatically caught and handled
  const result = await someAsyncOperation();
  res.json(result);
}));
```

### Configuration

**Use config module**:

```javascript
import { get } from './modules/config.js';

const timeout = get('REQUEST_TIMEOUT');
const apiKey = get('GOOGLE_API_KEY');
```

### Security

**Protect state-changing endpoints**:

```javascript
import { setupSecurity } from './modules/security.js';

const { csrfProtection, analysisLimiter } = setupSecurity(app);

app.post('/analyze', csrfProtection, analysisLimiter, handler);
```

### Testing

**Write security tests**:

```javascript
describe('Security', () => {
  it('should reject XSS attempts', () => {
    expect(() => validateUsername('<script>')).to.throw();
  });
});
```

---

## Performance Considerations

### Impact Assessment

**Positive**:
- Cached validation results
- Efficient rate limiting
- Minimal middleware overhead

**Neutral**:
- Security headers (negligible)
- CSRF token generation (~1ms)

**Monitoring**:
- Use test harness to measure response times
- Monitor rate limit violations
- Track error rates

### Optimization Tips

1. **Adjust rate limits** based on usage:
   ```env
   RATE_LIMIT_MAX=200  # Increase if needed
   ```

2. **Reduce detection levels** for faster scans:
   ```env
   DETECTION_LEVEL=normal  # vs high
   ```

3. **Limit worker counts** for resource constraints:
   ```env
   MAX_FAST_WORKERS=10  # Default 15
   ```

---

## Troubleshooting

### Common Issues

#### 1. "SESSION_SECRET is required"

**Solution**: Generate and set session secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add to .env: SESSION_SECRET=generated-value
```

#### 2. "CSRF token invalid"

**Solution**: Fetch token before POST requests

```javascript
const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());
// Include in request headers
```

#### 3. "Rate limit exceeded"

**Solution**: Adjust rate limits or implement backoff

```env
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=15
```

#### 4. "Configuration validation failed"

**Solution**: Check error message for specific field

```bash
# Review .env file
cat .env

# Validate against .env.example
diff .env .env.example
```

#### 5. Module import errors

**Solution**: Ensure package.json has `"type": "module"`

```json
{
  "type": "module"
}
```

---

## Testing the Refactoring

### Quick Validation

```bash
# 1. Install dependencies
npm install

# 2. Create .env
cp .env.example .env
# Edit .env: Set SESSION_SECRET

# 3. Run tests
npm test

# 4. Start development server
npm run dev

# 5. Access test harness
open http://localhost:9005/test-harness.html

# 6. Run security tests in GUI
# Click "Run All Security Tests"
```

### Expected Results

✅ All tests pass
✅ Application starts without errors
✅ Test harness loads successfully
✅ Security tests reject malicious inputs
✅ Configuration is validated
✅ CSRF protection active

---

## Future Enhancements

### Planned Features

- [ ] Authentication/Authorization system
- [ ] API key management
- [ ] Audit logging
- [ ] Performance monitoring dashboard
- [ ] Advanced threat detection
- [ ] Automated backup system
- [ ] Multi-factor authentication
- [ ] IP whitelisting/blacklisting

### Community Contributions

We welcome contributions! Please:

1. Read SECURITY.md
2. Write tests for new features
3. Follow coding standards
4. Update documentation

---

## Support and Resources

### Documentation

- **SECURITY.md**: Security guidelines and best practices
- **REFACTORING.md**: This document
- **.env.example**: Configuration reference
- **Makefile**: Available commands

### Getting Help

- **Issues**: GitHub Issues
- **Security**: security@example.com (private disclosure)
- **General**: discussions@example.com

### Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

## Acknowledgments

This refactoring implements industry best practices from:

- OWASP Application Security Verification Standard
- CWE Top 25 Most Dangerous Software Weaknesses
- NIST Cybersecurity Framework
- Node.js Security Working Group recommendations

---

## Version Information

**Refactoring Version**: 2.1.0
**Date**: 2025-11-18
**Status**: Complete

### Refactoring Scope

- ✅ Security hardening
- ✅ Input validation
- ✅ Configuration management
- ✅ Error handling
- ✅ Testing infrastructure
- ✅ Deployment automation
- ✅ Documentation

### Not Included (Future Work)

- ⏳ Database integration (currently JSON-based)
- ⏳ Authentication system
- ⏳ Multi-user support
- ⏳ Real-time monitoring dashboard
- ⏳ Advanced analytics

---

## Conclusion

This refactoring significantly improves the security, reliability, and maintainability of Social Analyzer while maintaining backward compatibility for most use cases. The modular architecture makes it easier to add new features and maintain existing code.

For questions or concerns, please refer to the documentation or contact the development team.

**Happy analyzing! 🔍🔒**
