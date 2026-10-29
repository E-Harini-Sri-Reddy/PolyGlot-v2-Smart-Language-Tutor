import { useEffect, type ReactNode } from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  confirmingLabel?: string;
  confirmDisabled?: boolean;
  confirmTone?: "danger" | "primary";
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirming = false,
  confirmingLabel = "Deleting...",
  confirmDisabled = false,
  confirmTone = "danger",
  children,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirming) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, confirming, onCancel]);

  if (!open) return null;

  const confirmClass =
    confirmTone === "primary"
      ? "rounded-xl bg-sea px-4 py-2.5 text-sm font-semibold text-white hover:bg-sea-deep disabled:opacity-60"
      : "rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => {
        if (!confirming) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        className="w-full max-w-md rounded-3xl border border-mist bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="font-display text-2xl font-semibold text-ink">
          {title}
        </h2>
        <p id="confirm-modal-description" className="mt-2 text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="rounded-xl border border-mist bg-foam px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirming || confirmDisabled}
            onClick={onConfirm}
            className={confirmClass}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
