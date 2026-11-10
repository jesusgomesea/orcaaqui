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
import { comprimirLogo, LIMITE_LOGO_LEVE } from "./imagem";
import { codigoServicoLivre, defaultState, mergeEmpresa, mudouPreco, normalizar, subirVersaoCatalogo } from "./estado";
import { agendarOrcamento, aprovarLeitura, type LeituraColada, type ResultadoAprovacao } from "./colar";
import type {
  Agendamento,
  Cliente,
  ConfigEmpresa,
  Empresa,
  EstadoApp,
  EstadoImportado,
  Orcamento,
  Saida,
  Servico,
} from "./tipos";

/** Chave usada pela versão sem login, que guardava tudo só no navegador. */
const CHAVE_LOCAL_LEGADA = "orcaaqui-dados-v1";
/** Para onde o backup local vai depois de subir para a conta. */
const CHAVE_LOCAL_MIGRADA = "orcaaqui-dados-migrado-v1";

const ESPERA_ANTES_DE_SALVAR = 700;

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

/** `conflito`: outro aparelho gravou antes; os salvamentos param até recarregar. */
export type StatusSincronizacao = "ocioso" | "salvando" | "erro" | "conflito";

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
  addOrcamento: (orcamento: Partial<Orcamento>) => void;
  updateOrcamento: (id: string, patch: Partial<Orcamento>) => void;
  removeOrcamento: (id: string) => void;
  addServico: (servico: Partial<Servico>) => Servico;
  updateServico: (id: string, patch: Partial<Servico>) => void;
  removeServico: (id: string) => void;
  marcarNovidadesVistas: () => void;
  updateConfig: (patch: Partial<ConfigEmpresa>) => void;
  /** Aplica o % do sinal a todas as empresas da conta (orçamentos já criados mantêm o seu). */
  aplicarSinalATodas: (percentual: number) => void;
  /** Colar orçamento: cliente + orçamento aprovado + agendamento (ver lib/colar.ts). */
  aprovarColagem: (leitura: LeituraColada) => ResultadoAprovacao;
  /** "Cliente aprovou → agendar" a partir de um orçamento salvo. */
  agendarOrcamento: (orcamentoId: string) => { agendamentoId: string; jaExistia: boolean } | null;
  updateAgendamento: (id: string, alterar: (a: Agendamento) => Agendamento) => void;
  removeAgendamento: (id: string) => void;
  addSaida: (saida: Omit<Saida, "id">) => Saida;
  updateSaida: (id: string, patch: Partial<Omit<Saida, "id">>) => void;
  removeSaida: (id: string) => void;
  /**
   * Grava agora o que estiver pendente (sem esperar o debounce). Usado antes
   * de gerar contrato/recibo, porque o servidor lê os dados já gravados.
   * Devolve false se a gravação falhar.
   */
  garantirSalvo: () => Promise<boolean>;
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

  // Versão (etag do Blobs) que este aparelho carregou ou gravou por último. O
  // servidor só aceita gravar por cima dela: se outro aparelho salvou no meio,
  // vem 409 e o app pede para recarregar, em vez de apagar o que o outro salvou.
  const versao = useRef<string | null>(null);
  const conflito = useRef(false);
  // Salvamentos em fila: dois PUTs ao mesmo tempo mandariam a mesma versão e o
  // segundo bateria no primeiro (falso conflito com o próprio aparelho).
  const fila = useRef<Promise<unknown>>(Promise.resolve());

  const salvar = useCallback((estado: EstadoApp): Promise<boolean> => {
    const tarefa = fila.current.then(async () => {
      if (conflito.current) return false;
      const corpo = JSON.stringify(estado);
      if (corpo === ultimoSalvo.current) {
        if (pendente.current === estado) pendente.current = null;
        return true;
      }
      setStatusSincronizacao("salvando");
      try {
        const resposta = await fetch("/api/dados", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado, versaoBase: versao.current }),
        });
        if (resposta.status === 409) {
          conflito.current = true;
          setStatusSincronizacao("conflito");
          return false;
        }
        if (!resposta.ok) throw new Error(`Falha ao salvar (${resposta.status})`);
        const { versao: nova } = (await resposta.json().catch(() => ({}))) as { versao?: string | null };
        versao.current = nova ?? null;
        ultimoSalvo.current = corpo;
        // Só limpa se não chegou alteração mais nova enquanto este PUT viajava.
        if (pendente.current === estado) pendente.current = null;
        setStatusSincronizacao("ocioso");
        return true;
      } catch (e) {
        console.error("Não foi possível salvar os dados na sua conta.", e);
        setStatusSincronizacao("erro");
        return false;
      }
    });
    fila.current = tarefa.catch(() => {});
    return tarefa;
  }, []);

  // `pendente` já guarda o estado ainda não gravado (o efeito do debounce o
  // preenche a cada alteração); vazio = nada a salvar.
  const garantirSalvo = useCallback(async () => {
    const estado = pendente.current;
    if (!estado) return true;
    return salvar(estado);
  }, [salvar]);

  // Carga inicial: busca o estado da conta; se ainda não existir, sobe o que
  // houver neste navegador (migração de quem usava a versão sem login).
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;

    (async () => {
      try {
        const resposta = await fetch("/api/dados");
        if (!resposta.ok) {
          // A rota devolve a causa (etapa que travou, última resposta do Blobs).
          const { erro } = (await resposta.json().catch(() => ({}))) as { erro?: string };
          throw new Error(erro || `Falha ao carregar (${resposta.status})`);
        }
        const { estado, versao: lida } = (await resposta.json()) as { estado: EstadoImportado | null; versao?: string | null };
        if (!vivo) return;
        versao.current = lida ?? null;

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
        const detalhe = e instanceof Error && !e.message.startsWith("Failed to fetch") ? ` Detalhe: ${e.message}` : "";
        setErroDeCarga(`Não foi possível carregar seus dados. Verifique a conexão e recarregue a página.${detalhe}`);
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
      if (!estado || conflito.current) return;
      fetch("/api/dados", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, versaoBase: versao.current }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

  // Logos gravadas antes da compressão (até 1,5 MB em base64) iam em todo
  // salvamento. Comprime uma vez por sessão, no navegador, e salva normalmente.
  const logosConferidas = useRef(false);
  useEffect(() => {
    if (!state || logosConferidas.current) return;
    logosConferidas.current = true;
    const pesadas = state.empresas.filter((e) => e.logoDataUrl.length > LIMITE_LOGO_LEVE);
    for (const empresa of pesadas) {
      comprimirLogo(empresa.logoDataUrl)
        .then((leve) => {
          if (leve.length >= empresa.logoDataUrl.length) return;
          setState((s) =>
            s
              ? {
                  ...s,
                  empresas: s.empresas.map((e) =>
                    e.id === empresa.id && e.logoDataUrl === empresa.logoDataUrl ? { ...e, logoDataUrl: leve } : e
                  ),
                }
              : s
          );
        })
        .catch(() => {});
    }
  }, [state]);

  // Voltou para o app (outra aba, celular desbloqueado…): se não há nada
  // pendente aqui, busca a versão mais nova do servidor. Assim o que foi salvo
  // no outro aparelho aparece sozinho e o conflito quase não acontece.
  useEffect(() => {
    if (!usuario) return;
    let buscando = false;
    const aoVoltar = async () => {
      if (document.visibilityState !== "visible" || buscando || conflito.current || pendente.current) return;
      buscando = true;
      try {
        await fila.current;
        const resposta = await fetch("/api/dados", { cache: "no-store" });
        if (!resposta.ok) return;
        const { estado, versao: lida } = (await resposta.json()) as { estado: EstadoImportado | null; versao?: string | null };
        if (!lida || lida === versao.current || pendente.current) return;
        const novo = normalizar(estado);
        if (!novo) return;
        versao.current = lida;
        ultimoSalvo.current = JSON.stringify(novo);
        setState(novo);
      } catch {
        // Sem rede: fica com o que tem; o próximo salvamento confere a versão.
      } finally {
        buscando = false;
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [usuario]);

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
      // O número sai do contador da empresa, então precisa ser resolvido aqui
      // dentro. `numero` vem depois do spread de propósito: duplicar um
      // orçamento traz o número do original, e o novo tem que ganhar o seu.
      patchEmpresaAtiva((e) => {
        const numero = e.proximoNumero;
        const novo = { id: uuid(), criadoEm: todayStr(), ...orcamento, numero } as Orcamento;
        return { ...e, orcamentos: [...e.orcamentos, novo], proximoNumero: numero + 1 };
      });
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
    (id: string) =>
      patchEmpresaAtiva((e) => ({
        ...e,
        orcamentos: e.orcamentos.filter((o) => o.id !== id),
        // A saída continua (o dinheiro saiu); só perde o vínculo com o trabalho.
        saidas: e.saidas.map((sd) => (sd.orcamentoId === id ? { ...sd, orcamentoId: undefined } : sd)),
      })),
    [patchEmpresaAtiva]
  );

  const addServico = useCallback(
    (servico: Partial<Servico>) => {
      const novo = { id: uuid(), categoria: "", nome: "", descricao: "", valor: 0, ...servico } as Servico;
      patchEmpresaAtiva((e) => {
        const usados = new Set(e.servicos.map((sv) => sv.codigo).filter((c): c is string => !!c));
        // Determinístico (derivado do id): rodar duas vezes no StrictMode dá o mesmo código.
        novo.codigo = novo.codigo && !usados.has(novo.codigo) ? novo.codigo : codigoServicoLivre(novo.id, usados);
        return { ...e, servicos: [...e.servicos, novo] };
      });
      return novo;
    },
    [patchEmpresaAtiva]
  );
  const updateServico = useCallback(
    (id: string, patch: Partial<Servico>) => {
      patchEmpresaAtiva((e) => {
        const antes = e.servicos.find((sv) => sv.id === id);
        const { codigo: _codigo, ...semCodigo } = patch; // o código é fixo: está em mensagens já enviadas
        const depois = antes ? { ...antes, ...semCodigo } : undefined;
        return {
          ...e,
          servicos: e.servicos.map((sv) => (sv.id === id && depois ? depois : sv)),
          config: antes && depois && mudouPreco(antes, depois) ? subirVersaoCatalogo(e.config) : e.config,
        };
      });
    },
    [patchEmpresaAtiva]
  );
  const removeServico = useCallback(
    (id: string) =>
      patchEmpresaAtiva((e) => ({
        ...e,
        servicos: e.servicos.filter((sv) => sv.id !== id),
        // Orçamentos com este serviço na [ref] não recalculam mais igual: avisa como tabela antiga.
        config: subirVersaoCatalogo(e.config),
      })),
    [patchEmpresaAtiva]
  );

  const updateConfig = useCallback(
    (patch: Partial<ConfigEmpresa>) => patchEmpresaAtiva((e) => ({ ...e, config: { ...e.config, ...patch } })),
    [patchEmpresaAtiva]
  );
  const aplicarSinalATodas = useCallback((percentual: number) => {
    setState((s) =>
      s ? { ...s, empresas: s.empresas.map((e) => ({ ...e, config: { ...e.config, sinalPercentual: percentual } })) } : s
    );
  }, []);

  const marcarNovidadesVistas = useCallback(() => {
    setState((s) => (s ? { ...s, novidadesVistoId: NOVIDADES[0]?.id || null } : s));
  }, []);

  const empresaAtiva = state ? state.empresas.find((e) => e.id === state.empresaAtivaId) || state.empresas[0] : null;

  // Aprovação e agendamento são calculados sobre a empresa ativa de agora (funções puras de
  // lib/colar.ts) e gravados de uma vez — quem chama precisa dos ids criados na hora.
  const aprovarColagem = useCallback(
    (leitura: LeituraColada) => {
      if (!empresaAtiva) throw new Error("Dados ainda não carregados.");
      const r = aprovarLeitura(empresaAtiva, leitura);
      patchEmpresaAtiva(() => r.empresa);
      return r;
    },
    [empresaAtiva, patchEmpresaAtiva]
  );
  const agendarOrcamentoAtivo = useCallback(
    (orcamentoId: string) => {
      if (!empresaAtiva) return null;
      const r = agendarOrcamento(empresaAtiva, orcamentoId);
      if (!r) return null;
      patchEmpresaAtiva(() => r.empresa);
      return { agendamentoId: r.agendamentoId, jaExistia: r.jaExistia };
    },
    [empresaAtiva, patchEmpresaAtiva]
  );
  const updateAgendamento = useCallback(
    (id: string, alterar: (a: Agendamento) => Agendamento) =>
      patchEmpresaAtiva((e) => ({
        ...e,
        agendamentos: e.agendamentos.map((a) => (a.id === id ? { ...alterar(a), atualizadoEm: new Date().toISOString() } : a)),
      })),
    [patchEmpresaAtiva]
  );
  const removeAgendamento = useCallback(
    (id: string) => patchEmpresaAtiva((e) => ({ ...e, agendamentos: e.agendamentos.filter((a) => a.id !== id) })),
    [patchEmpresaAtiva]
  );

  const addSaida = useCallback(
    (saida: Omit<Saida, "id">) => {
      const nova: Saida = { ...saida, id: uuid() };
      patchEmpresaAtiva((e) => ({ ...e, saidas: [...e.saidas, nova] }));
      return nova;
    },
    [patchEmpresaAtiva]
  );
  const updateSaida = useCallback(
    (id: string, patch: Partial<Omit<Saida, "id">>) =>
      patchEmpresaAtiva((e) => ({ ...e, saidas: e.saidas.map((sd) => (sd.id === id ? { ...sd, ...patch } : sd)) })),
    [patchEmpresaAtiva]
  );
  const removeSaida = useCallback(
    (id: string) => patchEmpresaAtiva((e) => ({ ...e, saidas: e.saidas.filter((sd) => sd.id !== id) })),
    [patchEmpresaAtiva]
  );

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
            garantirSalvo,
            updateConfig,
            aplicarSinalATodas,
            aprovarColagem,
            agendarOrcamento: agendarOrcamentoAtivo,
            updateAgendamento,
            removeAgendamento,
            addSaida,
            updateSaida,
            removeSaida,
          }
        : null,
    [
      state, empresaAtiva, statusSincronizacao, importState, updateEmpresaAtiva, addEmpresa, removeEmpresa, switchEmpresa,
      addCliente, addClientes, updateCliente, removeCliente,
      addOrcamento, updateOrcamento, removeOrcamento,
      addServico, updateServico, removeServico,
      marcarNovidadesVistas, garantirSalvo, updateConfig, aplicarSinalATodas,
      aprovarColagem, agendarOrcamentoAtivo, updateAgendamento, removeAgendamento,
      addSaida, updateSaida, removeSaida,
    ]
  );

  if (erroDeCarga) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-sm text-[13.5px] text-danger">{erroDeCarga}</p>
      </div>
    );
  }

  // Falso positivo: `value` carrega `garantirSalvo`, que lê `pendente.current`,
  // mas só quando chamado num clique — nunca durante a renderização.
  // oxlint-disable-next-line react/refs
  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13.5px] text-text-muted">Carregando seus dados…</p>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={value}>
      {statusSincronizacao === "conflito" && (
        <div
          role="alert"
          className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border border-warning bg-warning-tint p-3.5 text-[13px] text-warning shadow-[var(--shadow-lg)]"
        >
          <span className="min-w-0 flex-1">
            Seus dados foram alterados em outro aparelho. Recarregue para ver a versão mais nova — a última alteração feita
            aqui não foi salva.
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-warning px-4 py-1.5 font-semibold text-bg cursor-pointer"
          >
            Recarregar
          </button>
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
