# Manual Build Steps for Sentio Chrome Extension

Since the build directory was removed, here are the manual steps to rebuild the extension:

## Option 1: Using NPM (Recommended)

Open Terminal and run:

```bash
cd /Users/keremcopcu/Project/Sentio-Chrome-Scraper
npm run build:dev
```

If that fails, try:

```bash
cd /Users/keremcopcu/Project/Sentio-Chrome-Scraper
./node_modules/.bin/webpack --mode=development
```

## Option 2: Using Manual Build Script

I created a manual build script for you:

```bash
cd /Users/keremcopcu/Project/Sentio-Chrome-Scraper
node manual-build.js
```

This will:
1. Create the `build/` directory structure
2. Copy all necessary files to correct locations
3. Make the extension ready for Chrome

## Option 3: Manual File Copy (Last Resort)

If the scripts don't work, manually create the build structure:

### 1. Create directories:
```bash
mkdir -p build/background
mkdir -p build/content
mkdir -p build/popup
mkdir -p build/utils
mkdir -p build/shared
mkdir -p build/assets/icons
mkdir -p build/src/popup
```

### 2. Copy core files:
```bash
# Copy manifest
cp manifest.json build/

# Copy JavaScript files
cp src/background/*.js build/background/
cp src/content/*.js build/content/
cp src/popup/popup.js build/popup/
cp src/utils/*.js build/utils/
cp src/shared/*.js build/shared/

# Copy popup assets
cp src/popup/popup.html build/src/popup/
cp src/popup/popup.css build/src/popup/

# Copy icons
cp assets/icons/logo.png build/assets/icons/
```

## Verify Build Success

After building, check that these files exist:

```
build/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   └── scraper.js
├── popup/
│   └── popup.js
├── src/popup/
│   ├── popup.html
│   └── popup.css
└── assets/icons/
    └── logo.png
```

## Next Steps

1. **Verify Mock Server is Running**: 
   Check if `http://localhost:3001` shows the API server

2. **Load Extension in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/` folder

3. **Test Extension**:
   - Click extension icon in toolbar
   - Navigate to `https://www.sahibinden.com/satilik-daire`
   - Check console for logs

## Expected Results

- ✅ Extension loads without manifest errors
- ✅ Extension connects to localhost:3001
- ✅ Mock server receives polling requests
- ✅ Content script loads on Sahibinden.com

## Troubleshooting

If you get errors:

1. **"Could not load manifest"**: Check manifest.json syntax
2. **"Background script failed"**: Check service-worker.js path
3. **"Permission denied"**: Verify localhost permissions in manifest
4. **"Network error"**: Ensure mock server is running on port 3001

The key fixes we made:
- ✅ Fixed file paths in manifest.json
- ✅ Added localhost permissions
- ✅ Used existing logo.png for icons
- ✅ Updated CSP for local development