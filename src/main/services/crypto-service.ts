/**
 * Cryptographic service for client-side passphrase-derived encryption.
 *
 * Requirements (SPEC.md §9 & §10):
 *  - Key derived from user passphrase using PBKDF2-HMAC-SHA256 (210,000 iterations).
 *  - Authenticated encryption via AES-256-GCM with 12-byte random IV and 16-byte auth tag.
 *  - Tamper detection and constant-time password verification.
 *  - Self-describing serialization format: v1:{saltHex}:{ivHex}:{authTagHex}:{ciphertextHex}.
 */

import * as crypto from 'crypto';

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LEN = 32; // 256 bits
const PBKDF2_DIGEST = 'sha256';
const SALT_BYTE_LENGTH = 32;
const GCM_IV_BYTE_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const GCM_AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

export interface EncryptedEnvelope {
  version: 'v1';
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  ciphertextHex: string;
}

/**
 * Derives a 256-bit symmetric key from a user passphrase and salt using PBKDF2-HMAC-SHA256.
 */
export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (!passphrase || passphrase.length === 0) {
    throw new Error('Passphrase cannot be empty');
  }
  return crypto.pbkdf2Sync(
    passphrase,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LEN,
    PBKDF2_DIGEST
  );
}

/**
 * Serializes an encrypted envelope into a portable string format:
 * `v1:{saltHex}:{ivHex}:{authTagHex}:{ciphertextHex}`
 */
export function serializeEnvelope(env: EncryptedEnvelope): string {
  return `${env.version}:${env.saltHex}:${env.ivHex}:${env.authTagHex}:${env.ciphertextHex}`;
}

/**
 * Deserializes an envelope string into its components.
 */
export function deserializeEnvelope(raw: string): EncryptedEnvelope {
  const parts = raw.split(':');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    throw new Error('Invalid or unsupported encrypted payload format');
  }
  return {
    version: 'v1',
    saltHex: parts[1],
    ivHex: parts[2],
    authTagHex: parts[3],
    ciphertextHex: parts[4],
  };
}

/**
 * Encrypts plaintext using AES-256-GCM and a derived 256-bit key.
 */
export function encryptWithKey(plaintext: string, key: Buffer, saltHex = ''): EncryptedEnvelope {
  const iv = crypto.randomBytes(GCM_IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 'v1',
    saltHex,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    ciphertextHex: ciphertext.toString('hex'),
  };
}

/**
 * Decrypts an envelope using AES-256-GCM and the derived 256-bit key.
 * Throws an error if key is invalid or ciphertext has been altered.
 */
export function decryptWithKey(env: EncryptedEnvelope, key: Buffer): string {
  const iv = Buffer.from(env.ivHex, 'hex');
  const authTag = Buffer.from(env.authTagHex, 'hex');
  const ciphertext = Buffer.from(env.ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Decryption failed: invalid key or tampered payload');
  }
}

/**
 * High-level helper: Encrypts plaintext directly using a passphrase.
 * Generates a fresh random salt and returns a serialized string.
 */
export function encryptWithPassphrase(plaintext: string, passphrase: string): string {
  const salt = crypto.randomBytes(SALT_BYTE_LENGTH);
  const key = deriveKey(passphrase, salt);
  const envelope = encryptWithKey(plaintext, key, salt.toString('hex'));
  return serializeEnvelope(envelope);
}

/**
 * High-level helper: Decrypts a serialized payload using a passphrase.
 */
export function decryptWithPassphrase(serialized: string, passphrase: string): string {
  const envelope = deserializeEnvelope(serialized);
  const salt = Buffer.from(envelope.saltHex, 'hex');
  const key = deriveKey(passphrase, salt);
  return decryptWithKey(envelope, key);
}

/**
 * Creates a constant-time verification record for testing passphrase correctness
 * without storing the passphrase itself.
 */
export function createPassphraseVerifier(passphrase: string): { saltHex: string; verifierHex: string } {
  const salt = crypto.randomBytes(SALT_BYTE_LENGTH);
  const key = deriveKey(passphrase, salt);
  // Hash the derived key with a separate fixed string to create a verifier
  const verifier = crypto.createHmac('sha256', key).update('PB_VAULT_VERIFIER_V1').digest();
  return {
    saltHex: salt.toString('hex'),
    verifierHex: verifier.toString('hex'),
  };
}

/**
 * Verifies a passphrase against stored verification parameters in constant time.
 */
export function verifyPassphrase(passphrase: string, saltHex: string, expectedVerifierHex: string): boolean {
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const key = deriveKey(passphrase, salt);
    const computedVerifier = crypto.createHmac('sha256', key).update('PB_VAULT_VERIFIER_V1').digest();
    const expected = Buffer.from(expectedVerifierHex, 'hex');

    if (computedVerifier.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedVerifier, expected);
  } catch {
    return false;
  }
}
