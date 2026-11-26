import type { LucideIcon } from "lucide-react";

type MetricProps = { icon: LucideIcon; label: string; value: string };

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="rounded-md border border-line bg-white-warm p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0eadc] text-clay-text">
          <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.7} />
        </span>
        <p className="text-sm text-muted">{label}</p>
      </div>
      <p className="mt-4 font-display text-3xl leading-tight text-ink">{value}</p>
    </div>
  );
}

export { Metric };
