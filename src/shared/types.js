/**
 * Shared type definitions and constants for Sentio Chrome Extension
 */

// Job Status Types
export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Message Types for communication between components
export const MessageTypes = {
  // Service Worker → Content Script
  EXECUTE_JOB: 'execute_job',
  CANCEL_JOB: 'cancel_job',
  HEALTH_CHECK: 'health_check',
  
  // Content Script → Service Worker
  JOB_STARTED: 'job_started',
  JOB_PROGRESS: 'job_progress',
  JOB_COMPLETED: 'job_completed',
  JOB_FAILED: 'job_failed',
  HEALTH_RESPONSE: 'health_response',
  
  // Popup → Service Worker
  GET_STATUS: 'get_status',
  SET_API_KEY: 'set_api_key',
  CLEAR_API_KEY: 'clear_api_key',
  FORCE_POLL: 'force_poll',
  
  // Service Worker → Popup
  STATUS_UPDATE: 'status_update',
  API_KEY_VALIDATED: 'api_key_validated',
  API_KEY_INVALID: 'api_key_invalid'
};

// Extension States
export const ExtensionState = {
  UNAUTHORIZED: 'unauthorized',
  IDLE: 'idle',
  POLLING: 'polling',
  EXECUTING: 'executing',
  ERROR: 'error'
};

// API Endpoints
export const API_ENDPOINTS = {
  VALIDATE_KEY: '/auth/validate',
  GET_JOBS: '/jobs/pending',
  SUBMIT_RESULTS: '/jobs/results',
  HEALTH: '/health'
};

// Configuration Constants
export const CONFIG = {
  // Polling intervals (milliseconds)
  POLLING_INTERVAL_MIN: 30000,     // 30 seconds
  POLLING_INTERVAL_MAX: 300000,    // 5 minutes
  POLLING_BACKOFF_MULTIPLIER: 1.5,
  
  // Request timeouts
  REQUEST_TIMEOUT: 10000,          // 10 seconds
  MAX_RETRIES: 3,
  
  // Human simulation delays
  MIN_ACTION_DELAY: 500,           // 0.5 seconds
  MAX_ACTION_DELAY: 2000,          // 2 seconds
  MIN_SCROLL_DELAY: 200,           // 0.2 seconds
  MAX_SCROLL_DELAY: 800,           // 0.8 seconds
  
  // Security
  API_KEY_MIN_LENGTH: 32,
  MAX_CONCURRENT_JOBS: 1,
  
  // Storage keys
  STORAGE_KEYS: {
    API_KEY: 'sentio_api_key',
    LAST_POLL: 'last_poll_time',
    EXTENSION_STATE: 'extension_state',
    JOB_QUEUE: 'job_queue'
  }
};

/**
 * Job definition structure
 */
export const JobSchema = {
  id: 'string',
  token: 'string',
  type: 'string',
  config: {
    url: 'string',
    selectors: 'object',
    filters: 'object',
    maxItems: 'number',
    timeout: 'number'
  },
  createdAt: 'string',
  expiresAt: 'string'
};

/**
 * Result structure for job execution
 */
export const ResultSchema = {
  jobId: 'string',
  token: 'string',
  status: 'string',
  data: 'array',
  metadata: {
    itemsExtracted: 'number',
    executionTime: 'number',
    errors: 'array',
    userAgent: 'string',
    timestamp: 'string'
  }
};

/**
 * Error types and codes
 */
export const ErrorCodes = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  NETWORK_ERROR: 'NETWORK_ERROR',
  JOB_EXPIRED: 'JOB_EXPIRED',
  INVALID_JOB_TOKEN: 'INVALID_JOB_TOKEN',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  ANTI_BOT_DETECTED: 'ANTI_BOT_DETECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Utility functions for type validation
 */
export const TypeValidators = {
  isValidApiKey: (key) => {
    return typeof key === 'string' && 
           key.length >= CONFIG.API_KEY_MIN_LENGTH &&
           /^[A-Za-z0-9+/=]+$/.test(key);
  },
  
  isValidJob: (job) => {
    return job &&
           typeof job.id === 'string' &&
           typeof job.token === 'string' &&
           typeof job.type === 'string' &&
           job.config &&
           typeof job.config.url === 'string';
  },
  
  isValidResult: (result) => {
    return result &&
           typeof result.jobId === 'string' &&
           typeof result.token === 'string' &&
           Array.isArray(result.data);
  }
};