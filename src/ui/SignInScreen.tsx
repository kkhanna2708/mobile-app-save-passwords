import { useState } from 'react';
import { Text, View } from 'react-native';
import { signIn, type AuthUser } from '../auth';
import { GOOGLE_WEB_CLIENT_ID } from '../config';
import { Button, ErrorText, errorMessage, styles } from './common';

export function SignInScreen({ onSignedIn }: { onSignedIn: (u: AuthUser) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    GOOGLE_WEB_CLIENT_ID ? '' : 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. See README.',
  );

  const onPress = async () => {
    setBusy(true);
    setError('');
    try {
      const user = await signIn();
      if (user) onSignedIn(user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Pass Vault</Text>
      <Text style={styles.subtitle}>
        Your passwords are encrypted on this device with your master password and stored in a hidden app folder in
        your own Google Drive. There is no server.
      </Text>
      <Button title="Sign in with Google" onPress={onPress} busy={busy} disabled={!GOOGLE_WEB_CLIENT_ID} />
      <ErrorText error={error} />
    </View>
  );
}
