/**
 * Sentio Chrome Extension Service Worker
 * Handles API polling, job management, and background operations
 */
import { logger } from '../utils/logger.js';
import { secureStorage } from '../utils/storage.js';
import { ApiClient } from './api-client.js';
import { JobManager } from './job-manager.js';
import { AuthManager } from './auth-manager.js';
import { MessageTypes, ExtensionState, CONFIG } from '../shared/types.js';

class ServiceWorker {
  constructor() {
    this.apiClient = new ApiClient();
    this.jobManager = new JobManager(this.apiClient);
    this.authManager = new AuthManager(this.apiClient);
    this.currentState = ExtensionState.UNAUTHORIZED;
    this.pollingAlarm = 'sentio_polling';
    this.healthCheckAlarm = 'sentio_health_check';
    
    this.initialize();
  }

  /**
   * Initialize service worker
   */
  async initialize() {
    try {
      logger.info('Service worker initializing...');
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Restore previous state
      await this.restoreState();
      
      // Validate existing API key if present
      if (await secureStorage.hasApiKey()) {
        await this.validateApiKey();
      }
      
      logger.info('Service worker initialized successfully');
    } catch (error) {
      logger.error('Service worker initialization failed:', error);
      await this.setState(ExtensionState.ERROR);
    }
  }

