import React, { useMemo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/store/useAuthStore';
import { getEmailSettings, saveEmailSettings, testEmailSettings } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';

// Admin SMTP config for the workspace — used for member invites and report
// sharing. Password field stays blank unless you're changing it.
export default function EmailSettingsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const workspace = useAuthStore((s) => s.workspace);
  const [form, setForm] = useState({
    host: '', port: '587', username: '', password: '', from_address: '', secure: false,
  });
  const [passwordSet, setPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // 'save' | 'test'

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!workspace) return;
    getEmailSettings(workspace.id)
      .then((s) => {
        if (s) {
          setForm({
            host: s.host ?? '', port: String(s.port ?? 587), username: s.username ?? '',
            password: '', from_address: s.from_address ?? '', secure: !!s.secure,
          });
          setPasswordSet(!!s.password_set);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace]);

  const save = async () => {
    setBusy('save');
    try {
      await saveEmailSettings(workspace.id, {
        host: form.host.trim(),
        port: Number(form.port) || 587,
        username: form.username.trim() || null,
        password: form.password, // empty keeps the stored one
        from_address: form.from_address.trim(),
        secure: form.secure,
      });
      setPasswordSet(passwordSet || !!form.password);
      Toast.show({ type: 'success', text1: 'Email settings saved' });
    } catch {
      // interceptor toasted
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    try {
      await save();
      await testEmailSettings(workspace.id);
      Toast.show({ type: 'success', text1: 'Test email sent — check your inbox' });
    } catch {
      // interceptor toasted
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} color={t.colors.primary} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>SMTP host</Text>
      <TextInput style={styles.input} value={form.host} onChangeText={(v) => set('host', v)} placeholder="smtp.gmail.com" autoCapitalize="none" />

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Port</Text>
          <TextInput style={styles.input} value={form.port} onChangeText={(v) => set('port', v)} keyboardType="number-pad" placeholder="587" />
        </View>
        <View style={[styles.col, styles.secureCol]}>
          <Text style={styles.label}>SSL/TLS</Text>
          <Switch value={form.secure} onValueChange={(v) => set('secure', v)} />
        </View>
      </View>

      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={form.username} onChangeText={(v) => set('username', v)} placeholder="smtp username (optional)" autoCapitalize="none" />

      <Text style={styles.label}>Password {passwordSet && <Text style={styles.dim}>(saved — leave blank to keep)</Text>}</Text>
      <TextInput style={styles.input} value={form.password} onChangeText={(v) => set('password', v)} placeholder={passwordSet ? '••••••••' : 'smtp password / app password'} autoCapitalize="none" secureTextEntry />

      <Text style={styles.label}>From address</Text>
      <TextInput style={styles.input} value={form.from_address} onChangeText={(v) => set('from_address', v)} placeholder="Tressurer <books@example.com>" autoCapitalize="none" keyboardType="email-address" />

      <Text style={styles.hint}>
        Used to email member invites and to send reports (Reports → Export → Email). For Gmail use
        an app password; port 465 needs SSL/TLS on, 587 off.
      </Text>

      <Pressable style={[styles.btn, styles.primary]} onPress={save} disabled={!!busy || !form.host.trim() || !form.from_address.trim()}>
        {busy === 'save' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save settings</Text>}
      </Pressable>
      <Pressable style={[styles.btn, styles.outline]} onPress={test} disabled={!!busy}>
        {busy === 'test' ? <ActivityIndicator color={t.colors.primary} /> : <Text style={styles.outlineText}>Save & send test email</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.background },
  center: { flex: 1 },
  content: { padding: t.spacing(5), paddingBottom: t.spacing(10) },
  label: { fontSize: 13, fontWeight: '600', color: t.colors.textMuted, marginTop: t.spacing(4), marginBottom: t.spacing(1) },
  dim: { fontWeight: '400', fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
    fontSize: 15,
    color: t.colors.text,
    backgroundColor: t.colors.background,
  },
  row: { flexDirection: 'row', gap: t.spacing(4) },
  col: { flex: 1 },
  secureCol: { flex: 0, justifyContent: 'flex-end', paddingBottom: t.spacing(1) },
  hint: { fontSize: 12, color: t.colors.textMuted, marginTop: t.spacing(4), lineHeight: 18 },
  btn: { marginTop: t.spacing(4), borderRadius: t.radius.md, paddingVertical: t.spacing(3), alignItems: 'center' },
  primary: { backgroundColor: t.colors.primary },
  btnText: { color: '#fff', fontWeight: '700' },
  outline: { borderWidth: 1, borderColor: t.colors.primary },
  outlineText: { color: t.colors.primary, fontWeight: '700' },
});
