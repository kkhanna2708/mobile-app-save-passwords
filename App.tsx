import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getAccessToken, restoreSession, signOut, type AuthUser } from './src/auth';
import { AUTO_LOCK_MS } from './src/config';
import { DriveClient } from './src/drive';
import { colors, styles } from './src/ui/common';
import { EntryScreen } from './src/ui/EntryScreen';
import { SignInScreen } from './src/ui/SignInScreen';
import { UnlockScreen } from './src/ui/UnlockScreen';
import { VaultScreen } from './src/ui/VaultScreen';
import type { Entry, VaultSession } from './src/vault';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [session, setSession] = useState<VaultSession | null>(null);
  // undefined = list view, null = new entry, Entry = editing.
  const [editing, setEditing] = useState<Entry | null | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  const lastActivity = useRef(Date.now());

  const drive = useMemo(() => new DriveClient(getAccessToken), [user]);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  const lock = useCallback(() => {
    setSession((s) => {
      s?.lock();
      return null;
    });
    setEditing(undefined);
  }, []);

  // Auto-lock after inactivity, and on mobile whenever the app is backgrounded.
  useEffect(() => {
    if (!session) return;
    lastActivity.current = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_LOCK_MS) lock();
    }, 10_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (Platform.OS !== 'web' && state === 'background') lock();
    });
    const bump = () => (lastActivity.current = Date.now());
    if (Platform.OS === 'web') {
      window.addEventListener('pointerdown', bump);
      window.addEventListener('keydown', bump);
    }
    return () => {
      clearInterval(timer);
      sub.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('pointerdown', bump);
        window.removeEventListener('keydown', bump);
      }
    };
  }, [session, lock]);

  const doSignOut = async () => {
    lock();
    await signOut().catch(() => {});
    setUser(null);
  };

  let content: React.ReactNode;
  if (restoring) {
    content = <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  } else if (!user) {
    content = <SignInScreen onSignedIn={setUser} />;
  } else if (!session) {
    content = <UnlockScreen drive={drive} email={user.email} onUnlocked={setSession} onSignOut={doSignOut} />;
  } else if (editing !== undefined) {
    content = (
      <EntryScreen
        key={editing?.id ?? 'new'}
        session={session}
        entry={editing}
        onDone={() => {
          setEditing(undefined);
          setRevision((r) => r + 1);
        }}
      />
    );
  } else {
    content = (
      <VaultScreen
        session={session}
        email={user.email}
        revision={revision}
        onOpen={setEditing}
        onAdd={() => setEditing(null)}
        onLock={lock}
        onChanged={() => setRevision((r) => r + 1)}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1 }} onTouchStart={() => (lastActivity.current = Date.now())}>
          {content}
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
