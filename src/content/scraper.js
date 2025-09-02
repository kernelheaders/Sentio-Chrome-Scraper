/**
 * Main content script for Sentio Chrome Extension
 * Handles job execution and DOM manipulation on Sahibinden.com
 */
import { logger } from '../utils/logger.js';
import { JobExecutor } from './job-executor.js';
import { HumanSimulator } from './human-simulator.js';
import { AntiDetection } from './anti-detection.js';
import { MessageTypes, JobStatus } from '../shared/types.js';

class SentioContentScript {
  constructor() {
    this.jobExecutor = new JobExecutor();
    this.humanSimulator = new HumanSimulator();
    this.antiDetection = new AntiDetection();
    this.currentJob = null;
    this.isExecuting = false;
    this.startTime = Date.now();
    
    this.initialize();
  }

  /**
   * Initialize content script
   */
  async initialize() {
    try {
      // Only run on Sahibinden.com
      if (!this.isSahibindenSite()) {
        return;
      }

      logger.info('Sentio content script initialized on Sahibinden.com');

      // Set up message listener
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

      // Initialize anti-detection measures
      await this.antiDetection.initialize();

      // Apply human-like behaviors
      this.humanSimulator.startBackgroundActivity();

      // Signal that content script is ready
      this.sendMessage(MessageTypes.HEALTH_RESPONSE, {
        ready: true,
        url: window.location.href,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Content script initialization failed:', error);
    }
  }

  /**
   * Check if current site is Sahibinden.com
   */
  isSahibindenSite() {
    const hostname = window.location.hostname.toLowerCase();
    return hostname === 'www.sahibinden.com' || hostname === 'sahibinden.com';
  }

  /**
   * Handle messages from service worker
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      logger.debug('Content script received message:', message.type);

      switch (message.type) {
        case MessageTypes.EXECUTE_JOB:
          await this.handleExecuteJob(message.payload);
          sendResponse({ success: true });
          break;

        case MessageTypes.CANCEL_JOB:
          await this.handleCancelJob(message.payload);
          sendResponse({ success: true });
          break;

        case MessageTypes.HEALTH_CHECK:
          this.handleHealthCheck(message.payload);
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

    return true; // Keep message channel open
  }

  /**
   * Handle job execution request
   */
  async handleExecuteJob(payload) {
    try {
      if (this.isExecuting) {
        throw new Error('Another job is already executing');
      }

      if (!payload.job) {
        throw new Error('No job provided');
      }

      const job = payload.job;
      logger.logJobEvent(job.id, 'execution starting', { url: window.location.href });

      // Validate job token and expiration
      if (new Date(job.expiresAt) < new Date()) {
        throw new Error('Job has expired');
      }

      // Set execution state
      this.isExecuting = true;
      this.currentJob = job;

      // Notify service worker that job started
      this.sendMessage(MessageTypes.JOB_STARTED, {
        jobId: job.id,
        timestamp: Date.now(),
        url: window.location.href
      });

      // Execute the job
      const result = await this.executeJob(job);

      // Notify service worker of completion
      this.sendMessage(MessageTypes.JOB_COMPLETED, result);

      logger.logJobEvent(job.id, 'execution completed successfully');

    } catch (error) {
      logger.error('Job execution failed:', error);

      // Notify service worker of failure
      this.sendMessage(MessageTypes.JOB_FAILED, {
        jobId: this.currentJob?.id,
        error: error.message,
        timestamp: Date.now()
      });

    } finally {
      // Reset execution state
      this.isExecuting = false;
      this.currentJob = null;
    }
  }

  /**
   * Handle job cancellation
   */
  async handleCancelJob(payload) {
    try {
      if (!this.isExecuting) {
        return; // No job to cancel
      }

      logger.logJobEvent(this.currentJob?.id, 'cancellation requested');

      // Stop current execution
      this.jobExecutor.cancel();
      
      // Reset state
      this.isExecuting = false;
      this.currentJob = null;

      logger.info('Job cancelled successfully');

    } catch (error) {
      logger.error('Failed to cancel job:', error);
    }
  }

  /**
   * Handle health check
   */
  handleHealthCheck(payload) {
    this.sendMessage(MessageTypes.HEALTH_RESPONSE, {
      healthy: true,
      executing: this.isExecuting,
      currentJobId: this.currentJob?.id || null,
      uptime: Date.now() - this.startTime,
      url: window.location.href,
      timestamp: Date.now()
    });
  }

  /**
   * Execute a job
   */
  async executeJob(job) {
    const startTime = Date.now();
    const timer = logger.timer(`Job execution ${job.id}`);

    try {
      // Apply anti-detection measures
      await this.antiDetection.beforeJobExecution();

      // Navigate to target URL if needed
      if (job.config.url && job.config.url !== window.location.href) {
        await this.navigateToUrl(job.config.url);
      }

      // Wait for page to be ready
      await this.waitForPageReady();

      // Execute the actual scraping logic
      const extractedData = await this.jobExecutor.execute(job);

      // Apply post-execution anti-detection
      await this.antiDetection.afterJobExecution();

      const executionTime = timer.end();

      // Prepare result
      const result = {
        jobId: job.id,
        token: job.token,
        status: JobStatus.COMPLETED,
        data: extractedData,
        metadata: {
          itemsExtracted: extractedData.length,
          executionTime,
          errors: this.jobExecutor.getErrors(),
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      };

      return result;

    } catch (error) {
      timer.end();
      
      // Log execution failure
      logger.error(`Job ${job.id} execution failed:`, error);

      // Return failure result
      return {
        jobId: job.id,
        token: job.token,
        status: JobStatus.FAILED,
        data: [],
        metadata: {
          itemsExtracted: 0,
          executionTime: Date.now() - startTime,
          errors: [error.message],
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      };
    }
  }

  /**
   * Navigate to a URL with human-like behavior
   */
  async navigateToUrl(url) {
    try {
      logger.debug(`Navigating to: ${url}`);

      // Add random delay to simulate human thinking
      await this.humanSimulator.randomDelay(1000, 3000);

      // Navigate
      window.location.href = url;

      // Wait for navigation to complete
      await this.waitForPageReady();

    } catch (error) {
      logger.error('Navigation failed:', error);
      throw error;
    }
  }

  /**
   * Wait for page to be ready for interaction
   */
  async waitForPageReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Page ready timeout'));
      }, 30000); // 30 second timeout

      const checkReady = () => {
        if (document.readyState === 'complete') {
          clearTimeout(timeout);
          
          // Additional delay to ensure dynamic content loads
          setTimeout(resolve, 1000);
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Send message to service worker
   */
  sendMessage(type, payload) {
    try {
      chrome.runtime.sendMessage({
        type,
        payload
      });
    } catch (error) {
      logger.error('Failed to send message to service worker:', error);
    }
  }

  /**
   * Clean up on unload
   */
  cleanup() {
    try {
      this.humanSimulator.stopBackgroundActivity();
      this.jobExecutor.cancel();
      
      logger.debug('Content script cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SentioContentScript();
  });
} else {
  new SentioContentScript();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.sentioContentScript) {
    window.sentioContentScript.cleanup();
  }
});