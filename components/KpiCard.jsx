import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export default function KpiCard({ label, value, accent }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(4),
  },
  label: {
    fontSize: 12,
    color: t.colors.textMuted,
    marginBottom: t.spacing(1),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: t.colors.text,
  },
});
