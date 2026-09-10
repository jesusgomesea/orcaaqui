"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSessao } from "@/components/auth/ProvedorSessao";
import { uuid, todayStr } from "./helpers";
import { NOVIDADES } from "./changelog";
import type {
  Cliente,
  Empresa,
  EstadoApp,
  EstadoImportado,
  Orcamento,
  Servico,
} from "./tipos";

/** Chave usada pela versão sem login, que guardava tudo só no navegador. */
const CHAVE_LOCAL_LEGADA = "orcaaqui-dados-v1";
/** Para onde o backup local vai depois de subir para a conta. */
const CHAVE_LOCAL_MIGRADA = "orcaaqui-dados-migrado-v1";

const ESPERA_ANTES_DE_SALVAR = 700;

function defaultEmpresa(): Empresa {
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

export function defaultState(): EstadoApp {
  const empresa = defaultEmpresa();
  return {
    empresaAtivaId: empresa.id,
    empresas: [empresa],
    novidadesVistoId: NOVIDADES[0]?.id || null,
  };
}

function mergeEmpresa(parcial: Partial<Empresa>): Empresa {
  return { ...defaultEmpresa(), ...parcial, id: parcial.id || uuid() };
}

// Dados salvos antes do suporte a múltiplas empresas eram um único objeto
// `{ empresa, clientes, orcamentos }` no topo do state. Migra pra dentro de
// `empresas: [...]` pra não perder nada de quem já usava — vale tanto pro que
// vem do localStorage antigo quanto pro backup JSON importado.
function migrarSeNecessario(raw: EstadoImportado): Partial<EstadoApp> | null {
  if (raw.empresas) return raw as Partial<EstadoApp>;
  if (!raw.empresa) return null;
  const empresa = mergeEmpresa({
    ...raw.empresa,
    clientes: raw.clientes || [],
    orcamentos: raw.orcamentos || [],
    servicos: raw.servicos || [],
  });
  return { empresaAtivaId: empresa.id, empresas: [empresa] };
}

/** Normaliza qualquer entrada (servidor, backup, localStorage) num EstadoApp. */
function normalizar(bruto: EstadoImportado | null | undefined): EstadoApp | null {
  if (!bruto) return null;
  const migrado = migrarSeNecessario(bruto);
  if (!migrado?.empresas?.length) return null;
  const empresas = migrado.empresas.map(mergeEmpresa);
  const empresaAtivaId = empresas.some((e) => e.id === migrado.empresaAtivaId)
    ? (migrado.empresaAtivaId as string)
    : empresas[0].id;
  return { empresaAtivaId, empresas, novidadesVistoId: migrado.novidadesVistoId ?? null };
}

/** Dados que ficaram neste navegador na época em que o app não tinha login. */
function lerLegadoDoNavegador(): EstadoApp | null {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL_LEGADA);
    if (!raw) return null;
    return normalizar(JSON.parse(raw));
  } catch (e) {
    console.error("Não foi possível ler os dados antigos deste navegador.", e);
    return null;
  }
}

/**
 * Some com a chave antiga (guardando uma cópia) assim que os dados sobem pra
 * conta. Sem isso, quem entrasse depois com outra conta neste mesmo navegador
 * importaria os dados do primeiro.
 */
function arquivarLegadoDoNavegador() {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL_LEGADA);
    if (raw === null) return;
    localStorage.setItem(CHAVE_LOCAL_MIGRADA, raw);
    localStorage.removeItem(CHAVE_LOCAL_LEGADA);
  } catch (e) {
    console.error("Não foi possível arquivar os dados antigos deste navegador.", e);
  }
}

export type StatusSincronizacao = "ocioso" | "salvando" | "erro";

