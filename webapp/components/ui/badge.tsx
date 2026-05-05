import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary-foreground-on-light",
        brand:
          "border-transparent bg-brand-primary-100 text-brand-primary-700",
        secondary:
          "border-transparent bg-brand-secondary-100 text-brand-secondary-800",
        success:
          "border-transparent bg-emerald-100 text-emerald-700",
        warning:
          "border-transparent bg-amber-100 text-amber-700",
        destructive:
          "border-transparent bg-red-100 text-red-700",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
