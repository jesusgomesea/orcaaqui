/**
 * Miniatura ilustrativa do orçamento pronto, para a landing. É decorativa: não
 * reaproveita `gerarOrcamentoHtml` de propósito, porque aquela função existe
 * para virar PDF (cores fixas claras, estilos inline) e aqui a peça precisa
 * acompanhar o tema da página.
 */
export default function PreviaOrcamento() {
  const itens = [
    { descricao: "Ensaio fotográfico — 2h", qtd: 1, valor: "R$ 900,00" },
    { descricao: "Tratamento de imagens", qtd: 30, valor: "R$ 450,00" },
    { descricao: "Álbum impresso 20x30", qtd: 1, valor: "R$ 380,00" },
  ];

  return (
    <div aria-hidden className="rounded-xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)]">
      <div className="flex items-start justify-between border-b-[3px] border-primary pb-3.5">
        <div>
          <div className="text-[15px] font-extrabold tracking-tight text-text">Studio Fotografia</div>
          <div className="mt-0.5 text-[10.5px] text-text-muted">12.345.678/0001-90 · (11) 99999-0000</div>
        </div>
        <div className="text-right">
          <div className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted">Orçamento</div>
          <div className="text-[15px] font-extrabold text-primary">ORC-0007</div>
        </div>
      </div>

      <div className="mt-3.5 flex items-start justify-between text-[11px]">
        <div>
          <div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-text-muted">Cliente</div>
          <div className="font-semibold text-text">Marina Alves</div>
        </div>
        <div className="text-right">
          <div className="mb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-text-muted">Válido até</div>
          <div className="font-semibold text-warning">25/09/2026</div>
        </div>
      </div>

      <table className="mt-3.5 w-full border-collapse text-[11px]">
        <tbody>
          {itens.map((it) => (
            <tr key={it.descricao} className="border-b border-border">
              <td className="py-2 text-text">{it.descricao}</td>
              <td className="py-2 text-center text-text-muted">{it.qtd}</td>
              <td className="py-2 text-right font-semibold text-text">{it.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-baseline justify-between border-t-2 border-text pt-2.5">
        <span className="text-[12px] font-extrabold text-text">Total</span>
        <span className="text-[17px] font-extrabold text-text">R$ 1.730,00</span>
      </div>
    </div>
  );
}
