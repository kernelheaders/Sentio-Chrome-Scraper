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
import { config } from '../utils/config.js';

class ServiceWorker {
  constructor() {
    this.apiClient = new ApiClient();
    this.jobManager = new JobManager(this.apiClient);
    this.authManager = new AuthManager(this.apiClient);
    this.currentState = ExtensionState.UNAUTHORIZED;
    this.pollingAlarm = 'sentio_polling';
    this.healthCheckAlarm = 'sentio_health_check';
    this.submittedResults = new Set();
    this.blockedUntil = 0;
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
      try { this.blockedUntil = await secureStorage.getBlockedUntil(); } catch (_) {}

      // Seed development API key for easier testing
      try {
        await this.authManager.ensureDevApiKey();
      } catch (e) {
        logger.debug('Dev API key seeding skipped:', e?.message || e);
      }
      
      // Validate existing API key if present
      if (await secureStorage.hasApiKey()) {
        await this.validateApiKey();
      }

      // Warm up API connection and attempt an immediate poll
      await this.warmupApi();
      await this.pollForJobs();

      // Ensure periodic polling is active when API key is present and not blocked
      try {
        if (await secureStorage.hasApiKey() && !this.isBlocked()) {
          await this.startPolling();
        }
      } catch (_) {}
      
      logger.info('Service worker initialized successfully');
    } catch (error) {
      logger.error('Service worker initialization failed:', error);
      await this.setState(ExtensionState.ERROR);
    }
  }

  /**
   * Warm up API connection (health check)
   */
  async warmupApi() {
    try {
      const healthy = await this.apiClient.checkHealth();
      if (healthy) {
        logger.info('API health check: healthy');
      } else {
        logger.warn('API health check: unhealthy');
      }
    } catch (e) {
      logger.warn('API health check failed:', e?.message || e);
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

    // Detect 429 rate limits on target domain
    try {
      chrome.webRequest.onCompleted.addListener(
        this.handleWebRequestCompleted.bind(this),
        { urls: ['https://www.sahibinden.com/*','https://*.sahibinden.com/*'], types: ['main_frame','sub_frame','xmlhttprequest'] }
      );
    } catch (e) {
      logger.debug('webRequest listener not attached:', e?.message || e);
    }
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
          await this.pollForJobs(true); // force polling regardless of current state
          sendResponse({ success: true });
          break;
        
        case MessageTypes.GET_LAST_RESULT:
          try {
            const last = await secureStorage.getLastResult();
            sendResponse({ success: true, result: last });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'Failed to get last result' });
          }
          break;

        case MessageTypes.CLEAR_LOCAL_STATE:
          try {
            // Clear local caches but keep API key
            await secureStorage.clearBlockedUntil();
            await secureStorage.clearLastResult();
            await secureStorage.clearJobQueue();
            try { await new Promise((r)=> chrome.storage.local.remove([CONFIG.STORAGE_KEYS.DETAIL_PROGRESS], ()=> r())); } catch(_){}
            this.jobManager.currentJob = null;
            this.jobManager.jobQueue = [];
            await this.setState(ExtensionState.IDLE);
            await this.startPolling();
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'Failed to clear local state' });
          }
          break;

        case MessageTypes.GET_DEBUG_STATE:
          try {
            const blockedUntil = this.blockedUntil;
            const hasApiKey = await secureStorage.hasApiKey();
            const lastPoll = await secureStorage.getLastPoll();
            const queue = await this.jobManager.getPendingJobs();
            const currentJob = this.jobManager.currentJob || null;
            sendResponse({ success: true, state: this.currentState, blockedUntil, hasApiKey, lastPoll, queueSize: queue.length, currentJob });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'Failed to get debug state' });
          }
          break;

        case MessageTypes.GET_BLOCK_STATUS:
          sendResponse({ success: true, blockedUntil: this.blockedUntil });
          break;

        case MessageTypes.RESUME_AFTER_BLOCK:
          await this.clearBlock();
          sendResponse({ success: true });
          break;

        case MessageTypes.BLOCK_DETECTED: {
          const payload = message.payload || {};
          const reason = String(payload.reason || '').toLowerCase();
          const isExecuting = this.currentState === ExtensionState.EXECUTING || !!this.jobManager?.currentJob;
          const domOnly = reason.includes('dom') || reason.includes('unexpected') || reason.includes('listing') || reason.includes('detail');
          // Only enter backoff if we were actively executing (real scrape) or if webRequest caught 429/CHLG.
          if (isExecuting && !domOnly) {
            logger.logSecurityEvent('Block detected during execution; entering backoff', payload);
            await this.enterBlock();
          } else {
            logger.warn('DOM block signal received while idle/not executing; ignoring backoff', payload);
          }
          sendResponse({ success: true });
          break; }

        case MessageTypes.GET_DEV_KEY:
          try {
            const devKey = config?.isDevelopment ? config.devApiKey : null;
            sendResponse({ success: true, devKey });
          } catch (e) {
            sendResponse({ success: false, error: e?.message || 'Failed to get dev key' });
          }
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
    if (this.isBlocked()) {
      logger.warn('Execution skipped due to rate limit block');
      return;
    }
    if (tab.url.includes('sahibinden.com') && this.currentState !== ExtensionState.EXECUTING) {
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
      // Pause polling during validation to avoid race conditions
      await this.stopPolling();
      
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
  async pollForJobs(force = false) {
    if (this.isBlocked()) {
      logger.warn('Polling skipped due to rate limit block');
      return;
    }
    if (!force && this.currentState !== ExtensionState.IDLE) {
      return;
    }

    try {
      // Enter polling state only if we were idle; on force keep UI stable
      if (!force) {
        await this.setState(ExtensionState.POLLING);
      }
      
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
      // Invalid API key → UNAUTHORIZED; diğer durumlarda IDLE'da kal (flicker engelle)
      if (error.code === 'INVALID_API_KEY') {
        await secureStorage.clearApiKey();
        await this.setState(ExtensionState.UNAUTHORIZED);
      } else {
        await this.setState(ExtensionState.IDLE);
      }
      
      // Implement exponential backoff for failed polls
      setTimeout(() => {
        // Backoff sonra tekrar IDLE'a döneriz, popup'ta hata paneli tetiklemeyiz
        this.setState(ExtensionState.IDLE);
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
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: MessageTypes.HEALTH_CHECK,
            payload: { timestamp: Date.now() }
          });
        } catch (e) {
          // Content script may not be injected yet; ignore
          logger.debug(`Health check no receiver in tab ${tab.id}`);
        }
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Handle job execution events
   */
  async handleJobStarted(payload) {
    if (this.isBlocked()) return;
    await this.setState(ExtensionState.EXECUTING);
    logger.logJobEvent(payload.jobId, 'started', payload);
  }

  async handleJobCompleted(payload) {
    // Deduplicate multiple completes for same job
    if (this.submittedResults.has(payload.jobId)) {
      logger.debug(`Duplicate job_completed ignored for ${payload.jobId}`);
      return;
    }

    await this.setState(ExtensionState.IDLE);
    logger.logJobEvent(payload.jobId, 'completed', payload);
    try { await secureStorage.setLastResult(payload); } catch (e) {
      logger.warn('Failed to cache last job result for export:', e?.message || e);
    }

    try {
      await this.jobManager.handleJobCompletion(payload.jobId, payload);
      this.submittedResults.add(payload.jobId);
    } catch (e) {
      logger.warn('Result submission encountered an issue:', e?.message || e);
    }

    // Browser notification
    try {
      const items = payload?.metadata?.itemsExtracted ?? (payload?.data?.length || 0);
      chrome.notifications?.create?.(undefined, {
        type: 'basic',
        iconUrl: 'assets/icons/logo.png',
        title: 'Scrape Completed',
        message: `${items} item(s) extracted and submitted`,
        priority: 0
      });
    } catch (_) {}
  }

  async handleJobFailed(payload) {
    await this.setState(ExtensionState.IDLE);
    logger.logJobEvent(payload.jobId, 'failed', payload);
    // Propagate failure into JobManager for consistent handling
    try {
      if (this.jobManager.currentJob && this.jobManager.currentJob.id === payload.jobId) {
        await this.jobManager.handleJobFailure(this.jobManager.currentJob, payload.error || 'Job failed');
      }
    } catch (_) {}
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
      }, () => {
        // Access lastError to silence Unchecked runtime.lastError
        const _ = chrome.runtime.lastError; // eslint-disable-line no-unused-vars
      });
    } catch (error) {
      logger.debug('Failed to notify state change (popup likely closed)');
    }
  }

  // webRequest handler: detect 429 and enter blocked mode
  async handleWebRequestCompleted(details) {
    try {
      const url = details.url || '';
      // Treat explicit 429 or well-known challenge URL as block
      const isHttp429 = details.statusCode === 429;
      const isChallengeUrl = /https:\/\/secure\.sahibinden\.com\/giris\/iki-asamali-dogrulama/i.test(url) || /type=CHLG/i.test(url);
      if (isHttp429 || isChallengeUrl) {
        logger.logSecurityEvent(isHttp429 ? 'HTTP 429 detected; entering backoff' : 'CHLG challenge detected; entering backoff', { url });
        await this.enterBlock();
        // Attempt to cancel any running jobs
        try {
          const tabs = await chrome.tabs.query({ url: 'https://www.sahibinden.com/*' });
          for (const t of tabs) {
            chrome.tabs.sendMessage(t.id, { type: MessageTypes.CANCEL_JOB, payload: {} });
          }
        } catch (_) {}
      }
    } catch (e) {
      logger.debug('handleWebRequestCompleted error:', e?.message || e);
    }
  }

  isBlocked() {
    return this.blockedUntil && Date.now() < this.blockedUntil;
  }

  async enterBlock() {
    const minutes = 60 + Math.floor(Math.random() * 61); // 60-120 min
    this.blockedUntil = Date.now() + minutes * 60000;
    await secureStorage.setBlockedUntil(this.blockedUntil);
    await this.stopPolling();
    await this.setState(ExtensionState.IDLE);
    logger.warn(`Backoff engaged for ${minutes} minutes`);
  }

  async clearBlock() {
    this.blockedUntil = 0;
    await secureStorage.clearBlockedUntil();
    await this.startPolling();
    logger.info('Backoff cleared by user');
  }
}

// Initialize service worker
new ServiceWorker();
