import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import DateRangePicker from '@/components/DateRangePicker';
import ExportMenu from '@/components/ExportMenu';
import KpiCard from '@/components/KpiCard';
import { useWorkspace } from '@/hooks/useWorkspace';
import { reportAsText, shareCSV, shareReportPDF, shareTextWhatsApp, shareXLSX } from '@/services/export';
import { emailReport, getReport } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { fmtMoney, monthRange, prettyDate } from '@/utils/format';

const datePart = (iso) => String(iso ?? '').slice(0, 10);

export default function ReportsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { workspace, ready } = useWorkspace();
  const [range, setRange] = useState(() => monthRange(new Date()));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(null); // null=closed, ''=open prompt
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!ready || !workspace) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true); else setLoading(true);
      try {
        setReport(await getReport(workspace.id, range));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspace, range, ready]
  );

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  const days = (report?.days ?? []).map((d) => ({ ...d, date: prettyDate(d.business_date) }));
  const aoa = [
    ['Day', 'Open', 'Credit', 'Debit', 'Close'],
    ...(report?.days ?? []).map((d) => [
      datePart(d.business_date), Number(d.opening_balance), Number(d.credit), Number(d.debit), Number(d.closing_balance),
    ]),
  ];
  const base = `${workspace?.name ?? 'report'}-${range.from}-to-${range.to}`.replace(/\s+/g, '-');

  const doExport = async (kind) => {
    setExportOpen(false);
    if (kind === 'email') return setEmailTo('');
    // Let the bottom-sheet finish unmounting before the share intent opens,
    // otherwise the chooser can be buried behind the still-visible modal.
    await new Promise((r) => setTimeout(r, 350));
    setBusy(true);
    try {
      if (kind === 'csv') await shareCSV(`${base}.csv`, aoa[0], aoa.slice(1));
      else if (kind === 'xlsx') await shareXLSX(`${base}.xlsx`, 'Report', aoa);
      else if (kind === 'pdf') {
        await shareReportPDF(`${base}.pdf`, {
          title: `${workspace.name} — Report`,
          subtitle: `${range.from} → ${range.to}`,
          totals: report.totals,
          days,
        });
      } else if (kind === 'whatsapp') {
        await shareTextWhatsApp(
          reportAsText({ workspace: workspace.name, range, totals: report.totals, days: report.days })
        );
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Export failed', text2: err?.message ?? 'Unknown error' });
    } finally {
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    setBusy(true);
    try {
      await emailReport(workspace.id, { ...range, recipient: emailTo.trim() });
      Toast.show({ type: 'success', text1: 'Report emailed' });
      setEmailTo(null);
    } catch {
      // interceptor toasted
    } finally {
      setBusy(false);
    }
  };

  if (!ready || (loading && !report)) {
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

  const totals = report?.totals ?? { credit: 0, debit: 0, net: 0, closing_balance: 0 };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
        <Pressable style={styles.exportBtn} onPress={() => setExportOpen(true)} disabled={busy}>
          <Text style={styles.exportBtnText}>{busy ? '…' : 'Export'}</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true).catch(() => {})} />}
        ListHeaderComponent={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <View style={styles.kpiGrid}>
              <KpiCard label="Credit (received)" value={fmtMoney(totals.credit)} accent="#16A34A" />
              <KpiCard label="Debit (paid)" value={fmtMoney(totals.debit)} accent={t.colors.danger} />
              <KpiCard label="Net" value={fmtMoney(totals.net)} accent={totals.net >= 0 ? '#16A34A' : t.colors.danger} />
              <KpiCard label="Balance" value={fmtMoney(totals.closing_balance)} accent={t.colors.primary} />
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.cellDate, styles.headerText]}>Day</Text>
              <Text style={[styles.cell, styles.headerText]}>Open</Text>
              <Text style={[styles.cell, styles.headerText]}>Credit</Text>
              <Text style={[styles.cell, styles.headerText]}>Debit</Text>
              <Text style={[styles.cell, styles.headerText]}>Close</Text>
            </View>
          </>
        }
        data={days}
        keyExtractor={(item) => item.business_date}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellDate]}>{item.date}</Text>
            <Text style={styles.cell}>{fmtMoney(item.opening_balance)}</Text>
            <Text style={[styles.cell, { color: '#16A34A' }]}>{fmtMoney(item.credit)}</Text>
            <Text style={[styles.cell, { color: t.colors.danger }]}>{fmtMoney(item.debit)}</Text>
            <Text style={styles.cell}>{fmtMoney(item.closing_balance)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyList}>No days opened in this range.</Text>
        }
      />

      <ExportMenu
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        onPick={doExport}
        showEmail={workspace.role === 'admin'}
      />

      {/* Email report prompt */}
      <Modal visible={emailTo !== null} transparent animationType="fade" onRequestClose={() => setEmailTo(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Email report</Text>
            <TextInput
              style={styles.input}
              value={emailTo ?? ''}
              onChangeText={setEmailTo}
              placeholder="recipient@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />
            <Text style={styles.muted}>Sends a CSV of {range.from} → {range.to} via the workspace SMTP config.</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setEmailTo(null)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.sendBtn} onPress={sendEmail} disabled={busy || !(emailTo ?? '').includes('@')}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Send</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.background },
  list: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing(4),
    paddingTop: t.spacing(4),
  },
  title: { fontSize: 22, fontWeight: '800', color: t.colors.text },
  exportBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing(4),
    paddingVertical: t.spacing(2),
    minWidth: 64,
    alignItems: 'center',
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  content: { padding: t.spacing(4), paddingBottom: t.spacing(10) },
  center: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(3), marginTop: t.spacing(2) },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: t.colors.border,
    paddingVertical: t.spacing(2),
    marginTop: t.spacing(6),
  },
  headerText: { fontWeight: '700', color: t.colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: t.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  cell: { flex: 1, fontSize: 12, color: t.colors.text, textAlign: 'right' },
  cellDate: { flex: 1.4, textAlign: 'left' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: t.colors.textMuted, marginBottom: t.spacing(4) },
  cta: { backgroundColor: t.colors.primary, paddingHorizontal: t.spacing(6), paddingVertical: t.spacing(3), borderRadius: t.radius.md },
  ctaText: { color: '#fff', fontWeight: '700' },
  emptyList: { textAlign: 'center', color: t.colors.textMuted, padding: t.spacing(6) },
  muted: { fontSize: 12, color: t.colors.textMuted, marginTop: t.spacing(2), lineHeight: 17 },
  modalBackdrop: { flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  modalCard: { alignSelf: 'stretch', backgroundColor: t.colors.background, borderRadius: t.radius.lg, padding: t.spacing(5) },
  modalTitle: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(3) },
  input: { borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, padding: t.spacing(3), fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: t.spacing(4), marginTop: t.spacing(5) },
  linkBtn: { paddingVertical: t.spacing(2) },
  link: { color: t.colors.primary, fontWeight: '600' },
  sendBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3), minWidth: 96, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
});
