/**
 * Secure Chrome storage wrapper with encryption support
 */
import { encryptApiKey, decryptApiKey } from './crypto.js';
import { CONFIG } from '../shared/types.js';

/**
 * Storage utility class for Chrome extension
 */
class SecureStorage {
  constructor() {
    this.storage = chrome.storage.local;
  }

  /**
   * Store encrypted API key
   */
  async setApiKey(apiKey) {
    try {
      const encrypted = await encryptApiKey(apiKey);
      await this.storage.set({
        [CONFIG.STORAGE_KEYS.API_KEY]: encrypted
      });
      return true;
    } catch (error) {
      console.error('Failed to store API key:', error);
      return false;
    }
  }

  /**
   * Retrieve and decrypt API key
   */
  async getApiKey() {
    try {
      const result = await this.storage.get([CONFIG.STORAGE_KEYS.API_KEY]);
      const encrypted = result[CONFIG.STORAGE_KEYS.API_KEY];
      
      if (!encrypted) {
        return null;
      }
      
      return await decryptApiKey(encrypted);
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      // If decryption fails, clear the corrupted key
      await this.clearApiKey();
      return null;
    }
  }

  /**
   * Remove API key from storage
   */
  async clearApiKey() {
    try {
      await this.storage.remove([CONFIG.STORAGE_KEYS.API_KEY]);
      return true;
    } catch (error) {
      console.error('Failed to clear API key:', error);
      return false;
    }
  }

  /**
   * Check if API key exists
   */
  async hasApiKey() {
    try {
      const result = await this.storage.get([CONFIG.STORAGE_KEYS.API_KEY]);
      return !!result[CONFIG.STORAGE_KEYS.API_KEY];
    } catch (error) {
      console.error('Failed to check API key existence:', error);
      return false;
    }
  }

  /**
   * Store extension state
   */
  async setState(state) {
    try {
      await this.storage.set({
        [CONFIG.STORAGE_KEYS.EXTENSION_STATE]: state
      });
      return true;
    } catch (error) {
      console.error('Failed to store state:', error);
      return false;
    }
  }

  /**
   * Get extension state
   */
  async getState() {
    try {
      const result = await this.storage.get([CONFIG.STORAGE_KEYS.EXTENSION_STATE]);
      return result[CONFIG.STORAGE_KEYS.EXTENSION_STATE] || 'unauthorized';
    } catch (error) {
      console.error('Failed to get state:', error);
      return 'unauthorized';
    }
  }

  /**
   * Store last poll timestamp
   */
  async setLastPoll(timestamp) {
    try {
      await this.storage.set({
        [CONFIG.STORAGE_KEYS.LAST_POLL]: timestamp
      });
      return true;
    } catch (error) {
      console.error('Failed to store last poll time:', error);
      return false;
    }
  }

  /**
   * Get last poll timestamp
   */
  async getLastPoll() {
    try {
      const result = await this.storage.get([CONFIG.STORAGE_KEYS.LAST_POLL]);
      return result[CONFIG.STORAGE_KEYS.LAST_POLL] || 0;
    } catch (error) {
      console.error('Failed to get last poll time:', error);
      return 0;
    }
  }

  /**
   * Store job queue (temporary storage during execution)
   */
  async setJobQueue(jobs) {
    try {
      await this.storage.set({
        [CONFIG.STORAGE_KEYS.JOB_QUEUE]: jobs
      });
      return true;
    } catch (error) {
      console.error('Failed to store job queue:', error);
      return false;
    }
  }

  /**
   * Get job queue
   */
  async getJobQueue() {
    try {
      const result = await this.storage.get([CONFIG.STORAGE_KEYS.JOB_QUEUE]);
      return result[CONFIG.STORAGE_KEYS.JOB_QUEUE] || [];
    } catch (error) {
      console.error('Failed to get job queue:', error);
      return [];
    }
  }

  /**
   * Clear job queue
   */
  async clearJobQueue() {
    try {
      await this.storage.remove([CONFIG.STORAGE_KEYS.JOB_QUEUE]);
      return true;
    } catch (error) {
      console.error('Failed to clear job queue:', error);
      return false;
    }
  }

  /**
   * Clear all storage (logout functionality)
   */
  async clearAll() {
    try {
      await this.storage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear all storage:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageInfo() {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        used: bytesInUse,
        total: quota,
        available: quota - bytesInUse,
        usagePercent: (bytesInUse / quota) * 100
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return null;
    }
  }

  /**
   * Listen for storage changes
   */
  onChanged(callback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        callback(changes);
      }
    });
  }
}

// Create singleton instance
export const secureStorage = new SecureStorage();