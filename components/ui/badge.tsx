import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  gray: "bg-surface-2 text-text-muted",
  amber: "bg-warning-tint text-warning",
  green: "bg-success-tint text-success",
  red: "bg-danger-tint text-danger",
};

export type BadgeTone = keyof typeof TONES;

function Badge({ className, tone = "gray", ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
        TONES[tone] || TONES.gray,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
