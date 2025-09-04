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

  // Promise wrappers for chrome.storage APIs
  storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        this.storage.get(keys, (result) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message || String(err)));
          resolve(result || {});
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  storageSet(items) {
    return new Promise((resolve, reject) => {
      try {
        this.storage.set(items, () => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message || String(err)));
          resolve(true);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  storageRemove(keys) {
    return new Promise((resolve, reject) => {
      try {
        this.storage.remove(keys, () => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message || String(err)));
          resolve(true);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  storageClear() {
    return new Promise((resolve, reject) => {
      try {
        this.storage.clear(() => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message || String(err)));
          resolve(true);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  storageBytesInUse() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.getBytesInUse(null, (bytes) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(new Error(err.message || String(err)));
          resolve(bytes || 0);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Store encrypted API key
   */
  async setApiKey(apiKey) {
    try {
      const encrypted = await encryptApiKey(apiKey);
      await this.storageSet({ [CONFIG.STORAGE_KEYS.API_KEY]: encrypted });
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
      const result = await this.storageGet([CONFIG.STORAGE_KEYS.API_KEY]);
      const encrypted = result[CONFIG.STORAGE_KEYS.API_KEY];

      if (!encrypted) return null;

      // Smooth migration: if legacy CryptoJS/OpenSSL format is detected (U2FsdGVkX1...)
      if (typeof encrypted === 'string' && encrypted.startsWith('U2FsdGVkX1')) {
        console.warn('Legacy API key format detected; clearing for re-entry');
        await this.clearApiKey();
        return null;
      }

      return await decryptApiKey(encrypted);
    } catch (error) {
      console.warn('Failed to retrieve API key:', error?.message || error);
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
      await this.storageRemove([CONFIG.STORAGE_KEYS.API_KEY]);
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
      // Ensure the stored key is actually decryptable
      const key = await this.getApiKey();
      return !!key;
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
      await this.storageSet({ [CONFIG.STORAGE_KEYS.EXTENSION_STATE]: state });
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
      const result = await this.storageGet([CONFIG.STORAGE_KEYS.EXTENSION_STATE]);
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
      await this.storageSet({ [CONFIG.STORAGE_KEYS.LAST_POLL]: timestamp });
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
      const result = await this.storageGet([CONFIG.STORAGE_KEYS.LAST_POLL]);
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
      await this.storageSet({ [CONFIG.STORAGE_KEYS.JOB_QUEUE]: jobs });
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
      const result = await this.storageGet([CONFIG.STORAGE_KEYS.JOB_QUEUE]);
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
      await this.storageRemove([CONFIG.STORAGE_KEYS.JOB_QUEUE]);
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
      await this.storageClear();
      return true;
    } catch (error) {
      console.error('Failed to clear all storage:', error);
      return false;
    }
  }

  /**
   * Store last job result for CSV export
   */
  async setLastResult(result) {
    try {
      await this.storageSet({ [CONFIG.STORAGE_KEYS.LAST_RESULT]: result });
      return true;
    } catch (error) {
      console.error('Failed to store last result:', error);
      return false;
    }
  }

  /**
   * Get last job result
   */
  async getLastResult() {
    try {
      const result = await this.storageGet([CONFIG.STORAGE_KEYS.LAST_RESULT]);
      return result[CONFIG.STORAGE_KEYS.LAST_RESULT] || null;
    } catch (error) {
      console.error('Failed to get last result:', error);
      return null;
    }
  }

  /**
   * Clear last job result
   */
  async clearLastResult() {
    try {
      await this.storageRemove([CONFIG.STORAGE_KEYS.LAST_RESULT]);
      return true;
    } catch (error) {
      console.error('Failed to clear last result:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageInfo() {
    try {
      const bytesInUse = await this.storageBytesInUse();
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

  // Blocked until helpers
  async setBlockedUntil(timestamp) {
    try {
      await this.storageSet({ [CONFIG.STORAGE_KEYS.BLOCKED_UNTIL]: timestamp });
      return true;
    } catch (e) { console.error('Failed to set blockedUntil:', e); return false; }
  }
  async getBlockedUntil() {
    try {
      const r = await this.storageGet([CONFIG.STORAGE_KEYS.BLOCKED_UNTIL]);
      return r[CONFIG.STORAGE_KEYS.BLOCKED_UNTIL] || 0;
    } catch (e) { console.error('Failed to get blockedUntil:', e); return 0; }
  }
  async clearBlockedUntil() {
    try {
      await this.storageRemove([CONFIG.STORAGE_KEYS.BLOCKED_UNTIL]);
      return true;
    } catch (e) { console.error('Failed to clear blockedUntil:', e); return false; }
  }
}

// Create singleton instance
export const secureStorage = new SecureStorage();
