"use client";

import { useId, useRef, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnimatedDialog } from "@/components/ui/use-animated-dialog";
import { cn } from "@/lib/utils";

type ModalSize = "sm" | "full" | "drawer";

type ModalProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  open: boolean;
  /** `drawer` abre un panel lateral derecho; se cierra con Escape o al pulsar fuera. */
  size?: ModalSize;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  footer: ReactNode;
  children: ReactNode;
};

const dialogClasses: Record<ModalSize, string> = {
  sm: "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg rounded-md border border-line bg-white-warm shadow-xl",
  full: "m-0 h-dvh max-h-none w-screen max-w-none bg-paper",
  drawer: "m-0 ml-auto h-dvh max-h-none w-full max-w-md border-l border-line bg-white-warm shadow-xl",
};

const motion: Record<ModalSize, string> = { sm: "center", full: "full", drawer: "drawer" };

/**
 * Native modal dialog: traps focus and restores it on close. Stays mounted so the exit
 * animation can play; control it with `open`.
 */
function Modal({
  title,
  eyebrow,
  description,
  open,
  size = "sm",
  busy = false,
  onClose,
  onSubmit,
  footer,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const full = size === "full";
  const drawer = size === "drawer";
  const gutter = drawer ? "px-5" : "px-5 sm:px-8";

  useAnimatedDialog(ref, open);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-modal={motion[size]}
      onCancel={(event) => {
        event.preventDefault();
        // The full-screen form holds a lot of typed data, so Escape never discards it.
        if (!busy && !full) onClose();
      }}
      onClick={(event) => {
        if (drawer && !busy && event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-0 p-0 text-ink backdrop:bg-ink/50 open:flex open:flex-col",
        dialogClasses[size],
      )}
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <header
          className={cn(
            "flex shrink-0 items-start justify-between gap-4 border-b border-line py-4",
            gutter,
            full && "bg-white-warm",
          )}
        >
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="font-display text-xl sm:text-2xl">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar"
            disabled={busy}
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </header>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain py-6", gutter)}>
          <div className={cn("space-y-6", full && "mx-auto max-w-5xl")}>{children}</div>
        </div>
        <footer
          className={cn(
            "flex shrink-0 gap-3 border-t border-line bg-white-warm py-4",
            gutter,
            drawer
              ? "*:flex-1"
              : "flex-col-reverse sm:flex-row sm:justify-end *:w-full sm:*:w-auto",
          )}
        >
          {footer}
        </footer>
      </form>
    </dialog>
  );
}

export { Modal };
