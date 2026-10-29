import { useEffect, useState } from "react";
import { Folder, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ApiError } from "../../services/api";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_SNAPSHOT_CONFIRMATION,
  RESET_ACCOUNT_CONFIRMATION,
  deleteAccount,
  deleteAccountSnapshot,
  listAccountSnapshots,
  resetAccount,
  restoreAccountSnapshot,
  type AccountSnapshotSummary,
} from "../../services/accountService";
import { useAuthStore } from "../../store/authStore";
import type { PublicUser } from "../../types";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReauthPassword({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-sm">
      <span className="mb-1 block font-medium text-ink">
        Enter your password to continue.
      </span>
      <input
        type="password"
        autoComplete="current-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-coral focus:ring-2"
      />
    </label>
  );
}

export function AccountManagement() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const needsPassword = Boolean(authUser?.hasPassword);

  const [snapshots, setSnapshots] = useState<AccountSnapshotSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTyped, setResetTyped] = useState("");
  const [deleteTyped, setDeleteTyped] = useState("");
  const [scrubTyped, setScrubTyped] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<AccountSnapshotSummary | null>(null);
  const [deleteSnapshotTarget, setDeleteSnapshotTarget] =
    useState<AccountSnapshotSummary | null>(null);
  const [busy, setBusy] = useState<"delete" | "reset" | "restore" | "scrub" | null>(null);

  async function refreshSnapshots() {
    const data = await listAccountSnapshots();
    setSnapshots(data.snapshots);
  }

  useEffect(() => {
    void listAccountSnapshots()
      .then((data) => setSnapshots(data.snapshots))
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : "Could not load version history."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!deleteOpen && !resetOpen && !restoreTarget && !deleteSnapshotTarget) {
      setResetTyped("");
      setDeleteTyped("");
      setScrubTyped("");
      setReauthPassword("");
    }
  }, [deleteOpen, resetOpen, restoreTarget, deleteSnapshotTarget]);

  function applyUserAndReload(user: PublicUser) {
    if (accessToken) setSession(accessToken, user);
    window.location.assign(user.onboardingCompleted ? "/home" : "/onboarding");
  }

  function passwordBody() {
    return needsPassword ? { password: reauthPassword } : {};
  }

  async function confirmDeleteAccount() {
    setBusy("delete");
    setActionError(null);
    try {
      await deleteAccount({
        confirmation: DELETE_ACCOUNT_CONFIRMATION,
        ...passwordBody(),
      });
      await logout();
      window.location.assign("/login");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete account.");
      setBusy(null);
    }
  }

  async function confirmResetAccount() {
    setBusy("reset");
    setActionError(null);
    try {
      const data = await resetAccount({
        confirmation: RESET_ACCOUNT_CONFIRMATION,
        ...passwordBody(),
      });
      applyUserAndReload(data.user);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not reset account.");
      setBusy(null);
    }
  }

  async function confirmRestoreSnapshot() {
    if (!restoreTarget) return;
    setBusy("restore");
    setActionError(null);
    try {
      const data = await restoreAccountSnapshot(restoreTarget.id, passwordBody());
      applyUserAndReload(data.user);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not restore snapshot.");
      setBusy(null);
    }
  }

  async function confirmDeleteSnapshot() {
    if (!deleteSnapshotTarget) return;
    setBusy("scrub");
    setActionError(null);
    try {
      await deleteAccountSnapshot(deleteSnapshotTarget.id, {
        confirmation: DELETE_SNAPSHOT_CONFIRMATION,
        ...passwordBody(),
      });
      await refreshSnapshots();
      setDeleteSnapshotTarget(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not delete snapshot.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <section className="rounded-2xl border border-mist bg-foam/60 p-5">
        <h2 className="font-display text-xl font-semibold text-ink">Data Version History</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Every account reset is stored as a snapshot you can restore or permanently delete.
        </p>

        {loading && <p className="mt-4 text-sm text-ink-soft">Loading snapshots...</p>}
        {loadError && <p className="mt-4 text-sm text-coral">{loadError}</p>}

        {!loading && !loadError && snapshots.length === 0 && (
          <p className="mt-4 rounded-xl bg-white/80 px-3 py-3 text-sm text-ink-soft">
            No snapshots yet. Reset your account to archive your current progress.
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {snapshots.map((snapshot) => (
            <li
              key={snapshot.id}
              className="rounded-2xl border border-mist bg-white px-4 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Folder className="mt-0.5 h-5 w-5 shrink-0 text-sea" />
                  <div>
                    <p className="font-medium text-ink">
                      Data Snapshot: {formatDate(snapshot.periodStart)} —{" "}
                      {formatDate(snapshot.periodEnd)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Archived {formatDate(snapshot.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreTarget(snapshot)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sea/30 bg-sea/10 px-3 py-2 text-sm font-semibold text-sea hover:bg-sea/15"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteSnapshotTarget(snapshot)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-coral/25 bg-coral/5 p-5">
        <h2 className="font-display text-xl font-semibold text-ink">Account Management</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Reset archives your live workspace. Deletion hides the account for 30 days, then
          permanently erases it and every snapshot.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="rounded-xl border border-mist bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-foam"
          >
            Reset Entire Account
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Delete Account
          </button>
        </div>
      </section>

      {actionError && <p className="text-sm text-coral">{actionError}</p>}

      <ConfirmModal
        open={deleteOpen}
        title="Delete your account?"
        description="Your profile will be deactivated immediately and completely purged after 30 days. You can restore it by logging in during that window."
        confirmLabel="Delete Account"
        confirmingLabel="Deleting..."
        confirmDisabled={
          deleteTyped !== DELETE_ACCOUNT_CONFIRMATION || (needsPassword && !reauthPassword)
        }
        confirming={busy === "delete"}
        onCancel={() => {
          if (busy !== "delete") setDeleteOpen(false);
        }}
        onConfirm={() => void confirmDeleteAccount()}
      >
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-ink">
            To proceed, type &quot;Delete account&quot; below.
          </span>
          <input
            value={deleteTyped}
            onChange={(e) => setDeleteTyped(e.target.value)}
            className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-coral focus:ring-2"
            placeholder="Delete account"
            autoComplete="off"
          />
        </label>
        {needsPassword && (
          <ReauthPassword value={reauthPassword} onChange={setReauthPassword} />
        )}
      </ConfirmModal>

      <ConfirmModal
        open={resetOpen}
        title="Reset entire account?"
        description="This action will archive your current data, stats, and configurations into a historical folder and completely clear your active dashboard so you can start fresh."
        confirmLabel="Confirm Reset"
        confirmingLabel="Resetting..."
        confirmDisabled={
          resetTyped !== RESET_ACCOUNT_CONFIRMATION || (needsPassword && !reauthPassword)
        }
        confirming={busy === "reset"}
        onCancel={() => {
          if (busy !== "reset") setResetOpen(false);
        }}
        onConfirm={() => void confirmResetAccount()}
      >
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-ink">
            To proceed, type &quot;Reset account&quot; below.
          </span>
          <input
            value={resetTyped}
            onChange={(e) => setResetTyped(e.target.value)}
            className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-coral focus:ring-2"
            placeholder="Reset account"
            autoComplete="off"
          />
        </label>
        {needsPassword && (
          <ReauthPassword value={reauthPassword} onChange={setReauthPassword} />
        )}
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(restoreTarget)}
        title="Restore this snapshot?"
        description="Restoring this snapshot will overwrite your current active dashboard. If you want to save your current active data, please execute a new 'Reset Account' first to snapshot it."
        confirmLabel="Restore snapshot"
        confirmingLabel="Restoring..."
        confirmTone="primary"
        confirmDisabled={needsPassword && !reauthPassword}
        confirming={busy === "restore"}
        onCancel={() => {
          if (busy !== "restore") setRestoreTarget(null);
        }}
        onConfirm={() => void confirmRestoreSnapshot()}
      >
        {needsPassword && (
          <ReauthPassword value={reauthPassword} onChange={setReauthPassword} />
        )}
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(deleteSnapshotTarget)}
        title="Delete this snapshot?"
        description="Are you sure? This deletion is permanent. This specific historical data snapshot cannot be recovered once deleted."
        confirmLabel="Delete snapshot"
        confirmingLabel="Deleting..."
        confirmDisabled={
          scrubTyped !== DELETE_SNAPSHOT_CONFIRMATION || (needsPassword && !reauthPassword)
        }
        confirming={busy === "scrub"}
        onCancel={() => {
          if (busy !== "scrub") setDeleteSnapshotTarget(null);
        }}
        onConfirm={() => void confirmDeleteSnapshot()}
      >
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-ink">
            To proceed, type &quot;Delete snapshot&quot; below.
          </span>
          <input
            value={scrubTyped}
            onChange={(e) => setScrubTyped(e.target.value)}
            className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-coral focus:ring-2"
            placeholder="Delete snapshot"
            autoComplete="off"
          />
        </label>
        {needsPassword && (
          <ReauthPassword value={reauthPassword} onChange={setReauthPassword} />
        )}
      </ConfirmModal>
    </div>
  );
}
