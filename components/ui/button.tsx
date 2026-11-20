import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Botões em pílula (visual inspirado no orgfinapp). Altura de toque de 44px no
// celular; um pouco mais baixos a partir de `sm`, onde há mouse.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,background-color,filter,opacity] duration-150 cursor-pointer select-none active:scale-[.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  {
    variants: {
      variant: {
        // "Gel" do Liquid Glass: cor da empresa com gradiente vertical, brilho no topo e sombra colorida.
        default:
          "bg-[linear-gradient(180deg,var(--primary-light)_0%,var(--primary)_55%,var(--primary-dark)_100%)] text-sobre-primary shadow-[0_1px_0_rgb(255_255_255/35%)_inset,0_8px_22px_-8px_var(--primary-tint-strong)] hover:brightness-105",
        secondary: "bg-surface-2 text-text hover:bg-border-strong/60",
        danger: "bg-danger-tint text-danger hover:brightness-95",
        ghost: "bg-transparent text-text-muted hover:bg-surface-2 hover:text-text",
      },
      size: {
        default: "h-11 px-5 text-[14px] sm:h-10",
        sm: "h-9 px-3.5 text-[12.5px]",
        icon: "h-11 w-11 sm:h-10 sm:w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
