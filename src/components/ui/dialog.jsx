import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function Dialog(props) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogContent({ className, children, showClose = true, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "dialog-content z-50 w-full max-w-[560px]",
          "max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-lg)]",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-text-muted opacity-70 transition-opacity hover:opacity-100 cursor-pointer">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }) {
  return <DialogPrimitive.Title className={cn("mb-4 text-[16.5px] font-bold text-text", className)} {...props} />;
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

export { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose };
