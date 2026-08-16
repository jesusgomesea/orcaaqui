import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Download, UploadCloud, Plus, Building2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { readFileAsDataUrl, downloadFile, todayStr, MOEDAS } from "@/lib/helpers";

function EmpresasSection() {
  const { state, empresaAtiva, addEmpresa, removeEmpresa, switchEmpresa } = useStore();
  const [nomeNova, setNomeNova] = useState("");

  const handleAdicionar = () => {
    if (!nomeNova.trim()) { toast.error("Informe o nome da nova empresa."); return; }
    addEmpresa({ nome: nomeNova.trim() });
    setNomeNova("");
    toast.success("Empresa criada e selecionada.");
  };

  const handleRemover = (emp) => {
    if (state.empresas.length <= 1) { toast.error("Não é possível remover a única empresa."); return; }
    if (!confirm(`Remover "${emp.nome || "(sem nome)"}" e todos os clientes/orçamentos dela?`)) return;
    removeEmpresa(emp.id);
    toast.success("Empresa removida.");
  };

  return (
    <Card className="mb-5">
      <fieldset>
        <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Suas empresas</legend>
        <p className="mb-3 text-[13px] text-text-muted">
          Cada empresa tem seus próprios clientes, orçamentos e serviços, tudo neste mesmo navegador.
        </p>
        <div className="mb-3 space-y-1.5">
          {state.empresas.map((emp) => (
            <div
              key={emp.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 ${emp.id === empresaAtiva.id ? "border-primary bg-primary-tint" : "border-border"}`}
            >
              <button type="button" onClick={() => switchEmpresa(emp.id)} className="flex flex-1 items-center gap-2 text-left cursor-pointer">
                <Building2 className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.8} />
                <span className="text-[13.5px] font-semibold text-text">{emp.nome || "(sem nome)"}</span>
                {emp.id === empresaAtiva.id && <span className="text-[11px] font-semibold text-primary">ativa</span>}
              </button>
              {state.empresas.length > 1 && (
                <button type="button" onClick={() => handleRemover(emp)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-danger-tint hover:text-danger cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} placeholder="Nome da nova empresa" />
          <Button type="button" variant="secondary" onClick={handleAdicionar}>
            <Plus className="h-4 w-4" strokeWidth={1.8} /> Adicionar
          </Button>
        </div>
      </fieldset>
    </Card>
  );
}

function ConfigPage() {
  const { state, empresaAtiva, updateEmpresaAtiva, importState } = useStore();
  const logoInputRef = useRef(null);
  const backupInputRef = useRef(null);

  const set = (patch) => updateEmpresaAtiva(patch);

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
      <h1 className="mb-5 text-[21px] font-bold text-text">Empresa</h1>

      <EmpresasSection />

      <Card className="mb-5">
        <fieldset>
          <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Identidade</legend>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-bg">
              {empresaAtiva.logoDataUrl ? (
                <img src={empresaAtiva.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <Upload className="h-5 w-5 text-text-muted" strokeWidth={1.6} />
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>
                {empresaAtiva.logoDataUrl ? "Trocar logo" : "Enviar logo"}
              </Button>
              {empresaAtiva.logoDataUrl && (
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
              <Input value={empresaAtiva.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex: Studio Fotografia LTDA" />
            </div>
            <div>
              <Label>CPF/CNPJ</Label>
              <Input value={empresaAtiva.documento} onChange={(e) => set({ documento: e.target.value })} />
            </div>
            <div>
              <Label>Telefone/WhatsApp</Label>
              <Input value={empresaAtiva.telefone} onChange={(e) => set({ telefone: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={empresaAtiva.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div>
              <Label>Site/Instagram</Label>
              <Input value={empresaAtiva.site} onChange={(e) => set({ site: e.target.value })} />
            </div>
            <div>
              <Label>Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={empresaAtiva.corPrimaria}
                  onChange={(e) => set({ corPrimaria: e.target.value })}
                  className="h-9 w-11 cursor-pointer rounded-md border border-border-strong bg-surface p-1"
                />
                <Input value={empresaAtiva.corPrimaria} onChange={(e) => set({ corPrimaria: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Moeda padrão</Label>
              <Select value={empresaAtiva.moeda} onValueChange={(v) => set({ moeda: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOEDAS.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Label>Endereço</Label>
            <Input value={empresaAtiva.endereco} onChange={(e) => set({ endereco: e.target.value })} />
          </div>
        </fieldset>
      </Card>

      <Card className="mb-5">
        <fieldset>
          <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Pagamento e condições</legend>
          <div className="mb-3">
            <Label>Dados bancários / Pix (aparece no orçamento)</Label>
            <Textarea rows={2} value={empresaAtiva.dadosBancarios} onChange={(e) => set({ dadosBancarios: e.target.value })} placeholder="Chave Pix, banco, agência/conta..." />
          </div>
          <div>
            <Label>Condições de pagamento padrão</Label>
            <Textarea rows={2} value={empresaAtiva.condicoesPadrao} onChange={(e) => set({ condicoesPadrao: e.target.value })} />
          </div>
        </fieldset>
      </Card>

      <Card>
        <fieldset>
          <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Backup dos dados</legend>
          <p className="mb-3 text-[13px] text-text-muted">
            Todos os dados (todas as empresas) ficam salvos só neste navegador. Exporte um backup regularmente e guarde em local seguro — é a única forma de levar seus dados para outro computador.
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
