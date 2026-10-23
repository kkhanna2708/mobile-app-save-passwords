/**
 * Minimal Google Drive v3 client over fetch, limited to the hidden
 * appDataFolder (scope drive.appdata). The app can never see the user's
 * other Drive files, and the vault file is not visible in the Drive UI.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const VAULT_NAME = 'vault.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export type TokenProvider = (forceRefresh: boolean) => Promise<string>;

export type RemoteMeta = { id: string; version: string };

export class DriveClient {
  constructor(private getToken: TokenProvider) {}

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    let token = await this.getToken(false);
    let res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      token = await this.getToken(true);
      res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google Drive error ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  }

  async findVault(): Promise<RemoteMeta | null> {
    const q = encodeURIComponent(`name='${VAULT_NAME}' and trashed=false`);
    const res = await this.request(
      `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,version)&orderBy=createdTime`,
    );
    const { files } = (await res.json()) as { files: RemoteMeta[] };
    return files[0] ?? null;
  }

  async getMeta(id: string): Promise<RemoteMeta> {
    const res = await this.request(`${API}/files/${id}?fields=id,version`);
    return res.json();
  }

  async download<T>(id: string): Promise<T> {
    const res = await this.request(`${API}/files/${id}?alt=media`);
    return res.json();
  }

  async create(content: unknown): Promise<RemoteMeta> {
    const boundary = `pv${Date.now()}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: VAULT_NAME, parents: ['appDataFolder'], mimeType: 'application/json' }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(content) +
      `\r\n--${boundary}--`;
    const res = await this.request(`${UPLOAD}/files?uploadType=multipart&fields=id,version`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return res.json();
  }

  async update(id: string, content: unknown): Promise<RemoteMeta> {
    const res = await this.request(`${UPLOAD}/files/${id}?uploadType=media&fields=id,version`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
    return res.json();
  }
}
