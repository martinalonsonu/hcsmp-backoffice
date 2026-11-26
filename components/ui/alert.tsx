import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-3 rounded-sm border px-4 py-3 text-sm leading-6",
  {
    variants: {
      variant: {
        info: "border-line bg-mist text-ink",
        error: "border-red-200 bg-red-50 text-red-800",
        success: "border-[#cfdcca] bg-[#eaf0e8] text-[#426244]",
        loading: "border-line bg-white-warm text-muted",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const icons = {
  info: Info,
  error: CircleAlert,
  success: CircleCheck,
  loading: LoaderCircle,
};

type AlertProps = VariantProps<typeof alertVariants> & {
  children: ReactNode;
  className?: string;
};

function Alert({ variant = "info", className, children }: AlertProps) {
  const kind = variant ?? "info";
  const Icon = icons[kind];
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", kind === "loading" && "animate-spin")}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export { Alert };
