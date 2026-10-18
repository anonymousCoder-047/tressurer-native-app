import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import DateRangePicker from '@/components/DateRangePicker';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getAuditLog } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { monthRange, prettyDate } from '@/utils/format';

// Audit trail timeline (admin only — enforced server-side too). Every row is
// one audit_log entry: who did what, when, on which entity.
const ACTION_META = {
  'transaction.create': { label: 'Created entry', color: '#16A34A' },
  'transaction.update': { label: 'Edited entry', color: 'primary' },
  'transaction.delete': { label: 'Deleted entry', color: 'danger' },
  'transaction.delete_requested': { label: 'Requested entry deletion', color: '#B45309' },
  'transaction.update_requested': { label: 'Requested entry edit', color: '#B45309' },
  'transaction.proof_add': { label: 'Added proof', color: 'primary' },
  'transaction.proof_remove': { label: 'Removed proof', color: 'danger' },
  'approval.approve': { label: 'Approved request', color: '#16A34A' },
  'approval.reject': { label: 'Rejected request', color: 'danger' },
  'summary.open': { label: 'Opened day', color: 'primary' },
  'member.add': { label: 'Added member', color: '#16A34A' },
  'member.remove': { label: 'Removed member', color: 'danger' },
  'email.configure': { label: 'Updated email settings', color: 'muted' },
  'report.email': { label: 'Emailed report', color: 'muted' },
  'trash.restore': { label: 'Restored from trash', color: 'primary' },
  'trash.purge': { label: 'Permanently deleted', color: 'danger' },
  'workspace.create': { label: 'Created workspace', color: '#16A34A' },
  'workspace.delete': { label: 'Deleted workspace', color: 'danger' },
};

const actionLabel = (a) => ACTION_META[a]?.label ?? a.replace(/[._]/g, ' ');
const actionColor = (a, t) => {
  const c = ACTION_META[a]?.color;
  if (c === 'primary') return t.colors.primary;
  if (c === 'danger') return t.colors.danger;
  if (c === 'muted') return t.colors.textMuted;
  return c ?? t.colors.text;
};

const timeOnly = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso) => String(iso).slice(0, 10);

// Picks the interesting bits of details JSON into a compact line.
const detailLine = (e) => {
  const d = e.details ?? {};
  const bits = [];
  if (d.type) bits.push(d.type === 'income' ? 'received' : 'paid');
  if (d.amount != null) bits.push(`₹${d.amount}`);
  if (d.added != null) bits.push(`+${d.added} file${d.added === 1 ? '' : 's'}`);
  if (d.member_email) bits.push(d.member_email);
  if (d.name) bits.push(d.name);
  if (d.field) bits.push(`field: ${d.field}`);
  const tail = e.entity_type && e.entity_type !== 'transaction' ? e.entity_type : null;
  if (tail) bits.push(tail);
  return bits.join(' · ');
};

