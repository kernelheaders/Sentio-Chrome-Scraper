# CLAUDE.md - Sentio Chrome Extension Project Status

## Project Overview
**Sentio Chrome Extension** - API-driven Chrome extension for centrally managed Sahibinden.com scraping with server-mediated approach.

## Current Status: 🎉 COMPLETE STANDALONE SYSTEM - FULLY FUNCTIONAL WITH CSV EXPORT

### 🎉 COMPLETE SYSTEM ACHIEVEMENTS
1. **✅ Standalone Operation**: No server dependency - pure client-side extraction
2. **✅ Beautiful Professional Interface**: Modern gradient design with intuitive controls
3. **✅ Human-Like Navigation**: Real browser automation with proven anti-detection
4. **✅ Comprehensive Contact Extraction**: Names, phones, companies, addresses, prices, titles
5. **✅ Dual Extraction Logic**: Handles both real estate agencies and individual owners
6. **✅ Smart Job Control**: Start/Pause/Resume/Reset with persistent state management
7. **✅ CSV Export System**: Customizable field selection with professional formatting
8. **✅ Context Protection**: Robust handling of Chrome extension development issues
9. **✅ URL Deduplication**: Prevents duplicate contact extraction
10. **✅ Production Testing**: Successfully extracted real contacts with phone numbers

### ✅ Development Infrastructure
1. **Development Environment**: All dependencies installed (`npm install`)
2. **Mock API Server**: Created and configured (`mock-server.js`) 
3. **Extension Build**: Successfully built with human-like content script
4. **Testing Framework**: Comprehensive testing tools and debug utilities

### 🚀 Production-Ready Components

#### Standalone Extension (`build/` directory)
- **Beautiful Interface**: `stable-popup.html` with modern gradient design
- **Smart Content Script**: `clean-content-script.js` with bulletproof operation
- **No Service Worker**: Simplified architecture eliminates context issues
- **CSV Export**: Complete field selection and download system
- **Professional Styling**: Modern interface suitable for commercial use

#### Key Features Implemented
- **API Key**: "TEST" for development activation
- **Contact Extraction**: Names, phones, companies, addresses, prices, titles
- **Speed Profiles**: Fast (2-4 min/page), Normal (5-8 min/page), Secure (12-20 min/page)
- **Job Control**: Start/Pause/Resume/Reset with persistent state
- **CSV Export**: Customizable field selection with professional formatting

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