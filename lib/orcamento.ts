// Textos e documento do orçamento: o HTML impresso (PDF via window.print) e a
// mensagem do WhatsApp. Funções puras, fora da página, para serem testadas e
// reaproveitadas pelo gerador e pela agenda.

import { addDaysStr, calcOrcamentoTotais, escapeHtml, formatDateBR, formatMoney, logoSegura, todayStr } from "./helpers";
import type { Cliente, Empresa, Orcamento, ServicoContrato } from "./tipos";

export function servicoContratoVazio(): ServicoContrato {
  return {
    servico: "", pacote: "", dataServico: "", horarioInicio: "", horarioFim: "", local: "",
    tempoCampo: "", fotosEditadas: "", personalizado: false, personalizadoHoras: 0, personalizadoFotos: 0, prazoEntrega: "",
  };
}

/** Telefone só com dígitos, sem o 55 do Brasil — para achar o mesmo cliente escrito de jeitos diferentes. */
export function telefoneComparavel(tel: string): string {
  const d = tel.replace(/\D/g, "");
  return (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
}

/** Cliente com o mesmo telefone (dedupe ao criar pelo gerador ou ao colar). */
export function acharClientePorTelefone(clientes: Cliente[], telefone: string): Cliente | undefined {
  const alvo = telefoneComparavel(telefone);
  if (alvo.length < 8) return undefined;
  return clientes.find((c) => telefoneComparavel(c.telefone) === alvo);
}

/**
 * Monta o HTML do documento impresso. Estilos inline de propósito: esse HTML
 * vira o PDF (via window.print) e precisa ser autocontido, sem depender do
 * Tailwind nem do tema da tela — por isso as cores fixas claras.
 * Ao mudar o layout do orçamento impresso, é esta função que se edita.
 *
 * Todo valor vindo dos dados passa por `escapeHtml`: isto vira `innerHTML`, e
 * um "Instalação <2m" sumiria do PDF — pior, um nome de cliente importado de
 * CSV de terceiro poderia rodar script na sessão de quem importou.
 */
export function gerarOrcamentoHtml(o: Orcamento, cliente: Cliente | undefined, numero: string, empresa: Empresa) {
  const { subtotal, descontoValor, acrescimoValor, total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
  const validoAte = addDaysStr(o.data, o.validadeDias);
  const cor = escapeHtml(empresa.corPrimaria || "#2563eb");
  const logo = logoSegura(empresa.logoDataUrl);
  const moeda = o.moeda || empresa.moeda || "BRL";
  const linhas = o.itens.filter((it) => it.descricao.trim()).map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;">${escapeHtml(it.descricao)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${escapeHtml(it.quantidade)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(it.valorUnitario, moeda)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatMoney((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), moeda)}</td>
    </tr>`).join("");

  return `
    <div style="max-width:680px;margin:0 auto;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a2233;padding:0 24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:28px 0 20px;border-bottom:3px solid ${cor};">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logo ? `<img src="${logo}" style="height:48px;max-width:140px;object-fit:contain;" />` : ""}
          <div>
            <div style="font-size:20px;font-weight:800;letter-spacing:-.3px;">${escapeHtml(empresa.nome || "Sua Empresa")}</div>
            <div style="font-size:12px;color:#667085;margin-top:2px;">${escapeHtml([empresa.documento, empresa.telefone, empresa.email].filter(Boolean).join(" · "))}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#667085;letter-spacing:.04em;text-transform:uppercase;font-weight:700;">Orçamento</div>
          <div style="font-size:20px;font-weight:800;color:${cor};">${escapeHtml(numero)}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin:22px 0;font-size:13px;">
        <div>
          <div style="color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px;">Cliente</div>
          <div style="font-weight:600;">${escapeHtml(cliente ? cliente.nome : "-")}</div>
          <div style="color:#667085;">${escapeHtml(cliente?.telefone || cliente?.email || "")}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px;">Emitido em</div>
          <div style="font-weight:600;">${formatDateBR(o.data)}</div>
          <div style="color:#b54708;font-weight:600;margin-top:6px;">Válido até ${formatDateBR(validoAte)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px;">
        <thead>
          <tr style="background:#f6f5f1;">
            <th style="text-align:left;padding:9px 0 9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Descrição</th>
            <th style="text-align:center;padding:9px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Qtd</th>
            <th style="text-align:right;padding:9px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Valor unit.</th>
            <th style="text-align:right;padding:9px 10px 9px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <div style="width:260px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#667085;">
            <span>Subtotal</span><span>${formatMoney(subtotal, moeda)}</span>
          </div>
          ${descontoValor > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#b54708;"><span>Desconto</span><span>-${formatMoney(descontoValor, moeda)}</span></div>` : ""}
          ${acrescimoValor > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#667085;"><span>Acréscimo</span><span>+${formatMoney(acrescimoValor, moeda)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;font-size:19px;font-weight:800;padding:10px 0 0;border-top:2px solid #1a2233;margin-top:6px;">
            <span>Total</span><span>${formatMoney(total, moeda)}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:28px;padding:16px 18px;background:#f6f5f1;border-radius:10px;font-size:12.5px;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">Condições de pagamento</div>
        <div style="color:#333;white-space:pre-wrap;">${escapeHtml(o.condicoes || "-")}</div>
        ${empresa.dadosBancarios ? `<div style="font-weight:700;margin:10px 0 4px;">Pagamento</div><div style="color:#333;white-space:pre-wrap;">${escapeHtml(empresa.dadosBancarios)}</div>` : ""}
        ${o.observacoes ? `<div style="font-weight:700;margin:10px 0 4px;">Observações</div><div style="color:#333;white-space:pre-wrap;">${escapeHtml(o.observacoes)}</div>` : ""}
      </div>

      <div style="text-align:center;color:#98a2b3;font-size:11.5px;margin-top:26px;padding-bottom:24px;">
        Orçamento gerado em ${formatDateBR(todayStr())}${empresa.nome ? " — " + escapeHtml(empresa.nome) : ""}
      </div>
    </div>
  `;
}

export function gerarTextoWhatsapp(o: Orcamento, cliente: Cliente | undefined, numero: string, empresa: Empresa) {
  const moeda = o.moeda || empresa.moeda || "BRL";
  const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
  const validoAte = addDaysStr(o.data, o.validadeDias);
  const itens = o.itens.filter((it) => it.descricao.trim())
    .map((it) => `• ${it.descricao} (${it.quantidade}x ${formatMoney(it.valorUnitario, moeda)})`).join("\n");
  // Blocos separados por linha em branco. Antes um `.filter(Boolean)` apagava
  // também as linhas vazias de separação, e a mensagem chegava toda grudada.
  const blocos = [
    [`*Orçamento ${numero}*${empresa.nome ? " — " + empresa.nome : ""}`, cliente ? `Cliente: ${cliente.nome}` : ""],
    [itens],
    [`*Total: ${formatMoney(total, moeda)}*`, `Válido até ${formatDateBR(validoAte)}`],
    [o.condicoes.trim()],
  ];
  return blocos
    .map((linhas) => linhas.filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}
