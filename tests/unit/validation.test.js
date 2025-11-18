/**
 * Unit tests for input validation module
 */

import { expect } from 'chai';
import {
  ValidationError,
  validateUsername,
  validateUsernames,
  validateUUID,
  validateUrl,
  validateMode,
  sanitizeText,
  escapeRegex
} from '../../modules/validation.js';

describe('Validation Module', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('johndoe')).to.equal('johndoe');
      expect(validateUsername('john_doe')).to.equal('john_doe');
      expect(validateUsername('john.doe')).to.equal('john.doe');
      expect(validateUsername('john-doe123')).to.equal('john-doe123');
    });

    it('should trim whitespace', () => {
      expect(validateUsername('  johndoe  ')).to.equal('johndoe');
    });

    it('should reject empty usernames', () => {
      expect(() => validateUsername('')).to.throw(ValidationError);
      expect(() => validateUsername('  ')).to.throw(ValidationError);
    });

    it('should reject usernames with special characters', () => {
      expect(() => validateUsername('john<script>')).to.throw(ValidationError);
      expect(() => validateUsername('john@doe')).to.throw(ValidationError);
      expect(() => validateUsername('john!doe')).to.throw(ValidationError);
    });

    it('should reject usernames that are too long', () => {
      const longUsername = 'a'.repeat(101);
      expect(() => validateUsername(longUsername)).to.throw(ValidationError);
    });

    it('should reject path traversal attempts', () => {
      expect(() => validateUsername('../../../etc/passwd')).to.throw(ValidationError);
      expect(() => validateUsername('user/../admin')).to.throw(ValidationError);
    });

    it('should reject SQL injection attempts', () => {
      expect(() => validateUsername("admin'--")).to.throw(ValidationError);
      expect(() => validateUsername('DROP TABLE users')).to.throw(ValidationError);
      expect(() => validateUsername('SELECT * FROM')).to.throw(ValidationError);
    });
  });

  describe('validateUsernames', () => {
    it('should validate comma-separated usernames', () => {
      const result = validateUsernames('john,jane,bob');
      expect(result).to.deep.equal(['john', 'jane', 'bob']);
    });

    it('should trim whitespace from usernames', () => {
      const result = validateUsernames(' john , jane , bob ');
      expect(result).to.deep.equal(['john', 'jane', 'bob']);
    });

    it('should reject if any username is invalid', () => {
      expect(() => validateUsernames('john,<script>,bob')).to.throw(ValidationError);
    });

    it('should limit number of usernames', () => {
      const manyUsernames = Array(51).fill('user').join(',');
      expect(() => validateUsernames(manyUsernames)).to.throw(ValidationError);
    });
  });

  describe('validateUUID', () => {
    it('should accept valid UUIDs', () => {
      expect(validateUUID('abc123')).to.equal('abc123');
      expect(validateUUID('test-uuid-123')).to.equal('test-uuid-123');
    });

    it('should reject UUIDs with special characters', () => {
      expect(() => validateUUID('abc/../123')).to.throw(ValidationError);
      expect(() => validateUUID('abc<script>123')).to.throw(ValidationError);
    });

    it('should reject UUIDs that are too short or too long', () => {
      expect(() => validateUUID('abc')).to.throw(ValidationError);
      expect(() => validateUUID('a'.repeat(51))).to.throw(ValidationError);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(validateUrl('http://example.com')).to.equal('http://example.com');
      expect(validateUrl('https://example.com/path')).to.equal('https://example.com/path');
    });

    it('should reject invalid URLs', () => {
      expect(() => validateUrl('not-a-url')).to.throw(ValidationError);
      expect(() => validateUrl('javascript:alert(1)')).to.throw(ValidationError);
    });

    it('should accept empty URLs if optional', () => {
      expect(validateUrl('', { optional: true })).to.equal('');
    });

    it('should reject URLs without protocol', () => {
      expect(() => validateUrl('example.com')).to.throw(ValidationError);
    });
  });

  describe('validateMode', () => {
    it('should accept valid modes', () => {
      expect(validateMode('fast')).to.equal('fast');
      expect(validateMode('slow')).to.equal('slow');
      expect(validateMode('special')).to.equal('special');
    });

    it('should be case-insensitive', () => {
      expect(validateMode('FAST')).to.equal('fast');
      expect(validateMode('Slow')).to.equal('slow');
    });

    it('should return default for empty mode', () => {
      expect(validateMode('')).to.equal('fast');
      expect(validateMode(null)).to.equal('fast');
    });

    it('should reject invalid modes', () => {
      expect(() => validateMode('invalid')).to.throw(ValidationError);
    });
  });

  describe('sanitizeText', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeText('<script>alert("XSS")</script>'))
        .to.include('&lt;script&gt;');
      expect(sanitizeText('Test & <b>bold</b>'))
        .to.include('&amp;').and.include('&lt;b&gt;');
    });

    it('should escape quotes', () => {
      expect(sanitizeText('He said "hello"'))
        .to.include('&quot;');
      expect(sanitizeText("It's mine"))
        .to.include('&#x27;');
    });

    it('should handle empty or non-string input', () => {
      expect(sanitizeText('')).to.equal('');
      expect(sanitizeText(null)).to.equal('');
      expect(sanitizeText(undefined)).to.equal('');
    });
  });

  describe('escapeRegex', () => {
    it('should escape regex special characters', () => {
      expect(escapeRegex('test.regex')).to.equal('test\\.regex');
      expect(escapeRegex('(test)')).to.equal('\\(test\\)');
      expect(escapeRegex('[a-z]+')).to.equal('\\[a-z\\]\\+');
    });

    it('should handle empty input', () => {
      expect(escapeRegex('')).to.equal('');
      expect(escapeRegex(null)).to.equal('');
    });
  });
});
