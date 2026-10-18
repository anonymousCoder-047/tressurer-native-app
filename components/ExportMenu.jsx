import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const OPTIONS = [
  { key: 'csv', label: 'CSV', hint: 'Spreadsheet-compatible plain text' },
  { key: 'xlsx', label: 'Excel (.xlsx)', hint: 'Formatted workbook' },
  { key: 'pdf', label: 'PDF', hint: 'Styled report, same layout as on screen' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Share the summary as a text message' },
  { key: 'email', label: 'Email', hint: 'Send CSV via workspace SMTP' },
];

// Bottom-sheet export format picker. onPick receives 'csv'|'xlsx'|'pdf'|'email'.
export default function ExportMenu({ visible, onClose, onPick, showEmail = true }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Export</Text>
          {OPTIONS.filter((o) => showEmail || o.key !== 'email').map((o) => (
            <Pressable key={o.key} style={styles.option} onPress={() => onPick(o.key)}>
              <Text style={styles.optionLabel}>{o.label}</Text>
              <Text style={styles.optionHint}>{o.hint}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    padding: t.spacing(5),
    paddingBottom: t.spacing(8),
  },
  title: { fontSize: 17, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(3) },
  option: {
    paddingVertical: t.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  optionLabel: { fontSize: 15, fontWeight: '600', color: t.colors.text },
  optionHint: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: t.spacing(3), marginTop: t.spacing(2) },
  cancelText: { color: t.colors.danger, fontWeight: '700' },
});
