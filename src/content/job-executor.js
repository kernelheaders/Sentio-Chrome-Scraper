/**
 * Job execution engine for Sentio Chrome Extension
 * Handles the actual scraping logic and data extraction
 */
import { logger } from '../utils/logger.js';
import { DOMExtractor } from './dom-extractor.js';
import { HumanSimulator } from './human-simulator.js';
import { validateJob } from '../utils/validators.js';

export class JobExecutor {
  constructor() {
    this.domExtractor = new DOMExtractor();
    this.humanSimulator = new HumanSimulator();
    this.isCancelled = false;
    this.errors = [];
    this.currentStep = null;
  }

  /**
   * Execute a job and return extracted data
   */
  async execute(job) {
    try {
      // Reset state
      this.reset();

      // Validate job
      const validation = validateJob(job);
      if (!validation.isValid) {
        throw new Error(`Invalid job: ${validation.errors.join(', ')}`);
      }

      logger.logJobEvent(job.id, 'execution started', {
        type: job.type,
        url: job.config.url
      });

      // Execute based on job type
      switch (job.type) {
        case 'scrape_listings':
          return await this.scrapeListings(job);
          
        case 'scrape_details':
          return await this.scrapeDetails(job);
          
        case 'monitor_changes':
          return await this.monitorChanges(job);
          
        default:
          throw new Error(`Unsupported job type: ${job.type}`);
      }

    } catch (error) {
      this.addError(error.message);
      logger.error(`Job execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scrape property listings from search results
   */
  async scrapeListings(job) {
    const config = job.config;
    const results = [];
    let currentPage = 1;
    const maxPages = config.maxPages || 10;
    const maxItems = config.maxItems || 100;

    try {
      this.currentStep = 'scraping_listings';

      // Navigate to search results if not already there
      if (config.searchUrl && !window.location.href.includes(config.searchUrl)) {
        await this.navigateToUrl(config.searchUrl);
      }

      // Extract listings from current page
      while (currentPage <= maxPages && results.length < maxItems && !this.isCancelled) {
        logger.debug(`Scraping page ${currentPage}`);

        // Wait for content to load
        await this.waitForContent(config.selectors.listingContainer || '.searchResultsItem');

        // Extract listings from current page
        const pageResults = await this.extractListingsFromPage(config);
        
        if (pageResults.length === 0) {
          logger.info('No more listings found, stopping pagination');
          break;
        }

        results.push(...pageResults);
        logger.debug(`Extracted ${pageResults.length} items from page ${currentPage}`);

        // Check if we have enough results
        if (results.length >= maxItems) {
          logger.info(`Reached maximum items limit (${maxItems})`);
          break;
        }

        // Navigate to next page if available
        const hasNextPage = await this.goToNextPage(currentPage);
        if (!hasNextPage) {
          logger.info('No more pages available');
          break;
        }

        currentPage++;
      }

      // Trim results to max items
      const finalResults = results.slice(0, maxItems);
      
      logger.logJobEvent(job.id, `scraped ${finalResults.length} listings`, {
        pages: currentPage - 1,
        items: finalResults.length
      });

      return finalResults;

    } catch (error) {
      this.addError(`Listings scraping failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scrape detailed information from individual property pages
   */
  async scrapeDetails(job) {
    const config = job.config;
    const results = [];

    try {
      this.currentStep = 'scraping_details';

      // URLs should be provided in job config
      const urls = config.urls || [];
      if (urls.length === 0) {
        throw new Error('No URLs provided for detail scraping');
      }

      for (let i = 0; i < urls.length && !this.isCancelled; i++) {
        const url = urls[i];
        
        try {
          logger.debug(`Scraping details from: ${url}`);

          // Navigate to detail page
          await this.navigateToUrl(url);

          // Wait for content to load
          await this.waitForContent(config.selectors.detailContainer || '.classifiedDetail');

          // Extract detailed information
          const detailData = await this.extractDetailData(config, url);
          
          if (detailData) {
            results.push(detailData);
          }

          // Human-like delay between pages
          await this.humanSimulator.randomDelay(2000, 5000);

        } catch (error) {
          logger.warn(`Failed to scrape details from ${url}: ${error.message}`);
          this.addError(`Detail scraping failed for ${url}: ${error.message}`);
          continue; // Continue with next URL
        }
      }

      logger.logJobEvent(job.id, `scraped details from ${results.length} pages`);
      return results;

    } catch (error) {
      this.addError(`Detail scraping failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor for changes on specific pages
   */
  async monitorChanges(job) {
    const config = job.config;
    
    try {
      this.currentStep = 'monitoring_changes';

      // This is a simplified implementation
      // In a real scenario, this would compare with previous snapshots
      
      const currentData = await this.extractCurrentState(config);
      
      // For now, just return current state
      // In production, this would compare with stored previous state
      return [{
        url: window.location.href,
        timestamp: new Date().toISOString(),
        data: currentData,
        changes: [] // Would contain actual changes
      }];

    } catch (error) {
      this.addError(`Change monitoring failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract listings from current page
   */
  async extractListingsFromPage(config) {
    try {
      const listings = [];
      const selectors = config.selectors || {};
      
      // Default selectors for Sahibinden listings
      const listingSelector = selectors.listing || '.searchResultsItem';
      const listingElements = document.querySelectorAll(listingSelector);

      for (const element of listingElements) {
        if (this.isCancelled) break;

        try {
          const listingData = await this.extractListingData(element, selectors);
          if (listingData) {
            listings.push(listingData);
          }
        } catch (error) {
          logger.warn('Failed to extract listing data:', error.message);
          this.addError(`Listing extraction error: ${error.message}`);
        }
      }

      return listings;

    } catch (error) {
      logger.error('Failed to extract listings from page:', error);
      throw error;
    }
  }

  /**
   * Extract data from a single listing element
   */
  async extractListingData(element, selectors) {
    try {
      const data = {};

      // Extract basic fields
      data.id = this.domExtractor.extractText(element, selectors.id || '[data-id]', 'data-id');
      data.title = this.domExtractor.extractText(element, selectors.title || '.searchResultsTaglineText a');
      data.price = this.domExtractor.extractText(element, selectors.price || '.searchResultsPriceValue');
      data.location = this.domExtractor.extractText(element, selectors.location || '.searchResultsLocationValue');
      data.date = this.domExtractor.extractText(element, selectors.date || '.searchResultsDateValue');
      data.url = this.domExtractor.extractAttribute(element, selectors.link || '.searchResultsTaglineText a', 'href');

      // Extract images
      data.image = this.domExtractor.extractAttribute(element, selectors.image || '.searchResultsLargeThumbnail img', 'src');

      // Extract additional attributes if specified
      if (selectors.attributes) {
        data.attributes = {};
        for (const [key, selector] of Object.entries(selectors.attributes)) {
          data.attributes[key] = this.domExtractor.extractText(element, selector);
        }
      }

      // Clean and validate extracted data
      data.url = this.normalizeUrl(data.url);
      data.price = this.normalizePrice(data.price);

      return data;

    } catch (error) {
      logger.warn('Failed to extract listing data from element:', error);
      return null;
    }
  }

  /**
   * Extract detailed data from property detail page
   */
  async extractDetailData(config, url) {
    try {
      const selectors = config.selectors || {};
      const data = { url };

      // Extract basic information
      data.title = this.domExtractor.extractText(document, selectors.detailTitle || '.classifiedTitle');
      data.price = this.domExtractor.extractText(document, selectors.detailPrice || '.priceContainer');
      data.description = this.domExtractor.extractText(document, selectors.description || '.classifiedDescription');

      // Extract property details table
      const detailsTable = document.querySelector(selectors.detailsTable || '.classifiedInfoList');
      if (detailsTable) {
        data.details = this.domExtractor.extractTableData(detailsTable);
      }

      // Extract images
      const imageElements = document.querySelectorAll(selectors.images || '.classifiedImages img');
      data.images = Array.from(imageElements).map(img => img.src).filter(src => src);

      // Extract contact information (if available)
      data.contact = {
        phone: this.domExtractor.extractText(document, selectors.phone || '.phone-number'),
        name: this.domExtractor.extractText(document, selectors.contactName || '.contact-name')
      };

      return data;

    } catch (error) {
      logger.error('Failed to extract detail data:', error);
      throw error;
    }
  }

  /**
   * Navigate to next page in pagination
   */
  async goToNextPage(currentPage) {
    try {
      // Look for next page button
      const nextButton = document.querySelector('.paging a[title="Sonraki"]') || 
                        document.querySelector('.pagination .next:not(.disabled)') ||
                        document.querySelector('.paging a:contains("Sonraki")');

      if (!nextButton || nextButton.classList.contains('disabled')) {
        return false; // No next page available
      }

      // Simulate human-like clicking
      await this.humanSimulator.clickElement(nextButton);

      // Wait for page to load
      await this.waitForPageLoad();

      return true;

    } catch (error) {
      logger.warn('Failed to navigate to next page:', error.message);
      return false;
    }
  }

  /**
   * Wait for specific content to appear
   */
  async waitForContent(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for content: ${selector}`));
      }, timeout);

      const checkContent = () => {
        if (this.isCancelled) {
          clearTimeout(timeoutId);
          reject(new Error('Operation cancelled'));
          return;
        }

        const element = document.querySelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          resolve(element);
        } else {
          setTimeout(checkContent, 100);
        }
      };

      checkContent();
    });
  }

  /**
   * Wait for page to load after navigation
   */
  async waitForPageLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000); // Additional delay for dynamic content
      } else {
        const handler = () => {
          document.removeEventListener('readystatechange', handler);
          setTimeout(resolve, 1000);
        };
        document.addEventListener('readystatechange', handler);
      }
    });
  }

  /**
   * Navigate to URL with human simulation
   */
  async navigateToUrl(url) {
    if (window.location.href === url) {
      return; // Already on target page
    }

    // Human-like delay before navigation
    await this.humanSimulator.randomDelay(500, 1500);

    window.location.href = url;
    await this.waitForPageLoad();
  }

  /**
   * Normalize URL (make absolute)
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
   * Normalize price string
   */
  normalizePrice(priceText) {
    if (!priceText) return null;
    
    // Remove non-numeric characters except for decimal points
    const cleaned = priceText.replace(/[^\d.,]/g, '');
    
    // Convert to number
    const price = parseFloat(cleaned.replace(',', '.'));
    
    return isNaN(price) ? null : price;
  }

  /**
   * Extract current state for monitoring
   */
  async extractCurrentState(config) {
    try {
      // Extract key elements that might change
      const state = {
        title: document.title,
        url: window.location.href,
        lastModified: document.lastModified,
        content: {}
      };

      // Extract specified content areas
      if (config.monitorSelectors) {
        for (const [key, selector] of Object.entries(config.monitorSelectors)) {
          state.content[key] = this.domExtractor.extractText(document, selector);
        }
      }

      return state;

    } catch (error) {
      logger.error('Failed to extract current state:', error);
      throw error;
    }
  }

  /**
   * Cancel current operation
   */
  cancel() {
    this.isCancelled = true;
    logger.info('Job execution cancelled');
  }

  /**
   * Reset executor state
   */
  reset() {
    this.isCancelled = false;
    this.errors = [];
    this.currentStep = null;
  }

  /**
   * Add error to collection
   */
  addError(message) {
    this.errors.push({
      message,
      step: this.currentStep,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get collected errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Get current execution status
   */
  getStatus() {
    return {
      isExecuting: !this.isCancelled && this.currentStep !== null,
      currentStep: this.currentStep,
      errors: this.errors.length
    };
  }
}