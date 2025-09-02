# Testing Guide - Sentio Chrome Extension

This guide will help you test the Sentio Chrome Extension locally using the mock API server.

## Prerequisites ✅
- [x] Dependencies installed (`npm install`)
- [x] Extension built (`npm run build:dev`)
- [x] Mock server running (`npm run mock-server`)

## Setup Instructions

### 1. Load Extension in Chrome

1. **Open Chrome Extensions Page**
   ```
   Navigate to: chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked" button
   - Select the `build` folder in your project directory:
     ```
     /Users/keremcopcu/Project/Sentio-Chrome-Scraper/build
     ```

4. **Verify Installation**
   - You should see "Sentio Scraper" extension card
   - Extension icon should appear in Chrome toolbar

### 2. Configure API Connection

The extension is pre-configured for local testing:

- **Mock API Server**: Running on `http://localhost:3001/v1`
- **Test API Key**: `test_api_key_12345678901234567890123456`
- **Auto-Configuration**: Extension automatically uses test API key in development mode

### 3. Test the Extension

#### Step 1: Open Extension Popup
1. Click the Sentio extension icon in Chrome toolbar
2. You should see the extension popup interface

#### Step 2: Verify API Connection
1. The extension should automatically:
   - Connect to local mock server
   - Validate the test API key
   - Show "Connected" or "Authorized" status

#### Step 3: Navigate to Test Site
1. Open a new tab
2. Go to: `https://www.sahibinden.com/satilik-daire`
3. This will trigger the content script to load

#### Step 4: Check Job Polling
1. The extension should automatically:
   - Poll for jobs from the mock server
   - Receive the test job (configured to scrape listings)
   - Start executing the scraping job

#### Step 5: Monitor Execution
1. **Check Extension Popup**: Shows current job status
2. **Check Browser Console**: 
   - Open DevTools (F12)
   - Look for logs from the extension
3. **Check Mock Server Logs**: 
   - View the terminal where mock server is running
   - See API requests and job submissions

## Expected Behavior

### Mock Server Provides:
```json
{
  "jobs": [{
    "id": "job_001",
    "type": "listing_scrape",
    "config": {
      "url": "https://www.sahibinden.com/satilik-daire",
      "selectors": {
        "listingContainer": ".searchResultsItem",
        "title": ".classifiedTitle",
        "price": ".searchResultsPriceValue",
        "location": ".searchResultsLocationValue",
        "date": ".searchResultsDateValue"
      },
      "maxItems": 10
    }
  }]
}
```

### Extension Should:
1. ✅ Connect to mock server
2. ✅ Validate API key
3. ✅ Fetch pending jobs
4. ✅ Execute scraping on Sahibinden.com
5. ✅ Extract listing data using configured selectors
6. ✅ Submit results back to mock server
7. ✅ Show success status

## Debugging

### Check Extension Console
1. Go to `chrome://extensions/`
2. Find "Sentio Scraper" extension
3. Click "background page" or "service worker" link
4. Check console for logs

### Check Content Script Console
1. On Sahibinden.com page, open DevTools (F12)
2. Check Console tab for content script logs
3. Look for scraping activity

### Check Mock Server
Monitor the terminal output to see:
- API requests from extension
- Job polling activity  
- Result submissions

### Common Issues

**Extension not working:**
- Verify build folder is loaded correctly
- Check that mock server is running on port 3001
- Ensure no CORS errors in console

**No jobs received:**
- Check mock server is returning jobs
- Verify polling interval (10 seconds in dev mode)
- Check API key validation

**Scraping not working:**
- Ensure you're on the correct Sahibinden.com page
- Check selector configuration matches page structure
- Look for content script errors in console

## Test Commands

```bash
# Start mock server
npm run mock-server

# Build extension for testing
npm run build:dev

# Watch mode (rebuild on file changes)
npm run watch

# Run both server and watch mode
npm run dev

# Reset mock server data
curl -X POST http://localhost:3001/v1/reset

# Check server health
curl http://localhost:3001/v1/health

# View job results
curl -H "Authorization: Bearer test_api_key_12345678901234567890123456" \
     http://localhost:3001/v1/jobs/results
```

## Success Indicators

You'll know the test is successful when:
1. ✅ Extension popup shows "Connected" status
2. ✅ Mock server logs show job polling requests
3. ✅ Content script executes on Sahibinden.com
4. ✅ Listing data is extracted and logged
5. ✅ Results are submitted to mock server
6. ✅ Mock server receives and logs the results

## Next Steps

Once basic functionality works:
1. Test different job configurations
2. Test error scenarios (invalid selectors, network issues)
3. Test anti-detection features
4. Verify data extraction accuracy
5. Test human-like behavior simulation

---

**Need Help?**
Check the console logs in both the extension and mock server for detailed debugging information.