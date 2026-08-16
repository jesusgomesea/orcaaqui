import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NOVIDADES, TIPO_LABEL, TIPO_TONE } from "@/lib/changelog";
import { formatDateBR } from "@/lib/helpers";

function NovidadesPage() {
  const { marcarNovidadesVistas } = useStore();

  useEffect(() => {
    marcarNovidadesVistas();
  }, [marcarNovidadesVistas]);

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Novidades</h1>
      <p className="mb-4 text-[13px] text-text-muted">O que mudou no Orça Aqui, mais recente primeiro.</p>
      <div className="space-y-3">
        {NOVIDADES.map((n) => (
          <Card key={n.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge tone={TIPO_TONE[n.tipo]}>{TIPO_LABEL[n.tipo]}</Badge>
              <span className="text-[11.5px] text-text-muted">{formatDateBR(n.data)}</span>
            </div>
            <h3 className="mb-1 text-[14.5px] font-bold text-text">{n.titulo}</h3>
            <p className="text-[13px] text-text-muted">{n.descricao}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default NovidadesPage;
