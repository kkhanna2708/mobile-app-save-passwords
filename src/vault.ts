import { decryptVault, deriveKey, encryptVault, newKdfParams, type KdfParams, type VaultFile } from './crypto';
import type { DriveClient, RemoteMeta } from './drive';
import { randomBytes } from './random';

export type Entry = {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  updatedAt: number;
  /** Tombstone so a delete on one device survives a merge with another. */
  deleted?: boolean;
};

export type VaultData = { entries: Entry[] };

/**
 * Last-writer-wins per entry, by updatedAt. Used when another device saved
 * the vault after we loaded it, so neither device's edits are silently lost.
 */
export function mergeEntries(local: Entry[], remote: Entry[]): Entry[] {
  const byId = new Map<string, Entry>();
  for (const e of remote) byId.set(e.id, e);
  for (const e of local) {
    const other = byId.get(e.id);
    if (!other || e.updatedAt >= other.updatedAt) byId.set(e.id, e);
  }
  return [...byId.values()];
}

export class VaultSession {
  private constructor(
    private drive: DriveClient,
    private key: Uint8Array,
    private kdf: KdfParams,
    private remote: RemoteMeta,
    public data: VaultData,
  ) {}

  static async exists(drive: DriveClient): Promise<boolean> {
    return (await drive.findVault()) !== null;
  }

  static async create(drive: DriveClient, masterPassword: string): Promise<VaultSession> {
    if (await drive.findVault()) throw new Error('A vault already exists in this Google account.');
    const kdf = newKdfParams(randomBytes(16));
    const key = await deriveKey(masterPassword, kdf);
    const data: VaultData = { entries: [] };
    const remote = await drive.create(encryptVault(key, kdf, data, randomBytes(24)));
    return new VaultSession(drive, key, kdf, remote, data);
  }

  static async unlock(drive: DriveClient, masterPassword: string): Promise<VaultSession> {
    const meta = await drive.findVault();
    if (!meta) throw new Error('No vault found in this Google account.');
    const file = await drive.download<VaultFile>(meta.id);
    const key = await deriveKey(masterPassword, file.kdf);
    const data = decryptVault<VaultData>(key, file);
    return new VaultSession(drive, key, file.kdf, meta, data);
  }

  get entries(): Entry[] {
    return this.data.entries.filter((e) => !e.deleted).sort((a, b) => a.name.localeCompare(b.name));
  }

  async upsert(entry: Entry): Promise<void> {
    const others = this.data.entries.filter((e) => e.id !== entry.id);
    await this.save({ entries: [...others, { ...entry, updatedAt: Date.now() }] });
  }

  async remove(id: string): Promise<void> {
    const entries = this.data.entries.map((e) =>
      e.id === id ? { ...e, name: '', url: '', username: '', password: '', notes: '', deleted: true, updatedAt: Date.now() } : e,
    );
    await this.save({ entries });
  }

  /** Re-download and merge if another device saved since we last synced. */
  async refresh(): Promise<void> {
    const meta = await this.drive.getMeta(this.remote.id);
    if (meta.version === this.remote.version) return;
    const file = await this.drive.download<VaultFile>(this.remote.id);
    const remoteData = decryptVault<VaultData>(this.key, file);
    this.data = { entries: mergeEntries(this.data.entries, remoteData.entries) };
    this.remote = meta;
  }

  private async save(next: VaultData): Promise<void> {
    // Narrow the race with other devices: merge in anything saved since our
    // last sync. Drive has no compare-and-swap, so a write landing in the
    // gap between this check and our upload can still be overwritten.
    const meta = await this.drive.getMeta(this.remote.id);
    if (meta.version !== this.remote.version) {
      const file = await this.drive.download<VaultFile>(this.remote.id);
      next = { entries: mergeEntries(next.entries, decryptVault<VaultData>(this.key, file).entries) };
    }
    this.remote = await this.drive.update(this.remote.id, encryptVault(this.key, this.kdf, next, randomBytes(24)));
    this.data = next;
  }

  lock(): void {
    this.key.fill(0);
    this.data = { entries: [] };
  }
}
