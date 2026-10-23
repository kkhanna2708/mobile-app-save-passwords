import { randomBytes } from './random';

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';

/** Uniform pick via rejection sampling, so no character is favored by modulo bias. */
function pick(alphabet: string): string {
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    const b = randomBytes(1)[0];
    if (b < limit) return alphabet[b % alphabet.length];
  }
}

export function generatePassword(length = 20): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  for (;;) {
    let pw = '';
    for (let i = 0; i < length; i++) pw += pick(all);
    if ([LOWER, UPPER, DIGITS, SYMBOLS].every((set) => [...pw].some((c) => set.includes(c)))) return pw;
  }
}
