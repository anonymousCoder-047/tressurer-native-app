import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { useLoadingStore } from '@/store/useLoadingStore';
import { useTheme } from '@/hooks/useTheme';

// Mounted once in the root layout; spins while any axios request is in flight.
// Rendered through a native Modal so it floats above the navigator/tab bar —
// an absolute-fill sibling would sit underneath the navigation container.
export default function LoadingOverlay() {
  const count = useLoadingStore((s) => s.count);
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <Modal transparent animationType="fade" visible={count > 0} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={t.colors.primary} />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: t.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: t.colors.background,
    padding: t.spacing(6),
    borderRadius: t.radius.lg,
  },
});
