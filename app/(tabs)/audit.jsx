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
import { SymbolView } from 'expo-symbols';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';
import DateRangePicker from '@/components/DateRangePicker';
import ExportMenu from '@/components/ExportMenu';
import OpenDayModal from '@/components/OpenDayModal';
import ReportPreviewModal from '@/components/ReportPreviewModal';
import TransactionRow from '@/components/TransactionRow';
import TransactionViewModal from '@/components/TransactionViewModal';
import { useWorkspace } from '@/hooks/useWorkspace';
import { reportAsText, reportHtml, shareCSV, shareReportPDF, shareTextWhatsApp, shareXLSX } from '@/services/export';
import {
  deleteTransaction,
  emailReport,
  getReport,
  getTodaySummary,
  getTransactions,
} from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import {
  currencySymbol,
  fmtMoney,
  fmtNumber,
  monthRange,
  prettyDate,
  shiftDay,
  todayISO,
  txLabel,
} from '@/utils/format';

const datePart = (iso) => String(iso ?? '').slice(0, 10);

export default function AuditBookScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { workspace, ready } = useWorkspace();
  const [mode, setMode] = useState('day'); // 'day' | 'range' | 'journal'
  const [journal, setJournal] = useState([]); // chronological tx for journal view
  const [jMeta, setJMeta] = useState({ opening: null, closing: null }); // range balances
  const [date, setDate] = useState(todayISO());
  const [range, setRange] = useState(() => monthRange(new Date()));
  const [state, setState] = useState({ summary: null, transactions: [] });
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openDay, setOpenDay] = useState({ visible: false, previous: null });
  const [viewing, setViewing] = useState(null);   // transaction being viewed
  const [confirmDel, setConfirmDel] = useState(null); // transaction pending delete
  const [delBusy, setDelBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null); // non-null → preview modal open
  const [emailTo, setEmailTo] = useState(null);
  const [busy, setBusy] = useState(false);

  const isToday = date === todayISO();

  const load = useCallback(
    async (isRefresh = false) => {
      if (!ready || !workspace) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true); else setLoading(true);
      try {
        if (mode === 'day') {
          const data = await getTransactions(workspace.id, { date });
          setState({ summary: data.summary, transactions: data.transactions ?? [] });

          // Opening Balance Rule: viewing a day that was never opened prompts to open it.
          if (!data.summary && isToday) {
            const todayInfo = await getTodaySummary(workspace.id);
            if (todayInfo.needs_opening_balance) {
              setOpenDay({ visible: true, previous: todayInfo.previous_closing_balance });
            }
          }
        } else if (mode === 'journal') {
          const [tx, report] = await Promise.all([
            getTransactions(workspace.id, range),
            getReport(workspace.id, range),
          ]);
          const list = [...(tx.transactions ?? [])].sort(
            (a, b) =>
              datePart(a.business_date).localeCompare(datePart(b.business_date)) ||
              String(a.created_at).localeCompare(String(b.created_at))
          );
          setJournal(list);
          // Opening = first opened day, closing = last opened day of the range.
          const days = [...(report.days ?? [])].sort((a, b) =>
            datePart(a.business_date).localeCompare(datePart(b.business_date))
          );
          setJMeta({
            opening: days.length ? Number(days[0].opening_balance) : null,
            closing: days.length ? Number(days[days.length - 1].closing_balance) : null,
          });
        } else {
          const [tx, report] = await Promise.all([
            getTransactions(workspace.id, range),
            getReport(workspace.id, range),
          ]);
          const byDay = new Map();
          for (const t of tx.transactions ?? []) {
            const key = datePart(t.business_date);
            if (!byDay.has(key)) byDay.set(key, []);
            byDay.get(key).push(t);
          }
          const summaries = new Map(
            (report.days ?? []).map((d) => [datePart(d.business_date), d])
          );
          const keys = [...new Set([...byDay.keys(), ...summaries.keys()])].sort().reverse();
          setSections(
            keys.map((key) => ({
              date: key,
              summary: summaries.get(key) ?? null,
              transactions: byDay.get(key) ?? [],
            }))
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workspace, date, isToday, mode, range, ready]
  );

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  const onDelete = async () => {
    const item = confirmDel;
    if (!item) return;
    setDelBusy(true);
    try {
      const res = await deleteTransaction(workspace.id, item.id);
      setConfirmDel(null);
      if (res?.approval_request) {
        Toast.show({ type: 'info', text1: 'Sent for admin approval' });
      } else {
        Toast.show({ type: 'success', text1: 'Moved to trash' });
        load(true).catch(() => {});
      }
    } catch {
      // interceptor toasted
    } finally {
      setDelBusy(false);
    }
  };

  const editRow = (item) =>
    router.push({
      pathname: '/log',
      params: {
        id: item.id,
        type: item.type,
        amount: String(item.amount),
        description: item.description ?? '',
        category: item.category ?? '',
        received_from: item.received_from ?? '',
        paid_to: item.paid_to ?? '',
        hasProof: item.proof_file_path ? '1' : '0',
      },
    });

  // Row actions: view (bottom sheet + proof), edit, delete (confirm first).
  const rowActions = (item) => (
    <View style={styles.actions}>
      <Pressable hitSlop={8} onPress={() => setViewing(item)} style={styles.iconBtn}>
        <SymbolView name={{ ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor={t.colors.textMuted} size={20} />
      </Pressable>
      <Pressable hitSlop={8} onPress={() => editRow(item)} style={styles.iconBtn}>
        <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor={t.colors.primary} size={20} />
      </Pressable>
      <Pressable hitSlop={8} onPress={() => setConfirmDel(item)} style={styles.iconBtn}>
        <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor={t.colors.danger} size={20} />
      </Pressable>
    </View>
  );

  const doExport = async (kind) => {
    setExportOpen(false);
    if (kind === 'email') return setEmailTo('');
    await new Promise((r) => setTimeout(r, 350)); // let the sheet unmount first
    const aoa = [
      ['Date', 'Description', 'Category', 'Type', `Amount (${currencySymbol()})`, 'Recorded by'],
      ...sections.flatMap((s) =>
        s.transactions.map((t) => [
          prettyDate(s.date), txLabel(t), t.category ?? '', t.type,
          Number(t.amount), t.created_by_name ?? '',
        ])
      ),
    ];
    const base = `audit-${workspace.name}-${range.from}-to-${range.to}`.replace(/\s+/g, '-');
    setBusy(true);
    try {
      if (kind === 'csv') await shareCSV(`${base}.csv`, aoa[0], aoa.slice(1));
      else if (kind === 'xlsx') await shareXLSX(`${base}.xlsx`, 'Audit Book', aoa);
      else if (kind === 'pdf' || kind === 'preview') {
        const [rpt] = await Promise.all([getReport(workspace.id, range)]);
        const payload = {
          title: `${workspace.name} — Audit Book`,
          subtitle: `${prettyDate(range.from)} → ${prettyDate(range.to)}`,
          totals: rpt.totals,
          transactions: sections.flatMap((s) => s.transactions),
        };
        if (kind === 'pdf') await shareReportPDF(`${base}.pdf`, payload);
        else setPreviewHtml(reportHtml(payload));
      } else if (kind === 'whatsapp') {
        const rpt = await getReport(workspace.id, range);
        await shareTextWhatsApp(
          reportAsText({ workspace: workspace.name, range, totals: rpt.totals, days: rpt.days })
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

  const dayTotals = useMemo(() => {
    const received = state.transactions
      .filter((t) => t.type === 'income')
      .reduce((a, t) => a + Number(t.amount), 0);
    const paid = state.transactions
      .filter((t) => t.type === 'expense')
      .reduce((a, t) => a + Number(t.amount), 0);
    return { received, paid };
  }, [state.transactions]);

  if (!ready || (loading && state.transactions.length === 0 && sections.length === 0)) {
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

  const s = state.summary;
  // Journal columns mirror the app: Debit = received, Credit = paid.
  const journalDebit = journal
    .filter((x) => x.type === 'income')
    .reduce((n, x) => n + Number(x.amount || 0), 0);
  const journalCredit = journal
    .filter((x) => x.type === 'expense')
    .reduce((n, x) => n + Number(x.amount || 0), 0);
  // Cash-book balancing: opening sits on the debit side (b/d), closing on the
  // credit side (c/d) — negative balances flip side so columns still equal.
  const jOpen = jMeta.opening ?? 0;
  const jClose = jMeta.closing ?? 0;
  const jDrTotal = journalDebit + Math.max(0, jOpen) + Math.max(0, -jClose);
  const jCrTotal = journalCredit + Math.max(0, jClose) + Math.max(0, -jOpen);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Audit Book</Text>
          <Text style={styles.subtitle}>{workspace.name} · your role: {workspace.role}</Text>
        </View>
        {mode !== 'day' && (
          <Pressable style={styles.exportBtn} onPress={() => setExportOpen(true)} disabled={busy}>
            <Text style={styles.exportBtnText}>{busy ? '…' : 'Export'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.modeRow}>
        {[
          { key: 'day', label: 'By day' },
          { key: 'range', label: 'By range' },
          { key: 'journal', label: 'Journal' },
        ].map((m) => (
          <Pressable
            key={m.key}
            style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
            onPress={() => setMode(m.key)}>
            <Text style={mode === m.key ? styles.modeTextActive : styles.modeText}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'day' ? (
        <>
          <View style={styles.dateNav}>
            <Pressable onPress={() => setDate((d) => shiftDay(d, -1))} hitSlop={12} style={styles.navArrow}>
              <Text style={styles.navArrowText}>‹</Text>
            </Pressable>
            <Pressable onPress={() => setDate(todayISO())}>
              <Text style={styles.dateLabel}>{prettyDate(date)}</Text>
              {!isToday && <Text style={styles.backToday}>tap for today</Text>}
            </Pressable>
            <Pressable onPress={() => setDate((d) => shiftDay(d, 1))} hitSlop={12} style={styles.navArrow}>
              <Text style={styles.navArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.summaryBar}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Opening</Text>
              <Text style={styles.statValue}>{s ? fmtMoney(s.opening_balance) : '—'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: '#16A34A' }]}>Received</Text>
              <Text style={[styles.statValue, { color: '#16A34A' }]}>+{fmtMoney(dayTotals.received)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: t.colors.danger }]}>Paid</Text>
              <Text style={[styles.statValue, { color: t.colors.danger }]}>−{fmtMoney(dayTotals.paid)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Closing</Text>
              <Text style={styles.statValue}>{s ? fmtMoney(s.closing_balance) : '—'}</Text>
            </View>
          </View>

          <FlatList
            data={state.transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.rowWrap}>
                <View style={styles.rowMain}>
                  <TransactionRow item={item} />
                </View>
                {rowActions(item)}
              </View>
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true).catch(() => {})} />}
            ListEmptyComponent={
              <Text style={styles.emptyList}>
                {s ? 'No entries this day.' : 'Day not opened yet.'}
              </Text>
            }
            contentContainerStyle={styles.listContent}
          />

          <OpenDayModal
            visible={openDay.visible}
            workspaceId={workspace.id}
            previousClosing={openDay.previous}
            onOpened={(summary) => {
              setOpenDay({ visible: false, previous: null });
              setState((st) => ({ ...st, summary }));
            }}
            onClose={() => setOpenDay({ visible: false, previous: null })}
          />
        </>
      ) : mode === 'journal' ? (
        <FlatList
          data={journal}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              <View style={styles.rangeBox}>
                <DateRangePicker value={range} onChange={setRange} />
              </View>
              <View style={styles.jHead}>
                <Text style={[styles.jCell, styles.jDate, styles.jHeadText]}>Date</Text>
                <Text style={[styles.jCell, styles.jPart, styles.jHeadText]}>Particulars</Text>
                <Text style={[styles.jCell, styles.jDesc, styles.jHeadText]}>Description</Text>
                <Text style={[styles.jCell, styles.jAmt, styles.jHeadText, { color: '#16A34A' }]}>
                  Debit ({currencySymbol()})
                </Text>
                <Text style={[styles.jCell, styles.jAmt, styles.jHeadText, { color: t.colors.danger }]}>
                  Credit ({currencySymbol()})
                </Text>
              </View>
              {jMeta.opening !== null && (
                <View style={[styles.jRow, styles.jBalanceRow]}>
                  <Text style={[styles.jCell, styles.jDate]}>{prettyDate(range.from)}</Text>
                  <Text style={[styles.jCell, styles.jPart, styles.jBalanceText]}>Opening balance b/d</Text>
                  <Text style={[styles.jCell, styles.jDesc]} />
                  <View style={[styles.jCell, styles.jAmt]}>
                    {jOpen >= 0 && <Text style={styles.jBalanceAmt} numberOfLines={1}>{fmtNumber(jOpen)}</Text>}
                  </View>
                  <View style={[styles.jCell, styles.jAmt]}>
                    {jOpen < 0 && <Text style={styles.jBalanceAmt} numberOfLines={1}>{fmtNumber(-jOpen)}</Text>}
                  </View>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => {
            const income = item.type === 'income';
            const acct = (item.category ?? '').trim() || (income ? 'Income' : 'Expense');
            return (
              <View style={styles.jRow}>
                <Text style={[styles.jCell, styles.jDate]}>{prettyDate(datePart(item.business_date))}</Text>
                <View style={[styles.jCell, styles.jPart]}>
                  <Text style={[styles.jLine, income && styles.jDrLine]}>
                    {income ? 'Cash A/c' : `${acct} A/c`} <Text style={styles.jDr}>Dr.</Text>
                  </Text>
                  <Text style={[styles.jLine, styles.jCr, !income && styles.jCrLine]}>
                    {income ? `To ${acct} A/c` : 'To Cash A/c'}
                  </Text>
                </View>
                <Text style={[styles.jCell, styles.jDesc]} numberOfLines={3}>{txLabel(item)}</Text>
                <View style={[styles.jCell, styles.jAmt]}>
                  {income && (
                    <Text style={[styles.jLine, styles.jAmtIn]} numberOfLines={1}>{fmtNumber(item.amount)}</Text>
                  )}
                </View>
                <View style={[styles.jCell, styles.jAmt]}>
                  {!income && (
                    <Text style={[styles.jLine, styles.jAmtOut]} numberOfLines={1}>{fmtNumber(item.amount)}</Text>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            journal.length > 0 || jMeta.closing !== null ? (
              <>
                {jMeta.closing !== null && (
                  <View style={[styles.jRow, styles.jBalanceRow]}>
                    <Text style={[styles.jCell, styles.jDate]}>{prettyDate(range.to)}</Text>
                    <Text style={[styles.jCell, styles.jPart, styles.jBalanceText]}>Closing balance c/d</Text>
                    <Text style={[styles.jCell, styles.jDesc]} />
                    <View style={[styles.jCell, styles.jAmt]}>
                      {jClose < 0 && <Text style={styles.jBalanceAmt} numberOfLines={1}>{fmtNumber(-jClose)}</Text>}
                    </View>
                    <View style={[styles.jCell, styles.jAmt]}>
                      {jClose >= 0 && <Text style={styles.jBalanceAmt} numberOfLines={1}>{fmtNumber(jClose)}</Text>}
                    </View>
                  </View>
                )}
                <View style={[styles.jRow, styles.jTotalRow]}>
                  <Text style={[styles.jCell, styles.jDate]} />
                  <Text style={[styles.jCell, styles.jPart, styles.jTotalText]}>TOTAL</Text>
                  <Text style={[styles.jCell, styles.jDesc]} />
                  <Text style={[styles.jCell, styles.jAmt, styles.jTotalText, { color: '#16A34A' }]} numberOfLines={1}>
                    {fmtNumber(jDrTotal)}
                  </Text>
                  <Text style={[styles.jCell, styles.jAmt, styles.jTotalText, { color: t.colors.danger }]} numberOfLines={1}>
                    {fmtNumber(jCrTotal)}
                  </Text>
                </View>
                <View style={styles.jRow}>
                  <Text style={[styles.jCell, styles.jDate]} />
                  <Text style={[styles.jCell, styles.jPart, styles.jTotalText]}>NET</Text>
                  <Text style={[styles.jCell, styles.jDesc]} />
                  <Text
                    style={[
                      styles.jCell, styles.jAmt, styles.jTotalText,
                      { color: journalDebit - journalCredit >= 0 ? '#16A34A' : t.colors.danger },
                    ]}
                    numberOfLines={1}>
                    {fmtNumber(journalDebit - journalCredit)}
                  </Text>
                  <Text style={[styles.jCell, styles.jAmt]} />
                </View>
              </>
            ) : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true).catch(() => {})} />}
          ListEmptyComponent={
            <Text style={styles.emptyList}>No entries in this range.</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.date}
          ListHeaderComponent={
            <View style={styles.rangeBox}>
              <DateRangePicker value={range} onChange={setRange} />
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{prettyDate(item.date)}</Text>
                <Text style={styles.dayMeta}>
                  {item.summary
                    ? `Opening ${fmtMoney(item.summary.opening_balance)} · Closing ${fmtMoney(item.summary.closing_balance)}`
                    : 'No summary'}
                </Text>
              </View>
              {item.transactions.map((t) => (
                <View key={t.id} style={styles.rowWrap}>
                  <View style={styles.rowMain}>
                    <TransactionRow item={t} />
                  </View>
                  {rowActions(t)}
                </View>
              ))}
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true).catch(() => {})} />}
          ListEmptyComponent={
            <Text style={styles.emptyList}>No entries in this range.</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <TransactionViewModal
        visible={!!viewing}
        item={viewing}
        workspaceId={workspace.id}
        onClose={() => setViewing(null)}
        onEdit={editRow}
      />

      <ConfirmModal
        visible={!!confirmDel}
        title="Delete this entry?"
        message={`"${confirmDel?.description ?? confirmDel?.category ?? 'Entry'}" will move to the trash bin and auto-delete after 30 days.${workspace.role === 'admin' ? '' : ' Your delete will first need admin approval.'}`}
        confirmLabel="Delete"
        busy={delBusy}
        onConfirm={onDelete}
        onCancel={() => setConfirmDel(null)}
      />

      <ExportMenu
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        onPick={doExport}
        showEmail={workspace.role === 'admin'}
      />

      <ReportPreviewModal
        visible={previewHtml !== null}
        html={previewHtml ?? ''}
        onClose={() => setPreviewHtml(null)}
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
  center: { flex: 1 },
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing(1), paddingRight: t.spacing(2) },
  iconBtn: { padding: t.spacing(1) },
  subtitle: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  modeRow: {
    flexDirection: 'row',
    gap: t.spacing(2),
    paddingHorizontal: t.spacing(4),
    paddingTop: t.spacing(3),
  },
  modeChip: {
    paddingHorizontal: t.spacing(3),
    paddingVertical: t.spacing(2),
    borderRadius: t.radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  modeChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  modeText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted },
  modeTextActive: { fontSize: 12, fontWeight: '600', color: '#fff' },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing(4),
    paddingTop: t.spacing(2),
  },
  navArrow: { padding: t.spacing(2) },
  navArrowText: { fontSize: 24, color: t.colors.primary, fontWeight: '700' },
  dateLabel: { fontSize: 16, fontWeight: '700', color: t.colors.text, textAlign: 'center' },
  backToday: { fontSize: 11, color: t.colors.textMuted, textAlign: 'center' },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: t.spacing(3),
    margin: t.spacing(4),
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
  },
  summaryText: { fontSize: 12, fontWeight: '700', color: t.colors.text },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', color: t.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 12, fontWeight: '700', color: t.colors.text, marginTop: 2 },
  rangeBox: { padding: t.spacing(4) },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: t.spacing(4),
    paddingVertical: t.spacing(2),
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  dayTitle: { fontSize: 13, fontWeight: '700', color: t.colors.text },
  dayMeta: { fontSize: 11, color: t.colors.textMuted },
  // Journal (double-entry) styles
  jHead: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: t.colors.border,
    paddingVertical: t.spacing(2),
    paddingHorizontal: t.spacing(4),
  },
  jHeadText: { fontSize: 11, fontWeight: '700', color: t.colors.textMuted, textTransform: 'uppercase' },
  jRow: {
    flexDirection: 'row',
    paddingVertical: t.spacing(2),
    paddingHorizontal: t.spacing(4),
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  jCell: { paddingRight: t.spacing(2) },
  jDate: { width: 86 },
  jPart: { flex: 1 },
  jDesc: { flex: 0.9, fontSize: 11, color: t.colors.textMuted },
  jAmt: { width: 100, alignItems: 'center', textAlign: 'center' },
  jLine: { fontSize: 12, color: t.colors.text, lineHeight: 17 },
  jDr: { fontWeight: '700', color: t.colors.textMuted, fontSize: 10 },
  jDrLine: { color: '#16A34A' },
  jCr: { paddingLeft: t.spacing(4), color: t.colors.textMuted },
  jCrLine: { color: t.colors.danger },
  jAmtIn: { color: '#16A34A', fontWeight: '700' },
  jAmtOut: { color: t.colors.danger, fontWeight: '700' },
  jTotalRow: { borderTopWidth: 2, borderTopColor: t.colors.border, backgroundColor: t.colors.surface },
  jTotalText: { fontSize: 12, fontWeight: '800', color: t.colors.text, lineHeight: 17 },
  jBalanceRow: { backgroundColor: t.colors.surface },
  jBalanceText: { fontSize: 12, fontWeight: '700', fontStyle: 'italic', color: t.colors.textMuted, lineHeight: 17 },
  jBalanceAmt: { fontSize: 12, fontWeight: '700', color: t.colors.text, lineHeight: 17 },
  listContent: { paddingBottom: t.spacing(24) },
  rowWrap: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  modalCard: { alignSelf: 'stretch', backgroundColor: t.colors.background, borderRadius: t.radius.lg, padding: t.spacing(5) },
  modalTitle: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(3) },
  input: { borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, padding: t.spacing(3), fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: t.spacing(4), marginTop: t.spacing(5) },
  linkBtn: { paddingVertical: t.spacing(2) },
  link: { color: t.colors.primary, fontWeight: '600' },
  sendBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3), minWidth: 96, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  emptyList: { textAlign: 'center', color: t.colors.textMuted, padding: t.spacing(8) },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: t.colors.textMuted, marginBottom: t.spacing(4) },
  cta: { backgroundColor: t.colors.primary, paddingHorizontal: t.spacing(6), paddingVertical: t.spacing(3), borderRadius: t.radius.md },
  ctaText: { color: '#fff', fontWeight: '700' },
});
