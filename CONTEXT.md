Sentio Chrome Scraper — Context

Overview
- Purpose: Centrally managed data collection on sahibinden.com via a Chrome extension (MV3).
- Components: Service Worker (background), Content Script (scraper runtime), Popup UI, Utilities.
- Flow: Backend issues “jobs” → Service Worker queues and dispatches → Content Script executes → Results submitted and cached for CSV export.

Key Modules
- background/service-worker.js: Orchestrates polling, job dispatch, block handling, state.
- background/job-manager.js: Queue, delivery, result submission, history.
- background/api-client.js: Auth headers, retries, error mapping. Uses WebCrypto-based signing.
- background/auth-manager.js: API key lifecycle; dev key seeding in development.
- content/scraper.js: Entry runtime in page; HUD, navigation, resume logic, block detection.
- content/job-executor.js: Listing/detail extraction, pagination, human-like actions.
- content/human-simulator.js: Click/scroll/delay helpers to reduce detection.
- utils/storage.js: Chrome storage wrapper; encrypts API key.
- utils/crypto.js: WebCrypto (AES‑GCM + HMAC‑SHA256) for key storage + API signing.
- shared/types.js: MessageTypes, JobStatus, CONFIG constants.

Data/State
- chrome.storage.local keys: API key, last poll/result, job queue, detail progress, blocked_until.
- Detail progress: { jobId, urls, index, results, selectors, requirePhone, humanize, listingUrl } supports resume across tabs/reloads.

Block Handling
- Early detection in content script via page copy (e.g., “429”, “olağan dışı erişim”, CHLG text).
- Background also treats HTTP 429 and CHLG URL as block; sets blocked_until; cancels ongoing jobs.
- While blocked: content script halts navigation; HUD shows “Paused (429/CHLG)”.

Humanization
- Random delays, wheel scroll, progressive listing scroll, occasional breadcrumb clicks.

CSV Export
- Popup triggers export of last cached result; selectable fields.

