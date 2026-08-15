import { useRef } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Download, UploadCloud } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { readFileAsDataUrl, downloadFile, todayStr } from "@/lib/helpers";

function ConfigPage() {
  const { state, updateEmpresa, importState } = useStore();
  const { empresa } = state;
  const logoInputRef = useRef(null);
  const backupInputRef = useRef(null);

  const set = (patch) => updateEmpresa(patch);

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Use um arquivo de até 1,5MB.");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    set({ logoDataUrl: dataUrl });
    toast.success("Logo atualizada.");
  };

  const handleExport = () => {
    downloadFile(`orcaaqui-backup-${todayStr()}.json`, JSON.stringify(state, null, 2));
    toast.success("Backup exportado.");
  };

  const handleImportClick = () => backupInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      importState(parsed);
      toast.success("Backup importado com sucesso.");
    } catch {
      toast.error("Arquivo inválido. Verifique se é um backup do Orça Aqui.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Dados da empresa</h1>

      <Card className="mb-5">
        <fieldset>
          <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Identidade</legend>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-bg">
              {empresa.logoDataUrl ? (
                <img src={empresa.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <Upload className="h-5 w-5 text-text-muted" strokeWidth={1.6} />
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>
                {empresa.logoDataUrl ? "Trocar logo" : "Enviar logo"}
              </Button>
              {empresa.logoDataUrl && (
                <Button type="button" variant="danger" size="sm" onClick={() => set({ logoDataUrl: "" })}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </Button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome / razão social *</Label>
              <Input value={empresa.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex: Studio Fotografia LTDA" />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input value={empresa.documento} onChange={(e) => set({ documento: e.target.value })} />
            </div>
            <div>
              <Label>Telefone/WhatsApp</Label>
              <Input value={empresa.telefone} onChange={(e) => set({ telefone: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={empresa.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div>
              <Label>Site/Instagram</Label>
              <Input value={empresa.site} onChange={(e) => set({ site: e.target.value })} />
            </div>
            <div>
              <Label>Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={empresa.corPrimaria}
                  onChange={(e) => set({ corPrimaria: e.target.value })}
                  className="h-9 w-11 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
                />
                <Input value={empresa.corPrimaria} onChange={(e) => set({ corPrimaria: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Label>Endereço</Label>
            <Input value={empresa.endereco} onChange={(e) => set({ endereco: e.target.value })} />
          </div>
        </fieldset>
      </Card>

      <Card className="mb-5">
        <fieldset>
          <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Pagamento e condições</legend>
          <div className="mb-3">
            <Label>Dados bancários / Pix (aparece no orçamento)</Label>
            <Textarea rows={2} value={empresa.dadosBancarios} onChange={(e) => set({ dadosBancarios: e.target.value })} placeholder="Chave Pix, banco, agência/conta..." />
          </div>
          <div>
            <Label>Condições de pagamento padrão</Label>
            <Textarea rows={2} value={empresa.condicoesPadrao} onChange={(e) => set({ condicoesPadrao: e.target.value })} />
          </div>
        </fieldset>
      </Card>

      <Card>
        <fieldset>
          <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Backup dos dados</legend>
          <p className="mb-3 text-[13px] text-text-muted">
            Todos os dados ficam salvos só neste navegador. Exporte um backup regularmente e guarde em local seguro — é a única forma de levar seus dados para outro computador.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4" strokeWidth={1.8} /> Exportar backup (JSON)
            </Button>
            <Button type="button" variant="secondary" onClick={handleImportClick}>
              <UploadCloud className="h-4 w-4" strokeWidth={1.8} /> Importar backup
            </Button>
            <input ref={backupInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          </div>
        </fieldset>
      </Card>
    </div>
  );
}

export default ConfigPage;
