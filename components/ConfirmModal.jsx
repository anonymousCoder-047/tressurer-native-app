import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

// Generic destructive-action confirmation. `danger` styles the confirm button.
export default function ConfirmModal({
  visible, title, message, confirmLabel = 'Delete',
  danger = true, busy = false, onConfirm, onCancel,
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirm, danger && styles.confirmDanger]}
              onPress={onConfirm}
              disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
  title: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(2) },
  message: { fontSize: 14, color: t.colors.textMuted, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: t.spacing(4),
    marginTop: t.spacing(5),
  },
  cancel: { paddingVertical: t.spacing(2) },
  cancelText: { color: t.colors.primary, fontWeight: '600' },
  confirm: {
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing(5),
    paddingVertical: t.spacing(3),
    minWidth: 110,
    alignItems: 'center',
  },
  confirmDanger: { backgroundColor: t.colors.danger },
  confirmText: { color: '#fff', fontWeight: '700' },
});
