import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export default function MolduraAuth({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-5">
      <div className="w-full max-w-[400px]">
        <div className="mb-5 text-center text-[22px] font-bold text-text">
          Orça <span className="text-primary">Aqui</span>
        </div>
        <Card>
          <h1 className="mb-1 text-[16.5px] font-bold text-text">{titulo}</h1>
          {descricao && <p className="mb-4 text-[13px] text-text-muted">{descricao}</p>}
          {children}
        </Card>
        {rodape && <div className="mt-4 text-center text-[12.5px] text-text-muted">{rodape}</div>}
      </div>
    </div>
  );
}
