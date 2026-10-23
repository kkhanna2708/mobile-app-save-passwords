import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)) }));

import { decryptVault, deriveKey, encryptVault, newKdfParams, WrongPasswordError, type VaultFile } from '../crypto';
import type { DriveClient, RemoteMeta } from '../drive';
import { generatePassword } from '../passwordGen';
import { mergeEntries, VaultSession, type Entry } from '../vault';

// Cheap KDF params so tests run fast.
vi.mock('../crypto', async (orig) => {
  const m = await orig<typeof import('../crypto')>();
  return { ...m, newKdfParams: (salt: Uint8Array) => ({ ...m.newKdfParams(salt), N: 2 ** 10 }) };
});

const entry = (id: string, updatedAt: number, extra: Partial<Entry> = {}): Entry => ({
  id, name: id, url: '', username: '', password: 'pw', notes: '', updatedAt, ...extra,
});

/** In-memory stand-in for the Drive appDataFolder. */
class FakeDrive {
  file: { meta: RemoteMeta; content: VaultFile } | null = null;
  async findVault() { return this.file?.meta ?? null; }
  async getMeta() { return this.file!.meta; }
  async download<T>() { return JSON.parse(JSON.stringify(this.file!.content)) as T; }
  async create(content: VaultFile) { this.file = { meta: { id: 'f1', version: '1' }, content }; return this.file.meta; }
  async update(_id: string, content: VaultFile) {
    this.file = { meta: { id: 'f1', version: String(Number(this.file!.meta.version) + 1) }, content };
    return this.file.meta;
  }
}

describe('crypto', () => {
  it('round-trips and rejects a wrong password', async () => {
    const kdf = { ...newKdfParams(new Uint8Array(16)), N: 2 ** 10 };
    const key = await deriveKey('correct horse', kdf);
    const file = encryptVault(key, kdf, { entries: [entry('a', 1)] }, new Uint8Array(24));
    expect(file.ciphertext).not.toContain('pw');
    expect(decryptVault<{ entries: Entry[] }>(key, file).entries[0].id).toBe('a');
    const bad = await deriveKey('wrong', kdf);
    expect(() => decryptVault(bad, file)).toThrow(WrongPasswordError);
  });
});

describe('mergeEntries', () => {
  it('keeps the newer version of each entry and entries from both sides', () => {
    const merged = mergeEntries(
      [entry('a', 5, { password: 'local' }), entry('b', 1)],
      [entry('a', 3, { password: 'remote' }), entry('c', 2)],
    );
    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.find((e) => e.id === 'a')!.password).toBe('local');
  });
  it('a newer tombstone wins over an older edit', () => {
    const merged = mergeEntries([entry('a', 2)], [entry('a', 9, { deleted: true })]);
    expect(merged[0].deleted).toBe(true);
  });
});

describe('VaultSession', () => {
  let drive: FakeDrive;
  beforeEach(() => { drive = new FakeDrive(); });

  it('create, add, unlock again', async () => {
    const s = await VaultSession.create(drive as unknown as DriveClient, 'master-password');
    await s.upsert(entry('x', 0, { name: 'GitHub' }));
    const s2 = await VaultSession.unlock(drive as unknown as DriveClient, 'master-password');
    expect(s2.entries.map((e) => e.name)).toEqual(['GitHub']);
    await expect(VaultSession.unlock(drive as unknown as DriveClient, 'nope')).rejects.toThrow(WrongPasswordError);
  });

  it('does not lose edits made concurrently on two devices', async () => {
    const phone = await VaultSession.create(drive as unknown as DriveClient, 'master-password');
    const browser = await VaultSession.unlock(drive as unknown as DriveClient, 'master-password');
    await phone.upsert(entry('p', 0, { name: 'From phone' }));
    await browser.upsert(entry('b', 0, { name: 'From browser' }));
    const fresh = await VaultSession.unlock(drive as unknown as DriveClient, 'master-password');
    expect(fresh.entries.map((e) => e.name)).toEqual(['From browser', 'From phone']);
    await phone.refresh();
    expect(phone.entries).toHaveLength(2);
  });

  it('delete hides the entry and wipes its secrets', async () => {
    const s = await VaultSession.create(drive as unknown as DriveClient, 'master-password');
    await s.upsert(entry('x', 0));
    await s.remove('x');
    expect(s.entries).toHaveLength(0);
    expect(s.data.entries[0]).toMatchObject({ deleted: true, password: '' });
  });
});

describe('generatePassword', () => {
  it('has requested length and every character class', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(16);
      expect(pw).toHaveLength(16);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^a-zA-Z0-9]/);
    }
  });
});
