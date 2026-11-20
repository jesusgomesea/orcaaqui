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
        // Principal = "gel" (app/vidro.css): cor da empresa sólida, nunca vidro.
        default: "gel hover:brightness-105",
        // Secundário = vidro leve: translúcido com linha de luz, sem blur (costuma estar dentro de um cartão).
        secondary: "bg-surface-2 text-text shadow-[0_1px_0_var(--vidro-luz)_inset] hover:bg-vidro-realce",
        // danger continua na cor de alerta sólida: contraste conferido no claro e no escuro.
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
