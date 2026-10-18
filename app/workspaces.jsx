import React, { useMemo, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/store/useAuthStore';
import { createWorkspace, deleteWorkspace, listWorkspaces } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';

// Workspace management: switch active workspace, create new ones, and delete
// (admin only — deletes everything inside the workspace).
export default function WorkspacesScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const workspace = useAuthStore((s) => s.workspace);
  const setWorkspace = useAuthStore((s) => s.setWorkspace);
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null); // workspace pending delete confirm
  const [deleteBusy, setDeleteBusy] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setList(await listWorkspaces());
    } catch {
      setList([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const choose = async (ws) => {
    await setWorkspace(ws);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const ws = await createWorkspace(name.trim());
      Toast.show({ type: 'success', text1: `Workspace “${ws.name}” created` });
      await choose(ws);
    } catch {
      // interceptor toasted
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteWorkspace(deleting.id);
      Toast.show({ type: 'success', text1: `Workspace “${deleting.name}” deleted` });
      if (workspace?.id === deleting.id) {
        // Active workspace is gone — switch to the next one, if any.
        const remaining = (list ?? []).filter((w) => w.id !== deleting.id);
        await setWorkspace(remaining[0] ?? null);
      }
      setDeleting(null);
      load();
    } catch {
      // interceptor toasted
    } finally {
      setDeleteBusy(false);
    }
  };

  // KAV is iOS-only — on Android the OS resizes the window itself
  // (softwareKeyboardLayoutMode="resize" in app.json).
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={list ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Text style={styles.title}>Manage workspaces</Text>}
        renderItem={({ item }) => (
          <View style={[styles.wsRow, workspace?.id === item.id && styles.wsRowActive]}>
            <Pressable style={styles.wsInfo} onPress={() => choose(item)}>
              <Text style={styles.wsName}>{item.name}</Text>
              <Text style={styles.wsRole}>{item.role}</Text>
            </Pressable>
            {item.role === 'admin' && (
              <Pressable hitSlop={8} onPress={() => setDeleting(item)} style={styles.deleteWrap}>
                <Text style={styles.deleteLink}>Delete</Text>
              </Pressable>
            )}
            {workspace?.id === item.id && <Text style={styles.check}>✓</Text>}
          </View>
        )}
        ListEmptyComponent={
          list === null ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Text style={styles.muted}>No workspaces yet — create one below.</Text>
          )
        }
        // Create form lives inside the list so it can scroll above the
        // keyboard — a fixed bottom box gets covered regardless of the
        // window's soft-input mode.
        ListFooterComponent={
          <View style={styles.createBox}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="New workspace name"
              onFocus={() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150)}
            />
            <Pressable style={styles.createBtn} onPress={create} disabled={busy || !name.trim()}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create workspace</Text>}
            </Pressable>
          </View>
        }
      />

      {/* Delete confirmation */}
      <Modal
        visible={!!deleting}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleting(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete “{deleting?.name}”?</Text>
            <Text style={styles.muted}>
              This permanently deletes the workspace, all daily summaries, transactions, uploaded
              proofs, and member access. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setDeleting(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={remove} disabled={deleteBusy}>
                {deleteBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteBtnText}>Delete forever</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.spacing(5) },
  title: { fontSize: 20, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(4) },
  wsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.spacing(4),
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    marginBottom: t.spacing(3),
    gap: t.spacing(3),
  },
  wsRowActive: { borderColor: t.colors.primary, backgroundColor: t.colors.surface },
  wsInfo: { flex: 1 },
  wsName: { fontSize: 16, fontWeight: '600', color: t.colors.text },
  wsRole: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  deleteWrap: { paddingHorizontal: t.spacing(2), paddingVertical: t.spacing(1) },
  deleteLink: { color: t.colors.danger, fontWeight: '600', fontSize: 13 },
  check: { color: t.colors.primary, fontSize: 18, fontWeight: '700' },
  muted: { color: t.colors.textMuted, textAlign: 'center', marginTop: t.spacing(6) },
  createBox: { padding: t.spacing(5), borderTopWidth: 1, borderTopColor: t.colors.border },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
    fontSize: 15,
    marginBottom: t.spacing(3),
  },
  createBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingVertical: t.spacing(3),
    alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: t.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing(6),
  },
  modalCard: {
    alignSelf: 'stretch',
    backgroundColor: t.colors.background,
    borderRadius: t.radius.lg,
    padding: t.spacing(5),
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(3) },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: t.spacing(4),
    marginTop: t.spacing(5),
  },
  cancelBtn: { paddingVertical: t.spacing(2) },
  cancelText: { color: t.colors.primary, fontWeight: '600' },
  deleteBtn: {
    backgroundColor: t.colors.danger,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing(5),
    paddingVertical: t.spacing(3),
    minWidth: 120,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontWeight: '700' },
});
