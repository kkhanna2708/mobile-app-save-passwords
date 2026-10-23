import { getRandomBytes } from 'expo-crypto';

export function randomBytes(n: number): Uint8Array {
  return getRandomBytes(n);
}

export function randomId(): string {
  return Array.from(randomBytes(12), (b) => b.toString(16).padStart(2, '0')).join('');
}
