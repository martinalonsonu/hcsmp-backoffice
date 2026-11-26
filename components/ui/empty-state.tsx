import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-sm border border-dashed border-line bg-paper/50 px-5 py-12 text-center",
        className,
      )}
      role="status"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-mist text-muted">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export { EmptyState };
