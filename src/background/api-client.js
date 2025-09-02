/**
 * Secure API client for Sentio Chrome Extension
 * Handles all communication with the central API server
 */
import { logger } from '../utils/logger.js';
import { generateAuthHeaders } from '../utils/crypto.js';
import { secureStorage } from '../utils/storage.js';
import { validateApiKey } from '../utils/validators.js';
import { API_ENDPOINTS, CONFIG, ErrorCodes } from '../shared/types.js';
import { config } from '../utils/config.js';

export class ApiClient {
  constructor() {
    this.baseUrl = config.apiBaseUrl;
    this.requestTimeout = CONFIG.REQUEST_TIMEOUT;
    this.maxRetries = CONFIG.MAX_RETRIES;
    
    // Log configuration for debugging
    if (config.isDevelopment) {
      logger.info('API Client initialized in development mode', {
        baseUrl: this.baseUrl,
        devMode: true
      });
    }
  }

  /**
   * Make authenticated API request
   */
  async makeRequest(endpoint, options = {}) {
    const apiKey = await secureStorage.getApiKey();
    
    if (!apiKey) {
      throw new Error(ErrorCodes.INVALID_API_KEY);
    }

    const url = `${this.baseUrl}${endpoint}`;
    const method = options.method || 'GET';
    const body = options.body || null;
    
    // Generate authentication headers
    const headers = {
      ...generateAuthHeaders(apiKey, method, url, body),
      ...options.headers
    };

    const requestOptions = {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(this.requestTimeout)
    };

    const timer = logger.timer(`API ${method} ${endpoint}`);
    logger.logApiRequest(method, url);

    try {
      const response = await this.makeRequestWithRetry(url, requestOptions);
      const responseTime = timer.end();
      
      logger.logApiResponse(response.status, url, responseTime);
      
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
      
    } catch (error) {
      timer.end();
      
      if (error.name === 'AbortError') {
        throw new Error(ErrorCodes.TIMEOUT);
      }
      
      if (error.name === 'TypeError') {
        throw new Error(ErrorCodes.NETWORK_ERROR);
      }
      
      throw error;
    }
  }

  /**
   * Make request with exponential backoff retry
   */
  async makeRequestWithRetry(url, options, attempt = 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      logger.debug(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.makeRequestWithRetry(url, options, attempt + 1);
    }
  }

  /**
   * Handle error responses from API
   */
  async handleErrorResponse(response) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode = ErrorCodes.UNKNOWN_ERROR;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code || errorCode;
    } catch {
      // Failed to parse error response, use default message
    }

    // Map HTTP status codes to error codes
    switch (response.status) {
      case 401:
        errorCode = ErrorCodes.INVALID_API_KEY;
        break;
      case 429:
        errorCode = ErrorCodes.RATE_LIMITED;
        break;
      case 408:
      case 504:
        errorCode = ErrorCodes.TIMEOUT;
        break;
      case 500:
      case 502:
      case 503:
        errorCode = ErrorCodes.NETWORK_ERROR;
        break;
    }

    logger.error(`API Error: ${errorMessage}`, { status: response.status, code: errorCode });
    
    const error = new Error(errorMessage);
    error.code = errorCode;
    error.status = response.status;
    
    throw error;
  }

  /**
   * Validate API key with server
   */
  async validateApiKey(apiKey) {
    try {
      // First validate format locally
      const validation = validateApiKey(apiKey);
      if (!validation.isValid) {
        logger.warn('API key format invalid:', validation.errors);
        return false;
      }

      // Store temporarily for the validation request
      const currentKey = await secureStorage.getApiKey();
      await secureStorage.setApiKey(apiKey);

      try {
        const response = await this.makeRequest(API_ENDPOINTS.VALIDATE_KEY, {
          method: 'POST'
        });

        logger.info('API key validation successful');
        return response.valid === true;
        
      } catch (error) {
        logger.warn('API key validation failed:', error.message);
        
        // Restore previous key if validation failed
        if (currentKey) {
          await secureStorage.setApiKey(currentKey);
        } else {
          await secureStorage.clearApiKey();
        }
        
        return false;
      }

    } catch (error) {
      logger.error('API key validation error:', error);
      return false;
    }
  }

  /**
   * Fetch pending jobs from server
   */
  async fetchPendingJobs() {
    try {
      const response = await this.makeRequest(API_ENDPOINTS.GET_JOBS);
      
      if (response.jobs && Array.isArray(response.jobs)) {
        logger.info(`Fetched ${response.jobs.length} pending job(s)`);
        return response.jobs;
      }
      
      return [];
      
    } catch (error) {
      if (error.code === ErrorCodes.INVALID_API_KEY) {
        // API key is invalid, clear it
        await secureStorage.clearApiKey();
        logger.logSecurityEvent('Invalid API key detected during job fetch');
      }
      
      logger.error('Failed to fetch pending jobs:', error);
      throw error;
    }
  }

  /**
   * Submit job results to server
   */
  async submitJobResult(result) {
    try {
      const response = await this.makeRequest(API_ENDPOINTS.SUBMIT_RESULTS, {
        method: 'POST',
        body: result
      });

      logger.info(`Job result submitted successfully: ${result.jobId}`);
      return response;
      
    } catch (error) {
      logger.error(`Failed to submit job result for ${result.jobId}:`, error);
      
      // Store failed result for retry (implement retry queue if needed)
      // For now, we'll just log and throw
      throw error;
    }
  }

  /**
   * Check API server health
   */
  async checkHealth() {
    try {
      const response = await this.makeRequest(API_ENDPOINTS.HEALTH);
      return response.status === 'healthy';
      
    } catch (error) {
      logger.warn('Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get user account info
   */
  async getAccountInfo() {
    try {
      const response = await this.makeRequest('/account/info');
      return response;
      
    } catch (error) {
      logger.error('Failed to fetch account info:', error);
      throw error;
    }
  }

  /**
   * Report job execution metrics
   */
  async reportMetrics(metrics) {
    try {
      await this.makeRequest('/metrics', {
        method: 'POST',
        body: metrics
      });
      
      logger.debug('Metrics reported successfully');
      
    } catch (error) {
      // Don't throw on metrics errors, just log
      logger.warn('Failed to report metrics:', error.message);
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimit() {
    try {
      const response = await this.makeRequest('/rate-limit');
      return {
        limit: response.limit,
        remaining: response.remaining,
        resetTime: response.resetTime
      };
      
    } catch (error) {
      logger.warn('Failed to get rate limit info:', error.message);
      return null;
    }
  }

  /**
   * Update request timeout
   */
  setTimeout(timeout) {
    this.requestTimeout = timeout;
    logger.debug(`Request timeout updated to ${timeout}ms`);
  }

  /**
   * Update base URL (for testing or different environments)
   */
  setBaseUrl(url) {
    this.baseUrl = url;
    logger.debug(`Base URL updated to ${url}`);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    // This could be enhanced to track request counts, latencies, etc.
    return {
      baseUrl: this.baseUrl,
      timeout: this.requestTimeout,
      maxRetries: this.maxRetries
    };
  }
}