export default function AuditLogScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { workspace, ready } = useWorkspace();
  const [entries, setEntries] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState(() => monthRange(new Date()));
  const [viewing, setViewing] = useState(null); // entry open in the detail modal

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        setEntries(await getAuditLog(workspace.id, { from: range.from, to: range.to }));
      } finally {
        setRefreshing(false);
      }
    },
    [workspace, range]
  );

  useFocusEffect(
    useCallback(() => {
      if (workspace) load().catch(() => {});
    }, [load, workspace])
  );

  // Mark which rows start a new day header.
  const items = useMemo(
    () =>
      (entries ?? []).map((e, i, arr) => ({
        ...e,
        showDay: i === 0 || dayKey(e.created_at) !== dayKey(arr[i - 1].created_at),
      })),
    [entries]
  );

  if (!workspace) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>No workspace</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.muted}>{workspace.name}</Text>
      </View>
      <View style={styles.rangeBox}>
        <DateRangePicker value={range} onChange={setRange} />
      </View>

      {!ready || entries === null ? (
        <ActivityIndicator style={styles.center} color={t.colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => (
            <View>
              {item.showDay && <Text style={styles.dayHeader}>{prettyDate(dayKey(item.created_at))}</Text>}
              <View style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { borderColor: actionColor(item.action, t) }]} />
                  <View style={styles.line} />
                </View>
                <Pressable style={styles.cardBody} onPress={() => setViewing(item)}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.action, { color: actionColor(item.action, t) }]}>
                      {actionLabel(item.action)}
                    </Text>
                    <Text style={styles.viewLink}>View</Text>
                    <Text style={styles.time}>{timeOnly(item.created_at)}</Text>
                  </View>
                  {!!detailLine(item) && <Text style={styles.details}>{detailLine(item)}</Text>}
                  <Text style={styles.actor}>
                    {item.user_name ?? item.user_email ?? 'System'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true).catch(() => {})} />}
          ListEmptyComponent={<Text style={styles.empty}>No activity in this range.</Text>}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal visible={!!viewing} transparent animationType="slide" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setViewing(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Entry details</Text>
                <Pressable onPress={() => setViewing(null)} hitSlop={8}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>
              {viewing && (
                <>
                  <DetailRow styles={styles} label="Action" value={actionLabel(viewing.action)} />
                  <DetailRow styles={styles} label="By" value={viewing.user_name ?? viewing.user_email ?? 'System'} />
                  <DetailRow
                    styles={styles}
                    label="When"
                    value={`${prettyDate(dayKey(viewing.created_at))} ${timeOnly(viewing.created_at)}`}
                  />
                  {!!viewing.entity_type && (
                    <DetailRow styles={styles} label="Entity" value={viewing.entity_type} />
                  )}
                  {!!viewing.entity_id && (
                    <DetailRow styles={styles} label="Entity ID" value={viewing.entity_id} mono />
                  )}
                  <Text style={styles.detailsHead}>Details</Text>
                  {Object.keys(viewing.details ?? {}).length ? (
                    Object.entries(viewing.details).map(([k, v]) => (
                      <DetailRow
                        key={k}
                        styles={styles}
                        label={k.replace(/_/g, ' ')}
                        value={typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      />
                    ))
                  ) : (
                    <Text style={styles.muted}>No extra details.</Text>
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DetailRow({ styles, label, value, mono }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1 },
    gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.background },
    gateTitle: { fontSize: 17, fontWeight: '600', color: t.colors.textMuted, marginBottom: t.spacing(4) },
    link: { color: t.colors.primary, fontWeight: '600' },
    header: { paddingHorizontal: t.spacing(5), paddingTop: t.spacing(4), paddingBottom: t.spacing(3) },
    title: { fontSize: 22, fontWeight: '800', color: t.colors.text },
    muted: { fontSize: 13, color: t.colors.textMuted, marginTop: 2 },
    rangeBox: { paddingHorizontal: t.spacing(5), paddingBottom: t.spacing(2) },
    viewLink: { fontSize: 12, fontWeight: '700', color: t.colors.primary, marginRight: t.spacing(3) },
    listContent: { paddingHorizontal: t.spacing(5), paddingBottom: t.spacing(10) },
    dayHeader: {
      fontSize: 12,
      fontWeight: '800',
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: t.spacing(4),
      marginBottom: t.spacing(2),
    },
    row: { flexDirection: 'row' },
    rail: { width: 20, alignItems: 'center' },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      backgroundColor: t.colors.background,
      marginTop: 4,
    },
    line: { flex: 1, width: 1, backgroundColor: t.colors.border },
    cardBody: {
      flex: 1,
      marginLeft: t.spacing(3),
      marginBottom: t.spacing(4),
      paddingBottom: t.spacing(3),
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    action: { fontSize: 14, fontWeight: '700', flex: 1, paddingRight: t.spacing(2) },
    time: { fontSize: 11, color: t.colors.textMuted },
    details: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
    actor: { fontSize: 12, fontWeight: '600', color: t.colors.text, marginTop: t.spacing(1) },
    empty: { textAlign: 'center', color: t.colors.textMuted, padding: t.spacing(6) },
    modalBackdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.colors.background,
      borderTopLeftRadius: t.radius.lg,
      borderTopRightRadius: t.radius.lg,
      padding: t.spacing(5),
      maxHeight: '80%',
    },
    sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing(4) },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: t.colors.text },
    close: { fontSize: 18, fontWeight: '700', color: t.colors.textMuted, padding: t.spacing(1) },
    detailRow: { flexDirection: 'row', paddingVertical: t.spacing(1) },
    detailLabel: { width: 90, fontSize: 12, fontWeight: '700', color: t.colors.textMuted, textTransform: 'capitalize' },
    detailValue: { flex: 1, fontSize: 13, color: t.colors.text },
    mono: { fontSize: 11 },
    detailsHead: {
      fontSize: 12,
      fontWeight: '800',
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      marginTop: t.spacing(4),
      marginBottom: t.spacing(1),
    },
  });
