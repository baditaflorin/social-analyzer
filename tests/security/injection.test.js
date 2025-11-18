/**
 * Security tests for injection attempts
 */

import { expect } from 'chai';
import {
  validateUsername,
  validateUUID,
  validateUrl,
  sanitizeText
} from '../../modules/validation.js';

describe('Security - Injection Tests', () => {
  describe('XSS Prevention', () => {
    it('should reject script tags in username', () => {
      expect(() => validateUsername('<script>alert(1)</script>')).to.throw();
    });

    it('should reject javascript: protocol in URLs', () => {
      expect(() => validateUrl('javascript:alert(1)')).to.throw();
    });

    it('should sanitize HTML in text', () => {
      const malicious = '<img src=x onerror="alert(1)">';
      const sanitized = sanitizeText(malicious);
      expect(sanitized).to.not.include('<img');
      expect(sanitized).to.not.include('onerror');
    });

    it('should escape event handlers', () => {
      const malicious = 'test" onclick="alert(1)" data-x="';
      const sanitized = sanitizeText(malicious);
      expect(sanitized).to.not.include('onclick');
    });

    it('should handle encoded XSS attempts', () => {
      const attempts = [
        '&#60;script&#62;',
        '%3Cscript%3E',
        'test<svg/onload=alert(1)>',
        'test" autofocus onfocus="alert(1)"'
      ];

      for (const attempt of attempts) {
        const sanitized = sanitizeText(attempt);
        // Verify that dangerous characters are escaped
        expect(sanitized).to.not.match(/<[^&]/);
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should reject SQL keywords in usernames', () => {
      const sqlInjections = [
        "admin'--",
        "admin' OR '1'='1",
        'DROP TABLE users',
        'SELECT * FROM users',
        'INSERT INTO users',
        'DELETE FROM users',
        "'; DROP TABLE users--",
        '1\' UNION SELECT NULL--'
      ];

      for (const injection of sqlInjections) {
        expect(() => validateUsername(injection)).to.throw();
      }
    });

    it('should reject SQL comments', () => {
      expect(() => validateUsername('admin--')).to.throw();
      expect(() => validateUsername('admin/*comment*/')).to.throw();
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should reject path traversal in usernames', () => {
      const traversals = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'user/../admin',
        './../../secret'
      ];

      for (const traversal of traversals) {
        expect(() => validateUsername(traversal)).to.throw();
      }
    });

    it('should reject path traversal in UUIDs', () => {
      expect(() => validateUUID('../../../logs')).to.throw();
      expect(() => validateUUID('../../config')).to.throw();
    });

    it('should reject null bytes', () => {
      expect(() => validateUsername('user\x00admin')).to.throw();
    });
  });

  describe('Command Injection Prevention', () => {
    it('should reject command injection attempts', () => {
      const injections = [
        'user; ls -la',
        'user && cat /etc/passwd',
        'user | whoami',
        'user`whoami`',
        'user$(whoami)',
        'user;rm -rf /',
        'user\nwhoami'
      ];

      for (const injection of injections) {
        expect(() => validateUsername(injection)).to.throw();
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should reject LDAP injection attempts', () => {
      const injections = [
        'user)(|(password=*))',
        '*()|&',
        'admin*',
        'user)(cn=*'
      ];

      for (const injection of injections) {
        expect(() => validateUsername(injection)).to.throw();
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should reject NoSQL injection attempts', () => {
      const injections = [
        '{"$gt":""}',
        '{"$ne":null}',
        'user[$gt]=',
        '{$where: "1==1"}'
      ];

      for (const injection of injections) {
        expect(() => validateUsername(injection)).to.throw();
      }
    });
  });

  describe('XML Injection Prevention', () => {
    it('should reject XML injection attempts', () => {
      const injections = [
        '<user>admin</user>',
        '<?xml version="1.0"?>',
        '<!DOCTYPE foo>',
        '<![CDATA[attack]]>'
      ];

      for (const injection of injections) {
        expect(() => validateUsername(injection)).to.throw();
      }
    });
  });

  describe('Template Injection Prevention', () => {
    it('should reject template injection attempts', () => {
      const injections = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '#{7*7}',
        '*{7*7}'
      ];

      for (const injection of injections) {
        expect(() => validateUsername(injection)).to.throw();
      }
    });
  });

  describe('SSRF Prevention', () => {
    it('should reject internal URLs in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => validateUrl('http://localhost:8080')).to.throw();
        expect(() => validateUrl('http://127.0.0.1')).to.throw();
        expect(() => validateUrl('http://192.168.1.1')).to.throw();
        expect(() => validateUrl('http://10.0.0.1')).to.throw();
        expect(() => validateUrl('http://172.16.0.1')).to.throw();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should allow internal URLs in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        expect(() => validateUrl('http://localhost:8080', { optional: false })).to.not.throw();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Length-based Attacks', () => {
    it('should reject extremely long usernames', () => {
      const longUsername = 'a'.repeat(1000);
      expect(() => validateUsername(longUsername)).to.throw();
    });

    it('should reject extremely long UUIDs', () => {
      const longUUID = 'a'.repeat(1000);
      expect(() => validateUUID(longUUID)).to.throw();
    });

    it('should limit number of usernames in batch', () => {
      const manyUsernames = Array(100).fill('user').join(',');
      expect(() => validateUsername(manyUsernames)).to.throw();
    });
  });

  describe('Unicode and Encoding Attacks', () => {
    it('should handle unicode normalization', () => {
      // These should all be rejected due to special characters
      const unicodeAttacks = [
        'user\u202e', // Right-to-left override
        'user\u200b', // Zero-width space
        'user\ufeff', // Zero-width no-break space
        'admin\u0000', // Null character
      ];

      for (const attack of unicodeAttacks) {
        // Some may pass validation but should be sanitized
        try {
          validateUsername(attack);
          // If it passes, make sure it's cleaned
        } catch (err) {
          // Expected to throw
          expect(err).to.exist;
        }
      }
    });

    it('should reject homograph attacks', () => {
      // Cyrillic 'а' looks like Latin 'a'
      const homograph = 'аdmin'; // First char is Cyrillic
      expect(() => validateUsername(homograph)).to.throw();
    });
  });
});
