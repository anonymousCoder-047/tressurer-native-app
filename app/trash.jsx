import React, { useMemo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuthStore } from '@/store/useAuthStore';
import { listTrash, purgeTrash, restoreTrash } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { fmtMoney, prettyDate, txLabel } from '@/utils/format';

const daysLeft = (expires) =>
  Math.max(0, Math.ceil((new Date(expires) - Date.now()) / 86400000));

// Admin trash bin: soft-deleted entries restorable for 30 days.
export default function TrashScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const workspace = useAuthStore((s) => s.workspace);
  const [items, setItems] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState(null); // item pending permanent delete
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!workspace) return;
    isRefresh && setRefreshing(true);
    try {
      setItems(await listTrash(workspace.id));
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [workspace]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const restore = async (item) => {
    setBusyKey(item.id);
    try {
      await restoreTrash(workspace.id, item.id);
      Toast.show({ type: 'success', text1: 'Entry restored' });
      load();
    } catch {
      // interceptor toasted
    } finally {
      setBusyKey(null);
    }
  };

  const purge = async () => {
    if (!confirm) return;
    setBusyKey(confirm.id);
    try {
      await purgeTrash(workspace.id, confirm.id);
      Toast.show({ type: 'success', text1: 'Deleted permanently' });
      setConfirm(null);
      load();
    } catch {
      // interceptor toasted
    } finally {
      setBusyKey(null);
    }
  };

  const label = (item) => {
    const p = item.payload ?? {};
    return txLabel(p) || 'Entry';
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListHeaderComponent={
          <Text style={styles.hint}>Deleted entries stay here for 30 days, then they&rsquo;re gone for good.</Text>
        }
        renderItem={({ item }) => {
          const p = item.payload ?? {};
          const income = p.type === 'income';
          return (
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{label(item)}</Text>
                <Text style={styles.meta}>
                  <Text style={{ color: income ? '#16A34A' : t.colors.danger }}>
                    {income ? '+' : '−'}{fmtMoney(p.amount)}
                  </Text>
                  {'  ·  '}{p.business_date ? prettyDate(p.business_date) : '—'}
                  {'  ·  by '}{p.created_by_name ?? '—'}
                </Text>
                <Text style={styles.metaDim}>
                  deleted {prettyDate(item.deleted_at)} by {item.deleted_by_name} · {daysLeft(item.expires_at)}d left
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable hitSlop={8} disabled={busyKey === item.id} onPress={() => restore(item)}>
                  <Text style={styles.link}>Restore</Text>
                </Pressable>
                <Pressable hitSlop={8} disabled={busyKey === item.id} onPress={() => setConfirm(item)}>
                  <Text style={styles.linkDanger}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Text style={styles.empty}>Trash is empty.</Text>
          )
        }
      />

      <ConfirmModal
        visible={!!confirm}
        title="Delete permanently?"
        message={`"${label(confirm ?? {})}" will be removed forever — this can't be undone.`}
        confirmLabel="Delete forever"
        busy={busyKey === confirm?.id}
        onConfirm={purge}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.spacing(5) },
  hint: { fontSize: 13, color: t.colors.textMuted, marginBottom: t.spacing(4) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.spacing(4),
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    marginBottom: t.spacing(3),
    gap: t.spacing(3),
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: t.colors.text },
  meta: { fontSize: 12, color: t.colors.text, marginTop: 3 },
  metaDim: { fontSize: 11, color: t.colors.textMuted, marginTop: 3 },
  actions: { gap: t.spacing(2), alignItems: 'flex-end' },
  link: { color: t.colors.primary, fontWeight: '700', fontSize: 13 },
  linkDanger: { color: t.colors.danger, fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: t.colors.textMuted, marginTop: t.spacing(8) },
});
