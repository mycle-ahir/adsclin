import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import {
  deriveKey,
  encryptWithKey,
  decryptWithKey,
  encryptWithPassphrase,
  decryptWithPassphrase,
  serializeEnvelope,
  deserializeEnvelope,
  createPassphraseVerifier,
  verifyPassphrase,
} from '../../src/main/services/crypto-service';

describe('Passphrase-derived Client-Side Encryption (§9 & §10)', () => {
  const testPassphrase = 'Correct-Horse-Battery-Staple-2026!';
  const plaintext = JSON.stringify({
    profileName: 'Crypto Trader #1',
    proxy: { host: '10.0.0.1', port: 8080 },
    fingerprint: { seed: 'seed-uuid-12345' },
  });

  describe('deriveKey', () => {
    it('generates a 32-byte (256-bit) buffer', () => {
      const salt = crypto.randomBytes(32);
      const key = deriveKey(testPassphrase, salt);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('produces identical keys for identical passphrases and salts', () => {
      const salt = crypto.randomBytes(32);
      const key1 = deriveKey(testPassphrase, salt);
      const key2 = deriveKey(testPassphrase, salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('produces different keys for different salts', () => {
      const salt1 = crypto.randomBytes(32);
      const salt2 = crypto.randomBytes(32);
      const key1 = deriveKey(testPassphrase, salt1);
      const key2 = deriveKey(testPassphrase, salt2);
      expect(key1.equals(key2)).toBe(false);
    });

    it('throws when passphrase is empty', () => {
      const salt = crypto.randomBytes(32);
      expect(() => deriveKey('', salt)).toThrow('Passphrase cannot be empty');
    });
  });

  describe('encryptWithKey & decryptWithKey', () => {
    it('encrypts and decrypts accurately with valid key', () => {
      const salt = crypto.randomBytes(32);
      const key = deriveKey(testPassphrase, salt);

      const envelope = encryptWithKey(plaintext, key, salt.toString('hex'));
      expect(envelope.version).toBe('v1');
      expect(envelope.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(envelope.authTagHex).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(envelope.ciphertextHex.length).toBeGreaterThan(0);

      const decrypted = decryptWithKey(envelope, key);
      expect(decrypted).toBe(plaintext);
    });

    it('fails to decrypt with wrong key', () => {
      const salt = crypto.randomBytes(32);
      const key1 = deriveKey(testPassphrase, salt);
      const key2 = deriveKey('Wrong-Passphrase-999', salt);

      const envelope = encryptWithKey(plaintext, key1, salt.toString('hex'));
      expect(() => decryptWithKey(envelope, key2)).toThrow(/Decryption failed/);
    });

    it('detects tampering with ciphertext (authenticated encryption)', () => {
      const salt = crypto.randomBytes(32);
      const key = deriveKey(testPassphrase, salt);
      const envelope = encryptWithKey(plaintext, key, salt.toString('hex'));

      // Flip the last byte of ciphertext
      const tamperedCipher = envelope.ciphertextHex.slice(0, -2) + 'ff';
      const tamperedEnvelope = { ...envelope, ciphertextHex: tamperedCipher };

      expect(() => decryptWithKey(tamperedEnvelope, key)).toThrow(/Decryption failed/);
    });

    it('detects tampering with auth tag', () => {
      const salt = crypto.randomBytes(32);
      const key = deriveKey(testPassphrase, salt);
      const envelope = encryptWithKey(plaintext, key, salt.toString('hex'));

      // Alter auth tag
      const tamperedTag = envelope.authTagHex.slice(0, -2) + '00';
      const tamperedEnvelope = { ...envelope, authTagHex: tamperedTag };

      expect(() => decryptWithKey(tamperedEnvelope, key)).toThrow(/Decryption failed/);
    });
  });

  describe('serializeEnvelope & deserializeEnvelope', () => {
    it('serializes to v1 formatted string and deserializes correctly', () => {
      const env = {
        version: 'v1' as const,
        saltHex: 'aabb',
        ivHex: 'ccdd',
        authTagHex: 'eeff',
        ciphertextHex: '112233',
      };
      const serialized = serializeEnvelope(env);
      expect(serialized).toBe('v1:aabb:ccdd:eeff:112233');

      const parsed = deserializeEnvelope(serialized);
      expect(parsed).toEqual(env);
    });

    it('rejects malformed serialized strings', () => {
      expect(() => deserializeEnvelope('invalid:format')).toThrow();
      expect(() => deserializeEnvelope('v2:a:b:c:d')).toThrow();
    });
  });

  describe('encryptWithPassphrase & decryptWithPassphrase', () => {
    it('performs complete round-trip encryption and decryption with string output', () => {
      const serialized = encryptWithPassphrase(plaintext, testPassphrase);
      expect(typeof serialized).toBe('string');
      expect(serialized.startsWith('v1:')).toBe(true);

      const decrypted = decryptWithPassphrase(serialized, testPassphrase);
      expect(decrypted).toBe(plaintext);
    });

    it('fails when given incorrect passphrase', () => {
      const serialized = encryptWithPassphrase(plaintext, testPassphrase);
      expect(() => decryptWithPassphrase(serialized, 'Incorrect-Passphrase')).toThrow(
        /Decryption failed/
      );
    });
  });

  describe('createPassphraseVerifier & verifyPassphrase', () => {
    it('correctly verifies the right passphrase', () => {
      const { saltHex, verifierHex } = createPassphraseVerifier(testPassphrase);
      const isValid = verifyPassphrase(testPassphrase, saltHex, verifierHex);
      expect(isValid).toBe(true);
    });

    it('rejects an incorrect passphrase', () => {
      const { saltHex, verifierHex } = createPassphraseVerifier(testPassphrase);
      const isValid = verifyPassphrase('Wrong-Passphrase', saltHex, verifierHex);
      expect(isValid).toBe(false);
    });
  });
});
