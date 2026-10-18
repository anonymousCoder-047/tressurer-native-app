import api from '@/services/api';

// Thin wrappers over the Express backend. All functions return res.data.

// ---- workspaces & members -------------------------------------------------
export const listWorkspaces = () =>
  api.get('/workspaces').then((r) => r.data.workspaces);

export const createWorkspace = (name) =>
  api.post('/workspaces', { name }).then((r) => r.data.workspace);

export const deleteWorkspace = (workspaceId) =>
  api.delete(`/workspaces/${workspaceId}`);

export const listMembers = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/members`).then((r) => r.data.members);

export const addMember = (workspaceId, email, role) =>
  api.post(`/workspaces/${workspaceId}/members`, { email, role }).then((r) => r.data.member);

export const removeMember = (workspaceId, userId) =>
  api.delete(`/workspaces/${workspaceId}/members/${userId}`);

// ---- daily summaries ------------------------------------------------------
export const getTodaySummary = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/summaries/today`).then((r) => r.data);

export const openDay = (workspaceId, openingBalance) =>
  api
    .post(`/workspaces/${workspaceId}/summaries/open`, { opening_balance: openingBalance })
    .then((r) => r.data.summary);

// ---- transactions ---------------------------------------------------------
// params: { date } for one day, or { from, to } for a range.
export const getTransactions = (workspaceId, params) =>
  api.get(`/workspaces/${workspaceId}/transactions`, { params }).then((r) => r.data);

export const getDescriptions = (workspaceId, q) =>
  api
    .get(`/workspaces/${workspaceId}/transactions/descriptions`, { params: { q } })
    .then((r) => r.data.descriptions);

// files: [{ uri, name, type }] from ImagePicker/DocumentPicker — each appended
// as a 'proof' field (≤5 MB each, ≤25 MB total, enforced server-side too).
// files: [{ uri, name, type }] — each appended as a 'proof' field.
// Either {type, amount} or {received, paid} (both >0 → combined entry).
export const createTransaction = (workspaceId, { type, amount, received, paid, category, description, date, files }) => {
  const form = new FormData();
  if (received != null && paid != null) {
    form.append('received', String(received));
    form.append('paid', String(paid));
  } else {
    form.append('type', type);
    form.append('amount', String(amount));
  }
  if (date) form.append('date', date);
  if (category) form.append('category', category);
  if (description) form.append('description', description);
  for (const f of files ?? []) {
    form.append('proof', { uri: f.uri, name: f.name, type: f.type });
  }
  return api
    .post(`/workspaces/${workspaceId}/transactions`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data.transaction);
};

export const updateTransaction = (workspaceId, transactionId, changes) =>
  api.patch(`/workspaces/${workspaceId}/transactions/${transactionId}`, changes).then((r) => r.data);

export const deleteTransaction = (workspaceId, transactionId) =>
  api.delete(`/workspaces/${workspaceId}/transactions/${transactionId}`).then((r) => r.data);

// ---- proofs ---------------------------------------------------------------
export const listProofs = (workspaceId, transactionId) =>
  api.get(`/workspaces/${workspaceId}/files/${transactionId}/proofs`).then((r) => r.data.proofs);

// Admin only — append proof files to an existing entry.
export const addProofs = (workspaceId, transactionId, files) => {
  const form = new FormData();
  for (const f of files ?? []) {
    form.append('proof', { uri: f.uri, name: f.name, type: f.type });
  }
  return api
    .post(`/workspaces/${workspaceId}/transactions/${transactionId}/proofs`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

// Admin only — delete a single proof attachment.
export const deleteProof = (workspaceId, transactionId, proofId) =>
  api.delete(`/workspaces/${workspaceId}/transactions/${transactionId}/proofs/${proofId}`).then((r) => r.data);

// Admin only — workspace audit trail (newest first). params: {from,to,limit}.
export const getAuditLog = (workspaceId, params = {}) =>
  api
    .get(`/workspaces/${workspaceId}/audit-log`, { params: { limit: 200, ...params } })
    .then((r) => r.data.entries);

// ---- approvals (admin) ----------------------------------------------------
export const listApprovals = (workspaceId, status = 'pending') =>
  api
    .get(`/workspaces/${workspaceId}/approvals`, { params: { status } })
    .then((r) => r.data.approvals);

export const approveRequest = (workspaceId, approvalId) =>
  api.post(`/workspaces/${workspaceId}/approvals/${approvalId}/approve`).then((r) => r.data);

export const rejectRequest = (workspaceId, approvalId, reason) =>
  api
    .post(`/workspaces/${workspaceId}/approvals/${approvalId}/reject`, { reason })
    .then((r) => r.data);

// ---- reports --------------------------------------------------------------
export const getReport = (workspaceId, { from, to }) =>
  api.get(`/workspaces/${workspaceId}/reports`, { params: { from, to } }).then((r) => r.data);

// ---- trash bin (admin) ----------------------------------------------------
export const listTrash = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/trash`).then((r) => r.data.trash);

export const restoreTrash = (workspaceId, trashId) =>
  api.post(`/workspaces/${workspaceId}/trash/${trashId}/restore`).then((r) => r.data);

export const purgeTrash = (workspaceId, trashId) =>
  api.delete(`/workspaces/${workspaceId}/trash/${trashId}`).then((r) => r.data);

// ---- email / SMTP (admin) -------------------------------------------------
export const getEmailSettings = (workspaceId) =>
  api.get(`/workspaces/${workspaceId}/email`).then((r) => r.data.settings);

export const saveEmailSettings = (workspaceId, settings) =>
  api.put(`/workspaces/${workspaceId}/email`, settings).then((r) => r.data.settings);

export const testEmailSettings = (workspaceId) =>
  api.post(`/workspaces/${workspaceId}/email/test`).then((r) => r.data);

export const emailReport = (workspaceId, { from, to, recipient }) =>
  api.post(`/workspaces/${workspaceId}/reports/email`, { from, to, recipient }).then((r) => r.data);
