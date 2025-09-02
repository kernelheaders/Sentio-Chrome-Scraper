/**
 * Configuration constants for Sentio Chrome Extension
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: 'https://api.sentio.com/v1',
  TIMEOUT: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Exponential backoff base
  
  ENDPOINTS: {
    VALIDATE_KEY: '/auth/validate',
    GET_JOBS: '/jobs/pending',
    SUBMIT_RESULTS: '/jobs/results',
    HEALTH: '/health',
    ACCOUNT: '/account/info',
    METRICS: '/metrics',
    RATE_LIMIT: '/rate-limit'
  }
};

// Polling Configuration
export const POLLING_CONFIG = {
  INTERVAL_MIN: 30000,        // 30 seconds minimum
  INTERVAL_MAX: 300000,       // 5 minutes maximum
  BACKOFF_MULTIPLIER: 1.5,
  ERROR_COOLDOWN: 60000,      // 1 minute cooldown after errors
  HEALTH_CHECK_INTERVAL: 300000 // 5 minutes
};

// Security Configuration
export const SECURITY_CONFIG = {
  API_KEY_MIN_LENGTH: 32,
  API_KEY_PATTERN: /^[A-Za-z0-9+/=]+$/,
  ENCRYPTION_ALGORITHM: 'AES',
  SIGNATURE_ALGORITHM: 'HMAC-SHA256',
  NONCE_LENGTH: 16,
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  
  // Validation cache
  VALIDATION_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_ENTRIES: 10
};

// Job Configuration
export const JOB_CONFIG = {
  MAX_CONCURRENT_JOBS: 1,
  MAX_QUEUE_SIZE: 10,
  MAX_EXECUTION_TIME: 10 * 60 * 1000, // 10 minutes
  MAX_ITEMS_PER_JOB: 1000,
  
  // Job priorities
  PRIORITY: {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    URGENT: 3
  },
  
  // Job types
  TYPES: {
    SCRAPE_LISTINGS: 'scrape_listings',
    SCRAPE_DETAILS: 'scrape_details',
    MONITOR_CHANGES: 'monitor_changes'
  }
};

// Human Simulation Configuration
export const HUMAN_SIMULATION = {
  // Delays (milliseconds)
  MIN_ACTION_DELAY: 500,
  MAX_ACTION_DELAY: 2000,
  MIN_SCROLL_DELAY: 200,
  MAX_SCROLL_DELAY: 800,
  MIN_TYPE_DELAY: 50,
  MAX_TYPE_DELAY: 150,
  
  // Mouse simulation
  MOUSE_MOVE_STEPS: 10,
  MOUSE_MOVE_DELAY: 50,
  CLICK_VARIANCE: 5, // pixels
  
  // Scrolling
  SCROLL_STEP_SIZE: 100,
  MAX_SCROLL_ATTEMPTS: 50,
  VIEWPORT_PADDING: 100,
  
  // User agents (rotated for diversity)
  USER_AGENTS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
};

// Anti-Detection Configuration
export const ANTI_DETECTION = {
  // Request patterns
  MAX_REQUESTS_PER_MINUTE: 30,
  REQUEST_SPACING_MIN: 1000,
  REQUEST_SPACING_MAX: 3000,
  
  // Behavioral patterns
  RANDOM_MOUSE_MOVEMENTS: true,
  SIMULATE_READING_DELAYS: true,
  VARY_SCROLL_PATTERNS: true,
  SIMULATE_HUMAN_ERRORS: true,
  
  // Error simulation rates (0-1)
  WRONG_CLICK_RATE: 0.02,
  BACK_NAVIGATION_RATE: 0.01,
  PAUSE_AND_RESUME_RATE: 0.05,
  
  // Limits
  MAX_PAGES_PER_SESSION: 100,
  MAX_SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
  BREAK_DURATION_MIN: 5 * 60 * 1000,    // 5 minutes
  BREAK_DURATION_MAX: 15 * 60 * 1000    // 15 minutes
};

// Storage Configuration
export const STORAGE_CONFIG = {
  KEYS: {
    API_KEY: 'sentio_api_key',
    EXTENSION_STATE: 'sentio_state',
    JOB_QUEUE: 'sentio_job_queue',
    LAST_POLL: 'sentio_last_poll',
    EXECUTION_HISTORY: 'sentio_exec_history',
    USER_PREFERENCES: 'sentio_prefs',
    FAILED_RESULTS: 'sentio_failed_results'
  },
  
  LIMITS: {
    MAX_STORAGE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_HISTORY_ENTRIES: 100,
    MAX_FAILED_RESULTS: 20
  }
};

// Error Handling Configuration
export const ERROR_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // Progressive delays
  FATAL_ERROR_CODES: [
    'INVALID_API_KEY',
    'ACCOUNT_SUSPENDED',
    'EXTENSION_DISABLED'
  ],
  
  // Error reporting
  REPORT_ERRORS: true,
  MAX_ERROR_REPORTS_PER_HOUR: 10
};

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  // Memory management
  MAX_MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  GARBAGE_COLLECTION_INTERVAL: 5 * 60 * 1000, // 5 minutes
  
  // Request optimization
  ENABLE_REQUEST_CACHING: true,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_CONCURRENT_REQUESTS: 3,
  
  // DOM processing
  MAX_DOM_NODES_PROCESSED: 10000,
  DOM_PROCESSING_TIMEOUT: 30000, // 30 seconds
  
  // Resource limits
  MAX_IMAGE_SIZE: 1024 * 1024, // 1MB
  MAX_SCRIPT_EXECUTION_TIME: 5000 // 5 seconds
};

// Development Configuration
export const DEV_CONFIG = {
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV === 'development',
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_TRACKING: true,
  
  // Testing
  MOCK_API_RESPONSES: false,
  SIMULATE_NETWORK_DELAYS: false,
  TEST_MODE: false
};

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_METRICS_REPORTING: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_A_B_TESTING: false,
  ENABLE_ANALYTICS: true,
  ENABLE_AUTO_UPDATES: true,
  
  // Experimental features
  ENABLE_PARALLEL_EXECUTION: false,
  ENABLE_SMART_QUEUING: true,
  ENABLE_PREDICTIVE_POLLING: false
};

// Version and Compatibility
export const VERSION_CONFIG = {
  EXTENSION_VERSION: '1.0.0',
  API_VERSION: 'v1',
  MIN_CHROME_VERSION: 88,
  SUPPORTED_PLATFORMS: ['mac', 'win', 'linux'],
  
  // Compatibility checks
  CHECK_COMPATIBILITY: true,
  AUTO_UPDATE_CHECK_INTERVAL: 24 * 60 * 60 * 1000 // 24 hours
};

// Export all configurations as a single object for easy access
export const CONFIG = {
  API: API_CONFIG,
  POLLING: POLLING_CONFIG,
  SECURITY: SECURITY_CONFIG,
  JOB: JOB_CONFIG,
  HUMAN_SIMULATION,
  ANTI_DETECTION,
  STORAGE: STORAGE_CONFIG,
  ERROR: ERROR_CONFIG,
  PERFORMANCE: PERFORMANCE_CONFIG,
  DEV: DEV_CONFIG,
  FEATURES: FEATURE_FLAGS,
  VERSION: VERSION_CONFIG
};