// Minimal loader to execute the content script as an ES module.
// This avoids the "Cannot use import statement outside a module" error.
(async () => {
  try {
    await import(chrome.runtime.getURL('content/scraper.js'));
  } catch (e) {
    try { console.error('Failed to load module content script', e); } catch (_) {}
  }
})();

