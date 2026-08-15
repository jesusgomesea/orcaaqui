import { cn } from "@/lib/utils";

function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-[13.5px] text-text transition-[border-color,box-shadow] outline-none",
        "focus:border-primary focus:ring-[3px] focus:ring-primary-tint-strong",
        "placeholder:text-text-muted disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-md border border-border-strong bg-surface px-2.5 py-2 text-[13.5px] text-text transition-[border-color,box-shadow] outline-none",
        "focus:border-primary focus:ring-[3px] focus:ring-primary-tint-strong",
        "placeholder:text-text-muted disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

function Label({ className, ...props }) {
  return <label className={cn("mb-1 block text-[12.5px] font-medium text-text-muted", className)} {...props} />;
}

export { Input, Textarea, Label };
