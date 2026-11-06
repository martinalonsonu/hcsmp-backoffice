import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-12 w-full rounded-sm border border-line bg-white-warm px-4 py-3 text-sm text-ink shadow-sm transition-colors placeholder:text-muted/75 focus-visible:border-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600",
        className,
      )}
      type={type}
      {...props}
    />
  );
}

export { Input };
