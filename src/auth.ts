// Native (Android/iOS) Google sign-in. The web build uses auth.web.ts instead.
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';
import { DRIVE_SCOPE } from './drive';

export type AuthUser = { email: string };

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: [DRIVE_SCOPE],
  });
  configured = true;
}

/** Restores a previous sign-in without UI, if there is one. */
export async function restoreSession(): Promise<AuthUser | null> {
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) return null;
  const res = await GoogleSignin.signInSilently();
  return res.type === 'success' ? { email: res.data.user.email } : null;
}

/** Returns null if the user cancelled. */
export async function signIn(): Promise<AuthUser | null> {
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    if (!res.data.scopes.includes(DRIVE_SCOPE)) {
      throw new Error('Google Drive access was not granted. It is required to store the vault.');
    }
    return { email: res.data.user.email };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return null;
    throw e;
  }
}

export async function getAccessToken(forceRefresh: boolean): Promise<string> {
  const { accessToken } = await GoogleSignin.getTokens();
  if (!forceRefresh) return accessToken;
  await GoogleSignin.clearCachedAccessToken(accessToken);
  return (await GoogleSignin.getTokens()).accessToken;
}

export async function signOut(): Promise<void> {
  await GoogleSignin.signOut();
}
