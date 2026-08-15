import { cn } from "@/lib/utils";

function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow)]",
        className
      )}
      {...props}
    />
  );
}

export { Card };
