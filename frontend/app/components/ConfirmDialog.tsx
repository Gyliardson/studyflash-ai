"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Excluir",
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => cancelButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel();
    }}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-bg text-danger-fg">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Fechar confirmação"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <h2 id="confirm-dialog-title" className="mt-5 text-xl font-extrabold text-card-foreground">{title}</h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
            className="h-11 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pending ? "Excluindo…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
