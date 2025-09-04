/**
 * Main content script for Sentio Chrome Extension
 * Handles job execution and DOM manipulation on Sahibinden.com
 */
import { logger } from '../utils/logger.js';
import { JobExecutor } from './job-executor.js';
import { HumanSimulator } from './human-simulator.js';
import { AntiDetection } from './anti-detection.js';
import { MessageTypes, JobStatus, CONFIG } from '../shared/types.js';
import { secureStorage } from '../utils/storage.js';

class SentioContentScript {
  constructor() {
    this.jobExecutor = new JobExecutor();
    this.humanSimulator = new HumanSimulator();
    this.antiDetection = new AntiDetection();
    this.currentJob = null;
    this.isExecuting = false;
    this.startTime = Date.now();
    this.isUnloading = false;
    this.navigationInProgress = false;
    
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
      // HUD will be created lazily only when a job starts or resumes

      // Signal that content script is ready
      this.sendMessage(MessageTypes.HEALTH_RESPONSE, {
        ready: true,
        url: window.location.href,
        timestamp: Date.now()
      });

      // Global/DOM block signals early — no HUD splash while idle
      try {
        const blocked = await this.isGloballyBlocked();
        if (blocked || this.isLikelyBlockedPage()) {
          this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: blocked ? 'Global block' : 'DOM block', url: window.location.href });
          try { await this.clearDetailProgress(); } catch (_) {}
          return;
        }
      } catch (_) {}

      // Try to resume detail workflow if in progress
      await this.resumeDetailWorkflowIfAny();

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

      // Honor global block
      try {
        const blocked = await this.isGloballyBlocked();
        if (blocked || this.isLikelyBlockedPage()) {
          this.updateHud({ status: 'Paused (429)', progress: 0, total: 0 });
          this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: blocked ? 'Global block' : 'DOM block', url: window.location.href });
          return;
        }
      } catch (_) {}

      // Set execution state
      this.isExecuting = true;
      this.currentJob = job;

      // Notify service worker that job started
      this.sendMessage(MessageTypes.JOB_STARTED, {
        jobId: job.id,
        timestamp: Date.now(),
        url: window.location.href
      });

      // Ensure HUD is visible for job progress
      this.initHud();

      // For detail workflows, orchestrate across navigations
      if (job.type === 'scrape_details' || job.config?.followDetails) {
        this.updateHud({ status: 'Starting…' });
        await this.startDetailWorkflow(job);
      } else {
        // Execute the job (single-page type)
        const result = await this.executeJob(job);
        try { await secureStorage.setLastResult(result); } catch (_) {}
        this.sendMessage(MessageTypes.JOB_COMPLETED, result);
        logger.logJobEvent(job.id, 'execution completed successfully');
        this.updateHud({ status: 'Completed', progress: 1, total: 1 });
        this.hideHudSoon();
      }

    } catch (error) {
      const benign = this.isUnloading || this.navigationInProgress || /Extension context invalidated|message port closed/i.test(error?.message || '');
      if (benign) {
        logger.debug('Transient execution error during navigation, suppressed: ' + (error?.message || error));
      } else {
        logger.error('Job execution failed:', error);
        // Notify service worker of failure
        this.sendMessage(MessageTypes.JOB_FAILED, {
          jobId: this.currentJob?.id,
          error: error.message,
          timestamp: Date.now()
        });
      }

    } finally {
      // Reset execution state
      this.isExecuting = false;
      this.currentJob = null;
    }
  }

  /**
   * Start detail workflow: collect links on listing page and navigate to first detail
   */
  async startDetailWorkflow(job) {
    const config = job.config || {};
    // Lazily ensure HUD exists
    this.initHud();
    // Prefer direct URLs if provided, else collect from listing page
    let urls = [];
    try {
      if (Array.isArray(config.urls) && config.urls.length > 0) {
        urls = config.urls.map(u => this.jobExecutor.normalizeUrl(u)).filter(Boolean);
      } else {
        urls = await this.collectDetailLinks(config);
      }
    } catch (_) { urls = await this.collectDetailLinks(config); }
    const maxItems = config.maxItems || 10;
    const slice = urls.slice(0, maxItems);
    const progress = {
      jobId: job.id,
      token: job.token,
      listingUrl: config.url,
      urls: slice,
      index: 0,
      results: [],
      selectors: config.selectors || {},
      // Default: require phone unless explicitly set false
      requirePhone: config.requirePhone === false ? false : true,
      // Merge humanize with sane defaults if missing
      humanize: this.withHumanizeDefaults(config.humanize || {}),
      timestamp: Date.now(),
      maxItems
    };
    await this.persistDetailProgress(progress);
    this.updateHud({ status: 'Processing', progress: 0, total: slice.length });
    if (slice.length > 0) {
      await this.navigateToUrl(slice[0]);
    } else {
      // Nothing to do
      const result = this.buildResult(job, []);
      try { await secureStorage.setLastResult(result); } catch (_) {}
      this.sendMessage(MessageTypes.JOB_COMPLETED, result);
    }
  }

  async resumeDetailWorkflowIfAny() {
    try {
      const progress = await this.loadDetailProgress();
      if (!progress || !progress.urls || progress.urls.length === 0) return;
      // Ensure HUD exists when resuming
      this.initHud();

      // Stop if blocked
      try {
        const blocked = await this.isGloballyBlocked();
        if (blocked || this.isLikelyBlockedPage()) {
          this.updateHud({ status: 'Paused (429)', progress: 0, total: 0 });
          this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: blocked ? 'Global block' : 'DOM block', url: window.location.href });
          await this.clearDetailProgress();
          return;
        }
      } catch (_) {}

      // Ensure defaults in case of legacy progress
      progress.humanize = this.withHumanizeDefaults(progress.humanize || {});
      if (typeof progress.requirePhone === 'undefined') progress.requirePhone = true;
      await this.persistDetailProgress(progress);

      const { jobId, token, urls, index, listingUrl, selectors, results, maxItems } = progress;
      // Update HUD to reflect current state immediately
      try { this.updateHud({ status: 'Processing', progress: index, total: urls.length }); } catch (_) {}
      // Finished? finalize
      if (index >= urls.length) {
        const finalResult = this.buildResult({ id: jobId, token }, results);
        try { await secureStorage.setLastResult(finalResult); } catch (_) {}
        this.sendMessage(MessageTypes.JOB_COMPLETED, finalResult);
        await this.clearDetailProgress();
        return;
      }

      const currentTarget = urls[index];
      const here = window.location.href;

      // Helper comparators tolerate query/canonicalization by comparing /ilan/* id
      const isSameDetail = (a, b) => {
        try {
          const ra = new URL(a, 'https://www.sahibinden.com');
          const rb = new URL(b, 'https://www.sahibinden.com');
          const idA = (ra.pathname.match(/(\d{6,})/) || [])[1];
          const idB = (rb.pathname.match(/(\d{6,})/) || [])[1];
          return idA && idB ? idA === idB : ra.pathname === rb.pathname;
        } catch { return a === b; }
      };

      if (isSameDetail(here, currentTarget)) {
        // On expected detail: human pause + extract
        if (this.isLikelyBlockedPage()) {
          this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: 'Blocked on detail', url: here });
          logger.warn('BLOCK DETECTED on detail page; pausing flow');
          return;
        }
        try { await this.waitForPageReady(); } catch (_) {}
        try { await this.waitForContent(selectors?.detailContainer || '.classifiedDetail, .classifiedTitle', 15000); } catch (_) {}
        // Human-like behavior on detail (wheel scroll + dwell time)
        try {
          const hc = progress.humanize || {};
          const minNav = hc.minNavDelay ?? 1000, maxNav = hc.maxNavDelay ?? 3000;
          await this.humanSimulator.randomDelay(minNav, maxNav);
          await this.humanSimulator.wheelScrollPage();
          const dwell = this.computeDwellMs(hc);
          await this.humanSimulator.randomDelay(dwell * 0.6, dwell);
        } catch (_) {}

        // Quick-skip chance
        const qs = (progress.humanize?.quickSkipChance ?? 0.12);
        let detail = null;
        if (Math.random() < qs) {
          // Skip extracting; appear as if user didn't like it
          detail = null;
        } else {
          detail = await this.jobExecutor.extractDetailData({ selectors, requirePhone: !!progress.requirePhone }, here);
        }
        if (detail) results.push(detail);

        // Persist progress before navigating away
        const nextIndex = index + 1;
        await this.persistDetailProgress({ ...progress, results, index: nextIndex });
        this.updateHud({ status: 'Processing', progress: nextIndex, total: urls.length });

        // Always return to listing, then perform progressive scroll based on index, then go next
        const nextUrl = urls[nextIndex];
        if (nextUrl) {
          await this.goBackToListing(listingUrl, selectors);
          try {
            const itemsOnPage = document.querySelectorAll(selectors?.listingContainer || '.searchResultsItem').length || 20;
            await this.progressiveListingScroll(nextIndex, itemsOnPage, progress.humanize || {});
          } catch (_) {}
          await this.humanSimulator.randomDelay(500, 1200);
          await this.navigateToUrl(nextUrl);
        } else {
          const finalResult = this.buildResult({ id: jobId, token }, results);
          try { await secureStorage.setLastResult(finalResult); } catch (_) {}
          this.sendMessage(MessageTypes.JOB_COMPLETED, finalResult);
          await this.clearDetailProgress();
          this.updateHud({ status: 'Completed', progress: urls.length, total: urls.length });
          this.hideHudSoon();
        }
        return;
      }

      // If on listing page and not done, go to current target
      if (here.startsWith(listingUrl) && currentTarget) {
        if (this.isLikelyBlockedPage()) {
          this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: 'Blocked on listing', url: here });
          logger.warn('BLOCK DETECTED on listing page; pausing flow');
          return;
        }
        await this.humanSimulator.randomDelay(400, 900);
        await this.navigateToUrl(currentTarget);
        return;
      }

      // If we're on an unexpected page, steer back to listing
      if (this.isLikelyBlockedPage()) {
        this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: 'Blocked: unexpected page', url: here });
        logger.warn('BLOCK DETECTED (unexpected page); pausing');
        return;
      }
      await this.navigateToUrl(listingUrl);
      return;
    } catch (_) {}
  }

  // Lightweight HUD (progress + status)
  initHud() {
    try {
      if (document.getElementById('sentio-hud')) return;
      const hud = document.createElement('div');
      hud.id = 'sentio-hud';
      hud.innerHTML = `
        <div class="sentio-hud-inner">
          <div class="sentio-hud-title">Sentio</div>
          <div class="sentio-hud-status" id="sentio-hud-status">Idle</div>
          <div class="sentio-hud-bar"><div class="sentio-hud-fill" id="sentio-hud-fill" style="width:0%"></div></div>
          <div class="sentio-hud-count" id="sentio-hud-count">0 / 0</div>
        </div>`;
      const style = document.createElement('style');
      style.textContent = `
        #sentio-hud{position:fixed;bottom:16px;right:16px;z-index:2147483647;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
        .sentio-hud-inner{backdrop-filter:saturate(180%) blur(8px);background:rgba(17,24,39,0.75);color:#fff;border-radius:12px;padding:12px 14px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.2)}
        .sentio-hud-title{font-weight:600;font-size:12px;opacity:.9;margin-bottom:4px}
        .sentio-hud-status{font-size:12px;margin-bottom:6px;opacity:.9}
        .sentio-hud-bar{width:100%;height:6px;background:rgba(255,255,255,.15);border-radius:999px;overflow:hidden;margin-bottom:6px}
        .sentio-hud-fill{height:100%;background:linear-gradient(90deg,#22c55e,#3b82f6);width:0%;transition:width .3s ease}
        .sentio-hud-count{font-size:11px;opacity:.8;text-align:right}
      `;
      document.documentElement.appendChild(style);
      document.documentElement.appendChild(hud);
    } catch (_) {}
  }
  updateHud({ status, progress, total }) {
    try {
      const s = document.getElementById('sentio-hud-status');
      const f = document.getElementById('sentio-hud-fill');
      const c = document.getElementById('sentio-hud-count');
      if (s && status) s.textContent = status;
      if (f && typeof progress === 'number' && typeof total === 'number' && total > 0) {
        const pct = Math.max(0, Math.min(100, Math.round((progress/total)*100)));
        f.style.width = pct + '%';
      }
      if (c && typeof progress === 'number' && typeof total === 'number') {
        c.textContent = `${Math.min(progress,total)} / ${total}`;
      }
    } catch (_) {}
  }
  hideHudSoon() {
    try { setTimeout(()=>{ const h=document.getElementById('sentio-hud'); h&&h.remove(); }, 3000); } catch(_){}
  }

  // Progressive listing scroll depending on item index within page
  async progressiveListingScroll(itemIndex, itemsOnPage, humanize) {
    try {
      const perPage = itemsOnPage || 20;
      const idx = itemIndex % perPage; // 0-based index within current page
      const before = window.pageYOffset || 0;
      // Buckets: 0-4 minimal/no scroll; 5-9 partial; 10-14 deeper; 15+ near bottom
      if (idx <= 4) {
        if (Math.random() < 0.3) {
          await this.humanSimulator.wheelScrollPage(250 + Math.random()*250);
        }
      } else if (idx <= 9) {
        await this.humanSimulator.wheelScrollPage(600 + Math.random()*400);
      } else if (idx <= 14) {
        await this.humanSimulator.wheelScrollPage(900 + Math.random()*600);
      } else {
        await this.humanSimulator.wheelScrollPage(1400 + Math.random()*800);
      }
      const after = window.pageYOffset || 0;
      if (after - before < 50) {
        await this.humanSimulator.scrollPage('down', 500 + Math.random()*600);
      }
    } catch (_) {}
  }

  // Basic DOM-based block page detection
  isLikelyBlockedPage() {
    try {
      const txt = document.body?.innerText?.toLowerCase() || '';
      const signals = [
        'too many requests', '429', 'çok fazla istek', 'istek limit', 'erişim engellendi',
        'geçici olarak', 'temporarily blocked', 'try again later', 'bot', 'robot', 'doğrulayın',
        'olağan dışı erişim', 'olagan disi erisim', 'talebinizi gerçekleştiremiyoruz', 'tekrar deneyebilirsiniz',
        'iki aşamalı doğrulama', 'iki asamali', 'doğrulama kodu', 'verification code'
      ];
      return signals.some(s => txt.includes(s));
    } catch { return false; }
  }

  // Global blocked flag from storage
  async isGloballyBlocked() {
    try {
      const key = CONFIG.STORAGE_KEYS.BLOCKED_UNTIL;
      const until = await new Promise((resolve) => chrome.storage.local.get([key], (r) => resolve(r[key] || 0)));
      return until && Date.now() < until;
    } catch (_) { return false; }
  }

  async goBackToListing(listingUrl, selectors) {
    try {
      window.history.back();
      const listingContainerSel = selectors?.listingContainer || '.searchResultsItem';
      try { await this.waitForContent(listingContainerSel, 8000); return; } catch (_) {}
    } catch (_) {}
    try {
      // Avoid direct navigation if globally blocked
      try { if (await this.isGloballyBlocked()) return; } catch (_) {}
      await this.navigateToUrl(listingUrl);
      const listingContainerSel = selectors?.listingContainer || '.searchResultsItem';
      try { await this.waitForContent(listingContainerSel, 12000); } catch (_) {}
    } catch (_) {}
  }

  async collectDetailLinks(config) {
    try {
      // Ensure listing content present
      try { await this.waitForContent(config.selectors?.listingContainer || '.searchResultsItem', 15000); } catch (_) {}
      const urls = [];
      const sels = [
        config.selectors?.listing,
        config.selectors?.link,
        '.searchResultsTaglineText a',
        'a.searchResultsLargeThumbnail',
        'a[href*="/ilan/"]'
      ].filter(Boolean);
      for (const sel of sels) {
        try {
          const nodes = document.querySelectorAll(sel);
          for (const a of nodes) {
            const href = a.getAttribute('href');
            if (!href) continue;
            let url = href.startsWith('http') ? href : (href.startsWith('/') ? 'https://www.sahibinden.com' + href : 'https://www.sahibinden.com/' + href);
            if (!urls.includes(url)) urls.push(url);
          }
          if (urls.length) break;
        } catch (_) {}
      }
      if (urls.length === 0) {
        // Fallback: use existing listing extraction
        const pageResults = await this.jobExecutor.extractListingsFromPage(config);
        for (const item of pageResults) {
          if (item?.url) {
            const url = this.jobExecutor.normalizeUrl(item.url);
            if (url && !urls.includes(url)) urls.push(url);
          }
        }
      }
      logger.debug(`Collected ${urls.length} detail link(s) from listing page`);
      return urls;
    } catch (e) {
      logger.debug('Failed to collect detail links: ' + (e?.message || e));
      return [];
    }
  }

  async persistDetailProgress(progress) {
    try {
      const obj = {}; obj[CONFIG.STORAGE_KEYS.DETAIL_PROGRESS] = progress;
      await new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));
    } catch (_) {}
  }
  async loadDetailProgress() {
    try {
      const key = CONFIG.STORAGE_KEYS.DETAIL_PROGRESS;
      return await new Promise((resolve) => chrome.storage.local.get([key], (r) => resolve(r[key] || null)));
    } catch (_) { return null; }
  }
  async clearDetailProgress() {
    try {
      await new Promise((resolve) => chrome.storage.local.remove([CONFIG.STORAGE_KEYS.DETAIL_PROGRESS], () => resolve()));
    } catch (_) {}
  }

  buildResult(job, data) {
    return {
      jobId: job.id,
      token: job.token,
      status: JobStatus.COMPLETED,
      data,
      metadata: {
        itemsExtracted: data.length,
        executionTime: 0,
        errors: this.jobExecutor.getErrors(),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    };
  }

  withHumanizeDefaults(h) {
    return {
      warmup: h.warmup !== undefined ? h.warmup : true,
      randomScroll: h.randomScroll !== undefined ? h.randomScroll : true,
      randomScrollChance: h.randomScrollChance ?? 0.85,
      addressClickChance: h.addressClickChance ?? 0.15,
      newTabChance: h.newTabChance ?? 0.0,
      quickSkipChance: h.quickSkipChance ?? 0.12,
      readingSpeedWpm: h.readingSpeedWpm ?? 220,
      minNavDelay: h.minNavDelay ?? 1000,
      maxNavDelay: h.maxNavDelay ?? 3000,
      minPageDwell: h.minPageDwell ?? 12000,
      maxPageDwell: h.maxPageDwell ?? 25000,
      breakAfterN: h.breakAfterN ?? 6,
      shortBreakMin: h.shortBreakMin ?? 30000,
      shortBreakMax: h.shortBreakMax ?? 90000,
      longBreakAfter: h.longBreakAfter ?? 13,
      longBreakMin: h.longBreakMin ?? 180000,
      longBreakMax: h.longBreakMax ?? 420000
    };
  }

  computeDwellMs(hc) {
    const wpm = hc.readingSpeedWpm ?? 220;
    const minD = hc.minPageDwell ?? 12000;
    const maxD = hc.maxPageDwell ?? 25000;
    try {
      const text = [
        document.querySelector('.classifiedDescription')?.textContent || '',
        document.querySelector('.classifiedInfoList')?.textContent || ''
      ].join(' ');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const est = Math.max(1000, Math.round((words / wpm) * 60000));
      return Math.min(maxD, Math.max(minD, est));
    } catch { return Math.floor((minD + maxD) / 2); }
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
      
      // Clear detail progress if any (avoid automatic resume after block)
      try { await this.clearDetailProgress(); } catch (_) {}

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
      this.initHud();
      try { this.updateHud({ status: 'Processing', progress: 0, total: 1 }); } catch (_) {}
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
      // Do not navigate while blocked or on a blocked page pattern
      try {
        const blocked = await this.isGloballyBlocked();
        if (blocked || this.isLikelyBlockedPage()) {
          this.updateHud({ status: 'Paused (429/CHLG)', progress: 0, total: 0 });
          this.sendMessage(MessageTypes.BLOCK_DETECTED, { reason: blocked ? 'Global block' : 'DOM block', url: window.location.href });
          return;
        }
      } catch (_) {}

      logger.debug(`Navigating to: ${url}`);

      // Add random delay to simulate human thinking
      await this.humanSimulator.randomDelay(1000, 3000);

      // Navigate
      this.navigationInProgress = true;
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
      chrome.runtime.sendMessage({ type, payload }, () => {
        // Swallow transient errors like context invalidation or port closed
        const err = chrome.runtime.lastError;
        if (err) {
          logger.debug('Message not delivered (likely transient): ' + err.message);
        }
      });
    } catch (error) {
      // Extension context might be invalidated during navigation; treat as transient
      logger.debug('Failed to send message to service worker (transient): ' + (error?.message || error));
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

// Initialize content script once per page
(function initOnce() {
  try {
    if (window.__SENTIO_CS_LOADED__) {
      // Already initialized; avoid duplicate instances
      return;
    }

    const start = () => {
      const instance = new SentioContentScript();
      window.sentioContentScript = instance;
      window.__SENTIO_CS_LOADED__ = true;
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      try {
        window.sentioContentScript && window.sentioContentScript.cleanup();
      } catch (_) {}
      window.__SENTIO_CS_LOADED__ = false;
    });
  } catch (_) {}
})();
