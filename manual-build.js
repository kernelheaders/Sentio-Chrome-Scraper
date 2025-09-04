#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔨 Manual build script for Sentio Chrome Extension');

// Create build directory structure
const buildDir = path.join(__dirname, 'build');
const dirs = [
  'build',
  'build/background',
  'build/content', 
  'build/popup',
  'build/assets',
  'build/assets/icons',
  'build/vendor',
  'build/src',
  'build/src/popup'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Copy files
const filesToCopy = [
  // Manifest
  { from: 'manifest.json', to: 'build/manifest.json' },
  
  // JavaScript source files (we'll copy them as-is for now)
  { from: 'src/background/service-worker.js', to: 'build/background/service-worker.js' },
  { from: 'src/content/scraper.js', to: 'build/content/scraper.js' },
  { from: 'src/popup/popup.js', to: 'build/popup/popup.js' },
  
  // Other source files needed by the JS
  { from: 'src/background/api-client.js', to: 'build/background/api-client.js' },
  { from: 'src/background/auth-manager.js', to: 'build/background/auth-manager.js' },
  { from: 'src/background/job-manager.js', to: 'build/background/job-manager.js' },
  { from: 'src/background/constants.js', to: 'build/background/constants.js' },
  
  { from: 'src/content/anti-detection.js', to: 'build/content/anti-detection.js' },
  { from: 'src/content/dom-extractor.js', to: 'build/content/dom-extractor.js' },
  { from: 'src/content/human-simulator.js', to: 'build/content/human-simulator.js' },
  { from: 'src/content/job-executor.js', to: 'build/content/job-executor.js' },
  { from: 'src/content/loader.js', to: 'build/content/loader.js' },
  
  { from: 'src/utils/config.js', to: 'build/utils/config.js' },
  { from: 'src/utils/crypto.js', to: 'build/utils/crypto.js' },
  { from: 'src/utils/logger.js', to: 'build/utils/logger.js' },
  { from: 'src/utils/storage.js', to: 'build/utils/storage.js' },
  { from: 'src/utils/validators.js', to: 'build/utils/validators.js' },
  
  { from: 'src/shared/types.js', to: 'build/shared/types.js' },

  // Vendor libs needed at runtime (no bundler)
  { from: 'node_modules/crypto-js/crypto-js.js', to: 'build/vendor/crypto-js.js' },
  
  // Popup files
  { from: 'src/popup/popup.html', to: 'build/popup/popup.html' },
  { from: 'src/popup/popup.css', to: 'build/popup/popup.css' },
  
  // Assets
  { from: 'assets/icons/logo.png', to: 'build/assets/icons/logo.png' }
];

// Create additional directories for utils and shared
fs.mkdirSync(path.join(__dirname, 'build/utils'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'build/shared'), { recursive: true });

filesToCopy.forEach(({ from, to }) => {
  const fromPath = path.join(__dirname, from);
  const toPath = path.join(__dirname, to);
  
  try {
    if (fs.existsSync(fromPath)) {
      // Create directory if it doesn't exist
      const toDir = path.dirname(toPath);
      if (!fs.existsSync(toDir)) {
        fs.mkdirSync(toDir, { recursive: true });
      }
      
      fs.copyFileSync(fromPath, toPath);
      console.log(`✅ Copied: ${from} → ${to}`);
    } else {
      console.log(`⚠️  Source not found: ${from}`);
    }
  } catch (error) {
    console.log(`❌ Failed to copy ${from}: ${error.message}`);
  }
});

console.log('🎉 Manual build complete!');
console.log('📁 Extension ready in: build/');
console.log('🔗 Load in Chrome: chrome://extensions/ → Load unpacked → select build/ folder');
