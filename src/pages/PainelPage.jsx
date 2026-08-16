import { FileText, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import {
  todayStr, addDaysStr, formatDateBR, formatMoney,
  numeroOrcamento, calcOrcamentoTotais, STATUS_LABEL, STATUS_TONE, statusEfetivo,
} from "@/lib/helpers";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function faturamentoPorMes(orcamentos, meses = 6) {
  const hoje = new Date();
  const buckets = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    buckets.push({ chave, label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, orcado: 0, aprovado: 0 });
  }
  const porChave = Object.fromEntries(buckets.map((b) => [b.chave, b]));
  for (const o of orcamentos) {
    const chave = o.data?.slice(0, 7);
    const bucket = porChave[chave];
    if (!bucket) continue;
    const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
    bucket.orcado += total;
    if (statusEfetivo(o) === "aprovado") bucket.aprovado += total;
  }
  return buckets;
}

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
  const { empresaAtiva } = useStore();
  const moeda = empresaAtiva.moeda || "BRL";
  const hoje = todayStr();
  const mesAtual = hoje.slice(0, 7);

  const orcamentosComStatus = empresaAtiva.orcamentos.map((o) => ({ ...o, statusAtual: statusEfetivo(o) }));

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

  const dadosGrafico = faturamentoPorMes(empresaAtiva.orcamentos);
  const temDadosGrafico = dadosGrafico.some((b) => b.orcado > 0);

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Painel</h1>

      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Orçado este mês" value={formatMoney(orcadoNoMes, moeda)} />
        <Kpi icon={FileText} label="Orçamentos ativos" value={pendentes.length} />
        <Kpi icon={CheckCircle2} label="Taxa de aprovação" value={`${taxaAprovacao}%`} />
        <Kpi icon={Clock} label="Total de orçamentos" value={empresaAtiva.orcamentos.length} />
      </div>

      <Card className="mb-5">
        <h2 className="mb-3 text-[15px] font-bold text-text">Faturamento (últimos 6 meses)</h2>
        {!temDadosGrafico ? (
          <EmptyState message="Ainda não há orçamentos suficientes pra mostrar um gráfico." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatMoney(v, moeda)} />
                <Tooltip
                  formatter={(v) => formatMoney(v, moeda)}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }}
                />
                <Legend wrapperStyle={{ fontSize: 12.5 }} />
                <Bar dataKey="orcado" name="Orçado" fill="var(--primary-tint-strong)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="aprovado" name="Aprovado" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

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
                  const index = empresaAtiva.orcamentos.findIndex((x) => x.id === o.id);
                  const cliente = empresaAtiva.clientes.find((c) => c.id === o.clienteId);
                  const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
                  return (
                    <Tr key={o.id}>
                      <Td className="font-semibold">{numeroOrcamento(empresaAtiva.orcamentos, index)}</Td>
                      <Td>{cliente?.nome || "-"}</Td>
                      <Td>{formatDateBR(o.validoAte)}</Td>
                      <Td>{formatMoney(total, o.moeda || moeda)}</Td>
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
