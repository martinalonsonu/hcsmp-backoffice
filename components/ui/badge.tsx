import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "bg-mist text-forest",
        accent: "bg-[#f0eadc] text-clay-text",
        success: "bg-[#eaf0e8] text-[#426244]",
        muted: "bg-[#f0efec] text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ className, variant }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
