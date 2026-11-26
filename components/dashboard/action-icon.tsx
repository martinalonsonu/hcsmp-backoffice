import type { ReactNode } from "react";

type ActionIconProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
};

function ActionIcon({ label, onClick, disabled = false, children }: ActionIconProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className="inline-flex size-9 items-center justify-center rounded-sm border border-line text-ink transition-colors hover:bg-mist focus-visible:ring-2 focus-visible:ring-clay disabled:opacity-40"
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-center text-xs text-paper shadow-md group-focus-within:block group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}

export { ActionIcon };
