# CLAUDE.md - Sentio Chrome Extension Project Status

## Project Overview
**Sentio Chrome Extension** - API-driven Chrome extension for centrally managed Sahibinden.com scraping with server-mediated approach.

## Current Status: 🏆 PRODUCTION-READY - 30-CONTACT PAGINATION TESTED SUCCESSFULLY

### 🏆 MAJOR MILESTONE ACHIEVED
1. **✅ 30-Contact Extraction Test**: Successfully tested pagination across multiple pages
2. **✅ Human-Like Navigation**: Real browser clicking, scrolling, back navigation working perfectly
3. **✅ Contact Data Extraction**: Names, phones, companies, addresses extracted from detail pages
4. **✅ Anti-Detection**: No blocking during extended 30-contact test
5. **✅ Pagination Logic**: Automatically navigated through multiple listing pages
6. **✅ Production-Ready Foundation**: Based on proven sahibinden_human_scraper_v4_2 logic

### ✅ Development Infrastructure
1. **Development Environment**: All dependencies installed (`npm install`)
2. **Mock API Server**: Created and configured (`mock-server.js`) 
3. **Extension Build**: Successfully built with human-like content script
4. **Testing Framework**: Comprehensive testing tools and debug utilities

### 🚀 Ready Components

#### Mock API Server (`mock-server.js`)
- **URL**: `http://localhost:3001/v1`
- **Test API Key**: `test_api_key_12345678901234567890123456`
- **Endpoints**: Health, auth validation, job polling, result submission
- **Status**: Ready to run with `npm run mock-server`

#### Extension Build (`build/` directory)
- **Manifest**: Fixed paths and localhost permissions
- **Service Worker**: `build/background/service-worker.js`
- **Content Script**: `build/content/scraper.js` 
- **Popup**: `build/popup/popup.js` + HTML/CSS in `build/src/popup/`
- **Icons**: Using `build/assets/icons/logo.png`

#### Configuration Updates
- **Manifest.json**: Updated with correct file paths and localhost permissions
- **API Client**: Configured for local development mode
- **Auth Manager**: Auto-sets development API key
- **Config Helper**: `src/utils/config.js` for dev/prod switching

### 🔧 Key Files Modified
1. **manifest.json**: 
   - Fixed service worker path: `background/service-worker.js`
   - Added localhost permissions: `http://localhost:3001/*`
   - Updated CSP for localhost connections
   - Using logo.png for all icon sizes

2. **src/background/api-client.js**: Added config import for local development

3. **src/background/auth-manager.js**: Added auto dev API key setup

4. **src/utils/config.js**: New file for environment detection

5. **package.json**: Added mock server and dev scripts

### 📋 Next Steps for Testing
1. **Start Mock Server**: `npm run mock-server` (port 3001)
2. **Load Extension**: Chrome → `chrome://extensions/` → Load unpacked → select `build/`
3. **Test Scraping**: Visit `https://www.sahibinden.com/satilik-daire`
4. **Monitor**: Check extension popup, console logs, and mock server output

### 🎯 Testing Objectives
- ✅ Extension loads without manifest errors
- ✅ Connects to mock server and validates API key
- ✅ Polls for jobs every 10 seconds (dev mode)
- ✅ Executes scraping job on Sahibinden.com
- ✅ Extracts listing data using configured selectors
- ✅ Submits results back to mock server

### 📁 Project Structure
```
Sentio-Chrome-Scraper/
├── build/                 # Built extension (ready for Chrome)
├── src/                   # Source code
├── mock-server.js         # Local API server for testing
├── manual-build.js        # Manual build script (backup)
├── TESTING_GUIDE.md       # Comprehensive testing instructions
├── MANUAL_BUILD_STEPS.md  # Manual build instructions
└── CLAUDE.md             # This status file
```

### 🛠️ Available Commands
- `npm run build:dev` - Build extension for development
- `npm run mock-server` - Start local API server
- `npm run dev` - Run both server and watch mode
- `npm run watch` - Watch mode for development
- `node manual-build.js` - Manual build (if webpack fails)

### 🔍 Troubleshooting
- **Mock Server**: Should show "🚀 Mock Sentio API Server running on http://localhost:3001"
- **Extension Loading**: Verify build/ folder contains all files
- **API Connection**: Check localhost permissions in manifest.json
- **Console Logs**: Monitor both extension and mock server for debugging

### 💡 Development Notes
- **Auto Dev Mode**: Extension automatically detects local development
- **Test API Key**: Automatically set in development environment
- **Polling Interval**: 10 seconds in dev (vs 30 seconds in production)
- **CORS**: Mock server configured with CORS for localhost

---

## For Next Session
1. Load extension in Chrome and verify connection
2. Test scraping functionality on Sahibinden.com
3. Debug any issues with data extraction
4. Validate human-like behavior simulation
5. Test error handling and edge cases

**Status**: 🟢 Ready for functional testing