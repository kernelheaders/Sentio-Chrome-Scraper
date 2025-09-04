Sentio Chrome Scraper — Dev Quickstart

Prerequisites
- Node 18+ (tested with Node 24)
- Chrome 114+ (MV3)

Build (manual, no bundler)
- npm install
- node manual-build.js
- Load in Chrome: chrome://extensions → Developer mode → Load unpacked → select build/

Dev API Key
- Popup → “Use Test Key” fills and sets a built‑in dev key.
- Background also seeds the dev key automatically if none is stored.
- API endpoints default to http://127.0.0.1:3001/v1 (see src/utils/config.js).

Running a Test Job
- Open a sahibinden.com listing results page.
- Submit a job from your mock server or use any UI that triggers MessageTypes.EXECUTE_JOB.
- HUD appears on page and shows progress.

Block/Challenge Behavior
- On 429/challenge pages, content halts navigation and HUD shows “Paused (429/CHLG)”.
- Service worker enters backoff and cancels jobs; resume via popup “Resume”.

Rebuilding
- After source edits: node manual-build.js → refresh extension in chrome://extensions.

Common Gotchas
- “Cannot use import statement outside a module” in popup: Ensure popup.html uses <script type="module" src="popup.js"> (already configured).
- Content script imports are packaged as raw ESM; this is acceptable for our current flows in MV3. If bundling is later required, plug in webpack or rollup and point manifest to the bundled output.

File Map (selected)
- build/… mirrors src/…; service worker is module type; popup is ESM via type=module script.
- content scripts: build/content/*.js

