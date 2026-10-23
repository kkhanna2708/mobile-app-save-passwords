import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { CLIPBOARD_CLEAR_MS } from '../config';

export const colors = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  text: '#15181E',
  muted: '#646B78',
  border: '#DADDE3',
  primary: '#1F5EFF',
  danger: '#C62828',
};

export function Button({
  title,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && { backgroundColor: colors.primary },
        kind === 'secondary' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        kind === 'danger' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger },
        (pressed || off) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? '#fff' : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: kind === 'primary' ? '#fff' : kind === 'danger' ? colors.danger : colors.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, right, ...props }: TextInputProps & { label: string; right?: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        />
        {right}
      </View>
    </View>
  );
}

export function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.smallAction} accessibilityRole="button">
      <Text style={{ color: colors.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ error }: { error: string }) {
  return error ? <Text style={styles.error}>{error}</Text> : null;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Copies, then clears the clipboard after a delay if it still holds the same value. */
export function useCopy() {
  const [copied, setCopied] = useState('');
  return {
    copied,
    copy: async (label: string, value: string) => {
      await Clipboard.setStringAsync(value);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? '' : c)), 1500);
      setTimeout(async () => {
        try {
          if ((await Clipboard.getStringAsync()) === value) await Clipboard.setStringAsync('');
        } catch {
          // Web may deny clipboard reads; nothing more we can do.
        }
      }, CLIPBOARD_CLEAR_MS);
    },
  };
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 24, lineHeight: 21 },
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  input: { flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text },
  smallAction: { paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: colors.danger, marginTop: 8, marginBottom: 4 },
});
