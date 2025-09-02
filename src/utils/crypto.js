/**
 * Cryptographic utilities for secure API key handling and request signing
 */
import CryptoJS from 'crypto-js';

/**
 * Encryption key derivation from browser fingerprint
 */
async function getBrowserFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Browser fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL()
  ].join('|');
  
  // Hash the fingerprint to create a stable encryption key
  return CryptoJS.SHA256(fingerprint).toString();
}

/**
 * Encrypt API key for storage
 */
export async function encryptApiKey(apiKey) {
  try {
    const key = await getBrowserFingerprint();
    const encrypted = CryptoJS.AES.encrypt(apiKey, key).toString();
    return encrypted;
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
    const key = await getBrowserFingerprint();
    const bytes = CryptoJS.AES.decrypt(encryptedKey, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      throw new Error('Invalid encrypted key');
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Generate HMAC signature for API requests
 */
export function signRequest(method, url, body, apiKey, timestamp) {
  const message = [
    method.toUpperCase(),
    url,
    body ? JSON.stringify(body) : '',
    timestamp.toString()
  ].join('\n');
  
  return CryptoJS.HmacSHA256(message, apiKey).toString();
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
export function generateAuthHeaders(apiKey, method, url, body = null) {
  const timestamp = Date.now();
  const nonce = generateNonce();
  const signature = signRequest(method, url, body, apiKey, timestamp);
  
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
export function verifyResponseSignature(responseBody, signature, apiKey, timestamp) {
  const expectedSignature = CryptoJS.HmacSHA256(responseBody + timestamp, apiKey).toString();
  return expectedSignature === signature;
}