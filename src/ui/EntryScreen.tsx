import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { generatePassword } from '../passwordGen';
import { randomId } from '../random';
import type { Entry, VaultSession } from '../vault';
import { Button, ErrorText, Field, SmallAction, colors, confirm, errorMessage, styles, useCopy } from './common';

function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : `https://${u}`;
}

export function EntryScreen({
  session,
  entry,
  onDone,
}: {
  session: VaultSession;
  /** null when adding a new entry. */
  entry: Entry | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Entry>(
    entry ?? { id: randomId(), name: '', url: '', username: '', password: '', notes: '', updatedAt: 0 },
  );
  const [showPw, setShowPw] = useState(!entry);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const { copied, copy } = useCopy();

  const set = (k: keyof Entry) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!draft.name.trim()) return setError('Name is required.');
    setBusy('save');
    setError('');
    try {
      await session.upsert({ ...draft, name: draft.name.trim(), url: normalizeUrl(draft.url) });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!entry || !(await confirm('Delete login', `Delete "${entry.name}"? This cannot be undone.`))) return;
    setBusy('delete');
    setError('');
    try {
      await session.remove(entry.id);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 560, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text style={[styles.title, { flex: 1, marginBottom: 0 }]}>{entry ? 'Edit login' : 'New login'}</Text>
        <SmallAction label="Back" onPress={onDone} />
      </View>

      <Field label="Name" value={draft.name} onChangeText={set('name')} placeholder="e.g. GitHub" autoCapitalize="sentences" />
      <Field
        label="URL"
        value={draft.url}
        onChangeText={set('url')}
        placeholder="https://github.com/login"
        keyboardType="url"
        right={draft.url ? <SmallAction label="Open" onPress={() => Linking.openURL(normalizeUrl(draft.url))} /> : null}
      />
      <Field
        label="Username / email"
        value={draft.username}
        onChangeText={set('username')}
        textContentType="username"
        right={draft.username ? <SmallAction label="Copy" onPress={() => copy('Username', draft.username)} /> : null}
      />
      <Field
        label="Password"
        value={draft.password}
        onChangeText={set('password')}
        secureTextEntry={!showPw}
        textContentType="password"
        right={
          <View style={{ flexDirection: 'row' }}>
            <SmallAction label={showPw ? 'Hide' : 'Show'} onPress={() => setShowPw(!showPw)} />
            {draft.password ? <SmallAction label="Copy" onPress={() => copy('Password', draft.password)} /> : null}
          </View>
        }
      />
      <View style={{ alignItems: 'flex-start', marginTop: -8, marginBottom: 8 }}>
        <SmallAction
          label="Generate strong password"
          onPress={() => {
            setDraft((d) => ({ ...d, password: generatePassword() }));
            setShowPw(true);
          }}
        />
      </View>
      <Field label="Notes" value={draft.notes} onChangeText={set('notes')} multiline autoCapitalize="sentences" />

      {copied ? <Text style={{ color: colors.muted }}>{copied} copied (clipboard clears in 30s)</Text> : null}
      <ErrorText error={error} />
      <Button title="Save" onPress={save} busy={busy === 'save'} disabled={busy !== null} />
      {entry && <Button title="Delete" kind="danger" onPress={remove} busy={busy === 'delete'} disabled={busy !== null} />}
    </ScrollView>
  );
}
