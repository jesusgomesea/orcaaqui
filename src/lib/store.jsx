import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { uuid, todayStr } from "./helpers";

const STORAGE_KEY = "orcaaqui-dados-v1";

export function defaultState() {
  return {
    empresa: {
      nome: "",
      documento: "",
      telefone: "",
      email: "",
      site: "",
      endereco: "",
      logoDataUrl: "",
      corPrimaria: "#2563eb",
      dadosBancarios: "",
      condicoesPadrao: "Sinal de 50% na confirmação, restante na entrega.",
    },
    clientes: [],
    orcamentos: [],
  };
}

function mergeState(base, parcial) {
  return {
    ...base,
    ...parcial,
    empresa: { ...base.empresa, ...(parcial.empresa || {}) },
    clientes: parcial.clientes || [],
    orcamentos: parcial.orcamentos || [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return mergeState(defaultState(), JSON.parse(raw));
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
    setState(mergeState(defaultState(), novoEstado));
  }, []);

  const updateEmpresa = useCallback((patch) => {
    setState((s) => ({ ...s, empresa: { ...s.empresa, ...patch } }));
  }, []);

  const addCliente = useCallback((cliente) => {
    const novo = { id: uuid(), nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "", ...cliente };
    setState((s) => ({ ...s, clientes: [...s.clientes, novo] }));
    return novo;
  }, []);
  const updateCliente = useCallback((id, patch) => {
    setState((s) => ({ ...s, clientes: s.clientes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, []);
  const removeCliente = useCallback((id) => {
    setState((s) => ({ ...s, clientes: s.clientes.filter((c) => c.id !== id) }));
  }, []);

  const addOrcamento = useCallback((orcamento) => {
    const novo = { id: uuid(), criadoEm: todayStr(), ...orcamento };
    setState((s) => ({ ...s, orcamentos: [...s.orcamentos, novo] }));
    return novo;
  }, []);
  const updateOrcamento = useCallback((id, patch) => {
    setState((s) => ({ ...s, orcamentos: s.orcamentos.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  }, []);
  const removeOrcamento = useCallback((id) => {
    setState((s) => ({ ...s, orcamentos: s.orcamentos.filter((o) => o.id !== id) }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      setState,
      importState,
      updateEmpresa,
      addCliente,
      updateCliente,
      removeCliente,
      addOrcamento,
      updateOrcamento,
      removeOrcamento,
    }),
    [state, importState, updateEmpresa, addCliente, updateCliente, removeCliente, addOrcamento, updateOrcamento, removeOrcamento]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
