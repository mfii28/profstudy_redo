/**
 * @fileOverview Structured logging service.
 * Logs to console - extend with @sentry/node in production for error aggregation.
 */

import { v4 as uuidv4 } from 'uuid';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
}

const APP_ENV = process.env.NODE_ENV || 'development';

function generateRequestId(): string {
  return `req-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

function formatLogEntry(entry: LogEntry): string {
  const parts: string[] = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    entry.message,
  ];
  
  if (entry.requestId) {
    parts.push(`[req:${entry.requestId}]`);
  }
  if (entry.userId) {
    parts.push(`[uid:${entry.userId}]`);
  }
  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }
  
  return parts.join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function tryCaptureSentry(_entry: LogEntry): Promise<void> {
  // Sentry integration is handled at the infrastructure level.
  // Dynamic @sentry/node import removed to prevent node: built-in bundling errors.
}

const sanitizeContext = (context?: Record<string, unknown>): Record<string, unknown> => {
  if (!context) return {};
  
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'credential'];
  
  for (const [key, value] of Object.entries(context)) {
    const isSensitive = sensitiveKeys.some(sk => 
      key.toLowerCase().includes(sk.toLowerCase())
    );
    
    if (isSensitive && typeof value === 'string') {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = '[OBJECT]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

export const createLogger = (defaultContext?: Record<string, unknown>, defaultRequestId?: string) => {
  const baseContext = defaultContext || {};
  const baseRequestId = defaultRequestId;
  
  const log = async (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      id: generateRequestId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      context: sanitizeContext({ ...baseContext, ...context }),
      requestId: baseRequestId,
    };
    
    const formatted = formatLogEntry(entry);
    const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[method](formatted);
    
    await tryCaptureSentry(entry);
  };
  
  return {
    debug: async (message: string, context?: Record<string, unknown>) => {
      if (APP_ENV === 'production') return;
      await log('debug', message, context);
    },
    
    info: async (message: string, context?: Record<string, unknown>) => {
      await log('info', message, context);
    },
    
    warn: async (message: string, context?: Record<string, unknown>) => {
      await log('warn', message, context);
    },
    
    error: async (message: string, context?: Record<string, unknown>) => {
      await log('error', message, context);
    },
    
    withRequest: (requestId: string) => createLogger(baseContext, requestId),
    withUser: (userId: string) => createLogger({ ...baseContext, userId }, baseRequestId),
  };
};

export const logger = createLogger();

export function logApiCall(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context?: Record<string, unknown>
) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  logger[level](`${method} ${path} -> ${statusCode}`, { ...context, duration });
}

export function logError(
  error: Error,
  context?: Record<string, unknown>
) {
  logger.error(error.message, {
    ...context,
    name: error.name,
    stack: APP_ENV === 'development' ? error.stack : undefined,
  });
}