import { FileText, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import {
  todayStr, addDaysStr, formatDateBR, formatMoney,
  numeroOrcamento, calcOrcamentoTotais, STATUS_LABEL, STATUS_TONE, statusEfetivo,
} from "@/lib/helpers";

function Kpi({ icon: Icon, label, value, tone = "text-text" }) {
  return (
    <Card className="flex items-center gap-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div>
        <div className="text-[12px] font-medium text-text-muted">{label}</div>
        <div className={`text-[19px] font-bold ${tone}`}>{value}</div>
      </div>
    </Card>
  );
}

function PainelPage() {
  const { state } = useStore();
  const hoje = todayStr();
  const mesAtual = hoje.slice(0, 7);

  const orcamentosComStatus = state.orcamentos.map((o) => ({ ...o, statusAtual: statusEfetivo(o) }));

  const orcadoNoMes = orcamentosComStatus
    .filter((o) => o.data?.slice(0, 7) === mesAtual)
    .reduce((s, o) => s + calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo).total, 0);

  const aprovados = orcamentosComStatus.filter((o) => o.statusAtual === "aprovado").length;
  const finalizados = orcamentosComStatus.filter((o) => o.statusAtual === "aprovado" || o.statusAtual === "recusado").length;
  const taxaAprovacao = finalizados > 0 ? Math.round((aprovados / finalizados) * 100) : 0;

  const pendentes = orcamentosComStatus.filter((o) => o.statusAtual === "rascunho" || o.statusAtual === "enviado");

  const venceLogo = orcamentosComStatus
    .filter((o) => o.statusAtual === "enviado")
    .map((o) => ({ ...o, validoAte: addDaysStr(o.data, o.validadeDias || 0) }))
    .sort((a, b) => (a.validoAte < b.validoAte ? -1 : 1))
    .slice(0, 6);

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Painel</h1>

      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Orçado este mês" value={formatMoney(orcadoNoMes)} />
        <Kpi icon={FileText} label="Orçamentos ativos" value={pendentes.length} />
        <Kpi icon={CheckCircle2} label="Taxa de aprovação" value={`${taxaAprovacao}%`} />
        <Kpi icon={Clock} label="Total de orçamentos" value={state.orcamentos.length} />
      </div>

      <Card>
        <h2 className="mb-3 text-[15px] font-bold text-text">Próximos a vencer</h2>
        {venceLogo.length === 0 ? (
          <EmptyState message="Nenhum orçamento enviado aguardando resposta." />
        ) : (
          <TableWrap>
            <Table>
              <Thead><tr><Th>Número</Th><Th>Cliente</Th><Th>Válido até</Th><Th>Total</Th><Th>Status</Th></tr></Thead>
              <tbody>
                {venceLogo.map((o) => {
                  const index = state.orcamentos.findIndex((x) => x.id === o.id);
                  const cliente = state.clientes.find((c) => c.id === o.clienteId);
                  const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
                  return (
                    <Tr key={o.id}>
                      <Td className="font-semibold">{numeroOrcamento(state.orcamentos, index)}</Td>
                      <Td>{cliente?.nome || "-"}</Td>
                      <Td>{formatDateBR(o.validoAte)}</Td>
                      <Td>{formatMoney(total)}</Td>
                      <Td><Badge tone={STATUS_TONE[o.statusAtual]}>{STATUS_LABEL[o.statusAtual]}</Badge></Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

export default PainelPage;
