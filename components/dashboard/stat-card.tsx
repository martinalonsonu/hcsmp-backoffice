import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
};

function StatCard({ icon: Icon, label, value, note }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-[#f0eadc] text-clay-text">
            <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.7} />
          </span>
          <ArrowUpRight
            aria-hidden="true"
            className="mt-1 size-4 text-muted/70"
            strokeWidth={1.7}
          />
        </div>
        <p className="mt-5 text-sm text-muted">{label}</p>
        <p className="mt-1 font-display text-3xl leading-tight text-ink">{value}</p>
        <p className="mt-2 text-xs text-muted">{note}</p>
      </CardContent>
    </Card>
  );
}

export { StatCard };
