/**
 * Job management system for Sentio Chrome Extension
 * Handles job queuing, execution coordination, and result submission
 */
import { logger } from '../utils/logger.js';
import { secureStorage } from '../utils/storage.js';
import { validateJob, validateJobResult } from '../utils/validators.js';
import { MessageTypes, JobStatus, CONFIG, ErrorCodes } from '../shared/types.js';

export class JobManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.currentJob = null;
    this.jobQueue = [];
    this.executionHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Send execute message with safe injection + retries
   */
  async sendExecuteMessage(tabId, job, attempt = 1) {
    const maxAttempts = 5;
    const delay = 200 * attempt; // 200ms, 400ms, ...
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MessageTypes.EXECUTE_JOB,
        payload: { job, timestamp: Date.now() }
      });
      if (!response || response.success !== true) {
        logger.debug(`Execute ACK not received (attempt ${attempt}) for job ${job.id}`);
      }
      return true;
    } catch (err) {
      // Try to inject on first failure
      if (attempt === 1) {
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ['content/scraper.js'] });
        } catch (injErr) {
          logger.debug('Content script injection error:', injErr?.message || injErr);
        }
      }

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay));
        return this.sendExecuteMessage(tabId, job, attempt + 1);
      }

      logger.warn(`Failed to deliver execute message after ${maxAttempts} attempts for job ${job.id}`);
      return false;
    }
  }

  /**
   * Fetch pending jobs from API
   */
  async fetchPendingJobs() {
    try {
      const jobs = await this.apiClient.fetchPendingJobs();
      
      // Validate each job
      const validJobs = jobs.filter(job => {
        const validation = validateJob(job);
        if (!validation.isValid) {
          logger.warn(`Invalid job ${job.id}:`, validation.errors);
          return false;
        }
        return true;
      });

      if (validJobs.length !== jobs.length) {
        logger.warn(`Filtered out ${jobs.length - validJobs.length} invalid jobs`);
      }

      return validJobs;

    } catch (error) {
      logger.error('Failed to fetch pending jobs:', error);
      throw error;
    }
  }

  /**
   * Queue jobs for execution
   */
  async queueJobs(jobs) {
    try {
      // Add jobs to queue (avoiding duplicates)
      const newJobs = jobs.filter(job => 
        !this.jobQueue.some(queuedJob => queuedJob.id === job.id)
      );

      // Normalize incoming jobs (status/type defaults)
      for (const job of newJobs) {
        if (!job.status) job.status = JobStatus.PENDING;
        // Normalize type names from backend if needed
        if (job.type === 'listing_scrape') job.type = 'scrape_listings';
        if (job.type === 'detail_scrape') job.type = 'scrape_details';
      }

      this.jobQueue.push(...newJobs);
      
      // Sort by priority/creation time
      this.jobQueue.sort((a, b) => {
        const priorityA = a.config.priority || 0;
        const priorityB = b.config.priority || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Higher priority first
        }
        
        return new Date(a.createdAt) - new Date(b.createdAt); // Older first
      });

      // Persist queue
      await secureStorage.setJobQueue(this.jobQueue);

      logger.info(`Queued ${newJobs.length} new job(s), total: ${this.jobQueue.length}`);

    } catch (error) {
      logger.error('Failed to queue jobs:', error);
      throw error;
    }
  }

  /**
   * Get pending jobs from queue
   */
  async getPendingJobs() {
    try {
      // Load queue from storage if empty
      if (this.jobQueue.length === 0) {
        this.jobQueue = await secureStorage.getJobQueue();
      }

      return this.jobQueue.filter(job => 
        job.status === JobStatus.PENDING && 
        new Date(job.expiresAt) > new Date()
      );

    } catch (error) {
      logger.error('Failed to get pending jobs:', error);
      return [];
    }
  }

  /**
   * Try to execute the next job in queue
   */
  async tryExecuteNextJob() {
    if (this.currentJob) {
      logger.debug('Job already executing, skipping');
      return false;
    }

    try {
      const pendingJobs = await this.getPendingJobs();
      
      if (pendingJobs.length === 0) {
        logger.debug('No pending jobs to execute');
        return false;
      }

      const nextJob = pendingJobs[0];
      
      // Check if we have a suitable tab for execution
      const suitableTab = await this.findSuitableTab(nextJob);
      
      if (suitableTab) {
        return await this.executeJob(suitableTab.id, nextJob);
      } else {
        logger.debug('No suitable tab found for job execution');
        // Try to open a new tab if job has a target URL
        if (nextJob.config?.url) {
          try {
            const createdTab = await new Promise(resolve => chrome.tabs.create({ url: nextJob.config.url }, resolve));
            logger.info('Opened new tab for job execution', { tabId: createdTab?.id, url: nextJob.config.url });
            // handleTabUpdate will catch when the tab completes and trigger execution
          } catch (e) {
            logger.warn('Failed to open tab for job execution:', e?.message || e);
          }
        }
        return false;
      }

    } catch (error) {
      logger.error('Failed to execute next job:', error);
      return false;
    }
  }

  /**
   * Try to execute a specific job on a tab
   */
  async tryExecuteJob(tabId, job) {
    if (this.currentJob) {
      logger.debug('Another job is already executing');
      return false;
    }

    try {
      const validation = validateJob(job);
      if (!validation.isValid) {
        logger.error(`Cannot execute invalid job ${job.id}:`, validation.errors);
        return false;
      }

      return await this.executeJob(tabId, job);

    } catch (error) {
      logger.error(`Failed to execute job ${job.id}:`, error);
      return false;
    }
  }

  /**
   * Execute a job on a specific tab
   */
  async executeJob(tabId, job) {
    try {
      logger.logJobEvent(job.id, 'starting execution', { tabId });

      // Mark job as current
      this.currentJob = job;
      job.status = JobStatus.RUNNING;
      job.startTime = Date.now();

      // Update queue
      await this.updateJobQueue();

      const delivered = await this.sendExecuteMessage(tabId, job);
      if (delivered) {
        logger.logJobEvent(job.id, 'execution start message delivered');
        return true;
      } else {
        // Leave job as RUNNING, try again on next suitable event
        logger.warn(`Execution message not delivered; will retry later for job ${job.id}`);
        return false;
      }

    } catch (error) {
      logger.error(`Failed to execute job ${job.id}:`, error);
      // Do not mark as failed due to transient messaging issues
      // Keep job in queue/run state and let next events retry
      
      return false;
    }
  }

  /**
   * Handle job completion
   */
  async handleJobCompletion(jobId, result) {
    try {
      if (!this.currentJob || this.currentJob.id !== jobId) {
        logger.warn(`Received completion for unexpected job: ${jobId}`);
        return;
      }

      const job = this.currentJob;
      
      // Validate result
      const validation = validateJobResult(result);
      if (!validation.isValid) {
        logger.error(`Invalid job result for ${jobId}:`, validation.errors);
        await this.handleJobFailure(job, 'Invalid result format');
        return;
      }

      // Submit result to API
      await this.submitJobResult(result);

      // Mark job as completed
      job.status = JobStatus.COMPLETED;
      job.endTime = Date.now();
      job.executionTime = job.endTime - job.startTime;

      // Add to history
      this.addToHistory(job);

      // Remove from queue
      await this.removeJobFromQueue(jobId);

      // Clear current job
      this.currentJob = null;

      logger.logJobEvent(jobId, 'completed successfully', {
        itemsExtracted: result.metadata.itemsExtracted,
        executionTime: job.executionTime
      });

    } catch (error) {
      logger.error(`Failed to handle job completion for ${jobId}:`, error);
      
      if (this.currentJob && this.currentJob.id === jobId) {
        await this.handleJobFailure(this.currentJob, error.message);
      }
    }
  }

  /**
   * Handle job failure
   */
  async handleJobFailure(job, errorMessage) {
    try {
      job.status = JobStatus.FAILED;
      job.endTime = Date.now();
      job.error = errorMessage;

      if (job.startTime) {
        job.executionTime = job.endTime - job.startTime;
      }

      // Add to history
      this.addToHistory(job);

      // Remove from queue
      await this.removeJobFromQueue(job.id);

      // Clear current job
      this.currentJob = null;

      logger.logJobEvent(job.id, 'failed', { error: errorMessage });

      // Report failure to API (optional)
      try {
        await this.apiClient.reportMetrics({
          jobId: job.id,
          status: 'failed',
          error: errorMessage,
          timestamp: Date.now()
        });
      } catch (reportError) {
        logger.warn('Failed to report job failure:', reportError.message);
      }

    } catch (error) {
      logger.error(`Failed to handle job failure for ${job.id}:`, error);
    }
  }

  /**
   * Submit job result to API
   */
  async submitJobResult(result) {
    try {
      const pruned = this.pruneResultForSubmission(result);
      const response = await this.apiClient.submitJobResult(pruned);
      logger.info(`Job result submitted successfully: ${result.jobId}`);
      return response;

    } catch (error) {
      logger.error(`Failed to submit job result for ${result.jobId}:`, error);
      
      // Store for retry if needed
      await this.storeFailedResult(result, error.message);
      
      throw error;
    }
  }

  /**
   * Keep only required fields to reduce payload size
   */
  pruneResultForSubmission(result) {
    try {
      const keepItem = (item) => ({
        phone: item?.contact?.phone || '',
        name: item?.contact?.name || '',
        from: item?.from || '',
        address: item?.address || item?.location || '',
        title: item?.title || '',
        price: item?.price ?? '',
        date: item?.date || '',
        url: item?.url || ''
      });
      const data = Array.isArray(result.data) ? result.data.map(keepItem) : [];
      return { ...result, data };
    } catch {
      return result;
    }
  }

  /**
   * Find a suitable tab for job execution
   */
  async findSuitableTab(job) {
    try {
      // Get all tabs matching the target URL pattern
      const tabs = await chrome.tabs.query({
        url: ['https://www.sahibinden.com/*', 'https://sahibinden.com/*']
      });

      // Filter tabs based on job requirements
      for (const tab of tabs) {
        if (this.isTabSuitableForJob(tab, job)) {
          return tab;
        }
      }

      // If no suitable tab found, could potentially create one
      // But for now, we'll return null
      return null;

    } catch (error) {
      logger.error('Failed to find suitable tab:', error);
      return null;
    }
  }

  /**
   * Check if a tab is suitable for a job
   */
  isTabSuitableForJob(tab, job) {
    // Check if tab is loading or complete
    if (tab.status !== 'complete') {
      return false;
    }

    // Check if URL matches job requirements
    if (job.config.url) {
      try {
        const jobUrl = new URL(job.config.url);
        const tabUrl = new URL(tab.url);
        
        // Must be on the same domain
        if (tabUrl.hostname !== jobUrl.hostname) {
          return false;
        }

        // Additional URL matching logic can be added here
        
      } catch (error) {
        logger.warn('URL comparison failed:', error);
        return false;
      }
    }

    return true;
  }

  /**
   * Update job queue in storage
   */
  async updateJobQueue() {
    try {
      await secureStorage.setJobQueue(this.jobQueue);
    } catch (error) {
      logger.error('Failed to update job queue:', error);
    }
  }

  /**
   * Remove job from queue
   */
  async removeJobFromQueue(jobId) {
    try {
      this.jobQueue = this.jobQueue.filter(job => job.id !== jobId);
      await secureStorage.setJobQueue(this.jobQueue);
    } catch (error) {
      logger.error('Failed to remove job from queue:', error);
    }
  }

  /**
   * Add job to execution history
   */
  addToHistory(job) {
    this.executionHistory.unshift(job);
    
    // Limit history size
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Store failed result for retry
   */
  async storeFailedResult(result, error) {
    // Implementation could store in IndexedDB or similar
    // For now, just log
    logger.warn('Failed result stored for potential retry:', {
      jobId: result.jobId,
      error
    });
  }

  /**
   * Get job statistics
   */
  getJobStats() {
    const completed = this.executionHistory.filter(job => job.status === JobStatus.COMPLETED);
    const failed = this.executionHistory.filter(job => job.status === JobStatus.FAILED);
    
    return {
      queued: this.jobQueue.length,
      currentJob: this.currentJob?.id || null,
      completed: completed.length,
      failed: failed.length,
      successRate: completed.length / (completed.length + failed.length) || 0,
      avgExecutionTime: completed.reduce((sum, job) => sum + (job.executionTime || 0), 0) / completed.length || 0
    };
  }

  /**
   * Clear all jobs and reset state
   */
  async clearAllJobs() {
    try {
      this.jobQueue = [];
      this.currentJob = null;
      this.executionHistory = [];
      
      await secureStorage.clearJobQueue();
      
      logger.info('All jobs cleared');

    } catch (error) {
      logger.error('Failed to clear jobs:', error);
    }
  }
}
