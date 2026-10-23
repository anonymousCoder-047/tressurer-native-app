import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/hooks/useTheme';

// Full-screen in-app preview of the report HTML — same markup that produces
// the exported PDF, so what is shown here is what downloads.
export default function ReportPreviewModal({ visible, html, onClose }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.bar}>
          <Text style={styles.title}>Report preview</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        {visible && <WebView originWhitelist={['*']} source={{ html }} style={styles.web} />}
      </View>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: t.colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing(4),
    paddingVertical: t.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: t.colors.text },
  closeBtn: { paddingVertical: t.spacing(1), paddingHorizontal: t.spacing(2) },
  closeText: { fontSize: 15, fontWeight: '700', color: t.colors.primary },
  web: { flex: 1 },
});
