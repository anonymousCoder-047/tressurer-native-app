import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

// Shrink the number as it gets longer so it always fits the card on one line —
// adjustsFontSizeToFit is unreliable under Fabric, so tiers do the heavy lifting.
const valueSize = (v) => {
  const len = String(v).length;
  if (len <= 9) return 18;
  if (len <= 13) return 15;
  return 12;
};

export default function KpiCard({ label, value, accent }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.card}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text
        style={[styles.value, { fontSize: valueSize(value) }, accent && { color: accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}>
        {value}
      </Text>
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
