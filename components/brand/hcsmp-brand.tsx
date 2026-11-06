import Image from "next/image";
import { cn } from "@/lib/utils";

type HcsmpBrandProps = {
  inverse?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
};

function HcsmpBrand({
  inverse = false,
  compact = false,
  iconOnly = false,
  className,
}: HcsmpBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border",
          inverse
            ? "border-white/30 bg-white/10 text-[#d9c99f]"
            : "border-clay/35 bg-[#f0eadc] text-clay-text",
        )}
      >
        <Image
          src="/hcsmp-logo-i.png"
          alt=""
          width={32}
          height={32}
          className={cn("size-8 object-contain", inverse && "mix-blend-screen")}
        />
      </span>
      {!iconOnly && (
        <span className="flex flex-col">
          <span
            className={cn(
              "font-display text-base leading-tight",
              inverse ? "text-white" : "text-ink",
            )}
          >
            Hermandad de Cargadores de San Martin de Porres
          </span>
          {!compact && (
            <span
              className={cn(
                "mt-1 text-[0.625rem] font-medium uppercase leading-tight tracking-[0.15em]",
                inverse ? "text-white/70" : "text-muted",
              )}
            >
              Cruz Blanca · Diócesis de Huacho
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export { HcsmpBrand };
