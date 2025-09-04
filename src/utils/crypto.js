/**
 * Cryptographic utilities for secure API key handling and request signing
 */
// Lightweight crypto utilities built on Web Crypto API

const subtle = globalThis.crypto?.subtle;

function utf8(str) { return new TextEncoder().encode(str); }
function hexFromBuf(buf) {
  const b = new Uint8Array(buf);
  let h = '';
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
  return h;
}
function bufFromHex(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a.buffer;
}
function b64(bytes) {
  if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64ToBytes(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encryption key derivation from browser fingerprint
 */
async function getBrowserFingerprint() {
  try {
    // Use DOM-based fingerprint when document is available (content scripts)
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);

      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        (typeof screen !== 'undefined') ? (screen.width + 'x' + screen.height) : 'noscreen',
        new Date().getTimezoneOffset(),
        canvas.toDataURL()
      ].join('|');

      const digest = await subtle.digest('SHA-256', utf8(fingerprint));
      return hexFromBuf(digest);
    }
  } catch (_) {
    // Fall through to service worker path
  }

  // Service worker or non-DOM context: build a stable key without canvas
  const base = [
    navigator.userAgent || 'unknown',
    (typeof location !== 'undefined' && location.origin) ? location.origin : 'sw',
    'sentio-sw'
  ].join('|');
  const digest = await subtle.digest('SHA-256', utf8(base));
  return hexFromBuf(digest);
}

/**
 * Encrypt API key for storage
 */
export async function encryptApiKey(apiKey) {
  try {
    const fpHex = await getBrowserFingerprint();
    const keyBytes = new Uint8Array(bufFromHex(fpHex));
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(apiKey));
    // v1|base64(iv)|base64(ct)
    return `v1|${b64(iv)}|${b64(ct)}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt API key from storage
 */
export async function decryptApiKey(encryptedKey) {
  try {
    // Support legacy plain format or new v1|iv|ct
    if (!encryptedKey.startsWith('v1|')) {
      // Backward-compat not possible without CryptoJS; treat as invalid
      throw new Error('Unsupported key format');
    }
    const [, ivB64, ctB64] = encryptedKey.split('|');
    const fpHex = await getBrowserFingerprint();
    const keyBytes = new Uint8Array(bufFromHex(fpHex));
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const iv = b64ToBytes(ivB64);
    const ct = b64ToBytes(ctB64);
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Generate HMAC signature for API requests
 */
export async function signRequest(method, url, body, apiKey, timestamp) {
  const message = [
    method.toUpperCase(),
    url,
    body ? JSON.stringify(body) : '',
    timestamp.toString()
  ].join('\n');
  const key = await subtle.importKey('raw', utf8(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, utf8(message));
  return hexFromBuf(sig);
}

/**
 * Generate secure random string for nonces
 */
export function generateNonce(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  // Check minimum length (32 characters)
  if (apiKey.length < 32) {
    return false;
  }
  
  // Check for valid base64-like format
  if (!/^[A-Za-z0-9+/=]+$/.test(apiKey)) {
    return false;
  }
  
  return true;
}

/**
 * Secure memory cleanup for sensitive data
 */
export function secureCleanup(sensitiveString) {
  if (typeof sensitiveString === 'string') {
    // Overwrite the string memory (best effort in JavaScript)
    for (let i = 0; i < sensitiveString.length; i++) {
      sensitiveString = sensitiveString.substring(0, i) + '0' + sensitiveString.substring(i + 1);
    }
  }
}

/**
 * Generate request headers with authentication
 */
export async function generateAuthHeaders(apiKey, method, url, body = null) {
  const timestamp = Date.now();
  const nonce = generateNonce();
  const signature = await signRequest(method, url, body, apiKey, timestamp);
  return {
    'Authorization': `Bearer ${apiKey}`,
    'X-Signature': signature,
    'X-Timestamp': timestamp.toString(),
    'X-Nonce': nonce,
    'Content-Type': 'application/json'
  };
}

/**
 * Verify response signature (if server provides one)
 */
export async function verifyResponseSignature(responseBody, signature, apiKey, timestamp) {
  const key = await subtle.importKey('raw', utf8(apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', key, utf8(responseBody + timestamp));
  const expected = hexFromBuf(sig);
  return expected === signature;
}
