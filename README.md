# Pass Vault

A password manager for Android, iOS and the web, built with Expo (React Native + React Native Web). It has no backend. Each user signs in with their own Google account, and the vault is saved as `vault.json` in that account's Google Drive.

## How it works

- **Storage.** The app uses the `drive.appdata` scope, so it writes to Drive's hidden *appDataFolder*. It can't see the user's other files, and the vault doesn't show up in the Drive UI. Drive usage counts against the user's own quota.
- **Encryption.** The master password goes through scrypt (N=2^15, r=8, p=1) to produce a key, and the entries are encrypted with XChaCha20-Poly1305 on the device. Google only ever stores this:
  ```json
  { "format": "pass-vault/1",
    "kdf": { "name": "scrypt", "N": 32768, "r": 8, "p": 1, "salt": "…" },
    "cipher": { "name": "xchacha20-poly1305", "nonce": "…" },
    "ciphertext": "…" }
  ```
  The decrypted data is `{ "entries": [{ id, name, url, username, password, notes, updatedAt, deleted? }] }`.
- **Multiple devices.** Before each save the app checks the file's Drive `version`. If another device saved in the meantime, the app merges the two vaults per entry (newest `updatedAt` wins, and deletes are kept as tombstones). Pull to refresh or tap "Sync now" to fetch changes.
- **Auth.** On mobile the app uses `@react-native-google-signin/google-signin`. On the web it uses Google Identity Services (the token model). The web token is kept only in memory, so reloading the page means signing in again.
- **Locking.** The vault auto-locks after 5 minutes of inactivity, and on mobile it also locks when the app goes to the background. Copied values are cleared from the clipboard after 30 seconds if they haven't changed.

## Google Cloud setup (required, one time)

1. Create a project at https://console.cloud.google.com and enable the **Google Drive API**.
2. Under **OAuth consent screen**, set the user type to External, then add the scope `.../auth/drive.appdata` plus `openid` and `email`.
   - While the app is in "Testing", only test users you add (up to 100) can sign in. To open it to everyone, publish the app. `drive.appdata` is a non-sensitive scope, so this needs only basic verification, not a security assessment.
3. Under **Credentials**, create these OAuth client IDs:
   - **Web application**: add your web origins (e.g. `http://localhost:8081` and your production URL) to *Authorized JavaScript origins*. The mobile library also uses this ID.
   - **Android**: package `com.passvault.app` plus the SHA-1 of your signing key. Use the debug keystore for dev builds, and the EAS or Play signing key for release builds. You never enter this ID in the app.
   - **iOS**: bundle ID `com.passvault.app`.
4. Copy `.env.example` to `.env` and fill in the web and iOS client IDs.

Change `com.passvault.app` in `app.json` to your own identifier before you register the clients.

## Run

```bash
npm install
npm run web                 # browser
npx expo run:android        # needs Android SDK; or: npx eas-cli build --profile development -p android
npx expo run:ios            # needs macOS + Xcode
npm test                    # unit tests (crypto, merge, sync)
npm run typecheck
```

Google sign-in uses native code, so the mobile app **does not run in Expo Go**. You need a development build.

To deploy the web version: run `npx expo export --platform web` and host `dist/` on any static host (Netlify, Vercel, GitHub Pages, Firebase Hosting). Then add that origin to the web OAuth client.

## Known limitations

- **A forgotten master password can't be recovered.** There's no reset, because nobody else has the key.
- **The KDF is pure JavaScript.** Hermes has no JIT, so unlocking may take a few seconds on low-end phones. N is set lower than OWASP's scrypt recommendation (2^17) to keep unlock usable. A weak master password is the real risk. The parameters are stored in the file, so they can be raised later.
- **Saves can still collide.** Drive has no compare-and-swap, so two saves within the same second or so on different devices can still overwrite each other. Normal use (one device at a time, or edits minutes apart) merges correctly.
- **Web session.** On the web, Google tokens last an hour. When one expires, the app asks Google for a new token, which may open a short popup. If popups are blocked, the save fails with a message, and retrying from a click works.
- **No autofill.** The app doesn't integrate with the iOS/Android autofill services or a browser extension. You copy usernames and passwords by hand.
- **The web version's security depends on its host.** Anyone who can change the hosted JS can steal master passwords. Serve it over HTTPS from a host you control.
