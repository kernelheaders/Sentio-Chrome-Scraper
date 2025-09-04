/**
 * Configuration helper for development vs production
 */

// Check if we're in development mode
export const isDevelopment = () => {
  try {
    // Service worker context doesn't have process.env or location
    // Use chrome.runtime to detect development mode
    const manifest = chrome?.runtime?.getManifest?.();
    return manifest?.version?.includes('dev') || 
           manifest?.name?.includes('Debug') ||
           true; // For now, assume development mode for local testing
  } catch (error) {
    console.warn('Error detecting development mode:', error);
    return true; // Default to development mode
  }
};

// Get API base URL based on environment
export const getApiBaseUrl = () => {
  if (isDevelopment()) {
    // Prefer IPv4 localhost to avoid IPv6/host resolution issues in some setups
    return 'http://127.0.0.1:3001/v1';
  }
  return 'https://api.sentio.com/v1';
};

// Get development API key for testing
export const getDevApiKey = () => {
  if (isDevelopment()) {
    // Match mock-server's valid API key so all endpoints accept it
    return 'test_api_key_12345678901234567890123456';
  }
  return null;
};

export const getDevLogEndpoint = () => {
  if (isDevelopment()) {
    return 'http://127.0.0.1:3001/v1/dev/logs';
  }
  return null;
};

// Get polling interval based on environment
export const getPollingInterval = () => {
  if (isDevelopment()) {
    return 10000; // 10 seconds for faster testing
  }
  return 30000; // 30 seconds for production
};

export const config = {
  isDevelopment: isDevelopment(),
  apiBaseUrl: getApiBaseUrl(),
  devApiKey: getDevApiKey(),
  pollingInterval: getPollingInterval(),
  devLogEndpoint: getDevLogEndpoint()
};