interface StoreValue {
  state: EstadoApp;
  empresaAtiva: Empresa;
  statusSincronizacao: StatusSincronizacao;
  setState: Dispatch<SetStateAction<EstadoApp>>;
  importState: (novoEstado: EstadoImportado) => void;
  updateEmpresaAtiva: (patch: Partial<Empresa>) => void;
  addEmpresa: (dados?: Partial<Empresa>) => Empresa;
  removeEmpresa: (id: string) => void;
  switchEmpresa: (id: string) => void;
  addCliente: (cliente: Partial<Cliente>) => Cliente;
  addClientes: (clientes: Partial<Cliente>[]) => Cliente[];
  updateCliente: (id: string, patch: Partial<Cliente>) => void;
  removeCliente: (id: string) => void;
  addOrcamento: (orcamento: Partial<Orcamento>) => Orcamento;
  updateOrcamento: (id: string, patch: Partial<Orcamento>) => void;
  removeOrcamento: (id: string) => void;
  addServico: (servico: Partial<Servico>) => Servico;
  updateServico: (id: string, patch: Partial<Servico>) => void;
  removeServico: (id: string) => void;
  marcarNovidadesVistas: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function clienteVazio(): Cliente {
  return { id: uuid(), nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "" };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { usuario } = useSessao();
  const [state, setState] = useState<EstadoApp | null>(null);
  const [erroDeCarga, setErroDeCarga] = useState("");
  const [statusSincronizacao, setStatusSincronizacao] = useState<StatusSincronizacao>("ocioso");

  // Guarda o que já foi gravado no servidor pra não reenviar o que acabou de
  // chegar dele, e pra saber o que falta salvar ao fechar a aba.
  const ultimoSalvo = useRef<string | null>(null);
  const pendente = useRef<EstadoApp | null>(null);

  const salvar = useCallback(async (estado: EstadoApp) => {
    const corpo = JSON.stringify(estado);
    setStatusSincronizacao("salvando");
    try {
      const resposta = await fetch("/api/dados", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: corpo,
      });
      if (!resposta.ok) throw new Error(`Falha ao salvar (${resposta.status})`);
      ultimoSalvo.current = corpo;
      pendente.current = null;
      setStatusSincronizacao("ocioso");
    } catch (e) {
      console.error("Não foi possível salvar os dados na sua conta.", e);
      setStatusSincronizacao("erro");
    }
  }, []);

  // Carga inicial: busca o estado da conta; se ainda não existir, sobe o que
  // houver neste navegador (migração de quem usava a versão sem login).
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;

    (async () => {
      try {
        const resposta = await fetch("/api/dados");
        if (!resposta.ok) throw new Error(`Falha ao carregar (${resposta.status})`);
        const { estado } = (await resposta.json()) as { estado: EstadoImportado | null };
        if (!vivo) return;

        const doServidor = normalizar(estado);
        if (doServidor) {
          ultimoSalvo.current = JSON.stringify(doServidor);
          setState(doServidor);
          return;
        }

        const legado = lerLegadoDoNavegador();
        const inicial = legado || defaultState();
        setState(inicial);
        await salvar(inicial);
        if (legado) arquivarLegadoDoNavegador();
      } catch (e) {
        if (!vivo) return;
        console.error("Não foi possível carregar os dados da sua conta.", e);
        setErroDeCarga("Não foi possível carregar seus dados. Verifique a conexão e recarregue a página.");
      }
    })();

