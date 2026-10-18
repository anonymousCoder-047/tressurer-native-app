import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { listWorkspaces } from '@/services/workspace';

// Screen gate: keeps the selected workspace in sync and auto-selects when the
// user has exactly one. Returns { workspace, ready, refresh } — `ready` is
// false while the initial list fetch is in flight; screens render a picker CTA
// when ready && !workspace.
export function useWorkspace() {
  const workspace = useAuthStore((s) => s.workspace);
  const setWorkspace = useAuthStore((s) => s.setWorkspace);
  const token = useAuthStore((s) => s.token);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    // No session — the layout's auth guard is already routing to /login.
    // Don't fire an unauthenticated request (it only produces a 401 toast).
    if (!token) {
      setReady(true);
      return [];
    }
    // null = the fetch itself failed — don't disturb the current selection.
    const list = await listWorkspaces().catch(() => null);
    if (list) {
      if (!workspace && list.length === 1) {
        await setWorkspace(list[0]);
      } else if (workspace && !list.some((w) => w.id === workspace.id)) {
        // Selected workspace was deleted or access was revoked.
        await setWorkspace(list[0] ?? null);
      }
    }
    setReady(true);
    return list ?? [];
  }, [workspace, setWorkspace, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async store refresh, not a sync setState
    refresh();
  }, [refresh]);

  return { workspace, ready, refresh };
}
