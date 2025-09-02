/**
 * Anti-detection measures for Sentio Chrome Extension
 * Implements sophisticated techniques to avoid bot detection
 */
import { logger } from '../utils/logger.js';

export class AntiDetection {
  constructor() {
    this.isInitialized = false;
    this.originalFunctions = new Map();
    this.spoofedProperties = new Map();
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.sessionStartTime = Date.now();
  }

  /**
   * Initialize anti-detection measures
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      logger.debug('Initializing anti-detection measures');

      // Spoof navigator properties
      this.spoofNavigatorProperties();
      
      // Override detection methods
      this.overrideDetectionMethods();
      
      // Randomize timing patterns
      this.initializeTimingRandomization();
      
      // Hide extension traces
      this.hideExtensionTraces();
      
      // Set up viewport randomization
      this.randomizeViewport();

      this.isInitialized = true;
      logger.debug('Anti-detection initialization completed');

    } catch (error) {
      logger.error('Failed to initialize anti-detection:', error);
    }
  }

  /**
   * Spoof navigator properties to appear more human
   */
  spoofNavigatorProperties() {
    try {
      // Spoof webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });

      // Add realistic plugins
      this.addRealisticPlugins();
      
      // Spoof screen properties
      this.spoofScreenProperties();
      
      // Add realistic languages
      this.spoofLanguageProperties();

    } catch (error) {
      logger.debug('Failed to spoof navigator properties:', error);
    }
  }

  /**
   * Override common detection methods
   */
  overrideDetectionMethods() {
    try {
      // Override console.clear to prevent detection
      const originalClear = console.clear;
      console.clear = function() {
        // Do nothing
      };
      this.originalFunctions.set('console.clear', originalClear);

      // Override Date.getTime for timing attacks
      this.randomizeTimingFunctions();

      // Override mouse event properties
      this.enhanceMouseEvents();

      // Override request timing
      this.wrapNetworkFunctions();

    } catch (error) {
      logger.debug('Failed to override detection methods:', error);
    }
  }

  /**
   * Add realistic browser plugins
   */
  addRealisticPlugins() {
    try {
      const plugins = [
        {
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          description: 'Portable Document Format'
        },
        {
          name: 'Chrome PDF Viewer',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          description: 'Portable Document Format'
        },
        {
          name: 'Native Client',
          filename: 'internal-nacl-plugin',
          description: 'Native Client'
        }
      ];

      // This is a simplified implementation
      // In a real scenario, you'd need more sophisticated plugin spoofing
      logger.debug('Added realistic plugins');

    } catch (error) {
      logger.debug('Failed to add realistic plugins:', error);
    }
  }

  /**
   * Spoof screen properties for consistency
   */
  spoofScreenProperties() {
    try {
      // Common desktop resolutions
      const resolutions = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 }
      ];

      const resolution = resolutions[Math.floor(Math.random() * resolutions.length)];

      Object.defineProperty(screen, 'width', {
        get: () => resolution.width,
        configurable: true
      });

