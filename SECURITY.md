# Security Guidelines for Social Analyzer

## Overview

This document outlines the security measures implemented in Social Analyzer and provides guidelines for secure deployment and usage.

## Table of Contents

1. [Security Features](#security-features)
2. [Configuration Security](#configuration-security)
3. [Input Validation](#input-validation)
4. [Error Handling](#error-handling)
5. [Deployment Security](#deployment-security)
6. [Security Testing](#security-testing)
7. [Incident Response](#incident-response)
8. [Security Checklist](#security-checklist)

---

## Security Features

### 1. Input Validation and Sanitization

**All user inputs are validated and sanitized** before processing:

- **Username validation**: Only alphanumeric characters, dots, underscores, and hyphens allowed
- **Length limits**: Maximum 100 characters for usernames
- **SQL injection prevention**: Blocks SQL keywords (defensive measure)
- **Path traversal prevention**: Rejects `../` patterns
- **XSS prevention**: HTML entities are escaped in all outputs

**Location**: `modules/validation.js`

### 2. CSRF Protection

**Double-submit cookie pattern** implemented using `csrf-csrf`:

- CSRF tokens required for all state-changing requests (POST, PUT, DELETE)
- Tokens are cryptographically secure (64 bytes)
- Automatic token generation and validation
- Tokens are tied to user sessions

**Location**: `modules/security.js`

### 3. Security Headers

**Comprehensive HTTP security headers** using Helmet.js:

- `Content-Security-Policy`: Restricts resource loading
- `Strict-Transport-Security`: Enforces HTTPS (in production)
- `X-Frame-Options`: Prevents clickjacking
- `X-Content-Type-Options`: Prevents MIME-type sniffing
- `Referrer-Policy`: Controls referrer information
- `X-XSS-Protection`: Browser XSS filter

**Location**: `modules/security.js`

### 4. Rate Limiting

**Three-tier rate limiting system**:

1. **Global limiter**: 100 requests per 15 minutes per IP
2. **Analysis limiter**: 50 analysis requests per 15 minutes per IP
3. **Strict limiter**: 10 requests per 15 minutes for sensitive endpoints

**Location**: `modules/security.js`

### 5. Secure Session Management

- Session secrets are required in production
- HttpOnly and Secure cookies
- SameSite=Strict to prevent CSRF
- 24-hour session expiration

**Location**: `modules/security.js`

### 6. Non-Leaking Error Messages

**Error responses are sanitized**:

- Generic error messages in production
- Detailed errors only in development mode
- No stack traces or internal paths exposed
- All errors are logged securely

**Location**: `modules/error-handler.js`

### 7. Environment-Driven Configuration

**All sensitive settings use environment variables**:

- No hardcoded credentials
- Validation of all configuration values
- Graceful failure with clear error messages
- Type checking and range validation

**Location**: `modules/config.js`

---

## Configuration Security

### Required Settings

1. **Generate a strong session secret**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:

```
SESSION_SECRET=your-generated-secret-here
```

2. **Set NODE_ENV in production**:

```
NODE_ENV=production
```

### Optional but Recommended

```env
# Enable file logging
ENABLE_FILE_LOGGING=true

# Set log level
LOG_LEVEL=info

# Configure rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15

# Enable CORS only if needed
ENABLE_CORS=false
```

### Sensitive Data

**Never commit these to version control**:

- `SESSION_SECRET`
- `GOOGLE_API_KEY`
- `GOOGLE_API_CS`
- Any proxy credentials

**Use `.env` file** (already in `.gitignore`)

---

## Input Validation

### Validated Inputs

All inputs go through validation layers:

```javascript
// Username validation
validateUsername(username)
// ✓ Alphanumeric + . _ -
// ✗ Special characters
// ✗ SQL keywords
// ✗ Path traversal
// ✗ > 100 characters

// UUID validation
validateUUID(uuid)
// ✓ Alphanumeric + -
// ✗ Special characters
// ✗ Path traversal
// ✗ < 5 or > 50 characters

// URL validation
validateUrl(url)
// ✓ http:// or https://
// ✗ javascript:, data:, file:
// ✗ Private IPs in production
```

### Sanitization

All text outputs are sanitized:

```javascript
sanitizeText(userInput)
// Escapes: < > & " ' /
// Removes: Control characters
```

### Custom Validation

To add custom validation:

```javascript
import { ValidationError } from './modules/validation.js';

function validateCustomField(value) {
  if (!isValid(value)) {
    throw new ValidationError('fieldName', 'Reason for rejection');
  }
  return sanitizedValue;
}
```

---

## Error Handling

### Error Types

```javascript
ErrorTypes = {
  VALIDATION: 'validation_error',        // 400
  NOT_FOUND: 'not_found',                // 404
  RATE_LIMIT: 'rate_limit_exceeded',     // 429
  INTERNAL: 'internal_error',            // 500
  NETWORK: 'network_error',              // 503
  TIMEOUT: 'timeout_error'               // 504
}
```

### Error Response Format

**Production** (minimal information):

```json
{
  "error": true,
  "message": "An error occurred",
  "type": "internal_error",
  "timestamp": "2025-11-18T10:00:00.000Z"
}
```

**Development** (detailed):

```json
{
  "error": true,
  "message": "Detailed error message",
  "type": "internal_error",
  "timestamp": "2025-11-18T10:00:00.000Z",
  "stack": "Error stack trace...",
  "details": { ... }
}
```

### Logging

Errors are logged to:

- **Console**: If `VERBOSE=true`
- **File**: `./logs/error.log` (if `ENABLE_FILE_LOGGING=true`)

Log format:

```json
{
  "timestamp": "2025-11-18T10:00:00.000Z",
  "level": "error",
  "message": "Error message",
  "request": {
    "method": "POST",
    "url": "/analyze_string",
    "ip": "1.2.3.4"
  }
}
```

**Note**: Sensitive headers (Authorization, Cookie) are never logged.

---

## Deployment Security

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `SESSION_SECRET`
- [ ] Use HTTPS (configure reverse proxy)
- [ ] Set up firewall rules
- [ ] Disable verbose logging
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup data files
- [ ] Review and minimize CORS origins

### Docker Deployment (Secure)

Use the secure Dockerfile:

```bash
docker build -f Dockerfile.secure -t social-analyzer:secure .
docker run -d \
  -p 9005:9005 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your-secret \
  --read-only \
  --tmpfs /app/logs:rw,size=100m \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  social-analyzer:secure
```

### Reverse Proxy (Nginx)

**Recommended configuration**:

```nginx
server {
    listen 443 ssl http2;
    server_name social-analyzer.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:9005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Firewall Rules

```bash
# Allow only necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 443/tcp  # HTTPS
ufw enable
```

### System Hardening

1. **Keep system updated**:

```bash
apt update && apt upgrade -y
```

2. **Disable unnecessary services**
3. **Set up fail2ban** for SSH
4. **Use AppArmor or SELinux**
5. **Regular security audits**

---

## Security Testing

### Manual Testing

Use the **Test Harness**: `http://localhost:9005/test-harness.html`

Features:

- Configuration management
- API testing
- Security test suite
- Response inspection
- Request logging

### Automated Tests

Run security tests:

```bash
# All tests
npm test

# Security tests only
npm run test:security

# With coverage
npm test -- --coverage
```

### Security Test Suite

Tests include:

- ✓ XSS injection attempts
- ✓ SQL injection attempts
- ✓ Path traversal attempts
- ✓ Command injection attempts
- ✓ LDAP injection attempts
- ✓ NoSQL injection attempts
- ✓ Template injection attempts
- ✓ SSRF attempts
- ✓ Length-based attacks
- ✓ Unicode/encoding attacks
- ✓ Rate limiting validation

### Penetration Testing

Recommended tools:

- **OWASP ZAP**: Web application security scanner
- **Burp Suite**: Manual penetration testing
- **sqlmap**: SQL injection testing (defensive)
- **XSStrike**: XSS vulnerability scanner

### Vulnerability Scanning

```bash
# NPM audit
npm audit

# Fix vulnerabilities
npm audit fix

# Check with Makefile
make security-check
```

---

## Incident Response

### Security Incident Handling

1. **Detect**: Monitor logs for suspicious activity
2. **Contain**: Block malicious IPs, disable affected features
3. **Investigate**: Review logs, identify breach scope
4. **Remediate**: Patch vulnerabilities, update credentials
5. **Document**: Record incident details and lessons learned

### Log Monitoring

Monitor for:

- Multiple failed validation attempts
- Rate limit violations
- Suspicious patterns in requests
- Unusual error rates
- Unexpected traffic spikes

### Emergency Contacts

- Security team: [security@example.com]
- System admin: [admin@example.com]
- Emergency hotline: [+1-xxx-xxx-xxxx]

---

## Security Checklist

### Development

- [ ] All inputs validated
- [ ] All outputs sanitized
- [ ] No sensitive data in logs
- [ ] Error messages non-leaking
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Rate limiting active
- [ ] Dependencies up to date
- [ ] Security tests passing

### Deployment

- [ ] Production environment set
- [ ] Strong session secret
- [ ] HTTPS configured
- [ ] Firewall rules set
- [ ] Monitoring configured
- [ ] Backups scheduled
- [ ] Reverse proxy configured
- [ ] Security audit completed

### Maintenance

- [ ] Regular security updates
- [ ] Log review (weekly)
- [ ] Vulnerability scanning (monthly)
- [ ] Penetration testing (quarterly)
- [ ] Backup testing (monthly)
- [ ] Incident response drill (annually)

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email: security@example.com
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

Expected response time: 48 hours

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Docker Security](https://docs.docker.com/engine/security/)

---

## Version History

- **v2.1.0** (2025-11-18): Comprehensive security refactoring
  - Added input validation
  - Implemented CSRF protection
  - Added security headers
  - Environment-driven configuration
  - Non-leaking error messages
  - Rate limiting
  - Security test suite

---

**Last Updated**: 2025-11-18
**Review Frequency**: Quarterly
**Next Review**: 2026-02-18
