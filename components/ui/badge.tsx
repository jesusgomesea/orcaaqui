import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  gray: "bg-bg text-text-muted border-border-strong",
  amber: "bg-warning-tint text-warning border-warning",
  green: "bg-success-tint text-success border-success",
  red: "bg-danger-tint text-danger border-danger-border",
};

export type BadgeTone = keyof typeof TONES;

function Badge({ className, tone = "gray", ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold",
        TONES[tone] || TONES.gray,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
