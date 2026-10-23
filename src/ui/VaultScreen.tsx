import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Entry, VaultSession } from '../vault';
import { Button, ErrorText, colors, errorMessage, styles as common, useCopy } from './common';

export function VaultScreen({
  session,
  email,
  revision,
  onOpen,
  onAdd,
  onLock,
  onChanged,
}: {
  session: VaultSession;
  email: string;
  /** Bumped by the parent whenever session data changes, to recompute the list. */
  revision: number;
  onOpen: (e: Entry) => void;
  onAdd: () => void;
  onLock: () => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { copied, copy } = useCopy();

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return session.entries.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.url.toLowerCase().includes(q) || e.username.toLowerCase().includes(q),
    );
  }, [session, revision, query]);

  const refresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await session.refresh();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Vault</Text>
          <Text style={{ color: colors.muted }} numberOfLines={1}>
            {email}
          </Text>
        </View>
        <Pressable onPress={onLock} style={s.lock} accessibilityRole="button">
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Lock</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          placeholder="Search"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={s.search}
        />
        <ErrorText error={error} />
        {copied ? <Text style={{ color: colors.muted, marginBottom: 6 }}>{copied} copied</Text> : null}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <Text style={[common.subtitle, { textAlign: 'center', marginTop: 40 }]}>
            {query ? 'No matches.' : 'No entries yet. Add your first login.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
            <View style={s.avatar}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{(item.name[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: colors.muted }} numberOfLines={1}>
                {item.username || item.url}
              </Text>
            </View>
            {item.username ? (
              <Pressable hitSlop={6} onPress={() => copy('Username', item.username)} style={s.copy}>
                <Text style={s.copyText}>User</Text>
              </Pressable>
            ) : null}
            {item.password ? (
              <Pressable hitSlop={6} onPress={() => copy('Password', item.password)} style={s.copy}>
                <Text style={s.copyText}>Pass</Text>
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />

      <View style={s.footer}>
        <Button title="Add login" onPress={onAdd} />
        <Button title="Sync now" kind="secondary" onPress={refresh} busy={refreshing} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text },
  lock: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  search: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  copy: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.bg },
  copyText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  footer: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 0 },
});
