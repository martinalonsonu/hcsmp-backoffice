import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  level?: 1 | 2;
  className?: string;
};

function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  level = 1,
  className,
}: PageHeaderProps) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <Heading className="mt-2 font-display text-3xl sm:text-4xl">
          {title}
        </Heading>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export { PageHeader };