  /**
   * Set up Chrome extension event listeners
   */
  setupEventListeners() {
    // Handle extension installation/startup
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));
    
    // Handle messages from popup and content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Handle alarms for polling
    chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
    
    // Handle tab updates to detect navigation to Sahibinden
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Handle extension suspension
    chrome.runtime.onSuspend.addListener(this.handleSuspend.bind(this));
  }

  /**
   * Handle extension installation
   */
  async handleInstalled(details) {
    logger.info('Extension installed:', details);
    
    if (details.reason === 'install') {
      // First time installation
      await this.setState(ExtensionState.UNAUTHORIZED);
      await secureStorage.clearAll();
    } else if (details.reason === 'update') {
      // Extension updated - validate existing state
      await this.restoreState();
    }
  }

  /**
   * Handle extension startup
   */
  async handleStartup() {
    logger.info('Extension starting up');
    await this.restoreState();
    
    if (await secureStorage.hasApiKey()) {
      await this.validateApiKey();
    }
  }

  /**
   * Handle messages from other components
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      logger.debug('Received message:', { type: message.type, sender: sender.id });
      
      switch (message.type) {
        case MessageTypes.SET_API_KEY:
          await this.handleSetApiKey(message.payload.apiKey);
          sendResponse({ success: true });
          break;
          
        case MessageTypes.CLEAR_API_KEY:
          await this.handleClearApiKey();
          sendResponse({ success: true });
          break;
          
        case MessageTypes.GET_STATUS:
          sendResponse(await this.getStatus());
          break;
          
        case MessageTypes.FORCE_POLL:
          await this.pollForJobs();
          sendResponse({ success: true });
          break;
          
        case MessageTypes.JOB_STARTED:
          await this.handleJobStarted(message.payload);
          sendResponse({ success: true });
          break;
          
        case MessageTypes.JOB_COMPLETED:
          await this.handleJobCompleted(message.payload);
          sendResponse({ success: true });
          break;
          
        case MessageTypes.JOB_FAILED:
          await this.handleJobFailed(message.payload);
          sendResponse({ success: true });
          break;
          
        case MessageTypes.HEALTH_RESPONSE:
          await this.handleHealthResponse(message.payload, sender.tab.id);
          sendResponse({ success: true });
          break;
          
        default:
          logger.warn('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep message channel open for async response
  }

  /**
   * Handle alarm events
   */
  async handleAlarm(alarm) {
    try {
      switch (alarm.name) {
        case this.pollingAlarm:
          await this.pollForJobs();
          break;
          
        case this.healthCheckAlarm:
          await this.performHealthCheck();
          break;
          
        default:
          logger.warn('Unknown alarm:', alarm.name);
      }
    } catch (error) {
      logger.error('Error handling alarm:', error);
    }
  }

  /**
   * Handle tab updates
   */
  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only act when page is fully loaded
    if (changeInfo.status !== 'complete' || !tab.url) {
      return;
    }

    // Check if this is a Sahibinden page and we have pending jobs
    if (tab.url.includes('sahibinden.com') && this.currentState === ExtensionState.IDLE) {
      const pendingJobs = await this.jobManager.getPendingJobs();
      if (pendingJobs.length > 0) {
        logger.info('Sahibinden page detected with pending jobs, checking for execution');
        await this.jobManager.tryExecuteJob(tabId, pendingJobs[0]);
      }
    }
  }

  /**
   * Handle extension suspension
   */
  async handleSuspend() {
    logger.info('Service worker suspending');
    await this.saveState();
    chrome.alarms.clearAll();
  }

  /**
   * Set API key and validate
   */
  async handleSetApiKey(apiKey) {
    try {
      await this.setState(ExtensionState.IDLE);
      
      const isValid = await this.authManager.validateApiKey(apiKey);
      
      if (isValid) {
        await secureStorage.setApiKey(apiKey);
        await this.setState(ExtensionState.IDLE);
        await this.startPolling();
        
        // Notify popup
        this.notifyStateChange();
        
        logger.info('API key set and validated successfully');
      } else {
        await this.setState(ExtensionState.UNAUTHORIZED);
        throw new Error('Invalid API key');
      }
    } catch (error) {
      logger.error('Failed to set API key:', error);
      await this.setState(ExtensionState.UNAUTHORIZED);
      throw error;
    }
  }

  /**
   * Clear API key and reset state
   */
  async handleClearApiKey() {
    try {
      await secureStorage.clearApiKey();
      await this.setState(ExtensionState.UNAUTHORIZED);
      await this.stopPolling();
      
      // Notify popup
      this.notifyStateChange();
      
      logger.info('API key cleared');
    } catch (error) {
      logger.error('Failed to clear API key:', error);
      throw error;
    }
  }

  /**
   * Validate existing API key
   */
  async validateApiKey() {
    try {
      const apiKey = await secureStorage.getApiKey();
      
      if (!apiKey) {
        await this.setState(ExtensionState.UNAUTHORIZED);
        return false;
      }

      const isValid = await this.authManager.validateApiKey(apiKey);
      
      if (isValid) {
        await this.setState(ExtensionState.IDLE);
        await this.startPolling();
        return true;
      } else {
        await secureStorage.clearApiKey();
        await this.setState(ExtensionState.UNAUTHORIZED);
        return false;
      }
    } catch (error) {
      logger.error('API key validation failed:', error);
      await this.setState(ExtensionState.ERROR);
      return false;
    }
  }

  /**
   * Start periodic polling for jobs
   */
  async startPolling() {
    try {
      // Clear any existing alarms
      await chrome.alarms.clear(this.pollingAlarm);
      
      // Create new polling alarm
      chrome.alarms.create(this.pollingAlarm, {
        delayInMinutes: CONFIG.POLLING_INTERVAL_MIN / 60000,
        periodInMinutes: CONFIG.POLLING_INTERVAL_MIN / 60000
      });
      
      // Start health check alarm
      chrome.alarms.create(this.healthCheckAlarm, {
        delayInMinutes: 5,
        periodInMinutes: 5
      });
      
      logger.info('Polling started');
    } catch (error) {
      logger.error('Failed to start polling:', error);
    }
  }

  /**
   * Stop polling
   */
  async stopPolling() {
    try {
      await chrome.alarms.clear(this.pollingAlarm);
      await chrome.alarms.clear(this.healthCheckAlarm);
      logger.info('Polling stopped');
    } catch (error) {
      logger.error('Failed to stop polling:', error);
    }
  }

  /**
   * Poll for new jobs
   */
  async pollForJobs() {
    if (this.currentState !== ExtensionState.IDLE) {
      return;
    }

    try {
      await this.setState(ExtensionState.POLLING);
      
      const jobs = await this.jobManager.fetchPendingJobs();
      
      if (jobs && jobs.length > 0) {
        logger.info(`Found ${jobs.length} pending job(s)`);
        await this.jobManager.queueJobs(jobs);
        await this.jobManager.tryExecuteNextJob();
      }
      
      await this.setState(ExtensionState.IDLE);
      await secureStorage.setLastPoll(Date.now());
      
    } catch (error) {
      logger.error('Polling failed:', error);
      await this.setState(ExtensionState.ERROR);
      
      // Implement exponential backoff for failed polls
      setTimeout(() => {
        if (this.currentState === ExtensionState.ERROR) {
          this.setState(ExtensionState.IDLE);
        }
      }, CONFIG.POLLING_INTERVAL_MIN * 2);
    }
  }

  /**
   * Perform health check on content scripts
   */
  async performHealthCheck() {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.sahibinden.com/*' });
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: MessageTypes.HEALTH_CHECK,
          payload: { timestamp: Date.now() }
        });
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Handle job execution events
   */
  async handleJobStarted(payload) {
    await this.setState(ExtensionState.EXECUTING);
    logger.logJobEvent(payload.jobId, 'started', payload);
  }

  async handleJobCompleted(payload) {
    await this.setState(ExtensionState.IDLE);
    logger.logJobEvent(payload.jobId, 'completed', payload);
    
    // Try to execute next job in queue
    await this.jobManager.tryExecuteNextJob();
  }

  async handleJobFailed(payload) {
    await this.setState(ExtensionState.IDLE);
    logger.logJobEvent(payload.jobId, 'failed', payload);
    
    // Try to execute next job in queue
    await this.jobManager.tryExecuteNextJob();
  }

  async handleHealthResponse(payload, tabId) {
    logger.debug(`Health response from tab ${tabId}:`, payload);
  }

  /**
   * Set extension state
   */
  async setState(newState) {
    const oldState = this.currentState;
    this.currentState = newState;
    
    await secureStorage.setState(newState);
    
    if (oldState !== newState) {
      logger.info(`State changed: ${oldState} → ${newState}`);
      this.notifyStateChange();
    }
  }

  /**
   * Get current status
   */
  async getStatus() {
    const hasApiKey = await secureStorage.hasApiKey();
    const lastPoll = await secureStorage.getLastPoll();
    const jobQueue = await secureStorage.getJobQueue();
    
    return {
      state: this.currentState,
      hasApiKey,
      lastPoll,
      queuedJobs: jobQueue.length,
      isPolling: this.currentState === ExtensionState.POLLING,
      isExecuting: this.currentState === ExtensionState.EXECUTING
    };
  }

  /**
   * Restore state from storage
   */
  async restoreState() {
    try {
      const savedState = await secureStorage.getState();
      this.currentState = savedState || ExtensionState.UNAUTHORIZED;
      logger.info('State restored:', this.currentState);
    } catch (error) {
      logger.error('Failed to restore state:', error);
      this.currentState = ExtensionState.UNAUTHORIZED;
    }
  }

  /**
   * Save current state
   */
  async saveState() {
    try {
      await secureStorage.setState(this.currentState);
    } catch (error) {
      logger.error('Failed to save state:', error);
    }
  }

  /**
   * Notify other components of state changes
   */
  notifyStateChange() {
    // This will be caught by popup if it's open
    try {
      chrome.runtime.sendMessage({
        type: MessageTypes.STATUS_UPDATE,
        payload: { state: this.currentState }
      });
    } catch (error) {
      // Popup might not be open, this is normal
      logger.debug('Failed to notify state change (popup likely closed)');
    }
  }
}

// Initialize service worker
new ServiceWorker();