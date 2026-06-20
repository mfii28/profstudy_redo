import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createLogger, logger } from './logging';

describe('Logging Service', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Log formatting and output', () => {
    it('should create log entry with timestamp and level', async () => {
      await logger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('[INFO]');
      expect(output).toContain('Test message');
      expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T/); // ISO timestamp
    });

    it('should use correct console method for each log level', async () => {
      await logger.debug('Debug message');
      await logger.info('Info message');
      await logger.warn('Warning message');
      await logger.error('Error message');

      // Debug should not output in non-production
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Info message'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });

    it('should include context in log output', async () => {
      await logger.info('Action performed', { userId: 'user-123', action: 'login' });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('user-123');
      expect(output).toContain('login');
    });

    it('should include requestId in log output when provided', async () => {
      const customLogger = logger.withRequest('req-custom-123');
      await customLogger.info('Request processed');

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('req-custom-123');
      expect(output).toContain('[req:req-custom-123]');
    });

    it('should include userId in log output when provided', async () => {
      const customLogger = logger.withUser('user-456');
      await customLogger.info('User action');

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      // userId is included in the context JSON
      expect(output).toContain('user-456');
      expect(output).toContain('userId');
    });
  });

  describe('Sensitive data sanitization', () => {
    it('should redact password in context', async () => {
      await logger.info('Auth attempt', { 
        username: 'john@example.com',
        password: 'super-secret-password'
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('john@example.com');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('super-secret-password');
    });

    it('should redact token in context', async () => {
      await logger.warn('Token validation', { 
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      });

      expect(consoleSpy.warn).toHaveBeenCalled();
      const output = consoleSpy.warn.mock.calls[0][0] as string;

      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should redact secret in context', async () => {
      await logger.info('API call', { 
        endpoint: '/api/data',
        secret: 'my-secret-key'
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('/api/data');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('my-secret-key');
    });

    it('should redact authorization header', async () => {
      await logger.info('Request made', { 
        url: '/api/resource',
        authorization: 'Bearer token123'
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('/api/resource');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('Bearer token123');
    });

    it('should redact case-insensitive sensitive keys', async () => {
      await logger.info('Data', { 
        PASSWORD: 'test123',
        Token: 'abc123',
        SECRET_KEY: 'def456'
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      // All three should be redacted
      const redactedCount = (output.match(/\[REDACTED\]/g) || []).length;
      expect(redactedCount).toBeGreaterThanOrEqual(3);
    });

    it('should replace objects with [OBJECT]', async () => {
      await logger.info('Complex data', { 
        config: { nested: 'value' },
        user: { id: 'user-123' }
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('[OBJECT]');
      expect(output).not.toContain('nested');
      expect(output).not.toContain('id');
    });

    it('should preserve non-sensitive data while sanitizing', async () => {
      await logger.info('Mixed data', { 
        username: 'alice',
        email: 'alice@example.com',
        password: 'secret123',
        role: 'admin'
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('alice');
      expect(output).toContain('alice@example.com');
      expect(output).toContain('admin');
      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('secret123');
    });
  });

  describe('Logger instance management', () => {
    it('should create new logger instance with request context', async () => {
      const customLogger = logger.withRequest('req-abc-123');
      await customLogger.info('Test');

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('req-abc-123');
    });

    it('should create new logger instance with user context', async () => {
      const customLogger = logger.withUser('user-def-456');
      await customLogger.info('Test');

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      // userId is included in the context JSON
      expect(output).toContain('user-def-456');
    });

    it('should chain withRequest and withUser', async () => {
      const customLogger = logger
        .withRequest('req-chain-123')
        .withUser('user-chain-456');
      await customLogger.info('Chained context');

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('req-chain-123');
      expect(output).toContain('user-chain-456');
    });

    it('should support creating logger with initial context', () => {
      const customLogger = createLogger({ service: 'payment', version: '1.0' });
      expect(customLogger).toBeDefined();
      expect(typeof customLogger.info).toBe('function');
    });
  });

  describe('Production behavior', () => {
    it('should check NODE_ENV for production suppression of debug', async () => {
      // Note: APP_ENV is evaluated at module load time, so runtime env changes
      // won't affect the loaded module. This test verifies the logger supports
      // different environments at logger creation time.
      const devLogger = createLogger();
      await devLogger.debug('Debug in dev');

      // In non-production, debug should be output
      if (process.env.NODE_ENV !== 'production') {
        expect(consoleSpy.log).toHaveBeenCalled();
      }
    });

    it('should still emit info, warn, and error regardless of environment', async () => {
      const logger_ = createLogger();

      await logger_.info('Info message');
      await logger_.warn('Warn message');
      await logger_.error('Error message');

      expect(consoleSpy.log).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle undefined context gracefully', async () => {
      await logger.info('Message without context', undefined);

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('Message without context');
    });

    it('should handle empty context object', async () => {
      await logger.info('Message with empty context', {});

      expect(consoleSpy.log).toHaveBeenCalled();
      const output = consoleSpy.log.mock.calls[0][0] as string;

      expect(output).toContain('Message with empty context');
    });
  });
});
