/**
 * Authentication manager for Sentio Chrome Extension
 * Handles API key validation and authentication state
 */
import { logger } from '../utils/logger.js';
import { secureStorage } from '../utils/storage.js';
import { validateApiKey } from '../utils/validators.js';
import { ErrorCodes } from '../shared/types.js';

export class AuthManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.isAuthenticated = false;
    this.lastValidation = null;
    this.validationCache = new Map();
    this.maxCacheAge = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Validate API key with caching
   */
  async validateApiKey(apiKey) {
    try {
      // Check format first
      const formatValidation = validateApiKey(apiKey);
      if (!formatValidation.isValid) {
        logger.warn('API key format validation failed:', formatValidation.errors);
        return false;
      }

      // Check cache for recent validation
      const cacheKey = this.hashApiKey(apiKey);
      const cached = this.validationCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.maxCacheAge) {
        logger.debug('Using cached API key validation result');
        return cached.isValid;
      }

      // Validate with server
      const isValid = await this.apiClient.validateApiKey(apiKey);
      
      // Cache the result
      this.validationCache.set(cacheKey, {
        isValid,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanValidationCache();

      if (isValid) {
        this.isAuthenticated = true;
        this.lastValidation = Date.now();
        logger.info('API key validated successfully');
      } else {
        this.isAuthenticated = false;
        logger.warn('API key validation failed');
      }

      return isValid;

    } catch (error) {
      logger.error('API key validation error:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Check if currently authenticated
   */
  async isCurrentlyAuthenticated() {
    try {
      // Quick check - do we have a stored API key?
      if (!await secureStorage.hasApiKey()) {
        this.isAuthenticated = false;
        return false;
      }

      // If we validated recently, trust that
      if (this.lastValidation && Date.now() - this.lastValidation < this.maxCacheAge) {
        return this.isAuthenticated;
      }

      // Otherwise, re-validate
      const apiKey = await secureStorage.getApiKey();
      if (!apiKey) {
        this.isAuthenticated = false;
        return false;
      }

      return await this.validateApiKey(apiKey);

    } catch (error) {
      logger.error('Authentication check failed:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Logout and clear authentication
   */
  async logout() {
    try {
      await secureStorage.clearApiKey();
      this.isAuthenticated = false;
      this.lastValidation = null;
      this.validationCache.clear();
      
      logger.info('User logged out successfully');
      return true;

    } catch (error) {
      logger.error('Logout failed:', error);
      return false;
    }
  }

  /**
   * Get authentication status
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      lastValidation: this.lastValidation,
      cacheSize: this.validationCache.size
    };
  }

  /**
   * Handle authentication errors
   */
  async handleAuthError(error) {
    if (error.code === ErrorCodes.INVALID_API_KEY) {
      logger.logSecurityEvent('Invalid API key detected, clearing authentication');
      
      // Clear invalid API key
      await secureStorage.clearApiKey();
      this.isAuthenticated = false;
      this.lastValidation = null;
      
      return true; // Handled
    }

    if (error.code === ErrorCodes.RATE_LIMITED) {
      logger.warn('Rate limited, authentication temporarily unavailable');
      // Don't clear API key for rate limiting
      return true; // Handled
    }

    return false; // Not handled
  }

  /**
   * Force re-authentication
   */
  async forceReauth() {
    try {
      this.validationCache.clear();
      this.lastValidation = null;
      
      const apiKey = await secureStorage.getApiKey();
      if (!apiKey) {
        return false;
      }

      return await this.validateApiKey(apiKey);

    } catch (error) {
      logger.error('Forced re-authentication failed:', error);
      return false;
    }
  }

  /**
   * Set API key and validate
   */
  async setApiKey(apiKey) {
    try {
      // Validate format first
      const formatValidation = validateApiKey(apiKey);
      if (!formatValidation.isValid) {
        throw new Error(`Invalid API key format: ${formatValidation.errors.join(', ')}`);
      }

      // Validate with server
      const isValid = await this.validateApiKey(apiKey);
      
      if (!isValid) {
        throw new Error('API key rejected by server');
      }

      // Store the validated key
      await secureStorage.setApiKey(apiKey);
      
      logger.info('API key set and validated successfully');
      return true;

    } catch (error) {
      logger.error('Failed to set API key:', error);
      throw error;
    }
  }

  /**
   * Get masked API key for display (security)
   */
  async getMaskedApiKey() {
    try {
      const apiKey = await secureStorage.getApiKey();
      if (!apiKey) {
        return null;
      }

      // Show first 4 and last 4 characters
      if (apiKey.length < 8) {
        return '*'.repeat(apiKey.length);
      }

      return apiKey.slice(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4);

    } catch (error) {
      logger.error('Failed to get masked API key:', error);
      return null;
    }
  }

  /**
   * Check if API key needs renewal (based on server hints)
   */
  async checkKeyRenewal() {
    try {
      // This would typically check with the server for key expiration
      // For now, we'll implement a simple time-based check
      
      if (!this.lastValidation) {
        return false;
      }

      const age = Date.now() - this.lastValidation;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      return age > maxAge;

    } catch (error) {
      logger.error('Key renewal check failed:', error);
      return false;
    }
  }

  /**
   * Generate hash of API key for caching (without storing the key)
   */
  hashApiKey(apiKey) {
    // Simple hash for cache key (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      const char = apiKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clean old validation cache entries
   */
  cleanValidationCache() {
    const now = Date.now();
    const toDelete = [];

    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > this.maxCacheAge) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.validationCache.delete(key));

    if (toDelete.length > 0) {
      logger.debug(`Cleaned ${toDelete.length} expired cache entries`);
    }
  }

  /**
   * Get validation cache statistics
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      maxAge: this.maxCacheAge,
      oldestEntry: Math.min(...Array.from(this.validationCache.values()).map(v => v.timestamp))
    };
  }
}