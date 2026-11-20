import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "vidro rounded-[var(--radius-cartao)] p-5",
        className
      )}
      {...props}
    />
  );
}

export { Card };
