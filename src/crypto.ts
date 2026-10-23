import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { fromBase64, toBase64 } from './base64';

/**
 * On-disk format of vault.json in the user's Drive appDataFolder.
 * Everything except the KDF/cipher parameters is encrypted.
 */
export type VaultFile = {
  format: 'pass-vault/1';
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  cipher: { name: 'xchacha20-poly1305'; nonce: string };
  ciphertext: string;
};

export type KdfParams = VaultFile['kdf'];

// Pure-JS scrypt is slow on Hermes (no JIT), so N is a compromise between
// brute-force resistance and unlock time on low-end phones. The params live in
// the file, so they can be raised later without breaking existing vaults.
export const DEFAULT_SCRYPT = { N: 2 ** 15, r: 8, p: 1 };

export function newKdfParams(salt: Uint8Array): KdfParams {
  return { name: 'scrypt', ...DEFAULT_SCRYPT, salt: toBase64(salt) };
}

export async function deriveKey(masterPassword: string, kdf: KdfParams): Promise<Uint8Array> {
  if (kdf.name !== 'scrypt') throw new Error(`Unsupported KDF: ${kdf.name}`);
  return scryptAsync(masterPassword.normalize('NFKC'), fromBase64(kdf.salt), {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    dkLen: 32,
    asyncTick: 25,
  });
}

export function encryptVault(key: Uint8Array, kdf: KdfParams, data: unknown, nonce: Uint8Array): VaultFile {
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext);
  return {
    format: 'pass-vault/1',
    kdf,
    cipher: { name: 'xchacha20-poly1305', nonce: toBase64(nonce) },
    ciphertext: toBase64(ciphertext),
  };
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong master password');
  }
}

export function decryptVault<T>(key: Uint8Array, file: VaultFile): T {
  if (file.format !== 'pass-vault/1') throw new Error(`Unknown vault format: ${file.format}`);
  let plaintext: Uint8Array;
  try {
    plaintext = xchacha20poly1305(key, fromBase64(file.cipher.nonce)).decrypt(fromBase64(file.ciphertext));
  } catch {
    // Poly1305 tag mismatch: wrong key or tampered file.
    throw new WrongPasswordError();
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