      Object.defineProperty(screen, 'height', {
        get: () => resolution.height,
        configurable: true
      });

    } catch (error) {
      logger.debug('Failed to spoof screen properties:', error);
    }
  }

  /**
   * Spoof language properties
   */
  spoofLanguageProperties() {
    try {
      const languages = ['tr-TR', 'en-US', 'tr'];
      
      Object.defineProperty(navigator, 'languages', {
        get: () => languages,
        configurable: true
      });

      Object.defineProperty(navigator, 'language', {
        get: () => 'tr-TR',
        configurable: true
      });

    } catch (error) {
      logger.debug('Failed to spoof language properties:', error);
    }
  }

  /**
   * Randomize timing functions to avoid detection
   */
  randomizeTimingFunctions() {
    try {
      const originalNow = Date.now;
      const originalGetTime = Date.prototype.getTime;
      const originalPerformanceNow = performance.now;

      // Add small random variations to timing
      Date.now = function() {
        return originalNow.call(Date) + Math.random() * 2 - 1;
      };

      Date.prototype.getTime = function() {
        return originalGetTime.call(this) + Math.random() * 2 - 1;
      };

      performance.now = function() {
        return originalPerformanceNow.call(performance) + Math.random() * 0.1;
      };

      this.originalFunctions.set('Date.now', originalNow);
      this.originalFunctions.set('Date.prototype.getTime', originalGetTime);
      this.originalFunctions.set('performance.now', originalPerformanceNow);

    } catch (error) {
      logger.debug('Failed to randomize timing functions:', error);
    }
  }

  /**
   * Enhance mouse events to appear more natural
   */
  enhanceMouseEvents() {
    try {
      const originalAddEventListener = EventTarget.prototype.addEventListener;

      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (type.startsWith('mouse')) {
          const enhancedListener = function(event) {
            // Add small random variations to mouse coordinates
            if (event.clientX !== undefined) {
              Object.defineProperty(event, 'clientX', {
                value: event.clientX + (Math.random() - 0.5) * 2,
                writable: false
              });
            }
            
            if (event.clientY !== undefined) {
              Object.defineProperty(event, 'clientY', {
                value: event.clientY + (Math.random() - 0.5) * 2,
                writable: false
              });
            }

            return listener.call(this, event);
          };

          return originalAddEventListener.call(this, type, enhancedListener, options);
        }

        return originalAddEventListener.call(this, type, listener, options);
      };

      this.originalFunctions.set('addEventListener', originalAddEventListener);

    } catch (error) {
      logger.debug('Failed to enhance mouse events:', error);
    }
  }

  /**
   * Wrap network functions to control request patterns
   */
  wrapNetworkFunctions() {
    try {
      const originalFetch = window.fetch;
      const self = this;

      window.fetch = async function(...args) {
        // Rate limiting
        await self.enforceRateLimit();
        
        // Add random delays
        await self.addRequestDelay();
        
        return originalFetch.apply(this, args);
      };

      this.originalFunctions.set('fetch', originalFetch);

    } catch (error) {
      logger.debug('Failed to wrap network functions:', error);
    }
  }

  /**
   * Hide extension traces
   */
  hideExtensionTraces() {
    try {
      // Remove chrome-extension URLs from error stack traces
      const originalError = Error;
      
      Error = function(...args) {
        const error = new originalError(...args);
        
        if (error.stack) {
          error.stack = error.stack.replace(/chrome-extension:\/\/[^\/]+/g, 'https://www.sahibinden.com');
        }
        
        return error;
      };

      Error.prototype = originalError.prototype;
      this.originalFunctions.set('Error', originalError);

    } catch (error) {
      logger.debug('Failed to hide extension traces:', error);
    }
  }

  /**
   * Randomize viewport to avoid fingerprinting
   */
  randomizeViewport() {
    try {
      // Add small random variations to viewport dimensions
      const originalInnerWidth = window.innerWidth;
      const originalInnerHeight = window.innerHeight;

      Object.defineProperty(window, 'innerWidth', {
        get: () => originalInnerWidth + Math.floor(Math.random() * 10) - 5,
        configurable: true
      });

      Object.defineProperty(window, 'innerHeight', {
        get: () => originalInnerHeight + Math.floor(Math.random() * 10) - 5,
        configurable: true
      });

    } catch (error) {
      logger.debug('Failed to randomize viewport:', error);
    }
  }

  /**
   * Initialize timing randomization patterns
   */
  initializeTimingRandomization() {
    try {
      // Create realistic timing patterns
      this.timingPatterns = {
        mouseMove: () => 16 + Math.random() * 8, // 16-24ms (60fps variation)
        scroll: () => 33 + Math.random() * 17,   // 33-50ms
        click: () => 100 + Math.random() * 50,   // 100-150ms
        keypress: () => 50 + Math.random() * 100 // 50-150ms
      };

    } catch (error) {
      logger.debug('Failed to initialize timing randomization:', error);
    }
  }

  /**
   * Enforce rate limiting for requests
   */
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000; // Minimum 1 second between requests

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Add random delay to requests
   */
  async addRequestDelay() {
    const delay = 100 + Math.random() * 300; // 100-400ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Before job execution - apply additional measures
   */
  async beforeJobExecution() {
    try {
      // Clear any detection cookies
      await this.clearDetectionCookies();
      
      // Randomize user agent if needed
      this.randomizeUserAgent();
      
      // Add execution jitter
      const jitter = Math.random() * 2000 + 1000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, jitter));

      logger.debug('Pre-execution anti-detection measures applied');

    } catch (error) {
      logger.debug('Failed to apply pre-execution measures:', error);
    }
  }

  /**
   * After job execution - cleanup and reset
   */
  async afterJobExecution() {
    try {
      // Reset request counters
      this.requestCount = 0;
      
      // Add post-execution delay
      const delay = Math.random() * 3000 + 2000; // 2-5 seconds
      await new Promise(resolve => setTimeout(resolve, delay));

      logger.debug('Post-execution anti-detection measures applied');

    } catch (error) {
      logger.debug('Failed to apply post-execution measures:', error);
    }
  }

  /**
   * Clear detection-related cookies
   */
  async clearDetectionCookies() {
    try {
      const detectionCookies = ['_bot_detection', '_automated_browser', '_webdriver'];
      
      for (const cookieName of detectionCookies) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }

    } catch (error) {
      logger.debug('Failed to clear detection cookies:', error);
    }
  }

  /**
   * Randomize user agent (limited scope for consistency)
   */
  randomizeUserAgent() {
    try {
      // Only make minor version changes to maintain consistency
      const currentUA = navigator.userAgent;
      const versionMatch = currentUA.match(/Chrome\/(\d+\.\d+\.\d+)\.\d+/);
      
      if (versionMatch) {
        const baseVersion = versionMatch[1];
        const minorVersion = Math.floor(Math.random() * 100);
        const newUA = currentUA.replace(
          /Chrome\/\d+\.\d+\.\d+\.\d+/,
          `Chrome/${baseVersion}.${minorVersion}`
        );

        // This is limited in modern browsers, but we try
        Object.defineProperty(navigator, 'userAgent', {
          value: newUA,
          writable: false,
          configurable: true
        });
      }

    } catch (error) {
      logger.debug('Failed to randomize user agent:', error);
    }
  }

  /**
   * Get detection statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      sessionTime: Date.now() - this.sessionStartTime,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      spoofedPropertiesCount: this.spoofedProperties.size,
      overriddenFunctionsCount: this.originalFunctions.size
    };
  }

  /**
   * Restore original functions (for cleanup)
   */
  restore() {
    try {
      for (const [name, originalFunction] of this.originalFunctions) {
        // Restore original functions where possible
        if (name === 'console.clear') {
          console.clear = originalFunction;
        } else if (name === 'fetch') {
          window.fetch = originalFunction;
        }
        // Add more restorations as needed
      }

      this.originalFunctions.clear();
      this.spoofedProperties.clear();
      this.isInitialized = false;

      logger.debug('Anti-detection measures restored');

    } catch (error) {
      logger.error('Failed to restore original functions:', error);
    }
  }
}