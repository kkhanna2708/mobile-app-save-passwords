import type { ConfigContext, ExpoConfig } from 'expo/config';

// iOS Google sign-in needs the reversed iOS client ID registered as a URL scheme.
// Derived from the same env var the app uses, so it's set in one place.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : 'com.googleusercontent.apps.SET-EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [...(config.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
});
