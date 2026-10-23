import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '@/store/useAuthStore';
import { API_URL } from '@/constants/config';
import { listProofs } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { fmtMoney, prettyDate } from '@/utils/format';

const IMAGE_RE = /\.(png|jpe?g|gif|webp|heic)$/i;

// Downloads one proof to cache with the Bearer token and renders it — images
// inline, documents as an open-in-viewer button.
function ProofItem({ proof, transactionId, workspaceId, token, styles }) {
  const t = useTheme();
  const [state, setState] = useState({ loading: false, uri: null, opening: false });
  const isImage = IMAGE_RE.test(proof.file_path ?? '') || (proof.mime ?? '').startsWith('image/');
  const url = proof.legacy
    ? `${API_URL}/api/workspaces/${workspaceId}/files/${transactionId}/proof`
    : `${API_URL}/api/workspaces/${workspaceId}/files/${transactionId}/proofs/${proof.id}`;
  const ext = (proof.file_path?.match(/\.[a-z0-9]+$/i) ?? ['.bin'])[0];
  const cacheUri = `${FileSystem.cacheDirectory}proof-${proof.id}${ext}`;

  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks fetch start
    setState((s) => ({ ...s, loading: true }));
    FileSystem.downloadAsync(url, cacheUri, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => alive && setState({ loading: false, uri: res.status === 200 ? res.uri : null }))
      .catch(() => alive && setState({ loading: false, uri: null }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proof.id, isImage]);

  const openDocument = async () => {
    setState((s) => ({ ...s, opening: true }));
    try {
      const res = await FileSystem.downloadAsync(url, cacheUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(res.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: proof.mime ?? (ext === '.pdf' ? 'application/pdf' : '*/*'),
        });
      } else {
        await Sharing.shareAsync(res.uri);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not open proof', text2: err.message });
    } finally {
      setState((s) => ({ ...s, opening: false }));
    }
  };

  if (isImage) {
    if (state.loading) return <ActivityIndicator style={styles.image} color={t.colors.primary} />;
    if (!state.uri) return <Text style={styles.muted}>Could not load {proof.original_name ?? 'proof'}.</Text>;
    return <Image source={{ uri: state.uri }} style={styles.image} resizeMode="contain" />;
  }
  return (
    <Pressable style={styles.docBtn} onPress={openDocument} disabled={state.opening}>
      {state.opening
        ? <ActivityIndicator color={t.colors.primary} />
        : <Text style={styles.docBtnText}>{proof.original_name ?? 'Open document'}</Text>}
    </Pressable>
  );
}

// Read-only view of a transaction, incl. all proof attachments.
export default function TransactionViewModal({ visible, item, workspaceId, onClose, onEdit }) {
  const token = useAuthStore((s) => s.token);
  const [proofs, setProofs] = useState(null); // null = loading
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before refetch
    setProofs(null);
    if (!item?.id || !workspaceId) return;
    let alive = true;
    listProofs(workspaceId, item.id)
      .then((p) => {
        // Entries created before multi-proof support have a proof_file_path
        // but no proof rows — fall back to the legacy single-proof URL.
        if (alive && !p?.length && item.proof_file_path) {
          setProofs([{ id: 'legacy', file_path: item.proof_file_path, mime: null, original_name: 'Proof', legacy: true }]);
        } else if (alive) {
          setProofs(p);
        }
      })
      .catch(() => alive && setProofs([]));
    return () => { alive = false; };
  }, [item?.id, workspaceId]);

  if (!item) return null;
  const income = item.type === 'income';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView>
            <View style={styles.head}>
              <Text style={styles.title}>{item.description || item.category || 'Entry'}</Text>
              <Pressable hitSlop={10} onPress={onClose}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={[styles.amount, { color: income ? '#16A34A' : t.colors.danger }]}>
              {income ? '+' : '−'}{fmtMoney(item.amount)}
            </Text>

            <View style={styles.meta}>
              <Text style={styles.metaRow}><Text style={styles.metaLabel}>Date</Text>  {prettyDate(item.business_date ?? item.created_at)}</Text>
              <Text style={styles.metaRow}><Text style={styles.metaLabel}>Type</Text>  {income ? 'Received' : 'Paid'}</Text>
              {income && !!item.received_from && (
                <Text style={styles.metaRow}><Text style={styles.metaLabel}>Received from</Text>  {item.received_from}</Text>
              )}
              {!income && !!item.paid_to && (
                <Text style={styles.metaRow}><Text style={styles.metaLabel}>Paid to</Text>  {item.paid_to}</Text>
              )}
              {!!item.description && <Text style={styles.metaRow}><Text style={styles.metaLabel}>Description</Text>  {item.description}</Text>}
              {!!item.category && <Text style={styles.metaRow}><Text style={styles.metaLabel}>Category</Text>  {item.category}</Text>}
              {!!item.created_by_name && <Text style={styles.metaRow}><Text style={styles.metaLabel}>By</Text>  {item.created_by_name}</Text>}
            </View>

            {(proofs === null || proofs.length > 0) && (
              <View style={styles.proofBox}>
                <Text style={styles.metaLabel}>Proofs{proofs?.length > 1 ? ` (${proofs.length})` : ''}</Text>
                {proofs === null ? (
                  <ActivityIndicator color={t.colors.primary} />
                ) : (
                  proofs.map((p) => (
                    <ProofItem key={p.id} proof={p} transactionId={item.id} workspaceId={workspaceId} token={token} styles={styles} />
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {onEdit && (
            <Pressable style={styles.editBtn} onPress={() => { onClose(); onEdit(item); }}>
              <Text style={styles.editBtnText}>Edit entry</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.background,
    borderTopLeftRadius: t.radius.lg,
    borderTopRightRadius: t.radius.lg,
    padding: t.spacing(5),
    maxHeight: '85%',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: t.colors.text },
  close: { fontSize: 18, color: t.colors.textMuted, fontWeight: '700', padding: t.spacing(2) },
  amount: { fontSize: 28, fontWeight: '800', marginTop: t.spacing(2) },
  meta: { marginTop: t.spacing(4), gap: t.spacing(2) },
  metaRow: { fontSize: 14, color: t.colors.text },
  metaLabel: { fontSize: 12, fontWeight: '700', color: t.colors.textMuted, textTransform: 'uppercase' },
  muted: { fontSize: 13, color: t.colors.textMuted, textAlign: 'center', padding: t.spacing(4) },
  proofBox: { marginTop: t.spacing(5), gap: t.spacing(3) },
  image: { width: '100%', height: 320, borderRadius: t.radius.md, backgroundColor: t.colors.surface },
  docBtn: {
    borderWidth: 1,
    borderColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingVertical: t.spacing(3),
    alignItems: 'center',
  },
  docBtnText: { color: t.colors.primary, fontWeight: '700' },
  editBtn: {
    marginTop: t.spacing(4),
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingVertical: t.spacing(3),
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontWeight: '700' },
});
