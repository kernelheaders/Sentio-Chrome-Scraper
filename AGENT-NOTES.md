Agent Notes (for future AI assistants)

Scope
- Work within workspace-write; prefer surgical changes.
- Do not commit; use apply_patch. Keep edits minimal and focused.

Build/Test
- Build via node manual-build.js (no network needed).
- Load build/ in chrome://extensions.
- Validate popup loads (no ESM errors), service worker logs, basic HUD behavior in a sahibinden.com page.

Key Paths
- src/content/scraper.js: navigation/HUD/resume logic. Good place to tweak humanization and block checks.
- src/content/job-executor.js: extraction logic; selectors and pagination.
- src/background/service-worker.js: message routing, polling, block backoff.
- src/utils/crypto.js: WebCrypto (AES‑GCM for key storage; HMAC‑SHA256 for signing).
- src/utils/storage.js: storage wrappers and API key lifecycle.

Messaging Contracts
- MessageTypes in src/shared/types.js. Keep backward compatibility when adding types.

Blocking
- Treat both HTTP 429 and CHLG URL as block; avoid any navigation while blocked; update HUD.

Style/Conventions
- Keep logs concise via utils/logger.js; avoid noisy console in production.
- Avoid large refactors; preserve file structure.

