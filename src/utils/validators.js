/**
 * Input validation utilities for Chrome extension
 */
import { TypeValidators, CONFIG, JobSchema, ResultSchema } from '../shared/types.js';

/**
 * Validate API key format and strength
 */
export function validateApiKey(apiKey) {
  const errors = [];

  if (!apiKey) {
    errors.push('API key is required');
    return { isValid: false, errors };
  }

  if (typeof apiKey !== 'string') {
    errors.push('API key must be a string');
    return { isValid: false, errors };
  }

  if (apiKey.length < CONFIG.API_KEY_MIN_LENGTH) {
    errors.push(`API key must be at least ${CONFIG.API_KEY_MIN_LENGTH} characters long`);
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(apiKey)) {
    errors.push('API key contains invalid characters');
  }

  // Check for common weak patterns
  if (/^(.)\1+$/.test(apiKey)) {
    errors.push('API key appears to be a repeated character');
  }

  if (/^(012345|123456|abcdef|test|demo)/i.test(apiKey)) {
    errors.push('API key appears to be a test or demo key');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate job structure
 */
export function validateJob(job) {
  const errors = [];

  if (!job) {
    errors.push('Job is required');
    return { isValid: false, errors };
  }

  // Check required fields
  if (!job.id || typeof job.id !== 'string') {
    errors.push('Job must have a valid ID');
  }

  if (!job.token || typeof job.token !== 'string') {
    errors.push('Job must have a valid token');
  }

  if (!job.type || typeof job.type !== 'string') {
    errors.push('Job must have a valid type');
  }

  if (!job.config) {
    errors.push('Job must have a config object');
    return { isValid: false, errors };
  }

  // Validate config
  const configErrors = validateJobConfig(job.config);
  if (!configErrors.isValid) {
    errors.push(...configErrors.errors);
  }

  // Check timestamps
  if (job.createdAt && !isValidTimestamp(job.createdAt)) {
    errors.push('Job createdAt timestamp is invalid');
  }

  if (job.expiresAt && !isValidTimestamp(job.expiresAt)) {
    errors.push('Job expiresAt timestamp is invalid');
  }

  // Check if job is expired
  if (job.expiresAt && new Date(job.expiresAt) < new Date()) {
    errors.push('Job has expired');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate job configuration
 */
export function validateJobConfig(config) {
  const errors = [];

  if (!config.url || typeof config.url !== 'string') {
    errors.push('Job config must have a valid URL');
  } else if (!isValidUrl(config.url)) {
    errors.push('Job config URL is not valid');
  }

  if (config.maxItems && (typeof config.maxItems !== 'number' || config.maxItems <= 0)) {
    errors.push('Job config maxItems must be a positive number');
  }

  if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    errors.push('Job config timeout must be a positive number');
  }

  // Validate selectors if present
  if (config.selectors && typeof config.selectors !== 'object') {
    errors.push('Job config selectors must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate job result structure
 */
export function validateJobResult(result) {
  const errors = [];

  if (!result) {
    errors.push('Result is required');
    return { isValid: false, errors };
  }

  if (!result.jobId || typeof result.jobId !== 'string') {
    errors.push('Result must have a valid jobId');
  }

  if (!result.token || typeof result.token !== 'string') {
    errors.push('Result must have a valid token');
  }

  if (!result.status || typeof result.status !== 'string') {
    errors.push('Result must have a valid status');
  }

  if (!Array.isArray(result.data)) {
    errors.push('Result data must be an array');
  }

  if (!result.metadata || typeof result.metadata !== 'object') {
    errors.push('Result must have metadata object');
  } else {
    // Validate metadata
    if (typeof result.metadata.itemsExtracted !== 'number') {
      errors.push('Result metadata must include itemsExtracted number');
    }

    if (typeof result.metadata.executionTime !== 'number') {
      errors.push('Result metadata must include executionTime number');
    }

    if (!Array.isArray(result.metadata.errors)) {
      errors.push('Result metadata errors must be an array');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate URL format
 */
export function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate timestamp format
 */
export function isValidTimestamp(timestamp) {
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }
  
  if (typeof timestamp === 'number') {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }
  
  return false;
}

/**
 * Validate Sahibinden.com URL
 */
export function isSahibindenUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'www.sahibinden.com' || urlObj.hostname === 'sahibinden.com';
  } catch {
    return false;
  }
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate CSS selector
 */
export function isValidCssSelector(selector) {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate message structure for inter-component communication
 */
export function validateMessage(message) {
  const errors = [];

  if (!message) {
    errors.push('Message is required');
    return { isValid: false, errors };
  }

  if (!message.type || typeof message.type !== 'string') {
    errors.push('Message must have a valid type');
  }

  if (message.payload !== undefined && typeof message.payload !== 'object') {
    errors.push('Message payload must be an object or undefined');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}