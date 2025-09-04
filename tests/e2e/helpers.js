import path from 'path';
import fs from 'fs';
import { chromium, expect } from '@playwright/test';

export async function launchWithExtension(testInfo) {
  const buildPath = path.resolve('build');
  if (!fs.existsSync(buildPath)) {
    throw new Error('build/ not found. Run `node manual-build.js` or `npm run build:dev` first.');
  }
  const userDataDir = path.resolve('.pw-user');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: [
      `--disable-extensions-except=${buildPath}`,
      `--load-extension=${buildPath}`
    ]
  });

  // Collect console logs for all pages
  context.on('page', (p) => hookPageLogging(p, testInfo));

  // First page might be blank; open a tab to have a handle
  const [page] = context.pages().length ? context.pages() : [await context.newPage()];
  hookPageLogging(page, testInfo);
  return { context, page };
}

export async function connectToExistingChrome(testInfo, cdpUrl = 'http://127.0.0.1:9222') {
  const context = await chromium.connectOverCDP(cdpUrl);
  context.on('page', (p) => hookPageLogging(p, testInfo));
  const pages = context.pages();
  const page = pages.length ? pages[0] : await context.newPage();
  hookPageLogging(page, testInfo);
  return { context, page };
}

function hookPageLogging(page, testInfo) {
  const logs = [];
  page.on('console', (msg) => {
    const line = `[console:${msg.type()}] ${msg.text()}`;
    logs.push(line);
    // Echo important
    if (/\[flow\]|\[collect\]|\[resume\]|\[navigate\]|Sentio Extension/i.test(line)) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  });
  page.on('pageerror', (err) => {
    logs.push(`[pageerror] ${err?.message || err}`);
  });
  page.on('requestfailed', (req) => {
    logs.push(`[requestfailed] ${req.method()} ${req.url()} ${req.failure()?.errorText}`);
  });
  testInfo.attach(`logs-${page._guid || Date.now()}.txt`, { body: logs.join('\n'), contentType: 'text/plain' });
}

export async function seedJob(listingUrl, maxItems = 3) {
  const body = {
    type: 'detail_scrape',
    config: {
      url: listingUrl,
      maxItems,
      followDetails: true,
      requirePhone: true,
      selectors: {
        listing: '.searchResultsTaglineText a',
        detailTitle: '.classifiedTitle',
        detailPrice: '.priceContainer',
        detailContainer: '.classifiedDetail'
      },
      humanize: { randomScroll: true }
    }
  };
  const res = await fetch('http://127.0.0.1:3001/v1/jobs', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer test_api_key_12345678901234567890123456',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Seed job failed: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function waitForDetailPage(context, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  // Existing pages first
  for (const p of context.pages()) {
    if (isDetailUrl(p.url())) return p;
  }
  // Wait for a new page with /ilan/
  return await new Promise((resolve, reject) => {
    const onPage = async (p) => {
      try {
        await p.waitForLoadState('load', { timeout: Math.max(1000, deadline - Date.now()) });
        if (isDetailUrl(p.url())) {
          cleanup();
          resolve(p);
        }
      } catch (_) {}
    };
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        cleanup();
        reject(new Error('Timeout waiting for detail page'));
      }
    }, 1000);
    const cleanup = () => {
      clearInterval(timer);
      context.off('page', onPage);
    };
    context.on('page', onPage);
  });
}

function isDetailUrl(u) {
  try { return /https?:\/\/www\.sahibinden\.com\/.+\/ilan\//.test(u) || /\/ilan\//.test(new URL(u).pathname); } catch { return false; }
}
