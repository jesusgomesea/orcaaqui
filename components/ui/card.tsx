import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-cartao)] bg-surface p-5 shadow-[var(--shadow)] dark:shadow-none",
        className
      )}
      {...props}
    />
  );
}

export { Card };
