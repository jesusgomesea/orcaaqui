import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Campos preenchidos (sem contorno) e cantos de 16px. Fonte de 16px no celular:
// abaixo disso o iPhone dá zoom sozinho ao tocar no campo.
const CAMPO =
  "w-full rounded-[var(--radius-campo)] border border-transparent bg-surface-2 px-3.5 text-[16px] text-text transition-[border-color,box-shadow] outline-none sm:text-[14px] " +
  "focus:border-primary focus:ring-[3px] focus:ring-primary-tint " +
  "placeholder:text-text-muted/80 disabled:opacity-50";

function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("flex h-11 sm:h-10", CAMPO, className)} {...props} />;
}

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("flex py-2.5 leading-snug", CAMPO, className)} {...props} />;
}

function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[12.5px] font-medium text-text-muted", className)} {...props} />;
}

export { Input, Textarea, Label };
