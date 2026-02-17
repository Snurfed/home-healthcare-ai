/**
 * Encryption Utility
 *
 * AES-256-GCM encryption for storing sensitive credentials like
 * OAuth tokens, SMTP passwords, and API keys.
 */

import crypto from 'crypto';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Validate encryption key on module load
if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  console.error('[Encryption] WARNING: ENCRYPTION_KEY not set. Credentials will not be encrypted securely.');
}

// Derive a proper 32-byte key from the provided key
function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    // In development, use a default key (NOT SECURE - only for dev)
    return crypto.scryptSync('dev-default-key', 'salt', 32);
  }
  // Use scrypt to derive a proper key length
  return crypto.scryptSync(ENCRYPTION_KEY, 'homehealthai-salt', 32);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedData {
  encrypted: string; // Base64 encoded
  iv: string; // Base64 encoded
  tag: string; // Base64 encoded
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt data that was encrypted with encrypt()
 */
export function decrypt(data: EncryptedData): string {
  const key = getKey();
  const iv = Buffer.from(data.iv, 'base64');
  const tag = Buffer.from(data.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a JSON object
 */
export function encryptJson<T>(data: T): EncryptedData {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt to a JSON object
 */
export function decryptJson<T>(data: EncryptedData): T {
  return JSON.parse(decrypt(data)) as T;
}

/**
 * Encrypt credentials for storage in database
 * Returns a JSON string that can be stored in a Json field
 */
export function encryptCredentials(credentials: Record<string, unknown>): string {
  const encrypted = encryptJson(credentials);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt credentials from database storage
 */
export function decryptCredentials<T = Record<string, unknown>>(encryptedJson: string): T {
  const data = JSON.parse(encryptedJson) as EncryptedData;
  return decryptJson<T>(data);
}

/**
 * Check if a value looks like encrypted data
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      'encrypted' in parsed &&
      'iv' in parsed &&
      'tag' in parsed
    );
  } catch {
    return false;
  }
}

/**
 * Safely decrypt credentials, returning null if decryption fails
 */
export function safeDecryptCredentials<T = Record<string, unknown>>(
  encryptedJson: string | null | undefined
): T | null {
  if (!encryptedJson) return null;
  try {
    return decryptCredentials<T>(encryptedJson);
  } catch (error) {
    console.error('[Encryption] Failed to decrypt credentials:', error);
    return null;
  }
}

export default {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  encryptCredentials,
  decryptCredentials,
  safeDecryptCredentials,
  isEncrypted,
};
