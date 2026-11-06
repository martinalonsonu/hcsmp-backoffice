import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

type ModuleCardProps = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

function ModuleCard({
  id,
  title,
  description,
  href,
  icon: Icon,
}: ModuleCardProps) {
  return (
    <Card
      className="h-full transition-colors hover:border-clay/60"
      id={id}
    >
      <Link
        aria-label={`${title}: ${description}`}
        className="group flex h-full flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay sm:p-6"
        href={href}
      >
        <span className="flex items-start justify-between gap-4">
          <span className="grid size-11 place-items-center rounded-full bg-mist text-forest">
            <Icon aria-hidden="true" className="size-5" strokeWidth={1.7} />
          </span>
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            strokeWidth={1.7}
          />
        </span>
        <span className="mt-5 font-display text-lg text-ink">{title}</span>
        <span className="mt-2 text-sm leading-6 text-muted">{description}</span>
      </Link>
    </Card>
  );
}

export { ModuleCard };
