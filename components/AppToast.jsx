import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useTheme';

// Right-aligned toast card with an accent bar + close icon.
// Swipe-to-dismiss is enabled on the <Toast> mount in the root layout.
function AppToast({ kind, text1, text2 }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const ACCENTS = {
    success: '#16A34A',
    error: t.colors.danger,
    info: t.colors.primary,
  };
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, { borderLeftColor: ACCENTS[kind] ?? t.colors.primary }]}>
        <View style={styles.texts}>
          <Text style={styles.text1} numberOfLines={2}>{text1}</Text>
          {!!text2 && <Text style={styles.text2} numberOfLines={2}>{text2}</Text>}
        </View>
        <Pressable hitSlop={10} onPress={() => Toast.hide()} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const toastConfig = {
  success: (props) => <AppToast {...props} kind="success" />,
  error: (props) => <AppToast {...props} kind="error" />,
  info: (props) => <AppToast {...props} kind="info" />,
};

const makeStyles = (t) => StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: t.spacing(4),
    paddingLeft: t.spacing(10),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.background,
    borderRadius: t.radius.md,
    borderLeftWidth: 4,
    paddingVertical: t.spacing(3),
    paddingLeft: t.spacing(4),
    paddingRight: t.spacing(2),
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  texts: { flex: 1 },
  text1: { fontSize: 14, fontWeight: '700', color: t.colors.text },
  text2: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  close: { paddingHorizontal: t.spacing(2), paddingVertical: t.spacing(1) },
  closeText: { fontSize: 14, color: t.colors.textMuted, fontWeight: '700' },
});
