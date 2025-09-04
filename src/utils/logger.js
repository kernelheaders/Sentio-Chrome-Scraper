/**
 * Controlled logging utility for Chrome extension
 * Automatically removes logs in production builds
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    // Detect environment safely in browser/extension contexts
    const env = (typeof process !== 'undefined' && process?.env?.NODE_ENV) || 'development';
    this.currentLevel = env === 'production' ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG;
    this.isDevelopment = env !== 'production';
    try {
      // Lazy import to avoid circular deps
      const cfgMod = requireLike('../utils/config.js');
      this.devLogEndpoint = cfgMod?.config?.devLogEndpoint || null;
    } catch (_) { this.devLogEndpoint = null; }
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[Sentio Extension] ${timestamp} [${level}]`;
    
    if (context) {
      return [`${prefix} ${message}`, context];
    }
    
    return `${prefix} ${message}`;
  }

  /**
   * Log error messages (always shown)
   */
  error(message, context = null) {
    if (this.currentLevel >= LOG_LEVELS.ERROR) {
      const formatted = this.formatMessage('ERROR', message, context);
      if (context) {
        console.error(formatted[0], formatted[1]);
      } else {
        console.error(formatted);
      }
      this.forwardDevLog('ERROR', message, context);
    }
  }

  /**
   * Log warning messages
   */
  warn(message, context = null) {
    if (this.currentLevel >= LOG_LEVELS.WARN) {
      const formatted = this.formatMessage('WARN', message, context);
      if (context) {
        console.warn(formatted[0], formatted[1]);
      } else {
        console.warn(formatted);
      }
      this.forwardDevLog('WARN', message, context);
    }
  }

  /**
   * Log info messages
   */
  info(message, context = null) {
    if (this.currentLevel >= LOG_LEVELS.INFO) {
      const formatted = this.formatMessage('INFO', message, context);
      if (context) {
        console.info(formatted[0], formatted[1]);
      } else {
        console.info(formatted);
      }
      this.forwardDevLog('INFO', message, context);
    }
  }

  /**
   * Log debug messages (development only)
   */
  debug(message, context = null) {
    if (this.currentLevel >= LOG_LEVELS.DEBUG && this.isDevelopment) {
      const formatted = this.formatMessage('DEBUG', message, context);
      if (context) {
        console.debug(formatted[0], formatted[1]);
      } else {
        console.debug(formatted);
      }
      this.forwardDevLog('DEBUG', message, context);
    }
  }

  /**
   * Log API requests (development only)
   */
  logApiRequest(method, url, headers = null) {
    if (this.isDevelopment) {
      this.debug(`API Request: ${method} ${url}`, { headers });
    }
  }

  /**
   * Log API responses (development only)
   */
  logApiResponse(status, url, responseTime = null) {
    if (this.isDevelopment) {
      const message = `API Response: ${status} ${url}`;
      const context = responseTime ? { responseTime: `${responseTime}ms` } : null;
      this.debug(message, context);
    }
  }

  /**
   * Log job execution events
   */
  logJobEvent(jobId, event, details = null) {
    const message = `Job ${jobId}: ${event}`;
    this.info(message, details);
  }

  /**
   * Log security events (always logged)
   */
  logSecurityEvent(event, details = null) {
    const message = `Security Event: ${event}`;
    this.error(message, details);
  }

  /**
   * Log performance metrics (development only)
   */
  logPerformance(operation, duration, details = null) {
    if (this.isDevelopment) {
      const message = `Performance: ${operation} took ${duration}ms`;
      this.debug(message, details);
    }
  }

  /**
   * Create a timer for performance measurement
   */
  timer(label) {
    if (this.isDevelopment) {
      const startTime = performance.now();
      return {
        end: () => {
          const duration = Math.round(performance.now() - startTime);
          this.logPerformance(label, duration);
          return duration;
        }
      };
    }
    
    // Return no-op timer in production
    return {
      end: () => 0
    };
  }

  /**
   * Set log level dynamically
   */
  setLevel(level) {
    if (level in LOG_LEVELS) {
      this.currentLevel = LOG_LEVELS[level];
    }
  }

  forwardDevLog(level, message, context = null) {
    try {
      if (!this.isDevelopment || !this.devLogEndpoint) return;
      const source = typeof window !== 'undefined' && window?.location ? 'content' : 'background';
      const payload = {
        level,
        message,
        context,
        source,
        url: (typeof window !== 'undefined' && window?.location?.href) ? window.location.href : undefined,
        ts: Date.now()
      };
      // Prefer sendBeacon in content; fetch in worker
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(this.devLogEndpoint, blob);
      } else {
        fetch(this.devLogEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
          .catch(() => {});
      }
    } catch (_) {}
  }
}

// Create singleton instance
export const logger = new Logger();

// Simple CommonJS-like require for ESM context (best-effort)
function requireLike(relPath) {
  try {
    // eslint-disable-next-line no-new-func
    const req = new Function('path', 'return import(path)');
    // Dynamic import cannot be sync; return undefined if unavailable
    return undefined;
  } catch (_) {
    return undefined;
  }
}
