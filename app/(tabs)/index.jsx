import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import DateRangePicker from '@/components/DateRangePicker';
import KpiCard from '@/components/KpiCard';
import TransactionRow from '@/components/TransactionRow';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getReport, getTransactions } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { fmtMoney, monthRange } from '@/utils/format';

export default function DashboardScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { workspace, ready } = useWorkspace();
  const [range, setRange] = useState(() => monthRange(new Date()));
  const [data, setData] = useState({ totals: null, recent: [], totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!ready || !workspace) {
        setLoading(false); // don't strand the spinner when there's nothing to load
        return;
      }
      if (isRefresh) setRefreshing(true); else setLoading(true);
      try {
        const [report, tx] = await Promise.all([
          getReport(workspace.id, range),
          getTransactions(workspace.id, range),
        ]);
        const transactions = tx.transactions ?? [];
        setData({ totals: report.totals, recent: transactions.slice(0, 10), totalCount: transactions.length });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspace, range, ready]
  );

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {}); // errors already toasted by the interceptor
    }, [load])
  );

  if (!ready || (loading && !refreshing && !data.totals)) {
    return <ActivityIndicator style={styles.center} color={t.colors.primary} />;
  }

  if (!workspace) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No workspace selected</Text>
        <Pressable style={styles.cta} onPress={() => router.push('/workspaces')}>
          <Text style={styles.ctaText}>Choose a workspace</Text>
        </Pressable>
      </View>
    );
  }

  const totals = data.totals ?? { credit: 0, debit: 0, closing_balance: 0 };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true).catch(() => {})} />}
      ListHeaderComponent={
        <>
          <DateRangePicker value={range} onChange={setRange} />
          <View style={styles.kpiGrid}>
            <KpiCard label="Transactions" value={String(data.totalCount)} />
            <KpiCard label="Received" value={fmtMoney(totals.credit)} accent="#16A34A" />
            <KpiCard label="Paid" value={fmtMoney(totals.debit)} accent={t.colors.danger} />
            <KpiCard label="Balance" value={fmtMoney(totals.closing_balance)} accent={t.colors.primary} />
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <Pressable onPress={() => router.push('/(tabs)/audit')} hitSlop={8}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
        </>
      }
      data={data.recent}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionRow item={item} showDate />}
      ListEmptyComponent={
        <Text style={styles.emptyList}>No transactions this month.</Text>
      }
    />
  );
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.spacing(4), paddingBottom: t.spacing(10) },
  center: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(3), marginTop: t.spacing(2) },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: t.spacing(6),
    marginBottom: t.spacing(2),
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: t.colors.text },
  viewAll: { color: t.colors.primary, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: t.colors.textMuted, marginBottom: t.spacing(4) },
  cta: { backgroundColor: t.colors.primary, paddingHorizontal: t.spacing(6), paddingVertical: t.spacing(3), borderRadius: t.radius.md },
  ctaText: { color: '#fff', fontWeight: '700' },
  emptyList: { textAlign: 'center', color: t.colors.textMuted, padding: t.spacing(6) },
});
