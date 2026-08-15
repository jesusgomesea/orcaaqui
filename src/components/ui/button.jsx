import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-primary-light to-primary text-white border border-primary shadow-sm hover:from-primary hover:to-primary-dark hover:shadow-md active:translate-y-px",
        secondary: "bg-surface text-text border border-border-strong hover:bg-bg",
        danger: "bg-surface text-danger border border-danger-border hover:bg-danger-tint",
        ghost: "bg-transparent text-text-muted hover:bg-bg hover:text-text border border-transparent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-7 px-2.5 text-xs",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
