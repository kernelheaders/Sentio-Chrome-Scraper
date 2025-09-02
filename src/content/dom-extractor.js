/**
 * DOM extraction utilities for Sentio Chrome Extension
 * Handles robust data extraction from web pages
 */
import { logger } from '../utils/logger.js';

export class DOMExtractor {
  constructor() {
    this.extractionStats = {
      successful: 0,
      failed: 0,
      cached: 0
    };
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds
  }

  /**
   * Extract text content from element using selector
   */
  extractText(container, selector, attribute = null) {
    try {
      const element = this.findElement(container, selector);
      if (!element) {
        return null;
      }

      let text;
      if (attribute) {
        text = element.getAttribute(attribute);
      } else {
        text = element.textContent || element.innerText;
      }

      // Clean and normalize text
      text = this.cleanText(text);
      
      this.extractionStats.successful++;
      return text;

    } catch (error) {
      logger.debug(`Failed to extract text with selector "${selector}":`, error.message);
      this.extractionStats.failed++;
      return null;
    }
  }

  /**
   * Extract attribute value from element
   */
  extractAttribute(container, selector, attribute) {
    try {
      const element = this.findElement(container, selector);
      if (!element) {
        return null;
      }

      const value = element.getAttribute(attribute);
      this.extractionStats.successful++;
      return value;

    } catch (error) {
      logger.debug(`Failed to extract attribute "${attribute}" with selector "${selector}":`, error.message);
      this.extractionStats.failed++;
      return null;
    }
  }

  /**
   * Extract multiple text values using array of selectors
   */
  extractMultipleText(container, selectors) {
    const results = [];

    for (const selector of selectors) {
      const text = this.extractText(container, selector);
      if (text) {
        results.push(text);
      }
    }

    return results;
  }

  /**
   * Extract all matching elements and their text
   */
  extractAllText(container, selector) {
    try {
      const elements = this.findAllElements(container, selector);
      const texts = [];

      for (const element of elements) {
        const text = this.cleanText(element.textContent || element.innerText);
        if (text) {
          texts.push(text);
        }
      }

      this.extractionStats.successful++;
      return texts;

    } catch (error) {
      logger.debug(`Failed to extract all text with selector "${selector}":`, error.message);
      this.extractionStats.failed++;
      return [];
    }
  }

  /**
   * Extract data from table structure
   */
  extractTableData(tableElement) {
    try {
      const data = {};
      
      // Try different table structures
      const rows = tableElement.querySelectorAll('tr, .row, .list-item');
      
      for (const row of rows) {
        // Try key-value pair extraction
        const keyElement = row.querySelector('.label, .key, td:first-child, .property-name');
        const valueElement = row.querySelector('.value, .data, td:last-child, .property-value');
        
        if (keyElement && valueElement) {
          const key = this.cleanText(keyElement.textContent);
          const value = this.cleanText(valueElement.textContent);
          
          if (key && value) {
            data[key] = value;
          }
        }
      }

      this.extractionStats.successful++;
      return data;

    } catch (error) {
      logger.debug('Failed to extract table data:', error.message);
      this.extractionStats.failed++;
      return {};
    }
  }

  /**
   * Extract structured data from a list
   */
  extractListData(container, itemSelector, fieldSelectors) {
    try {
      const items = [];
      const itemElements = this.findAllElements(container, itemSelector);

      for (const itemElement of itemElements) {
        const itemData = {};

        for (const [fieldName, selector] of Object.entries(fieldSelectors)) {
          if (typeof selector === 'object') {
            // Handle complex field extraction
            itemData[fieldName] = this.extractComplexField(itemElement, selector);
          } else {
            // Simple text extraction
            itemData[fieldName] = this.extractText(itemElement, selector);
          }
        }

        if (Object.keys(itemData).length > 0) {
          items.push(itemData);
        }
      }

      this.extractionStats.successful++;
      return items;

    } catch (error) {
      logger.debug('Failed to extract list data:', error.message);
      this.extractionStats.failed++;
      return [];
    }
  }

