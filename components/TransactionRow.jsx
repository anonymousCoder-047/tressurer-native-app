import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fmtMoney, prettyDate } from '@/utils/format';

// One row in a transaction list. Received (income) shows green +, Paid red −.
export default function TransactionRow({ item, showDate }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const income = item.type === 'income';
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.description} numberOfLines={1}>
          {item.description || item.category || '(no description)'}
        </Text>
        <Text style={styles.meta}>
          {showDate && item.business_date ? `${prettyDate(item.business_date)} · ` : ''}
          {item.created_by_name ?? ''}
          {item.proof_file_path ? ' · proof' : ''}
        </Text>
      </View>
      <Text style={[styles.amount, { color: income ? '#16A34A' : t.colors.danger }]}>
        {income ? '+' : '−'}
        {fmtMoney(item.amount)}
      </Text>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing(3),
    paddingHorizontal: t.spacing(4),
    backgroundColor: t.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  left: { flex: 1, marginRight: t.spacing(3) },
  description: { fontSize: 15, fontWeight: '600', color: t.colors.text },
  meta: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
});
