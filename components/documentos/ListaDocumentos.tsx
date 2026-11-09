"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { baixarDocumento, compartilharDocumento } from "@/lib/documentosCliente";
import { formatarData } from "@/lib/documentos/formatos";
import type { DocumentoGerado } from "@/lib/tipos";

function horaGeracao(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Linhas do histórico: versão, número, data, modelo e ações de baixar/compartilhar. */
export function ListaDocumentos({
  documentos,
  vazio,
  mostrarTipo = false,
}: {
  documentos: DocumentoGerado[];
  vazio: string;
  mostrarTipo?: boolean;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (!documentos.length) return <p className="py-2 text-[12.5px] text-text-muted">{vazio}</p>;

  const ordenados = [...documentos].sort((a, b) => (a.geradoEm < b.geradoEm ? 1 : -1));

  const agir = async (doc: DocumentoGerado, acao: "baixar" | "compartilhar") => {
    setOcupado(doc.id + acao);
    try {
      if (acao === "baixar") await baixarDocumento(doc);
      else if ((await compartilharDocumento(doc)) === "baixado") toast.info("Compartilhamento indisponível neste navegador — arquivo baixado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o documento.");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <ul className="divide-y divide-border">
      {ordenados.map((doc, i) => (
        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="min-w-0 text-[13px]">
            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-text">
              {mostrarTipo && <span>{doc.tipo === "contrato" ? "Contrato" : "Recibo"}</span>}
              <span>nº {doc.numero}</span>
              <span className="font-normal text-text-muted">· v{doc.versao}</span>
              {i === 0 && !mostrarTipo && <Badge tone="green">Atual</Badge>}
              {doc.formato === "docx" && <Badge tone="amber">.docx</Badge>}
            </div>
            <div className="text-[11.5px] text-text-muted">
              {formatarData(doc.dataGeracao)} {horaGeracao(doc.geradoEm)}
              {doc.modeloVersao ? ` · modelo ${doc.modeloVersao}` : ""}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" disabled={!!ocupado} onClick={() => agir(doc, "baixar")} title="Baixar">
              <Download className="h-3.5 w-3.5" strokeWidth={1.8} /> Baixar
            </Button>
            <Button variant="secondary" size="sm" disabled={!!ocupado} onClick={() => agir(doc, "compartilhar")} title="Compartilhar">
              <Share2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
