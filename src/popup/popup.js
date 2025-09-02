/**
 * Popup script for Sentio Chrome Extension
 * Handles UI interactions and communication with service worker
 */
import { MessageTypes, ExtensionState } from '../shared/types.js';

class SentioPopup {
  constructor() {
    this.currentState = ExtensionState.UNAUTHORIZED;
    this.statusUpdateInterval = null;
    this.toasts = [];
    
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

    // Disconnect button
    const disconnectButton = document.getElementById('disconnectButton');
    disconnectButton?.addEventListener('click', this.handleDisconnect.bind(this));

    // Action buttons
    const forceRefreshButton = document.getElementById('forceRefreshButton');
    forceRefreshButton?.addEventListener('click', this.handleForceRefresh.bind(this));

    const openDashboardButton = document.getElementById('openDashboardButton');
    openDashboardButton?.addEventListener('click', this.handleOpenDashboard.bind(this));

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

      // Send API key to service worker
      const response = await this.sendMessage(MessageTypes.SET_API_KEY, { apiKey });

      if (response.success) {
        this.showToast('API key validated successfully', 'success');
        apiKeyInput.value = '';
        await this.loadStatus(); // Refresh status
      } else {
        throw new Error(response.error || 'Failed to validate API key');
      }

    } catch (error) {
      console.error('API key validation failed:', error);
      this.showInputError(apiKeyInput, error.message);
      this.showToast('API key validation failed', 'error');
    } finally {
      this.setButtonLoading(submitButton, false);
    }
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

      const response = await this.sendMessage(MessageTypes.FORCE_POLL);

      if (response.success) {
        this.showToast('Checking for jobs...', 'info');
        await this.loadStatus();
      } else {
        throw new Error(response.error || 'Failed to check for jobs');
      }

    } catch (error) {
      console.error('Force refresh failed:', error);
      this.showToast('Failed to check for jobs', 'error');
    } finally {
      const button = document.getElementById('forceRefreshButton');
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Handle open dashboard button click
   */
  handleOpenDashboard() {
    chrome.tabs.create({ url: 'https://app.sentio.com/dashboard' });
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
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  /**
   * Load current status from service worker
   */
  async loadStatus() {
    try {
      const response = await this.sendMessage(MessageTypes.GET_STATUS);
      
      if (response.success !== false) {
        this.updateStatus(response);
      } else {
        throw new Error(response.error || 'Failed to get status');
      }

    } catch (error) {
      console.error('Failed to load status:', error);
      this.updateStatus({ state: ExtensionState.ERROR });
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