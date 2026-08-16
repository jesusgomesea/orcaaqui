import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { uuid, todayStr } from "./helpers";
import { NOVIDADES } from "./changelog";

const STORAGE_KEY = "orcaaqui-dados-v1";

function defaultEmpresa() {
  return {
    id: uuid(),
    nome: "",
    documento: "",
    telefone: "",
    email: "",
    site: "",
    endereco: "",
    logoDataUrl: "",
    corPrimaria: "#2563eb",
    moeda: "BRL",
    dadosBancarios: "",
    condicoesPadrao: "Sinal de 50% na confirmação, restante na entrega.",
    clientes: [],
    orcamentos: [],
    servicos: [],
  };
}

export function defaultState() {
  const empresa = defaultEmpresa();
  return {
    empresaAtivaId: empresa.id,
    empresas: [empresa],
    novidadesVistoId: NOVIDADES[0]?.id || null,
  };
}

function mergeEmpresa(parcial) {
  return { ...defaultEmpresa(), ...parcial, id: parcial.id || uuid() };
}

// Dados salvos antes do suporte a múltiplas empresas eram um único objeto
// `{ empresa, clientes, orcamentos }` no topo do state. Migra pra dentro de
// `empresas: [...]` na primeira carga pra não perder nada de quem já usava.
function migrarSeNecessario(raw) {
  if (raw.empresas) return raw;
  if (!raw.empresa) return null;
  const empresa = mergeEmpresa({
    ...raw.empresa,
    clientes: raw.clientes || [],
    orcamentos: raw.orcamentos || [],
    servicos: raw.servicos || [],
  });
  return { empresaAtivaId: empresa.id, empresas: [empresa] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = migrarSeNecessario(JSON.parse(raw));
    if (!parsed || !parsed.empresas?.length) return defaultState();
    const empresas = parsed.empresas.map(mergeEmpresa);
    const empresaAtivaId = empresas.some((e) => e.id === parsed.empresaAtivaId) ? parsed.empresaAtivaId : empresas[0].id;
    return { empresaAtivaId, empresas, novidadesVistoId: parsed.novidadesVistoId ?? null };
  } catch (e) {
    console.error("Falha ao carregar dados salvos, iniciando vazio.", e);
    return defaultState();
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const importState = useCallback((novoEstado) => {
    const migrado = migrarSeNecessario(novoEstado) || novoEstado;
    if (!migrado.empresas?.length) return;
    const empresas = migrado.empresas.map(mergeEmpresa);
    const empresaAtivaId = empresas.some((e) => e.id === migrado.empresaAtivaId) ? migrado.empresaAtivaId : empresas[0].id;
    setState({ empresaAtivaId, empresas, novidadesVistoId: migrado.novidadesVistoId ?? null });
  }, []);

  // Aplica `updater` só na empresa ativa dentro do array `empresas`.
  const patchEmpresaAtiva = useCallback((updater) => {
    setState((s) => ({
      ...s,
      empresas: s.empresas.map((e) => (e.id === s.empresaAtivaId ? updater(e) : e)),
    }));
  }, []);

  const updateEmpresaAtiva = useCallback((patch) => {
    patchEmpresaAtiva((e) => ({ ...e, ...patch }));
  }, [patchEmpresaAtiva]);

  const addEmpresa = useCallback((dados) => {
    const nova = mergeEmpresa(dados || {});
    setState((s) => ({ ...s, empresas: [...s.empresas, nova], empresaAtivaId: nova.id }));
    return nova;
  }, []);

  const removeEmpresa = useCallback((id) => {
    setState((s) => {
      if (s.empresas.length <= 1) return s;
      const empresas = s.empresas.filter((e) => e.id !== id);
      const empresaAtivaId = s.empresaAtivaId === id ? empresas[0].id : s.empresaAtivaId;
      return { ...s, empresas, empresaAtivaId };
    });
  }, []);

  const switchEmpresa = useCallback((id) => {
    setState((s) => (s.empresas.some((e) => e.id === id) ? { ...s, empresaAtivaId: id } : s));
  }, []);

  const addCliente = useCallback((cliente) => {
    const novo = { id: uuid(), nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "", ...cliente };
    patchEmpresaAtiva((e) => ({ ...e, clientes: [...e.clientes, novo] }));
    return novo;
  }, [patchEmpresaAtiva]);
  const addClientes = useCallback((clientes) => {
    const novos = clientes.map((c) => ({ id: uuid(), nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "", ...c }));
    patchEmpresaAtiva((e) => ({ ...e, clientes: [...e.clientes, ...novos] }));
    return novos;
  }, [patchEmpresaAtiva]);
  const updateCliente = useCallback((id, patch) => {
    patchEmpresaAtiva((e) => ({ ...e, clientes: e.clientes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, [patchEmpresaAtiva]);
  const removeCliente = useCallback((id) => {
    patchEmpresaAtiva((e) => ({ ...e, clientes: e.clientes.filter((c) => c.id !== id) }));
  }, [patchEmpresaAtiva]);

  const addOrcamento = useCallback((orcamento) => {
    const novo = { id: uuid(), criadoEm: todayStr(), ...orcamento };
    patchEmpresaAtiva((e) => ({ ...e, orcamentos: [...e.orcamentos, novo] }));
    return novo;
  }, [patchEmpresaAtiva]);
  const updateOrcamento = useCallback((id, patch) => {
    patchEmpresaAtiva((e) => ({ ...e, orcamentos: e.orcamentos.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  }, [patchEmpresaAtiva]);
  const removeOrcamento = useCallback((id) => {
    patchEmpresaAtiva((e) => ({ ...e, orcamentos: e.orcamentos.filter((o) => o.id !== id) }));
  }, [patchEmpresaAtiva]);

  const addServico = useCallback((servico) => {
    const novo = { id: uuid(), categoria: "", nome: "", descricao: "", valor: 0, ...servico };
    patchEmpresaAtiva((e) => ({ ...e, servicos: [...e.servicos, novo] }));
    return novo;
  }, [patchEmpresaAtiva]);
  const updateServico = useCallback((id, patch) => {
    patchEmpresaAtiva((e) => ({ ...e, servicos: e.servicos.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)) }));
  }, [patchEmpresaAtiva]);
  const removeServico = useCallback((id) => {
    patchEmpresaAtiva((e) => ({ ...e, servicos: e.servicos.filter((sv) => sv.id !== id) }));
  }, [patchEmpresaAtiva]);

  const marcarNovidadesVistas = useCallback(() => {
    setState((s) => ({ ...s, novidadesVistoId: NOVIDADES[0]?.id || null }));
  }, []);

  const empresaAtiva = state.empresas.find((e) => e.id === state.empresaAtivaId) || state.empresas[0];

  const value = useMemo(
    () => ({
      state,
      empresaAtiva,
      setState,
      importState,
      updateEmpresaAtiva,
      addEmpresa,
      removeEmpresa,
      switchEmpresa,
      addCliente,
      addClientes,
      updateCliente,
      removeCliente,
      addOrcamento,
      updateOrcamento,
      removeOrcamento,
      addServico,
      updateServico,
      removeServico,
      marcarNovidadesVistas,
    }),
    [
      state, empresaAtiva, importState, updateEmpresaAtiva, addEmpresa, removeEmpresa, switchEmpresa,
      addCliente, addClientes, updateCliente, removeCliente,
      addOrcamento, updateOrcamento, removeOrcamento,
      addServico, updateServico, removeServico,
      marcarNovidadesVistas,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
