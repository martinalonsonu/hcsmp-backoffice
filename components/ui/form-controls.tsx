import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlClass =
  "w-full rounded-sm border border-line bg-white-warm px-4 text-sm text-ink shadow-sm transition-colors placeholder:text-muted/75 focus-visible:border-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/20 disabled:cursor-not-allowed disabled:bg-paper disabled:opacity-70 aria-invalid:border-red-600";

type FieldProps = {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="block text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  );
}

function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "h-12", className)} {...props} />;
}

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(controlClass, "py-3", className)} {...props} />
  );
}

export { controlClass, Field, Select, Textarea };
