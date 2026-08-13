/**
 * Encryption Utility
 *
 * AES-256-GCM encryption for storing sensitive credentials like
 * OAuth tokens, SMTP passwords, and API keys.
 */

import crypto from 'crypto';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Salt for key derivation - configurable via environment variable
// In production, this MUST be set via environment variable
// In development only, falls back to a random salt (regenerated on each startup)
const getEncryptionSalt = (): string => {
  const envSalt = process.env.ENCRYPTION_SALT;

  if (envSalt) {
    return envSalt;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL: ENCRYPTION_SALT environment variable is not set in production. ' +
      'This is required for consistent encryption/decryption across restarts.'
    );
  }

  // Development only: generate random salt (warning: data encrypted in one session cannot be decrypted in another)
  console.warn('[Encryption] WARNING: ENCRYPTION_SALT not set. Using random salt for development. Data will not persist across restarts.');
  return crypto.randomBytes(16).toString('hex');
};

// Cache the salt to ensure consistency within a single process run
let cachedSalt: string | null = null;
const getSalt = (): string => {
  if (!cachedSalt) {
    cachedSalt = getEncryptionSalt();
  }
  return cachedSalt;
};

// Validate encryption key on module load
if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error(
    'CRITICAL: ENCRYPTION_KEY environment variable is not set in production. ' +
    'This is required for secure credential encryption.'
  );
}

// Derive a proper 32-byte key from the provided key
function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    // In development, use a default key (NOT SECURE - only for dev)
    console.warn('[Encryption] WARNING: Using insecure default key for development only.');
    return crypto.scryptSync('dev-default-key-not-for-production', getSalt(), 32);
  }
  // Use scrypt to derive a proper key length with configurable salt
  return crypto.scryptSync(ENCRYPTION_KEY, getSalt(), 32);
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