    return () => {
      vivo = false;
    };
  }, [usuario, salvar]);

  // Salva com folga: digitar num campo não dispara uma requisição por tecla.
  useEffect(() => {
    if (!state) return;
    const corpo = JSON.stringify(state);
    if (corpo === ultimoSalvo.current) return;
    pendente.current = state;
    const id = setTimeout(() => {
      // A carga inicial de uma conta nova já grava direto; sem esta segunda
      // checagem o debounce repetiria a mesma escrita logo em seguida.
      if (JSON.stringify(state) === ultimoSalvo.current) {
        pendente.current = null;
        return;
      }
      void salvar(state);
    }, ESPERA_ANTES_DE_SALVAR);
    return () => clearTimeout(id);
  }, [state, salvar]);

  // Fechar a aba dentro da janela do debounce perderia a última alteração.
  useEffect(() => {
    const aoSair = () => {
      const estado = pendente.current;
      if (!estado) return;
      fetch("/api/dados", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(estado),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

  const importState = useCallback((novoEstado: EstadoImportado) => {
    const normalizado = normalizar(novoEstado);
    if (!normalizado) return;
    setState(normalizado);
  }, []);

  // Aplica `updater` só na empresa ativa dentro do array `empresas`.
  const patchEmpresaAtiva = useCallback((updater: (e: Empresa) => Empresa) => {
    setState((s) =>
      s ? { ...s, empresas: s.empresas.map((e) => (e.id === s.empresaAtivaId ? updater(e) : e)) } : s
    );
  }, []);

  const updateEmpresaAtiva = useCallback(
    (patch: Partial<Empresa>) => patchEmpresaAtiva((e) => ({ ...e, ...patch })),
    [patchEmpresaAtiva]
  );

  const addEmpresa = useCallback((dados?: Partial<Empresa>) => {
    const nova = mergeEmpresa(dados || {});
    setState((s) => (s ? { ...s, empresas: [...s.empresas, nova], empresaAtivaId: nova.id } : s));
    return nova;
  }, []);

  const removeEmpresa = useCallback((id: string) => {
    setState((s) => {
      if (!s || s.empresas.length <= 1) return s;
      const empresas = s.empresas.filter((e) => e.id !== id);
      const empresaAtivaId = s.empresaAtivaId === id ? empresas[0].id : s.empresaAtivaId;
      return { ...s, empresas, empresaAtivaId };
    });
  }, []);

  const switchEmpresa = useCallback((id: string) => {
    setState((s) => (s && s.empresas.some((e) => e.id === id) ? { ...s, empresaAtivaId: id } : s));
  }, []);

  const addCliente = useCallback(
    (cliente: Partial<Cliente>) => {
      const novo = { ...clienteVazio(), ...cliente, id: uuid() };
      patchEmpresaAtiva((e) => ({ ...e, clientes: [...e.clientes, novo] }));
      return novo;
    },
    [patchEmpresaAtiva]
  );
  const addClientes = useCallback(
    (clientes: Partial<Cliente>[]) => {
      const novos = clientes.map((c) => ({ ...clienteVazio(), ...c, id: uuid() }));
      patchEmpresaAtiva((e) => ({ ...e, clientes: [...e.clientes, ...novos] }));
      return novos;
    },
    [patchEmpresaAtiva]
  );
  const updateCliente = useCallback(
    (id: string, patch: Partial<Cliente>) => {
      patchEmpresaAtiva((e) => ({ ...e, clientes: e.clientes.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    },
    [patchEmpresaAtiva]
  );
  const removeCliente = useCallback(
    (id: string) => patchEmpresaAtiva((e) => ({ ...e, clientes: e.clientes.filter((c) => c.id !== id) })),
    [patchEmpresaAtiva]
  );

  const addOrcamento = useCallback(
    (orcamento: Partial<Orcamento>) => {
      const novo = { id: uuid(), criadoEm: todayStr(), ...orcamento } as Orcamento;
      patchEmpresaAtiva((e) => ({ ...e, orcamentos: [...e.orcamentos, novo] }));
      return novo;
    },
    [patchEmpresaAtiva]
  );
  const updateOrcamento = useCallback(
    (id: string, patch: Partial<Orcamento>) => {
      patchEmpresaAtiva((e) => ({ ...e, orcamentos: e.orcamentos.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
    },
    [patchEmpresaAtiva]
  );
  const removeOrcamento = useCallback(
    (id: string) => patchEmpresaAtiva((e) => ({ ...e, orcamentos: e.orcamentos.filter((o) => o.id !== id) })),
    [patchEmpresaAtiva]
  );

  const addServico = useCallback(
    (servico: Partial<Servico>) => {
      const novo = { id: uuid(), categoria: "", nome: "", descricao: "", valor: 0, ...servico, } as Servico;
      patchEmpresaAtiva((e) => ({ ...e, servicos: [...e.servicos, novo] }));
      return novo;
    },
    [patchEmpresaAtiva]
  );
  const updateServico = useCallback(
    (id: string, patch: Partial<Servico>) => {
      patchEmpresaAtiva((e) => ({ ...e, servicos: e.servicos.map((sv) => (sv.id === id ? { ...sv, ...patch } : sv)) }));
    },
    [patchEmpresaAtiva]
  );
  const removeServico = useCallback(
    (id: string) => patchEmpresaAtiva((e) => ({ ...e, servicos: e.servicos.filter((sv) => sv.id !== id) })),
    [patchEmpresaAtiva]
  );

  const marcarNovidadesVistas = useCallback(() => {
    setState((s) => (s ? { ...s, novidadesVistoId: NOVIDADES[0]?.id || null } : s));
  }, []);

  const empresaAtiva = state ? state.empresas.find((e) => e.id === state.empresaAtivaId) || state.empresas[0] : null;

  const value = useMemo<StoreValue | null>(
    () =>
      state && empresaAtiva
        ? {
            state,
            empresaAtiva,
            statusSincronizacao,
            setState: setState as Dispatch<SetStateAction<EstadoApp>>,
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
          }
        : null,
    [
      state, empresaAtiva, statusSincronizacao, importState, updateEmpresaAtiva, addEmpresa, removeEmpresa, switchEmpresa,
      addCliente, addClientes, updateCliente, removeCliente,
      addOrcamento, updateOrcamento, removeOrcamento,
      addServico, updateServico, removeServico,
      marcarNovidadesVistas,
    ]
  );

  if (erroDeCarga) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-sm text-[13.5px] text-danger">{erroDeCarga}</p>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13.5px] text-text-muted">Carregando seus dados…</p>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
