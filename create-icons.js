#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Simple PNG placeholder generator (creates minimal valid PNG files)
function createMinimalPNG(width, height, color = [64, 128, 255]) {
  // This creates a minimal PNG with solid color
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // PNG signature
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // Length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // Bit depth
  ihdr.writeUInt8(2, 17); // Color type (RGB)
  ihdr.writeUInt32BE(crc32(ihdr.slice(4, 21)), 21); // CRC
  
  // Simple RGB data
  const pixelData = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    pixelData[y * (width * 3 + 1)] = 0; // Filter type
    for (let x = 0; x < width; x++) {
      const pixelOffset = y * (width * 3 + 1) + 1 + x * 3;
      pixelData[pixelOffset] = color[0];     // Red
      pixelData[pixelOffset + 1] = color[1]; // Green  
      pixelData[pixelOffset + 2] = color[2]; // Blue
    }
  }
  
  // Compress with zlib (minimal implementation)
  const idat = Buffer.alloc(pixelData.length + 20);
  idat.writeUInt32BE(pixelData.length + 6, 0);
  idat.write('IDAT', 4);
  idat.writeUInt8(120, 8); // Zlib header
  idat.writeUInt8(1, 9);
  idat.writeUInt16LE(pixelData.length, 10);
  idat.writeUInt16LE(~pixelData.length, 12);
  pixelData.copy(idat, 14);
  idat.writeUInt32BE(crc32(idat.slice(4, idat.length - 4)), idat.length - 4);
  
  const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Simple CRC32 implementation
function crc32(buf) {
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// Create icon directory
const iconsDir = '/Users/keremcopcu/Project/Sentio-Chrome-Scraper/build/assets/icons';

// Create icon files
const sizes = [16, 32, 48, 128];
const colors = [
  [64, 128, 255],   // Blue for 16px
  [64, 128, 255],   // Blue for 32px  
  [64, 128, 255],   // Blue for 48px
  [64, 128, 255]    // Blue for 128px
];

sizes.forEach((size, index) => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  const pngData = createMinimalPNG(size, size, colors[index]);
  fs.writeFileSync(iconPath, pngData);
  console.log(`✅ Created ${iconPath}`);
});

console.log('🎉 All extension icons created successfully!');