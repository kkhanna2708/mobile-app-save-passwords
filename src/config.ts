// OAuth client IDs from Google Cloud Console. Set them in .env (see README).
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export const AUTO_LOCK_MS = 5 * 60 * 1000;
export const CLIPBOARD_CLEAR_MS = 30 * 1000;
