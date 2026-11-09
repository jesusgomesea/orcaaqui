"use client";

import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          // Celular: margem nas laterais, altura do viewport visível (dvh desconta a
          // barra do navegador) e menos respiro interno.
          "dialog-content z-50 w-[calc(100%-1.5rem)] max-w-[560px]",
          "max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-lg)]",
          "sm:max-h-[calc(100dvh-5rem)] sm:p-6",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close aria-label="Fechar" className="absolute right-2.5 top-2.5 rounded-sm p-1.5 sm:right-4 sm:top-4 sm:p-0 text-text-muted opacity-70 transition-opacity hover:opacity-100 cursor-pointer">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("mb-4 pr-7 text-[16.5px] font-bold text-text", className)} {...props} />;
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

export { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose };
