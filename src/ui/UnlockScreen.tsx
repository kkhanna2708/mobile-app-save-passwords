import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WrongPasswordError } from '../crypto';
import type { DriveClient } from '../drive';
import { VaultSession } from '../vault';
import { Button, ErrorText, Field, colors, errorMessage, styles } from './common';

const MIN_LENGTH = 10;

export function UnlockScreen({
  drive,
  email,
  onUnlocked,
  onSignOut,
}: {
  drive: DriveClient;
  email: string;
  onUnlocked: (s: VaultSession) => void;
  onSignOut: () => void;
}) {
  const [exists, setExists] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = () => {
    setError('');
    setExists(null);
    VaultSession.exists(drive)
      .then(setExists)
      .catch((e) => setError(errorMessage(e)));
  };
  useEffect(check, [drive]);

  const submit = async () => {
    setError('');
    if (!exists) {
      if (password.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
      if (password !== confirmPw) return setError('Passwords do not match.');
    }
    setBusy(true);
    try {
      const session = exists ? await VaultSession.unlock(drive, password) : await VaultSession.create(drive, password);
      setPassword('');
      setConfirmPw('');
      onUnlocked(session);
    } catch (e) {
      setError(e instanceof WrongPasswordError ? 'Wrong master password.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>{exists === false ? 'Create your vault' : 'Unlock vault'}</Text>
      <Text style={styles.subtitle}>Signed in as {email}</Text>

      {exists === null && !error ? (
        <ActivityIndicator color={colors.primary} />
      ) : exists === null ? (
        <Button title="Retry" onPress={check} />
      ) : (
        <>
          {!exists && (
            <Text style={[styles.subtitle, { color: colors.danger }]}>
              Choose a strong master password. It is never sent anywhere and cannot be recovered. If you forget it,
              your saved passwords are lost.
            </Text>
          )}
          <Field
            label="Master password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
            onSubmitEditing={exists ? submit : undefined}
          />
          {!exists && (
            <Field
              label="Confirm master password"
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              onSubmitEditing={submit}
            />
          )}
          <Button title={exists ? 'Unlock' : 'Create vault'} onPress={submit} busy={busy} />
          {busy && <Text style={[styles.subtitle, { marginTop: 8 }]}>Deriving key, this can take a few seconds…</Text>}
        </>
      )}
      <ErrorText error={error} />
      <Button title="Sign out" kind="secondary" onPress={onSignOut} />
    </View>
  );
}
