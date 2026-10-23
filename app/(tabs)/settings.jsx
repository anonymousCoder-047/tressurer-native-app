import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import DateField from '@/components/DateField';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore, CURRENCIES, currencyMeta } from '@/store/useSettingsStore';
import { updateProfile } from '@/services/auth';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  addMember,
  approveRequest,
  deleteWorkspace,
  getDaySummary,
  listApprovals,
  listMembers,
  rejectRequest,
  removeMember,
  renameWorkspace,
  updateSummary,
  wipeWorkspaceData,
} from '@/services/workspace';
import { useTheme } from '@/hooks/useTheme';
import { avatarUri } from '@/constants/config';
import { fmtMoney, prettyDate, todayISO } from '@/utils/format';

const describeApproval = (a) => {
  if (a.action === 'delete') {
    const old = a.old_values ?? {};
    return `Delete "${old.description ?? old.category ?? 'entry'}" (${fmtMoney(old.amount)})`;
  }
  const changes = Object.entries(a.new_values ?? {})
    .map(([k, v]) => `${k} → ${k === 'amount' ? fmtMoney(v) : v}`)
    .join(', ');
  return `Edit: ${changes || 'no changes'}`;
};

export default function SettingsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setWorkspace = useAuthStore((s) => s.setWorkspace);
  const signOut = useAuthStore((s) => s.signOut);
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const customCurrencies = useSettingsStore((s) => s.custom);
  const addCurrency = useSettingsStore((s) => s.addCurrency);
  const { workspace, ready } = useWorkspace();

  const isAdmin = workspace?.role === 'admin';
  const [members, setMembers] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [addCur, setAddCur] = useState(false);
  const [curName, setCurName] = useState('');
  const [curSymbol, setCurSymbol] = useState('');
  const [confirmMember, setConfirmMember] = useState(null); // member pending removal
  const [busyKey, setBusyKey] = useState(null);
  const [renameWs, setRenameWs] = useState(false);
  const [wsName, setWsName] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);
  // Daily balances (admin): pick a date, view/edit its opening & closing.
  const [balanceDate, setBalanceDate] = useState(todayISO());
  const [daySummary, setDaySummary] = useState(null);
  const [editBalances, setEditBalances] = useState(false);
  const [editOpening, setEditOpening] = useState('');
  const [editClosing, setEditClosing] = useState('');

  const load = useCallback(async () => {
    if (!ready || !workspace) return;
    try {
      setMembers(await listMembers(workspace.id));
      if (isAdmin) setApprovals(await listApprovals(workspace.id, 'pending'));
    } catch {
      // interceptor toasted
    }
  }, [workspace, isAdmin, ready]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!workspace || !isAdmin) return;
    let alive = true;
    getDaySummary(workspace.id, balanceDate)
      .then((s) => alive && setDaySummary(s))
      .catch(() => alive && setDaySummary(null));
    return () => {
      alive = false;
    };
  }, [workspace, isAdmin, balanceDate]);

  const act = async (key, fn, toast) => {
    setBusyKey(key);
    try {
      await fn();
      if (toast) Toast.show({ type: 'success', text1: toast });
      await load();
    } catch {
      // interceptor toasted
    } finally {
      setBusyKey(null);
    }
  };

  const onInvite = () =>
    act('invite', async () => {
      await addMember(workspace.id, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
    }, 'Member added');

  const onRenameWorkspace = () =>
    act('renameWs', async () => {
      const updated = await renameWorkspace(workspace.id, wsName.trim());
      await setWorkspace(updated);
      setRenameWs(false);
    }, 'Workspace renamed');

  const onWipeData = () =>
    act('wipe', async () => {
      const { deleted } = await wipeWorkspaceData(workspace.id);
      setConfirmWipe(false);
      setDaySummary(null);
      Toast.show({ type: 'success', text1: `All data deleted (${deleted?.transactions ?? 0} entries)` });
    });

  const onDeleteWorkspace = () =>
    act('deleteWs', async () => {
      await deleteWorkspace(workspace.id);
      setConfirmDelete(false);
      await setWorkspace(null);
      Toast.show({ type: 'success', text1: 'Workspace deleted' });
      router.replace('/workspaces');
    });

  const onSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const onSaveProfile = () =>
    act('profile', async () => {
      const updated = await updateProfile(profileName.trim());
      await setUser(updated);
      setEditProfile(false);
    }, 'Profile updated');

  // Only changed fields go to the server — an untouched prefill isn't an edit.
  const onSaveBalances = () => {
    const patch = {};
    const o = editOpening.trim();
    const c = editClosing.trim();
    if (o !== '' && Number(o) !== Number(daySummary.opening_balance)) patch.opening_balance = Number(o);
    if (c !== '' && Number(c) !== Number(daySummary.closing_balance)) patch.closing_balance = Number(c);
    if (!Object.keys(patch).length) return setEditBalances(false);
    if ([patch.opening_balance, patch.closing_balance].some((v) => v != null && (!isFinite(v) || v < 0))) {
      return Toast.show({ type: 'error', text1: 'Balances must be non-negative numbers' });
    }
    act('balances', async () => {
      setDaySummary(await updateSummary(workspace.id, balanceDate, patch));
      setEditBalances(false);
    }, 'Balances updated');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ---- Profile ---- */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          {avatarUri(user?.avatar_url) ? (
            <Image source={{ uri: avatarUri(user.avatar_url) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{(user?.name ?? '?')[0]}</Text>
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.name ?? 'Unknown user'}</Text>
            <Text style={styles.muted}>{user?.email}</Text>
          </View>
        </View>
        <View style={styles.memberActions}>
          <Pressable
            style={styles.linkBtn}
            onPress={() => {
              setProfileName(user?.name ?? '');
              setEditProfile(true);
            }}>
            <Text style={styles.link}>Edit profile</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={onSignOut}>
            <Text style={styles.linkDanger}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {/* ---- Preferences ---- */}
      <Text style={styles.section}>Preferences</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>Currency</Text>
          <Pressable onPress={() => setAddCur(true)}>
            <Text style={styles.link}>+ Add currency</Text>
          </Pressable>
        </View>
        <View style={styles.currencyRow}>
          {Object.entries({ ...CURRENCIES, ...customCurrencies }).map(([code]) => {
            const meta = currencyMeta(code, customCurrencies);
            return (
              <Pressable
                key={code}
                style={[styles.roleChoice, currency === code && styles.roleChoiceActive]}
                onPress={() => setCurrency(code)}>
                <Text style={currency === code ? styles.roleChoiceTextActive : styles.roleChoiceText}>
                  {meta.symbol.trim()} {code}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.muted, { marginTop: t.spacing(4) }]}>Theme</Text>
        <View style={styles.currencyRow}>
          {[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.roleChoice, themeMode === value && styles.roleChoiceActive]}
              onPress={() => setThemeMode(value)}>
              <Text style={themeMode === value ? styles.roleChoiceTextActive : styles.roleChoiceText}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ---- Workspace ---- */}
      <Text style={styles.section}>Workspace</Text>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.name}>{workspace?.name ?? 'None selected'}</Text>
            {workspace && <Text style={styles.muted}>Your role: {workspace.role}</Text>}
          </View>
          <View style={styles.memberActions}>
            {isAdmin && (
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setWsName(workspace?.name ?? '');
                  setRenameWs(true);
                }}>
                <Text style={styles.link}>Rename</Text>
              </Pressable>
            )}
            <Pressable style={styles.linkBtn} onPress={() => router.push('/workspaces')}>
              <Text style={styles.link}>{workspace ? 'Manage' : 'Choose'}</Text>
            </Pressable>
          </View>
        </View>
        {isAdmin && (
          <View style={styles.workspaceLinks}>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/trash')}>
              <Text style={styles.link}>Trash bin</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/email')}>
              <Text style={styles.link}>Email (SMTP)</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => router.push('/audit-log')}>
              <Text style={styles.link}>Audit log</Text>
            </Pressable>
          </View>
        )}
      </View>

      {workspace && (
        <>
          {/* ---- Daily balances (admin) ---- */}
          {isAdmin && (
            <>
              <Text style={styles.section}>Daily balances</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Day</Text>
                <DateField value={balanceDate} onChange={setBalanceDate} />
                {daySummary ? (
                  <>
                    <View style={styles.balanceRow}>
                      <Text style={styles.muted}>Opening balance</Text>
                      <Text style={styles.balanceValue}>{fmtMoney(daySummary.opening_balance)}</Text>
                    </View>
                    <View style={styles.balanceRow}>
                      <Text style={styles.muted}>Closing balance</Text>
                      <Text style={styles.balanceValue}>{fmtMoney(daySummary.closing_balance)}</Text>
                    </View>
                    <Pressable
                      style={styles.linkBtn}
                      onPress={() => {
                        setEditOpening(String(daySummary.opening_balance ?? ''));
                        setEditClosing(String(daySummary.closing_balance ?? ''));
                        setEditBalances(true);
                      }}>
                      <Text style={styles.link}>Edit balances</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={[styles.muted, { marginTop: t.spacing(3) }]}>
                    This day isn&rsquo;t opened yet — log its first entry to record a balance.
                  </Text>
                )}
              </View>
            </>
          )}

          {/* ---- Members ---- */}
          <Text style={styles.section}>Members</Text>
          <View style={styles.card}>
            {members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                {avatarUri(m.avatar_url) ? (
                  <Image source={{ uri: avatarUri(m.avatar_url) }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{(m.name ?? '?')[0]}</Text>
                  </View>
                )}
                <View style={styles.profileInfo}>
                  <Text style={styles.name}>{m.name}</Text>
                  <Text style={styles.muted}>{m.email}</Text>
                </View>
                {isAdmin && m.id !== user?.id ? (
                  <View style={styles.memberActions}>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        act(`role-${m.id}`, () =>
                          addMember(workspace.id, m.email, m.role === 'admin' ? 'member' : 'admin')
                        )
                      }>
                      <Text style={styles.link}>{m.role === 'admin' ? 'Make member' : 'Make admin'}</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => setConfirmMember(m)}>
                      <Text style={styles.linkDanger}>Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.roleTag}>{m.role}</Text>
                )}
              </View>
            ))}

            {isAdmin && (
              <View style={styles.inviteBox}>
                <TextInput
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="Invite by email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View style={styles.inviteRow}>
                  {['member', 'admin'].map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.roleChoice, inviteRole === r && styles.roleChoiceActive]}
                      onPress={() => setInviteRole(r)}>
                      <Text style={inviteRole === r ? styles.roleChoiceTextActive : styles.roleChoiceText}>
                        {r}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.inviteBtn} onPress={onInvite} disabled={busyKey === 'invite' || !inviteEmail.trim()}>
                    {busyKey === 'invite' ? <ActivityIndicator color="#fff" /> : <Text style={styles.inviteBtnText}>Invite</Text>}
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* ---- Approvals (admin) ---- */}
          {isAdmin && (
            <>
              <Text style={styles.section}>Pending approvals</Text>
              <View style={styles.card}>
                {approvals.length === 0 && <Text style={styles.muted}>Nothing to review.</Text>}
                {approvals.map((a) => (
                  <View key={a.id} style={styles.approvalRow}>
                    <Text style={styles.approvalText}>{describeApproval(a)}</Text>
                    <Text style={styles.muted}>by {a.requested_by_name ?? a.requested_by_email}</Text>
                    <View style={styles.memberActions}>
                      <Pressable
                        hitSlop={8}
                        onPress={() => act(`ok-${a.id}`, () => approveRequest(workspace.id, a.id), 'Approved')}>
                        <Text style={styles.link}>Approve</Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() => act(`no-${a.id}`, () => rejectRequest(workspace.id, a.id), 'Rejected')}>
                        <Text style={styles.linkDanger}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              {/* ---- Danger zone ---- */}
              <Text style={styles.section}>Danger zone</Text>
              <View style={[styles.card, styles.dangerCard]}>
                <Pressable onPress={() => setConfirmWipe(true)} hitSlop={4}>
                  <Text style={styles.linkDanger}>Delete all data</Text>
                </Pressable>
                <Text style={styles.muted}>Wipes every entry, balance and proof — keeps members.</Text>
                <Pressable style={{ marginTop: t.spacing(4) }} onPress={() => setConfirmDelete(true)}>
                  <Text style={styles.linkDanger}>Delete workspace “{workspace.name}”</Text>
                </Pressable>
                <Text style={styles.muted}>Removes the workspace, its members and everything in it.</Text>
              </View>
            </>
          )}
        </>
      )}

      {/* Add currency modal */}
      <Modal visible={addCur} transparent animationType="fade" onRequestClose={() => setAddCur(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add currency</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={curName}
              onChangeText={setCurName}
              placeholder="e.g. Bangladeshi Taka"
              autoFocus
            />
            <Text style={[styles.label, { marginTop: t.spacing(3) }]}>Symbol</Text>
            <TextInput
              style={styles.input}
              value={curSymbol}
              onChangeText={setCurSymbol}
              placeholder="e.g. ৳"
              maxLength={6}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setAddCur(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                disabled={!curName.trim() || !curSymbol.trim()}
                onPress={async () => {
                  const code = await addCurrency(curName, curSymbol);
                  if (!code) return Toast.show({ type: 'error', text1: 'That currency already exists' });
                  await setCurrency(code);
                  setAddCur(false);
                  setCurName('');
                  setCurSymbol('');
                  Toast.show({ type: 'success', text1: `Currency ${code} added` });
                }}>
                <Text style={styles.saveBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove member confirmation */}
      <Modal visible={!!confirmMember} transparent animationType="fade" onRequestClose={() => setConfirmMember(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Remove {confirmMember?.name}?</Text>
            <Text style={styles.muted}>
              They&rsquo;ll lose access to “{workspace?.name}” immediately. Their past entries stay on record.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setConfirmMember(null)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() =>
                  act(`rm-${confirmMember.id}`, async () => {
                    await removeMember(workspace.id, confirmMember.id);
                    setConfirmMember(null);
                  })
                }>
                <Text style={styles.deleteBtnText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit profile modal */}
      <Modal visible={editProfile} transparent animationType="fade" onRequestClose={() => setEditProfile(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit profile</Text>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Your name"
              autoFocus
            />
            <Text style={styles.muted}>
              Email and photo come from your sign-in provider and can&rsquo;t be changed here.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setEditProfile(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={onSaveProfile}
                disabled={busyKey === 'profile' || !profileName.trim()}>
                {busyKey === 'profile' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit daily balances modal */}
      <Modal visible={editBalances} transparent animationType="fade" onRequestClose={() => setEditBalances(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Balances for {prettyDate(balanceDate)}</Text>
            <Text style={styles.label}>Opening balance</Text>
            <TextInput
              style={styles.input}
              value={editOpening}
              onChangeText={setEditOpening}
              placeholder="0.00"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={[styles.label, { marginTop: t.spacing(3) }]}>Closing balance</Text>
            <TextInput
              style={styles.input}
              value={editClosing}
              onChangeText={setEditClosing}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <Text style={styles.muted}>
              Changing the opening balance recalculates closing from the day&rsquo;s entries.
              A closing edit holds until the next entry changes it.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setEditBalances(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={onSaveBalances}
                disabled={busyKey === 'balances' || (!editOpening.trim() && !editClosing.trim())}>
                {busyKey === 'balances' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename workspace modal */}
      <Modal visible={renameWs} transparent animationType="fade" onRequestClose={() => setRenameWs(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename workspace</Text>
            <Text style={styles.label}>Workspace name</Text>
            <TextInput
              style={styles.input}
              value={wsName}
              onChangeText={setWsName}
              placeholder="Workspace name"
              autoFocus
              maxLength={120}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setRenameWs(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={onRenameWorkspace}
                disabled={busyKey === 'renameWs' || !wsName.trim()}>
                {busyKey === 'renameWs' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wipe-all-data confirmation */}
      <ConfirmModal
        visible={confirmWipe}
        title="Delete all data?"
        message={`Every entry, daily balance, proof file, approval, trash item and audit record in "${workspace?.name}" will be permanently deleted. Members and settings stay. This cannot be undone.`}
        confirmLabel="Delete all data"
        busy={busyKey === 'wipe'}
        onCancel={() => setConfirmWipe(false)}
        onConfirm={onWipeData}
      />

      {/* Delete confirmation modal */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete “{workspace?.name}”?</Text>
            <Text style={styles.muted}>
              This permanently deletes the workspace, all daily summaries, transactions, uploaded
              proofs, and member access. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.linkBtn} onPress={() => setConfirmDelete(false)}>
                <Text style={styles.link}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={onDeleteWorkspace} disabled={busyKey === 'deleteWs'}>
                {busyKey === 'deleteWs' ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteBtnText}>Delete forever</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (t) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.colors.background },
  content: { padding: t.spacing(4), paddingBottom: t.spacing(12) },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: t.spacing(6),
    marginBottom: t.spacing(2),
  },
  card: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(4),
  },
  dangerCard: { borderColor: t.colors.danger },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  memberAvatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '700', fontSize: 20 },
  profileInfo: { flex: 1, marginLeft: t.spacing(3) },
  name: { fontSize: 16, fontWeight: '700', color: t.colors.text },
  muted: { fontSize: 13, color: t.colors.textMuted, marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkBtn: { marginTop: t.spacing(3) },
  link: { color: t.colors.primary, fontWeight: '600' },
  linkDanger: { color: t.colors.danger, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: t.spacing(2), gap: t.spacing(3) },
  memberActions: { flexDirection: 'row', gap: t.spacing(4) },
  roleTag: { fontSize: 12, color: t.colors.textMuted, fontWeight: '600' },
  inviteBox: { borderTopWidth: 1, borderTopColor: t.colors.border, marginTop: t.spacing(3), paddingTop: t.spacing(3) },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    padding: t.spacing(3),
    fontSize: 15,
    backgroundColor: t.colors.background,
  },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing(3), marginTop: t.spacing(3) },
  roleChoice: {
    paddingHorizontal: t.spacing(3),
    paddingVertical: t.spacing(2),
    borderRadius: t.radius.full,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  roleChoiceActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  roleChoiceText: { color: t.colors.textMuted, fontSize: 13, fontWeight: '600' },
  roleChoiceTextActive: { color: '#fff', fontSize: 13, fontWeight: '600' },
  inviteBtn: {
    marginLeft: 'auto',
    backgroundColor: t.colors.primary,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing(5),
    paddingVertical: t.spacing(2),
    minWidth: 72,
    alignItems: 'center',
  },
  inviteBtnText: { color: '#fff', fontWeight: '700' },
  approvalRow: { paddingVertical: t.spacing(2), borderBottomWidth: 1, borderBottomColor: t.colors.border },
  approvalText: { fontSize: 14, color: t.colors.text, fontWeight: '600' },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing(2), marginTop: t.spacing(3) },
  workspaceLinks: { flexDirection: 'row', gap: t.spacing(5), marginTop: t.spacing(2) },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.spacing(2),
  },
  balanceValue: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  label: { fontSize: 13, fontWeight: '600', color: t.colors.textMuted, marginBottom: t.spacing(2) },
  saveBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.md, paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3), minWidth: 96, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center', padding: t.spacing(6) },
  modalCard: { alignSelf: 'stretch', backgroundColor: t.colors.background, borderRadius: t.radius.lg, padding: t.spacing(5) },
  modalTitle: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing(3) },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: t.spacing(4), marginTop: t.spacing(5) },
  deleteBtn: { backgroundColor: t.colors.danger, borderRadius: t.radius.md, paddingHorizontal: t.spacing(5), paddingVertical: t.spacing(3), minWidth: 120, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontWeight: '700' },
});
