import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

function Panel({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-line bg-white-warm shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

type PanelHeaderProps = {
  title: string;
  id?: string;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

function PanelHeader({
  title,
  id,
  description,
  aside,
  className,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-line px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={id} className="font-display text-xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {aside && <div className="shrink-0 text-sm text-muted">{aside}</div>}
    </div>
  );
}

function PanelBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-4 py-5 sm:px-6", className)} {...props} />;
}

export { Panel, PanelBody, PanelHeader };
