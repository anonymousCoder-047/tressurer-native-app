import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import DateField from '@/components/DateField';
import OpenDayModal from '@/components/OpenDayModal';
import { useWorkspace } from '@/hooks/useWorkspace';
import { addProofs, createTransaction, deleteProof, getDescriptions, getTodaySummary, listProofs, updateTransaction } from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { todayISO } from '@/utils/format';
import ConfirmModal from '@/components/ConfirmModal';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024;    // 5 MB per attachment
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;  // 25 MB across all attachments

// Log Record: new entry or edit (params: id/type/amount/description/category).
// Edits go through PATCH — admins apply inline, members get a pending approval.
export default function LogRecordScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { workspace, ready } = useWorkspace();
  const params = useLocalSearchParams();
  const editingId = params.id ?? null;
  const isAdmin = workspace?.role === 'admin';
  // Existing proofs on the entry (admin edit mode only).
  const [proofs, setProofs] = useState([]);
  const [confirmRmProof, setConfirmRmProof] = useState(null); // proof row pending removal

  // 'checking' → 'open' | 'needs_open'. Only checked for new entries.
  const [dayOpen, setDayOpen] = useState(editingId ? 'open' : 'checking');
  const [openDay, setOpenDay] = useState({ visible: false, previous: null });

  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState(params.description ?? '');
  const [category, setCategory] = useState(params.category ?? '');
  const [received, setReceived] = useState(params.type === 'income' ? params.amount ?? '' : '');
  const [paid, setPaid] = useState(params.type === 'expense' ? params.amount ?? '' : '');
  const [files, setFiles] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const debounce = useRef(null);

  // Admin edit mode: load the entry's existing proof attachments.
  useEffect(() => {
    if (!editingId || !isAdmin || !workspace) return;
    listProofs(workspace.id, editingId)
      .then(setProofs)
      .catch(() => {});
  }, [editingId, isAdmin, workspace]);

  // Opening Balance Rule: a new entry can't be logged until today is opened.
  useEffect(() => {
    if (editingId || !ready || !workspace) return;
    getTodaySummary(workspace.id)
      .then((info) => {
        if (info.needs_opening_balance) {
          setDayOpen('needs_open');
          setOpenDay({ visible: true, previous: info.previous_closing_balance });
        } else {
          setDayOpen('open');
        }
      })
      .catch(() => setDayOpen('open'));
  }, [editingId, ready, workspace]);

  // Autocomplete for repeated descriptions (debounced backend lookup).
  useEffect(() => {
    if (!workspace || description.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale suggestions
      setSuggestions([]);
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        setSuggestions(await getDescriptions(workspace.id, description.trim()));
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [description, workspace]);

  // Appends an attachment after the 5 MB per-file check. `size` comes from
  // ImagePicker.fileSize / DocumentPicker.size; unknown sizes pass through and
  // the server enforces the cap.
  const addFile = ({ uri, name, type, size }) => {
    if (size && size > MAX_FILE_BYTES) {
      return Toast.show({ type: 'error', text1: `"${name}" is over 5 MB — pick a smaller file` });
    }
    setFiles((f) => (f.some((x) => x.uri === uri) ? f : [...f, { uri, name, type, size: size ?? 0 }]));
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!res.canceled) {
      for (const a of res.assets ?? []) {
        addFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg', size: a.fileSize });
      }
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return Toast.show({ type: 'error', text1: 'Camera permission needed to take a photo' });
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      addFile({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg', size: a.fileSize });
    }
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (!res.canceled) {
      for (const a of res.assets ?? []) {
        addFile({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream', size: a.size });
      }
    }
  };

  const submit = async () => {
    const receivedNum = parseFloat(received);
    const paidNum = parseFloat(paid);

    if (!editingId && !DATE_RE.test(date)) {
      return Toast.show({ type: 'error', text1: 'Date must be YYYY-MM-DD' });
    }
    if (!isFinite(receivedNum) && !isFinite(paidNum)) {
      return Toast.show({ type: 'error', text1: 'Enter an amount received or paid' });
    }
    const bothFilled = isFinite(receivedNum) && isFinite(paidNum) && receivedNum > 0 && paidNum > 0;
    if (editingId && bothFilled) {
      // An existing entry is a single ledger row — can't split it via edit.
      return Toast.show({ type: 'error', text1: 'Fill received OR paid, not both, when editing' });
    }

    const type = isFinite(receivedNum) && receivedNum > 0 ? 'income' : 'expense';
    const amount = type === 'income' ? receivedNum : paidNum;

    const totalBytes = files.reduce((n, f) => n + (f.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return Toast.show({ type: 'error', text1: 'Attachments exceed 25 MB total — remove some files' });
    }

    setBusy(true);
    try {
      if (editingId) {
        const res = await updateTransaction(workspace.id, editingId, {
          type, amount, description: description.trim() || null, category: category.trim() || null,
        });
        // Admin-only: newly picked files are appended as proofs.
        if (files.length && isAdmin) {
          await addProofs(workspace.id, editingId, files);
        }
        if (res?.approval_request) {
          Toast.show({ type: 'info', text1: 'Edit sent for admin approval' });
        } else {
          Toast.show({ type: 'success', text1: 'Transaction updated' });
        }
      } else {
        await createTransaction(
          workspace.id,
          bothFilled
            ? {
                received: receivedNum, paid: paidNum,
                description: description.trim() || null,
                category: category.trim() || null,
                date, files,
              }
            : {
                type, amount,
                description: description.trim() || null,
                category: category.trim() || null,
                date, files,
              }
        );
        Toast.show({ type: 'success', text1: bothFilled ? 'Both entries logged' : 'Record logged' });
      }
      router.back();
    } catch (err) {
      if (err?.response?.data?.error === 'OPENING_BALANCE_REQUIRED') {
        Toast.show({ type: 'error', text1: 'Day not opened', text2: 'Open that day in the Audit Book first' });
      }
      // other errors already toasted by the axios interceptor
    } finally {
      setBusy(false);
    }
  };

  if (!ready || dayOpen === 'checking') {
    return <ActivityIndicator style={styles.center} color={t.colors.primary} />;
  }

  if (!workspace) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Create a workspace first</Text>
        <Text style={styles.gateText}>
          Records live inside a workspace — create or choose one before logging an entry.
        </Text>
        <Pressable style={styles.cta} onPress={() => router.push('/workspaces')}>
          <Text style={styles.ctaText}>Create workspace</Text>
        </Pressable>
      </View>
    );
  }

  if (dayOpen === 'needs_open') {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Open today&rsquo;s book</Text>
        <Text style={styles.gateText}>
          Confirm the opening balance before recording today&rsquo;s first entry.
        </Text>
        <Pressable
          style={styles.cta}
          onPress={() => setOpenDay((o) => ({ ...o, visible: true }))}>
          <Text style={styles.ctaText}>Set opening balance</Text>
        </Pressable>
        <OpenDayModal
          visible={openDay.visible}
          workspaceId={workspace.id}
          previousClosing={openDay.previous}
          onOpened={() => {
            setOpenDay({ visible: false, previous: null });
            setDayOpen('open');
          }}
          onClose={() => setOpenDay((o) => ({ ...o, visible: false }))}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Date</Text>
        <DateField value={date} onChange={setDate} disabled={!!editingId} />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Office supplies"
        />
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Pressable key={s} style={styles.suggestion} onPress={() => { setDescription(s); setSuggestions([]); }}>
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Category (optional)</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Supplies"
        />

        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.label}>Amount received</Text>
            <TextInput
              style={[styles.input, styles.received]}
              value={received}
              onChangeText={setReceived}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.label}>Amount paid</Text>
            <TextInput
              style={[styles.input, styles.paid]}
              value={paid}
              onChangeText={setPaid}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </View>
        </View>

        {!editingId && parseFloat(received) > 0 && parseFloat(paid) > 0 && (
          <Text style={styles.hint}>
            Both filled — this logs two entries: received + paid.
          </Text>
        )}

        {(!editingId || isAdmin) && (
          <>
            <Text style={styles.label}>
              {editingId ? `Proofs (${proofs.length} attached)` : 'Proofs (optional)'}
            </Text>
            <Text style={styles.hint}>Images or PDFs · up to 5 MB each, 25 MB total</Text>

            {/* Existing attachments — removable (admin edit only) */}
            {editingId && proofs.length === 0 && params.hasProof === '1' && (
              <View style={styles.fileChip}>
                <Text style={styles.fileName} numberOfLines={1}>Proof attached</Text>
              </View>
            )}
            {proofs.map((p) => (
              <View key={p.id} style={styles.fileChip}>
                <Text style={styles.fileName} numberOfLines={1}>{p.original_name ?? 'Proof'}</Text>
                <Pressable onPress={() => setConfirmRmProof(p)} hitSlop={8}>
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            ))}

            {/* New files — attached on save */}
            {files.map((f) => (
              <View key={f.uri} style={[styles.fileChip, styles.fileChipNew]}>
                <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                <Pressable onPress={() => setFiles((x) => x.filter((y) => y.uri !== f.uri))} hitSlop={8}>
                  <Text style={styles.fileRemove}>✕</Text>
                </Pressable>
              </View>
            ))}

            <View style={styles.attachRow}>
              <Pressable style={styles.attachBtn} onPress={takePhoto}>
                <Text style={styles.attachText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.attachBtn} onPress={pickImage}>
                <Text style={styles.attachText}>Gallery</Text>
              </Pressable>
              <Pressable style={styles.attachBtn} onPress={pickDocument}>
                <Text style={styles.attachText}>Document</Text>
              </Pressable>
            </View>
          </>
        )}

        <Pressable style={[styles.submit, busy && styles.submitDim]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{editingId ? 'Save changes' : 'Log record'}</Text>
          )}
        </Pressable>
      </ScrollView>

      <ConfirmModal
        visible={!!confirmRmProof}
        title="Remove proof?"
        message={`"${confirmRmProof?.original_name ?? 'Proof'}" will be deleted permanently. This can't be undone.`}
        confirmLabel="Remove"
        onCancel={() => setConfirmRmProof(null)}
        onConfirm={async () => {
          const p = confirmRmProof;
          setConfirmRmProof(null);
          try {
            await deleteProof(workspace.id, editingId, p.id);
            setProofs((x) => x.filter((y) => y.id !== p.id));
            Toast.show({ type: 'success', text1: 'Proof removed' });
          } catch {
            // interceptor toasted
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: t.colors.background },
  center: { flex: 1 },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  gateTitle: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(2) },
  gateText: {
    fontSize: 14,
    color: t.colors.textMuted,
    textAlign: 'center',
    marginBottom: t.spacing(6),
    lineHeight: 20,
  },
  cta: {
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing(6),
    paddingVertical: t.spacing(3),
    borderRadius: t.radius.md,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  content: { padding: t.spacing(5), paddingBottom: t.spacing(12) },
  label: { fontSize: 13, fontWeight: '600', color: t.colors.textMuted, marginTop: t.spacing(4), marginBottom: t.spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
    fontSize: 16,
    color: t.colors.text,
    backgroundColor: t.colors.background,
  },
  inputDisabled: { backgroundColor: t.colors.surface, color: t.colors.textMuted },
  suggestions: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    marginTop: t.spacing(1),
    overflow: 'hidden',
  },
  suggestion: { padding: t.spacing(3), borderBottomWidth: 1, borderBottomColor: t.colors.border },
  suggestionText: { color: t.colors.text },
  amountRow: { flexDirection: 'row', gap: t.spacing(3) },
  amountCol: { flex: 1 },
  received: { borderColor: '#16A34A' },
  paid: { borderColor: t.colors.danger },
  attachRow: { flexDirection: 'row', gap: t.spacing(3) },
  attachBtn: {
    borderWidth: 1,
    borderColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing(4),
    paddingVertical: t.spacing(2),
  },
  attachText: { color: t.colors.primary, fontWeight: '600' },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing(3),
    marginTop: t.spacing(3),
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
  },
  fileName: { flex: 1, color: t.colors.text },
  fileRemove: { color: t.colors.danger, fontWeight: '700' },
  fileChipNew: { borderColor: t.colors.primary, borderWidth: 1 },
  removeLink: { color: t.colors.danger, fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 11, color: t.colors.textMuted, marginBottom: t.spacing(2) },
  submit: {
    marginTop: t.spacing(8),
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingVertical: t.spacing(4),
    alignItems: 'center',
  },
  submitDim: { opacity: 0.7 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