  /**
   * Extract complex field with multiple possible selectors or transformations
   */
  extractComplexField(container, fieldConfig) {
    try {
      if (fieldConfig.selectors) {
        // Try multiple selectors until one works
        for (const selector of fieldConfig.selectors) {
          const result = this.extractText(container, selector, fieldConfig.attribute);
          if (result) {
            return fieldConfig.transform ? this.transformValue(result, fieldConfig.transform) : result;
          }
        }
      }

      if (fieldConfig.selector) {
        const result = this.extractText(container, fieldConfig.selector, fieldConfig.attribute);
        return fieldConfig.transform ? this.transformValue(result, fieldConfig.transform) : result;
      }

      return null;

    } catch (error) {
      logger.debug('Failed to extract complex field:', error.message);
      return null;
    }
  }

  /**
   * Find element with fallback selectors
   */
  findElement(container, selectors) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    const containerElement = container === document ? document : container;

    for (const selector of selectorArray) {
      try {
        const element = containerElement.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        logger.debug(`Invalid selector "${selector}":`, error.message);
        continue;
      }
    }

    return null;
  }

  /**
   * Find all elements with fallback selectors
   */
  findAllElements(container, selectors) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    const containerElement = container === document ? document : container;

    for (const selector of selectorArray) {
      try {
        const elements = containerElement.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements);
        }
      } catch (error) {
        logger.debug(`Invalid selector "${selector}":`, error.message);
        continue;
      }
    }

    return [];
  }

  /**
   * Clean and normalize extracted text
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\t+/g, ' ') // Replace tabs with spaces
      .trim();
  }

  /**
   * Transform extracted value based on type
   */
  transformValue(value, transformType) {
    if (!value) return value;

    switch (transformType) {
      case 'number':
        return this.extractNumber(value);
        
      case 'price':
        return this.extractPrice(value);
        
      case 'date':
        return this.extractDate(value);
        
      case 'url':
        return this.normalizeUrl(value);
        
      case 'phone':
        return this.extractPhone(value);
        
      case 'email':
        return this.extractEmail(value);
        
      case 'lowercase':
        return value.toLowerCase();
        
      case 'uppercase':
        return value.toUpperCase();
        
      default:
        return value;
    }
  }

  /**
   * Extract number from text
   */
  extractNumber(text) {
    const match = text.match(/[\d,.]+/);
    if (match) {
      const cleaned = match[0].replace(/,/g, '.');
      const number = parseFloat(cleaned);
      return isNaN(number) ? null : number;
    }
    return null;
  }

  /**
   * Extract price from text
   */
  extractPrice(text) {
    // Remove currency symbols and normalize
    const cleaned = text.replace(/[^\d,.]/g, '');
    return this.extractNumber(cleaned);
  }

  /**
   * Extract date from text
   */
  extractDate(text) {
    // Simple date extraction - can be enhanced
    const datePatterns = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/     // YYYY-MM-DD
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0]; // Return matched date string
      }
    }

    return null;
  }

  /**
   * Normalize URL
   */
  normalizeUrl(url) {
    if (!url) return null;

    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    if (url.startsWith('/')) {
      return 'https://www.sahibinden.com' + url;
    }

    return url;
  }

  /**
   * Extract phone number
   */
  extractPhone(text) {
    const phonePattern = /[\d\s\-\(\)\+]+/;
    const match = text.match(phonePattern);
    return match ? match[0].trim() : null;
  }

  /**
   * Extract email address
   */
  extractEmail(text) {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailPattern);
    return match ? match[0] : null;
  }

  /**
   * Wait for element to appear
   */
  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }, timeout);

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(element);
        }
      });

      // Check if element already exists
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        resolve(element);
      } else {
        // Start observing for changes
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    });
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      ...this.extractionStats,
      cacheSize: this.cache.size,
      successRate: this.extractionStats.successful / (this.extractionStats.successful + this.extractionStats.failed)
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.extractionStats = {
      successful: 0,
      failed: 0,
      cached: 0
    };
  }
}