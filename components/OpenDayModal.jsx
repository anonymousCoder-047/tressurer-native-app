import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { openDay } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { fmtMoney } from '@/utils/format';

// Opening Balance Rule UI: shown before the first entry of the day. Pre-fills
// the previous day's closing balance; submitting opens the business day.
export default function OpenDayModal({ visible, workspaceId, previousClosing, onOpened, onClose }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [value, setValue] = useState(previousClosing != null ? String(previousClosing) : '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const opening = value.trim() === '' ? null : Number(value);
    if (opening != null && (!isFinite(opening) || opening < 0)) {
      Toast.show({ type: 'error', text1: 'Enter a valid opening balance' });
      return;
    }
    setBusy(true);
    try {
      const summary = await openDay(workspaceId, opening ?? previousClosing ?? 0);
      Toast.show({ type: 'success', text1: 'Day opened', text2: `Opening balance ${fmtMoney(summary.opening_balance)}` });
      onOpened?.(summary);
    } catch {
      // interceptor already toasted
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>Open the day</Text>
          <Text style={styles.subtitle}>
            Confirm today&apos;s opening balance before logging entries.
            {previousClosing != null
              ? ` Yesterday's closing was ${fmtMoney(previousClosing)}.`
              : ' No previous day on record.'}
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="Opening balance"
            autoFocus
          />
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.ghost]} onPress={onClose} disabled={busy}>
              <Text style={styles.ghostText}>Later</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Open day</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: t.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing(6),
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: t.colors.background,
    borderRadius: t.radius.lg,
    padding: t.spacing(5),
  },
  title: { fontSize: 18, fontWeight: '700', color: t.colors.text },
  subtitle: { fontSize: 13, color: t.colors.textMuted, marginTop: t.spacing(2), lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
    fontSize: 16,
    marginTop: t.spacing(4),
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing(3), marginTop: t.spacing(5) },
  button: {
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing(5),
    paddingVertical: t.spacing(3),
    borderRadius: t.radius.md,
    minWidth: 96,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  ghost: { backgroundColor: 'transparent' },
  ghostText: { color: t.colors.textMuted, fontWeight: '600' },
});
