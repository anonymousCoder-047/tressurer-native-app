import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateField from '@/components/DateField';
import { useTheme } from '@/hooks/useTheme';
import { monthRange, shiftMonth, toISODate } from '@/utils/format';

const last30Days = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toISODate(from), to: toISODate(to) };
};

const presets = () => [
  { key: 'this-month', label: 'This month', range: monthRange(new Date()) },
  { key: 'last-month', label: 'Last month', range: monthRange(shiftMonth(new Date(), -1)) },
  { key: 'last-30', label: 'Last 30 days', range: last30Days() },
];

// Preset chips + from/to pickers. `value` is { from, to } as YYYY-MM-DD strings.
export default function DateRangePicker({ value, onChange }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const presetList = presets();
  const active = presetList.find(
    (p) => p.range.from === value.from && p.range.to === value.to
  )?.key;

  return (
    <View>
      <View style={styles.chips}>
        {presetList.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.chip, active === p.key && styles.chipActive]}
            onPress={() => onChange(p.range)}>
            <Text style={active === p.key ? styles.chipTextActive : styles.chipText}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.fields}>
        <DateField
          style={styles.field}
          value={value.from}
          onChange={(from) => onChange({ from, to: value.to < from ? from : value.to })}
        />
        <Text style={styles.arrow}>→</Text>
        <DateField
          style={styles.field}
          value={value.to}
          onChange={(to) => onChange({ from: value.from > to ? to : value.from, to })}
        />
      </View>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  chips: { flexDirection: 'row', gap: t.spacing(2), marginBottom: t.spacing(3) },
  chip: {
    paddingHorizontal: t.spacing(3),
    paddingVertical: t.spacing(2),
    borderRadius: t.radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  chipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted },
  chipTextActive: { fontSize: 12, fontWeight: '600', color: '#fff' },
  fields: { flexDirection: 'row', alignItems: 'center', gap: t.spacing(2) },
  field: { flex: 1, paddingVertical: t.spacing(2) },
  arrow: { color: t.colors.textMuted, fontWeight: '700' },
});
