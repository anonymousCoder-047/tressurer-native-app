import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { monthLabel } from '@/utils/format';

// ‹ March 2026 › — date-range filter used by Dashboard and Reports.
export default function MonthNav({ month, onShift }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onShift(-1)} style={styles.arrow} hitSlop={12}>
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>
      <Text style={styles.label}>{monthLabel(month)}</Text>
      <Pressable onPress={() => onShift(1)} style={styles.arrow} hitSlop={12}>
        <Text style={styles.arrowText}>›</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing(2),
  },
  arrow: { padding: t.spacing(2) },
  arrowText: { fontSize: 24, color: t.colors.primary, fontWeight: '700' },
  label: { fontSize: 16, fontWeight: '700', color: t.colors.text },
});
