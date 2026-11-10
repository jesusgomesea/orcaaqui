import { cn } from "@/lib/utils";

/**
 * Marca do Orça Aqui: um recibo com o visto, dentro de um quadrado arredondado.
 * Vetorial e sem arquivo externo (pesa menos de 1 KB). Usa a cor de destaque
 * do momento (`--primary`), então dentro do app acompanha a cor da empresa.
 */
export function SimboloMarca({ className, tamanho = 28 }: { className?: string; tamanho?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={tamanho} height={tamanho} className={cn("shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path
        d="M10 6.5h12a1.5 1.5 0 0 1 1.5 1.5v17.2l-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6-2.5-1.6-2.5 1.6V8A1.5 1.5 0 0 1 10 6.5Z"
        fill="var(--sobre-primary)"
      />
      <rect x="11.5" y="10.5" width="9" height="2" rx="1" fill="var(--primary)" />
      <path d="M12.2 17.4l2.6 2.6 5-5" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Símbolo + nome. */
export function Marca({ className, tamanho = 28 }: { className?: string; tamanho?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SimboloMarca tamanho={tamanho} />
      <span className="text-[17px] font-semibold tracking-tight text-text">
        Orça <span className="text-primary-texto">Aqui</span>
      </span>
    </span>
  );
}
