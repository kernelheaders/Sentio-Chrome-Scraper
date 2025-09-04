/**
 * Popup script for Sentio Chrome Extension
 * Handles UI interactions and communication with service worker
 */
import { MessageTypes, ExtensionState, CONFIG } from '../shared/types.js';

class SentioPopup {
  constructor() {
    this.currentState = ExtensionState.UNAUTHORIZED;
    this.statusUpdateInterval = null;
    this.toasts = [];
    this.lastStatus = null;
    
    this.initialize();
  }

  /**
   * Initialize popup
   */
  async initialize() {
    try {
      // Set up event listeners
      this.setupEventListeners();
      
      // Load current status
      await this.loadStatus();
      
      // Start status updates
      this.startStatusUpdates();
      
      console.log('Sentio popup initialized');

    } catch (error) {
      console.error('Popup initialization failed:', error);
      this.showToast('Failed to initialize popup', 'error');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // API Key form submission
    const apiKeyForm = document.getElementById('apiKeyForm');
    apiKeyForm?.addEventListener('submit', this.handleApiKeySubmit.bind(this));

    // Toggle API key visibility
    const toggleButton = document.getElementById('toggleApiKey');
    toggleButton?.addEventListener('click', this.toggleApiKeyVisibility.bind(this));

    // Use Test Key (dev helper)
    const useTestKeyButton = document.getElementById('useTestKeyButton');
    useTestKeyButton?.addEventListener('click', async () => {
      const btn = useTestKeyButton;
      this.setButtonLoading(btn, true);
      try {
        const res = await this.sendMessage(MessageTypes.GET_DEV_KEY);
        const key = res?.devKey || 'test_api_key_12345678901234567890123456';
        // Reflect in input for transparency
        const apiKeyInput = document.getElementById('apiKeyInput');
        apiKeyInput.value = key;
        apiKeyInput.type = 'text';
        // Auto-submit the test key
        const setRes = await this.sendMessage(MessageTypes.SET_API_KEY, { apiKey: key });
        // Treat transient port errors as benign; verify via status after a short wait
        await new Promise(r => setTimeout(r, 150));
        const status = await this.sendMessage(MessageTypes.GET_STATUS);
        const connected = status && status.success !== false && (status.hasApiKey === true || (status.state && status.state !== undefined && status.state !== 'unauthorized'));
        if (setRes?.success || connected) {
          this.showToast('Test key set', 'success');
          await this.loadStatus();
        } else {
          this.showToast('Failed to set test key', 'error');
        }
      } catch (e) {
        this.showToast('Use Test Key failed', 'error');
      } finally {
        this.setButtonLoading(btn, false);
      }
    });

    // Disconnect button
    const disconnectButton = document.getElementById('disconnectButton');
    disconnectButton?.addEventListener('click', this.handleDisconnect.bind(this));

    // Action buttons
    const forceRefreshButton = document.getElementById('forceRefreshButton');
    forceRefreshButton?.addEventListener('click', this.handleForceRefresh.bind(this));

    const resumeBlockButton = document.getElementById('resumeBlockButton');
    resumeBlockButton?.addEventListener('click', async () => {
      const res = await this.sendMessage(MessageTypes.RESUME_AFTER_BLOCK);
      if (res?.success) {
        this.showToast('Resumed after backoff', 'success');
        await this.loadStatus();
        this.updateBlockUI(false);
      }
    });

    const openDashboardButton = document.getElementById('openDashboardButton');
    openDashboardButton?.addEventListener('click', this.handleOpenDashboard.bind(this));

    const resetLocalButton = document.getElementById('resetLocalButton');
    resetLocalButton?.addEventListener('click', async () => {
      this.setButtonLoading(resetLocalButton, true);
      try {
        const r = await this.sendMessage(MessageTypes.CLEAR_LOCAL_STATE);
        if (r?.success) {
          this.showToast('Local cache cleared', 'success');
          // Trigger a fresh poll
          await this.tryForcePoll(2);
          await this.loadStatus();
        } else {
          this.showToast('Failed to clear cache', 'error');
        }
      } finally {
        this.setButtonLoading(resetLocalButton, false);
      }
    });

    const debugDumpButton = document.getElementById('debugDumpButton');
    debugDumpButton?.addEventListener('click', async () => {
      const r = await this.sendMessage(MessageTypes.GET_DEBUG_STATE);
      if (r?.success) {
        const s = r;
        const msg = `state=${s.state} blocked=${s.blockedUntil ? 'yes' : 'no'} queue=${s.queueSize} hasKey=${s.hasApiKey} lastPoll=${this.formatTime(s.lastPoll)}`;
        this.showToast(msg, 'info', 5000);
        console.log('[DebugState]', r);
      } else {
        this.showToast('Debug state unavailable', 'warning');
      }
    });

    // Export CSV (compact menu)
    const exportBtn = document.getElementById('exportCsvButton');
    exportBtn?.addEventListener('click', this.toggleExportMenu.bind(this));
    const exportApply = document.getElementById('exportApplyButton');
    exportApply?.addEventListener('click', this.handleExportCsv.bind(this));

    // Error state buttons
    const retryButton = document.getElementById('retryButton');
    retryButton?.addEventListener('click', this.handleRetry.bind(this));

    const resetButton = document.getElementById('resetButton');
    resetButton?.addEventListener('click', this.handleReset.bind(this));

    // Help links
    const dashboardLink = document.querySelector('.help-links a[href*="dashboard"]');
    dashboardLink?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://app.sentio.com/dashboard' });
    });

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Handle popup close
    window.addEventListener('beforeunload', () => {
      this.stopStatusUpdates();
    });
  }

  /**
   * Handle API key form submission
   */
  async handleApiKeySubmit(event) {
    event.preventDefault();
    
    const apiKeyInput = document.getElementById('apiKeyInput');
    const submitButton = document.getElementById('submitApiKey');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      this.showInputError(apiKeyInput, 'API key is required');
      return;
    }

    if (apiKey.length < 32) {
      this.showInputError(apiKeyInput, 'API key must be at least 32 characters');
      return;
    }

    try {
      // Show loading state
      this.setButtonLoading(submitButton, true);
      this.clearInputError(apiKeyInput);

      // Try with lightweight retry on transient messaging errors
      const response = await this.trySetApiKey(apiKey, 2);

      if (response?.success) {
        this.showToast('API key validated successfully', 'success');
        apiKeyInput.value = '';
        await this.loadStatus(); // Refresh status
      } else {
        const msg = response?.error || 'Failed to validate API key';
        throw new Error(msg);
      }

    } catch (error) {
      // Only show a visible error if it is not a transient port/timeout issue
      const msg = String(error?.message || error);
      if (!/No response|message port closed/i.test(msg)) {
        this.showInputError(apiKeyInput, msg);
        this.showToast('API key validation failed', 'error');
      }
    } finally {
      this.setButtonLoading(submitButton, false);
    }
  }

  /**
   * Try setting API key with small retry on transient channel errors
   */
  async trySetApiKey(apiKey, retries = 1) {
    const attempt = async () => this.sendMessage(MessageTypes.SET_API_KEY, { apiKey });
    let res = await attempt();
    if (res?.success) return res;
    const msg = String(res?.error || '').toLowerCase();
    if (retries > 0 && (msg.includes('no response') || msg.includes('message port closed'))) {
      await new Promise(r => setTimeout(r, 300));
      return this.trySetApiKey(apiKey, retries - 1);
    }
    return res;
  }

  /**
   * Toggle API key visibility
   */
  toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const toggleButton = document.getElementById('toggleApiKey');

    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleButton.textContent = '🙈';
      toggleButton.title = 'Hide API Key';
    } else {
      apiKeyInput.type = 'password';
      toggleButton.textContent = '👁️';
      toggleButton.title = 'Show API Key';
    }
  }

  /**
   * Handle disconnect button click
   */
  async handleDisconnect() {
    try {
      const confirmed = confirm('Are you sure you want to disconnect? This will clear your API key and stop all scraping jobs.');
      
      if (!confirmed) return;

      const response = await this.sendMessage(MessageTypes.CLEAR_API_KEY);

      if (response.success) {
        this.showToast('Disconnected successfully', 'success');
        await this.loadStatus();
      } else {
        throw new Error(response.error || 'Failed to disconnect');
      }

    } catch (error) {
      console.error('Disconnect failed:', error);
      this.showToast('Failed to disconnect', 'error');
    }
  }

  /**
   * Handle force refresh button click
   */
  async handleForceRefresh() {
    try {
      const button = document.getElementById('forceRefreshButton');
      this.setButtonLoading(button, true);

      const response = await this.tryForcePoll(2);

      if (response?.success) {
        this.showToast('Checking for jobs...', 'info');
        await this.loadStatus();
      } else {
        throw new Error(response?.error || 'Failed to check for jobs');
      }

    } catch (error) {
      const msg = String(error?.message || error);
      if (!/No response|message port closed/i.test(msg)) {
        console.warn('Force refresh failed:', msg);
        this.showToast('Failed to check for jobs', 'error');
      }
    } finally {
      const button = document.getElementById('forceRefreshButton');
      this.setButtonLoading(button, false);
    }
  }

  async tryForcePoll(retries = 1) {
    const res = await this.sendMessage(MessageTypes.FORCE_POLL);
    if (res?.success) return res;
    const msg = String(res?.error || '').toLowerCase();
    if (retries > 0 && (msg.includes('no response') || msg.includes('message port closed'))) {
      await new Promise(r => setTimeout(r, 300));
      return this.tryForcePoll(retries - 1);
    }
    return res;
  }

  /**
   * Handle open dashboard button click
   */
  handleOpenDashboard() {
    chrome.tabs.create({ url: 'https://app.sentio.com/dashboard' });
  }

  /**
   * Toggle export dropdown visibility
   */
  toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  /**
   * Handle CSV export with selected fields
   */
  async handleExportCsv() {
    try {
      const menu = document.getElementById('exportMenu');
      const checkboxes = menu?.querySelectorAll('input[type="checkbox"][data-field]') || [];
      const fields = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.getAttribute('data-field'));

      if (fields.length === 0) {
        this.showToast('Select at least one field', 'warning');
        return;
      }

      let response = await this.sendMessage(MessageTypes.GET_LAST_RESULT);
      let result = response?.result;

      if (!result || !Array.isArray(result.data) || result.data.length === 0) {
        // Fallback: read directly from storage in case SW missed the event
        try {
          result = await new Promise((resolve) => {
            chrome.storage.local.get([CONFIG.STORAGE_KEYS.LAST_RESULT], (r) => {
              resolve(r[CONFIG.STORAGE_KEYS.LAST_RESULT] || null);
            });
          });
        } catch (_) {}
      }

      if (!result || !Array.isArray(result.data) || result.data.length === 0) {
        this.showToast('No recent results to export', 'warning');
        return;
      }

      const csv = this.buildCsv(fields, result.data);
      this.downloadCsv(csv, 'sentio-results.csv');
      this.showToast('CSV exported', 'success');
      this.toggleExportMenu();
    } catch (error) {
      console.error('CSV export failed:', error);
      this.showToast('Failed to export CSV', 'error');
    }
  }

  /**
   * Build CSV string from data and selected fields
   */
  buildCsv(fields, rows) {
    const headers = fields.map(f => this.prettyFieldName(f));
    const normPhone = (s) => String(s || '').replace(/[^\d+]/g, '');
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const lines = [];
    lines.push(headers.join(','));
    for (const item of rows) {
      const values = fields.map(f => {
        let v = this.getFieldValue(item, f);
        if (f === 'phone') v = normPhone(v);
        return escape(v);
      });
      lines.push(values.join(','));
    }
    return lines.join('\n');
  }

  /**
   * Map selected field to item property
   */
  getFieldValue(item, field) {
    switch (field) {
      case 'phone': return item.contact?.phone || '';
      case 'name': return item.contact?.name || '';
      case 'from': return item.from || '';
      case 'location':
      case 'address': return item.address || item.location || '';
      case 'title': return item.title || '';
      case 'price': return item.price ?? '';
      case 'date': return item.date || '';
      case 'url': return item.url || '';
      default: return '';
    }
  }

  prettyFieldName(f) {
    const map = {
      phone: 'Phone',
      name: 'Name',
      from: 'From',
      title: 'Title',
      price: 'Price',
      location: 'Address',
      address: 'Address',
      date: 'Date',
      url: 'URL'
    };
    return map[f] || f;
  }

  /**
   * Trigger CSV file download
   */
  downloadCsv(csvText, filename) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Handle retry button click
   */
  async handleRetry() {
    await this.loadStatus();
  }

  /**
   * Handle reset button click
   */
  async handleReset() {
    await this.handleDisconnect();
  }

  /**
   * Handle messages from service worker
   */
  handleMessage(message, sender, sendResponse) {
    if (message.type === MessageTypes.STATUS_UPDATE) {
      this.updateStatus(message.payload);
    }
  }

  /**
   * Send message to service worker
   */
  async sendMessage(type, payload = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          // Read lastError to prevent Unchecked runtime.lastError noise
          const err = chrome.runtime.lastError;
          if (err) {
            // Resolve gracefully; caller may fallback to last known status
            return resolve({ success: false, error: err.message || 'No response' });
          }
          resolve(response || { success: false, error: 'No response' });
        });
      } catch (e) {
        resolve({ success: false, error: e?.message || 'sendMessage failed' });
      }
    });
  }

  /**
   * Load current status from service worker
   */
  async loadStatus() {
    try {
      const response = await this.sendMessage(MessageTypes.GET_STATUS);
      
      // GET_STATUS returns a plain object (no success flag) on success.
      if (response && response.success !== false) {
        this.lastStatus = response;
        this.updateStatus(response);
      } else {
        // Transient failure: keep last known status; avoid flipping to error panel
        if (this.lastStatus) {
          this.updateStatus(this.lastStatus);
        }
      }

    } catch (_error) {
      // Swallow transient errors silently to avoid user-visible flicker
      if (this.lastStatus) this.updateStatus(this.lastStatus);
    }
  }

  /**
   * Update UI based on status
   */
  updateStatus(status) {
    const {
      state,
      hasApiKey,
      lastPoll,
      queuedJobs,
      isPolling,
      isExecuting
    } = status;

    // Update current state
    this.currentState = state;

    // Update status indicator
    this.updateStatusIndicator(state, isPolling, isExecuting);

    // Show appropriate panel
    this.showStatePanel(state);

    if (state === ExtensionState.IDLE || state === ExtensionState.POLLING || state === ExtensionState.EXECUTING) {
      // Update authorized state UI
      this.updateAuthorizedUI(status);
    }

    if (state === ExtensionState.UNAUTHORIZED) {
      this.prefillDevKey();
    }

    // Check block status to toggle Resume button
    this.updateBlockStateAsync();
  }

  async updateBlockStateAsync() {
    try {
      const res = await this.sendMessage(MessageTypes.GET_BLOCK_STATUS);
      const blocked = res?.blockedUntil && Date.now() < res.blockedUntil;
      this.updateBlockUI(!!blocked);
    } catch (_) {}
  }

  updateBlockUI(isBlocked) {
    const btn = document.getElementById('resumeBlockButton');
    const checkBtn = document.getElementById('forceRefreshButton');
    if (!btn || !checkBtn) return;
    btn.style.display = isBlocked ? 'block' : 'none';
    checkBtn.disabled = isBlocked;
  }

  async prefillDevKey() {
    try {
      const res = await this.sendMessage(MessageTypes.GET_DEV_KEY);
      const key = res?.devKey;
      if (key) {
        const input = document.getElementById('apiKeyInput');
        if (input && !input.value) input.value = key;
      }
    } catch (_) {}
  }

  /**
   * Update status indicator
   */
  updateStatusIndicator(state, isPolling, isExecuting) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    statusDot.className = 'status-dot';
    
    if (isExecuting) {
      statusDot.classList.add('working');
      statusText.textContent = 'Executing Job';
    } else if (isPolling) {
      statusDot.classList.add('working');
      statusText.textContent = 'Checking Jobs';
    } else {
      switch (state) {
        case ExtensionState.IDLE:
          statusDot.classList.add('connected');
          statusText.textContent = 'Connected';
          break;
        case ExtensionState.UNAUTHORIZED:
          statusDot.classList.add('error');
          statusText.textContent = 'No API Key';
          break;
        case ExtensionState.ERROR:
          statusDot.classList.add('error');
          statusText.textContent = 'Error';
          break;
        default:
          statusDot.classList.add('idle');
          statusText.textContent = 'Unknown';
      }
    }
  }

  /**
   * Show appropriate state panel
   */
  showStatePanel(state) {
    const panels = {
      unauthorized: document.getElementById('unauthorizedState'),
      authorized: document.getElementById('authorizedState'),
      error: document.getElementById('errorState')
    };

    // Hide all panels
    Object.values(panels).forEach(panel => {
      if (panel) panel.style.display = 'none';
    });

    // Show appropriate panel
    switch (state) {
      case ExtensionState.UNAUTHORIZED:
        panels.unauthorized.style.display = 'block';
        break;
      case ExtensionState.ERROR:
        panels.error.style.display = 'block';
        break;
      default:
        panels.authorized.style.display = 'block';
    }
  }

  /**
   * Update authorized state UI
   */
  updateAuthorizedUI(status) {
    const {
      lastPoll,
      queuedJobs,
      isExecuting,
      isPolling
    } = status;

    // Update queued jobs count
    const queuedJobsElement = document.getElementById('queuedJobs');
    if (queuedJobsElement) {
      queuedJobsElement.textContent = queuedJobs || 0;
    }

    // Update last poll time
    const lastPollElement = document.getElementById('lastPoll');
    if (lastPollElement) {
      lastPollElement.textContent = lastPoll ? this.formatTime(lastPoll) : 'Never';
    }

    // Update current activity
    this.updateCurrentActivity(isExecuting, isPolling, queuedJobs);

    // Update masked API key (placeholder)
    const maskedApiKeyElement = document.getElementById('maskedApiKey');
    if (maskedApiKeyElement) {
      maskedApiKeyElement.textContent = '••••••••••••••••';
    }
  }

  /**
   * Update current activity display
   */
  updateCurrentActivity(isExecuting, isPolling, queuedJobs) {
    const activityIcon = document.getElementById('activityIcon');
    const activityStatus = document.getElementById('activityStatus');
    const activityDetails = document.getElementById('activityDetails');

    if (!activityIcon || !activityStatus || !activityDetails) return;

    if (isExecuting) {
      activityIcon.textContent = '⚡';
      activityStatus.textContent = 'Executing Job';
      activityDetails.textContent = 'Scraping data from Sahibinden.com';
    } else if (isPolling) {
      activityIcon.textContent = '🔍';
      activityStatus.textContent = 'Checking for Jobs';
      activityDetails.textContent = 'Polling server for new tasks';
    } else if (queuedJobs > 0) {
      activityIcon.textContent = '📋';
      activityStatus.textContent = 'Jobs Queued';
      activityDetails.textContent = `${queuedJobs} job${queuedJobs > 1 ? 's' : ''} waiting`;
    } else {
      activityIcon.textContent = '💤';
      activityStatus.textContent = 'Idle';
      activityDetails.textContent = 'Waiting for jobs from dashboard';
    }
  }

  /**
   * Start periodic status updates
   */
  startStatusUpdates() {
    if (this.statusUpdateInterval) return;

    this.statusUpdateInterval = setInterval(() => {
      this.loadStatus();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Stop status updates
   */
  stopStatusUpdates() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  /**
   * Show input error
   */
  showInputError(input, message) {
    input.classList.add('error');
    
    // Remove existing error message
    const existingError = input.parentNode.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    // Add error message
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = `
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
    `;
    
    input.parentNode.appendChild(errorElement);
  }

  /**
   * Clear input error
   */
  clearInputError(input) {
    input.classList.remove('error');
    const errorMessage = input.parentNode.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.remove();
    }
  }

  /**
   * Set button loading state
   */
  setButtonLoading(button, isLoading) {
    if (!button) return;

    if (isLoading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);
    this.toasts.push(toast);

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);

    // Remove on click
    toast.addEventListener('click', () => {
      this.removeToast(toast);
    });
  }

  /**
   * Remove toast notification
   */
  removeToast(toast) {
    if (toast && toast.parentNode) {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);

      // Remove from tracking array
      const index = this.toasts.indexOf(toast);
      if (index > -1) {
        this.toasts.splice(index, 1);
      }
    }
  }

  /**
   * Format timestamp for display
   */
  formatTime(timestamp) {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      const date = new Date(timestamp);
      return date.toLocaleDateString();
    }
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SentioPopup();
  });
} else {
  new SentioPopup();
}
