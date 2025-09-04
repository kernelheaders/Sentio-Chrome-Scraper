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
          if (job.config?.followDetails) {
            return await this.scrapeDetailsFromListing(job);
          }
          return await this.scrapeListings(job);
          
        case 'scrape_details':
          // If direct URLs are not provided, derive from a listing page URL
          if (!job.config?.urls || job.config.urls.length === 0) {
            return await this.scrapeDetailsFromListing(job);
          }
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
   * Warmup on homepage and then collect detail links from listing page, visit each and extract
   */
  async scrapeDetailsFromListing(job) {
    const config = job.config || {};
    const maxItems = config.maxItems || 10;
    const results = [];
    const listingUrl = config.url;
    if (await this.isGloballyBlocked()) return results;

    // Optional warmup without bouncing away: do human actions on current page
    if (config.humanize?.warmup) {
      try {
        await this.humanSimulator.randomDelay(800, 1500);
        if (config.humanize?.randomScroll) {
          await this.humanSimulator.scrollPage('down');
          await this.humanSimulator.scrollPage('up');
        }
      } catch (_) {}
    }

    // Ensure we are on listing page
    if (await this.isGloballyBlocked()) return results;
    if (window.location.href !== config.url) {
      await this.navigateToUrl(config.url);
      await this.waitForPageReady();
    }

    // Wait for listing container to appear
    const listingContainerSel = config.selectors?.listingContainer || '.searchResultsItem';
    try { await this.waitForContent(listingContainerSel, 15000); } catch (_) {}

    // Human-like scroll on listing page (randomized)
    await this.randomListingScroll(config);

    // Collect detail links with multiple fallbacks
    const urls = [];
    const candidateSelectors = [
      config.selectors?.listing,
      config.selectors?.link,
      '.searchResultsTaglineText a',
      'a.searchResultsLargeThumbnail',
      'a[href*="/ilan/"]'
    ].filter(Boolean);

    for (const sel of candidateSelectors) {
      try {
        const nodes = document.querySelectorAll(sel);
        for (const a of nodes) {
          const href = a.getAttribute('href');
          if (!href) continue;
          let url = href.startsWith('http') ? href : (href.startsWith('/') ? 'https://www.sahibinden.com' + href : 'https://www.sahibinden.com/' + href);
          if (!urls.includes(url)) urls.push(url);
          if (urls.length >= maxItems * 2) break;
        }
        if (urls.length >= maxItems) break;
      } catch (_) {}
    }

    // Fallback: use existing listing extraction to get URLs
    if (urls.length === 0) {
      try {
        const pageResults = await this.extractListingsFromPage(config);
        for (const item of pageResults) {
          if (item?.url) {
            const url = this.normalizeUrl(item.url);
            if (url && !urls.includes(url)) urls.push(url);
            if (urls.length >= maxItems) break;
          }
        }
      } catch (_) {}
    }

    logger.debug(`Collected ${urls.length} detail link(s) from listing page`);

    // Pagination: fetch more links if needed
    let currentPage = 1;
    while (urls.length < maxItems) {
      if (await this.isGloballyBlocked()) break;
      const hasNext = await this.goToNextPage(currentPage);
      if (!hasNext) break;
      currentPage++;
      try { await this.waitForPageReady(); } catch (_) {}
      await this.randomListingScroll(config);
      // collect more
      const more = await this.collectDetailLinks(config);
      for (const u of more) {
        if (!urls.includes(u)) urls.push(u);
        if (urls.length >= maxItems) break;
      }
    }

    if (urls.length === 0) {
      this.addError('No listing links found on page');
      return results;
    }

    // Visit details up to maxItems
    for (const url of urls.slice(0, maxItems)) {
      if (this.isCancelled) break;
      try {
        if (await this.isGloballyBlocked()) break;
        await this.navigateToUrl(url);
        await this.waitForContent(config.selectors?.detailContainer || '.classifiedDetail', 15000);
        const detail = await this.extractDetailData(config, url);
        if (detail) results.push(detail);
        if (config.humanize?.randomScroll) {
          await this.humanSimulator.scrollPage('down');
        }
        await this.humanSimulator.randomDelay(800, 1400);

        // Return to listing for next link (prefer history.back for human-like flow)
        await this.goBackToListing(listingUrl, config);
        await this.humanSimulator.randomDelay(600, 1200);
      } catch (e) {
        this.addError(`Detail scraping failed for ${url}: ${e.message}`);
        await this.humanSimulator.randomDelay(400, 900);
        continue;
      }
    }

    return results;
  }

  /**
   * Collect detail links from the current listing page
   */
  async collectDetailLinks(config) {
    try {
      // Ensure listing container is present (best-effort)
      try { await this.waitForContent(config.selectors?.listingContainer || '.searchResultsItem', 15000); }
      catch { await this.waitForContent('a[href*="/ilan/"]', 15000); }

      const urls = [];
      const candidateSelectors = [
        config.selectors?.listing,
        config.selectors?.link,
        '.searchResultsTaglineText a',
        'a.searchResultsLargeThumbnail',
        'a[href*="/ilan/"]'
      ].filter(Boolean);

      const tryCollect = () => {
        for (const sel of candidateSelectors) {
          try {
            const nodes = document.querySelectorAll(sel);
            logger.debug(`[executor.collect] selector=${sel} count=${nodes.length}`);
            for (const a of nodes) {
              const href = a.getAttribute('href');
              if (!href) continue;
              let url = href.startsWith('http') ? href : (href.startsWith('/') ? 'https://www.sahibinden.com' + href : 'https://www.sahibinden.com/' + href);
              if (!urls.includes(url)) urls.push(url);
            }
          } catch (_) {}
        }
      };
      for (let i = 0; i < 3 && urls.length === 0; i++) {
        tryCollect();
        if (urls.length > 0) break;
        try { await this.humanSimulator.wheelScrollPage(400 + Math.random()*600); } catch (_) {}
        try { await this.humanSimulator.randomDelay(300, 800); } catch (_) {}
      }

      if (urls.length === 0) {
        logger.debug('[executor.collect] fallback to extractListingsFromPage');
        // Fallback: use listing extraction to derive URLs
        try {
          const pageResults = await this.extractListingsFromPage(config);
          for (const item of pageResults) {
            if (item?.url) {
              const u = this.normalizeUrl(item.url);
              if (u && !urls.includes(u)) urls.push(u);
            }
          }
        } catch (_) {}
      }

      logger.debug(`Collected ${urls.length} detail link(s) from listing page`);
      return urls;
    } catch (e) {
      logger.debug('Failed to collect detail links: ' + (e?.message || e));
      return [];
    }
  }

  async randomListingScroll(config) {
    try {
      const chance = config.humanize?.randomScrollChance ?? 0.8;
      if (!config.humanize?.randomScroll || Math.random() > chance) return;
      const patterns = [
        async () => { await this.humanSimulator.scrollPage('down'); },
        async () => { await this.humanSimulator.scrollPage('down'); await this.humanSimulator.randomDelay(200,600); await this.humanSimulator.scrollPage('up'); },
        async () => { await this.humanSimulator.randomDelay(200,700); await this.humanSimulator.scrollPage('down'); await this.humanSimulator.scrollPage('down'); },
      ];
      const pick = Math.floor(Math.random()*patterns.length);
      await patterns[pick]();

      // Occasionally click an address breadcrumb link
      const addrChance = config.humanize?.addressClickChance ?? 0.15;
      if (Math.random() < addrChance) {
        try {
          const bc = Array.from(document.querySelectorAll('a[data-click-label*="Adres Breadcrumb"]'));
          if (bc.length) {
            const i = Math.floor(Math.random()*bc.length);
            await this.humanSimulator.clickElement(bc[i]);
            await this.humanSimulator.randomDelay(400,900);
            window.history.back();
            await this.humanSimulator.randomDelay(400,900);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  /**
   * Navigate back to listing page after a detail visit.
   * Try history.back(), fall back to direct navigation if needed.
   */
  async goBackToListing(listingUrl, config) {
    try {
      // Try browser back
      window.history.back();
      // Wait for listing container to re-appear
      const listingContainerSel = config.selectors?.listingContainer || '.searchResultsItem';
      try {
        await this.waitForContent(listingContainerSel, 8000);
        return;
      } catch (_) {
        // Fall through to direct navigation
      }
    } catch (_) { /* ignore */ }

    // Fallback: direct navigation to listing URL
    try {
      await this.navigateToUrl(listingUrl);
      await this.waitForContent(config.selectors?.listingContainer || '.searchResultsItem', 12000);
    } catch (_) { /* ignore */ }
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
      // Title: prefer classifiedDetailTitle, fallback classifiedTitle, then og:title
      data.title = this.domExtractor.extractText(document, selectors.detailTitle || '.classifiedDetailTitle, .classifiedTitle');
      if (!data.title) {
        try {
          const og = document.querySelector('meta[property="og:title"]');
          data.title = og?.getAttribute('content') || '';
        } catch (_) {}
      }

      // Price: prefer classified-price-wrapper, fallback priceContainer
      const rawPrice = this.domExtractor.extractText(document, selectors.detailPrice || '.classified-price-wrapper, .priceContainer');
      data.price = this.parsePrice(rawPrice);
      data.description = this.domExtractor.extractText(document, selectors.description || '.classifiedDescription');

      // Extract property details table
      const detailsTable = document.querySelector(selectors.detailsTable || '.classifiedInfoList');
      if (detailsTable) {
        data.details = this.domExtractor.extractTableData(detailsTable);
      }

      // Extract images
      const imageElements = document.querySelectorAll(selectors.images || '.classifiedImages img');
      data.images = Array.from(imageElements).map(img => img.src).filter(src => src);

      // Try to reveal phone if hidden behind a button
      await this.tryRevealPhone(selectors);

      // Extract phone - robust strategies
      let phoneText = this.domExtractor.extractText(document, selectors.phone || '#phoneInfoPart .pretty-phone-part [data-content], .phone-number, [class*="phone"], [id*="phone"]');
      // If pretty-phone-part used, prefer its data-content
      try {
        const pretty = document.querySelector('#phoneInfoPart .pretty-phone-part [data-content]');
        if (pretty) phoneText = pretty.getAttribute('data-content') || phoneText;
      } catch (_) {}
      if (!phoneText || phoneText.replace(/\D/g,'').length < 10) {
        // Fallback: parse style blocks for content: '0 (5xx) ...'
        try {
          const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
          const re = /content:\s*'([^']+)'/g; let m;
          while ((m = re.exec(styles)) !== null) {
            const v = m[1];
            if (/(\+90|0)?\s*\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/.test(v)) { phoneText = v; break; }
          }
        } catch (_) {}
      }

      // Extract name - try explicit selectors, else ::before content from style
      let nameText = this.domExtractor.extractText(document, selectors.contactName || '.contact-name, .user-about, .username');
      if (!nameText) {
        try {
          // Find a span inside favorite seller dialogs or user box with ::before
          const nameSpan = document.querySelector('.classifiedUserBox span[class^="css"], #favoriteSellerRemoveDialog span[class^="css"]');
          if (nameSpan) {
            const content = window.getComputedStyle(nameSpan, '::before').getPropertyValue('content');
            if (content && content !== 'none') nameText = content.replace(/^"|"$/g,'').trim();
          } else {
            // Fallback: parse style blocks for a plausible name value
            const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
            const re = /content:\s*'([^']+)'/g; let m;
            while ((m = re.exec(styles)) !== null) {
              const v = m[1];
              if (/[A-Za-zÇĞİÖŞÜçğıöşü\.\-\s]{2,}/.test(v) && v.length <= 64 && !/(\+?\d|TL|TRY)/.test(v)) { nameText = v; break; }
            }
          }
        } catch (_) {}
      }
      data.contact = { phone: phoneText || '', name: nameText || '' };

      // Require phone? skip item if missing
      if ((config.requirePhone ?? false) && (!phoneText || phoneText.replace(/\D/g,'').length < 10)) {
        return null;
      }

      // Address from breadcrumb h2 links (İl / İlçe / Mahalle)
      let addr = '';
      try {
        const bcLinks = document.querySelectorAll('a[data-click-label*="Adres Breadcrumb"]');
        if (bcLinks && bcLinks.length) {
          addr = Array.from(bcLinks).map(a => (a.textContent || '').trim()).filter(Boolean).join(' / ');
        }
      } catch (_) {}
      if (!addr) {
        // Fallback to existing heuristics
        addr = this.domExtractor.extractText(document, selectors.address || '.classifiedInfo , .address , .classifiedDetail [class*="address"]');
      }
      if (addr) { data.address = addr; data.location = addr; }

      // From (Kimden) explicit parse
      data.from = this.extractFromField();

      // Date: parse "İlan Tarihi <date>" to ISO
      const rawDate = this.extractLabeledValue(/İlan\s*Tarihi/i);
      data.date = this.parseTurkishDate(rawDate);

      return data;

    } catch (error) {
      logger.error('Failed to extract detail data:', error);
      throw error;
    }
  }

  extractFromField() {
    try {
      // Try explicit "Kimden" label
      const val = this.extractLabeledValue(/Kimden/i);
      if (val) {
        if (/Sahibinden/i.test(val)) return 'Owner';
        if (/Emlak/i.test(val) || /Ofisinden/i.test(val) || /Kurum/i.test(val)) return 'Agency';
        return val.trim();
      }
      // Fallback: owner/agency markers
      const agency = document.querySelector('.storeTitle, .store-info, [class*="store"]');
      const ownerMarks = document.querySelectorAll('.for-classified-owner, .fromOwner');
      return agency ? 'Agency' : (ownerMarks.length ? 'Owner' : 'Owner');
    } catch { return 'Owner'; }
  }

  extractLabeledValue(labelRegex) {
    try {
      const items = document.querySelectorAll('.classifiedInfoList li, .classifiedInfo li, li');
      for (const li of items) {
        const strong = li.querySelector('strong');
        const label = (strong?.textContent || '').trim();
        if (labelRegex.test(label)) {
          // Value may be in span or text after strong
          const span = li.querySelector('span');
          const txt = (span?.textContent || li.textContent || '').replace(label, '').trim();
          if (txt) return txt;
        }
      }
      return '';
    } catch { return ''; }
  }

  parsePrice(text) {
    if (!text) return null;
    const digits = String(text).replace(/[^\d]/g, '');
    if (!digits) return null;
    return Number(digits);
  }

  parseTurkishDate(text) {
    if (!text) return '';
    const months = {
      'ocak': '01','şubat': '02','subat': '02','mart': '03','nisan': '04','mayıs': '05','mayis': '05',
      'haziran': '06','temmuz': '07','ağustos': '08','agustos': '08','eylül': '09','eylul': '09',
      'ekim': '10','kasım': '11','kasim': '11','aralık': '12','aralik': '12'
    };
    try {
      const clean = text.toLowerCase().replace('ilan tarihi', '').trim();
      const m = clean.match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/i);
      if (m) {
        const d = m[1].padStart(2,'0');
        const mon = months[m[2]] || months[m[2].normalize('NFD').replace(/\p{Diacritic}/gu,'')] || '01';
        const y = m[3];
        return `${y}-${mon}-${d}`;
      }
    } catch {}
    return '';
  }

  /**
   * Try to reveal phone number if hidden behind a toggle/button
   */
  async tryRevealPhone(selectors) {
    try {
      const textMatches = (el) => /telefon|ara|gsm/i.test(el.textContent || '');
      const isExternal = (el) => {
        const href = el.getAttribute && el.getAttribute('href');
        if (!href) return false;
        try {
          const u = new URL(href, window.location.origin);
          return u.hostname !== window.location.hostname || /facebook|twitter|linkedin|share/i.test(u.href);
        } catch { return /facebook|twitter|linkedin|share/i.test(href); }
      };

      const candidateSelectors = [
        selectors.phoneReveal,
        'button',
        '[role="button"]',
        '[class*="phone"]',
        '.phone-number'
      ].filter(Boolean);

      for (const sel of candidateSelectors) {
        const nodes = Array.from(document.querySelectorAll(sel));
        for (const el of nodes) {
          if (isExternal(el)) continue;
          if (el.tagName === 'A') continue; // avoid anchors for safety
          if (!textMatches(el) && !/phone/i.test(el.getAttribute('class') || '')) continue;
          await this.humanSimulator.clickElement(el);
          await this.humanSimulator.randomDelay(400, 900);
          return;
        }
      }
    } catch (_) {}
  }

  /**
   * Navigate to next page in pagination
   */
  async goToNextPage(currentPage) {
    if (await this.isGloballyBlocked()) return false;
    try {
      // Look for next page control using robust heuristics
      let nextButton = document.querySelector('a[rel="next"]');
      if (!nextButton) {
        nextButton = document.querySelector('.pagination .next:not(.disabled) a, .pagination a.next, .paging a[title="Sonraki"]');
      }
      if (!nextButton) {
        // Fallback: scan anchors inside common containers and match by text
        const containers = document.querySelectorAll('.paging, .pagination');
        const texts = ['sonraki', 'next', 'ileri', '›', '»'];
        for (const c of containers) {
          const anchors = c.querySelectorAll('a');
          for (const a of anchors) {
            const t = (a.textContent || '').trim().toLowerCase();
            if (!t) continue;
            if (texts.some(x => t.includes(x))) { nextButton = a; break; }
          }
          if (nextButton) break;
        }
      }

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
   * Wait until page is fully ready (document complete + small buffer)
   */
  async waitForPageReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Page ready timeout')), 30000);
      const check = () => {
        if (document.readyState === 'complete') {
          clearTimeout(timeout);
          setTimeout(resolve, 1000);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  async isGloballyBlocked() {
    try {
      const key = 'blocked_until';
      const val = await new Promise(resolve => chrome.storage.local.get([key], r => resolve(r[key] || 0)));
      return val && Date.now() < val;
    } catch { return false; }
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
    try {
      if (await this.isGloballyBlocked()) return;
    } catch (_) {}
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
