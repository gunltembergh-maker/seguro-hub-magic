// =====================================================================
// Catálogo de gatilhos — T1 a T16.
//
// Cada gatilho é uma função pura: recebe o contexto de UMA empresa e
// devolve zero ou mais eventos. Adicionar gatilho é adicionar um item ao
// array GATILHOS. O motor não precisa saber nada sobre ele.
// =====================================================================

import { analisarProcesso, TPU_CLASSE_EXEC_FISCAL, type Analise, type MovEntrada } from "./nlp.ts";
import { CNAE_PRIORITARIOS, type Modalidade, type Parametros } from "./pricing.ts";
import { brl, processoFmt } from "./format.ts";

export interface EmpresaCtx {
  id: string;
  cnpj: string;
  razao_social: string;
  uf: string | null;
  cnae: string | null;
  porte: string | null;
  capital_social: number | null;
  situacao_cadastral: string | null;
  relacao: string;
  data_abertura: string | null;
}

export interface ProcessoCtx {
  id: string;
  numero: string;
  area: string | null;
  tribunal: string | null;
  classe: string | null;
  classe_codigo: string | null;
  polo: string | null;
  distribuicao: string | null;
  valor_causa: number | null;
  valor_execucao: number | null;
  orgao_julgador: string | null;
  movimentacoes: (MovEntrada & { data: string | null })[];
}

export interface InscricaoCtx {
  numero_inscricao: string | null;
  ente: string;
  tipo: string | null;
  valor: number;
  situacao: string | null;
}

export interface ContratoCtx {
  identificador: string;
  orgao: string | null;
  objeto: string | null;
  valor: number | null;
  data_assinatura: string | null;
  obra_engenharia: boolean;
}

export interface RestritivoCtx {
  tipo: string;
  descricao: string | null;
  valor: number | null;
  ativo: boolean;
}

export interface EditalCtx {
  identificador: string;
  orgao: string | null;
  objeto: string | null;
  valor_estimado: number | null;
  data_encerramento: string | null;
  uf: string | null;
  exige_garantia_proposta: boolean;
  percentual_garantia: number | null;
  trecho_garantia: string | null;
}

export interface Contexto {
  empresa: EmpresaCtx;
  processos: ProcessoCtx[];
  inscricoes: InscricaoCtx[];
  contratos: ContratoCtx[];
  restritivos: RestritivoCtx[];
  editais: EditalCtx[];
  params: Parametros;
}

export interface EventoDetectado {
  gatilho: string;
  modalidade: Modalidade;
  referencia: string;
  descricao: string;
  valorBase: number;
  deadline: string | null;
  confianca: number;
  evidencia: Record<string, unknown>;
  grandeVulto?: boolean;
  fatorIs?: number | null;
}

export interface MetaGatilho {
  codigo: string;
  nome: string;
  modalidade: Modalidade;
  produto: string;
  fonte: string;
  fn: (ctx: Contexto) => EventoDetectado[];
}

// ---------------------------------------------------------------------
const hoje = () => new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const maisDias = (base: string | null, dias: number): string => {
  const d = base ? new Date(base + "T00:00:00") : hoje();
  d.setDate(d.getDate() + dias);
  return iso(d);
};
const diasAtras = (n: number): string => {
  const d = hoje();
  d.setDate(d.getDate() - n);
  return iso(d);
};

const cache = new WeakMap<ProcessoCtx, Analise>();
function sinais(p: ProcessoCtx): Analise {
  let a = cache.get(p);
  if (!a) {
    const movs = [...p.movimentacoes].sort((x, y) => (y.data ?? "").localeCompare(x.data ?? ""));
    a = analisarProcesso(movs);
    cache.set(p, a);
  }
  return a;
}

function ultimaMov(p: ProcessoCtx): string | null {
  const datas = p.movimentacoes.map((m) => m.data).filter(Boolean) as string[];
  return datas.length ? datas.sort().at(-1)! : null;
}

function trecho(p: ProcessoCtx, limite = 320): string | null {
  const ordenadas = [...p.movimentacoes].sort((x, y) => (y.data ?? "").localeCompare(x.data ?? ""));
  for (const m of ordenadas) {
    if (!m.texto) continue;
    const a = analisarProcesso([m]);
    if (a.bloqueio || a.exigeGarantia) {
      const t = m.texto.replace(/\s+/g, " ").trim();
      return t.length > limite ? t.slice(0, limite) + "…" : t;
    }
  }
  return null;
}

const valorDe = (p: ProcessoCtx, a: Analise) =>
  a.valorMaximo || p.valor_execucao || p.valor_causa || 0;

// =====================================================================
// JUDICIAL
// =====================================================================
export const GATILHOS: MetaGatilho[] = [
  {
    codigo: "T1",
    nome: "Depósito recursal já efetuado em dinheiro",
    modalidade: "JUDICIAL",
    produto: "Seguro garantia judicial — substituição de depósito recursal",
    fonte: "bureau / DJEN",
    // Base instalada: o CNJ firmou entendimento de que a empresa pode RESGATAR
    // depósito recursal já feito e substituí-lo por seguro garantia. Toda
    // empresa com depósito ativo é lead, não só quem vai recorrer agora.
    fn: (ctx) =>
      ctx.processos.flatMap((p) => {
        if (p.polo === "ATIVO") return [];
        const a = sinais(p);
        if (!a.sinais.includes("DEPOSITO_RECURSAL") || a.garantiaPrestada) return [];
        return [{
          gatilho: "T1",
          modalidade: "JUDICIAL" as Modalidade,
          referencia: p.numero,
          descricao:
            `Depósito recursal identificado em ${p.tribunal ?? "tribunal"} ` +
            `(${p.area ?? "área não informada"}). Passível de resgate e substituição por ` +
            `seguro garantia (CLT art. 899 §11 + Ato Conjunto TST/CSJT 1/2019).`,
          valorBase: valorDe(p, a),
          deadline: null,
          confianca: Math.min(0.95, a.confianca),
          evidencia: { sinais: a.sinais, processo: p.numero },
        }];
      }),
  },
  {
    codigo: "T2",
    nome: "Sentença condenatória com prazo recursal correndo",
    modalidade: "JUDICIAL",
    produto: "Seguro garantia judicial — depósito recursal",
    fonte: "DJEN / bureau",
    fn: (ctx) => {
      const limite = diasAtras(20);
      return ctx.processos.flatMap((p) => {
        if (p.polo === "ATIVO") return [];
        const a = sinais(p);
        if (!a.sinais.includes("SENTENCA_CONDENATORIA") || a.garantiaPrestada) return [];
        const ultima = ultimaMov(p);
        if (ultima && ultima < limite) return [];
        return [{
          gatilho: "T2",
          modalidade: "JUDICIAL" as Modalidade,
          referencia: p.numero,
          descricao:
            `Sentença condenatória recente em ${processoFmt(p.numero)}. Janela de 8 dias ` +
            `para recurso — o depósito recursal pode ser substituído por seguro garantia.`,
          valorBase: a.valorMaximo || p.valor_causa || 0,
          deadline: maisDias(ultima, 8),
          confianca: a.confianca,
          evidencia: { sinais: a.sinais, ultima_movimentacao: ultima },
        }];
      });
    },
  },
  {
    codigo: "T3",
    nome: "Execução trabalhista definitiva não paga (CNDT positiva)",
    modalidade: "JUDICIAL",
    produto: "Seguro garantia judicial",
    fonte: "CNDT / BNDT (grátis)",
    fn: (ctx) => {
      const cndt = ctx.restritivos.filter((r) => r.tipo === "CNDT" && r.ativo);
      if (!cndt.length) return [];
      const valor =
        cndt.reduce((s, r) => s + (r.valor ?? 0), 0) ||
        ctx.processos
          .filter((p) => p.area === "TRABALHISTA")
          .reduce((s, p) => s + (p.valor_execucao ?? p.valor_causa ?? 0), 0);
      return [{
        gatilho: "T3",
        modalidade: "JUDICIAL" as Modalidade,
        referencia: "CNDT",
        descricao:
          "CNDT positiva: há execução trabalhista definitiva inadimplida (BNDT). " +
          "Sinal binário e limpo — a empresa precisa garantir para obter certidão.",
        valorBase: valor,
        deadline: null,
        confianca: 0.9,
        evidencia: { restritivos: cndt.map((r) => r.descricao) },
      }];
    },
  },
  {
    codigo: "T4",
    nome: "Penhora / bloqueio de ativos efetivado",
    modalidade: "JUDICIAL",
    produto: "Seguro garantia judicial — substituição de penhora",
    fonte: "bureau (texto do andamento) / DJEN",
    // O gatilho de maior urgência: caixa travado. CPC art. 835 §2º equipara
    // o seguro garantia a dinheiro para substituição da penhora.
    fn: (ctx) =>
      ctx.processos.flatMap((p) => {
        if (p.polo === "ATIVO") return [];
        const a = sinais(p);
        if (!(a.bloqueio || a.exigeGarantia) || a.garantiaPrestada) return [];
        const rotulo = a.bloqueio ? "Bloqueio/penhora de ativos" : "Intimação para prestar garantia";
        return [{
          gatilho: "T4",
          modalidade: "JUDICIAL" as Modalidade,
          referencia: p.numero,
          descricao:
            `${rotulo} em ${processoFmt(p.numero)} (${p.tribunal ?? "—"}). ` +
            `Substituição por seguro garantia com base no CPC art. 835 §2º / art. 848.`,
          valorBase: valorDe(p, a),
          deadline: maisDias(ultimaMov(p), 15),
          confianca: a.confianca,
          evidencia: { sinais: a.sinais, processo: p.numero, trecho: trecho(p) },
        }];
      }),
  },
  {
    codigo: "T13",
    nome: "Improbidade / ACP com pedido de indisponibilidade",
    modalidade: "JUDICIAL",
    produto: "Seguro garantia judicial",
    fonte: "bureau (texto) / DJEN",
    fn: (ctx) =>
      ctx.processos.flatMap((p) => {
        const a = sinais(p);
        if (!a.sinais.includes("IMPROBIDADE") || a.garantiaPrestada) return [];
        return [{
          gatilho: "T13",
          modalidade: "JUDICIAL" as Modalidade,
          referencia: p.numero,
          descricao:
            `Ação de improbidade / ACP em ${processoFmt(p.numero)} com risco de ` +
            `indisponibilidade de bens. Garantia judicial pode preservar a operação.`,
          valorBase: valorDe(p, a),
          deadline: null,
          confianca: Math.min(0.7, a.confianca),
          evidencia: { sinais: a.sinais },
        }];
      }),
  },

  // =====================================================================
  // FISCAL
  // =====================================================================
  {
    codigo: "T5",
    nome: "Execução fiscal ajuizada",
    modalidade: "FISCAL",
    produto: "Seguro garantia de execução fiscal",
    fonte: "DataJud (classe 1116) / bureau",
    fn: (ctx) =>
      ctx.processos.flatMap((p) => {
        if (p.polo === "ATIVO") return [];
        const a = sinais(p);
        const area = (p.area ?? "").toUpperCase();
        const ehFiscal =
          p.classe_codigo === TPU_CLASSE_EXEC_FISCAL ||
          ["FISCAL", "TRIBUTARIO", "TRIBUTÁRIO"].includes(area) ||
          a.sinais.includes("EXECUCAO_FISCAL");
        if (!ehFiscal || a.garantiaPrestada) return [];
        return [{
          gatilho: "T5",
          modalidade: "FISCAL" as Modalidade,
          referencia: p.numero,
          descricao:
            `Execução fiscal em curso (${processoFmt(p.numero)}). Lei 6.830/80 art. 9º, II e ` +
            `§3º: seguro garantia equiparado a depósito em dinheiro. Lei 14.689/2023 veda ` +
            `liquidação antecipada antes do trânsito em julgado.`,
          valorBase: valorDe(p, a),
          deadline: maisDias(ultimaMov(p) ?? p.distribuicao, 5),
          confianca: Math.max(0.75, a.confianca),
          evidencia: { classe: p.classe, classe_codigo: p.classe_codigo, sinais: a.sinais },
        }];
      }),
  },
  {
    codigo: "T6",
    nome: "Dívida ativa inscrita, sem garantia",
    modalidade: "FISCAL",
    produto: "Seguro garantia de execução fiscal / administrativo tributário",
    fonte: "PGFN dados abertos (grátis)",
    // O gatilho mais barato do motor. A coluna de SITUAÇÃO da PGFN já diz
    // quem ainda não garantiu — usar isso é o que evita queimar a lista.
    fn: (ctx) => {
      const JA_RESOLVIDO = ["garantida", "suspensa", "negociada", "parcelada", "extinta", "liquidada"];
      const SEM_GARANTIA = ["ativa", "em cobranca", "em cobrança", "ajuizada", "irregular", "devedor"];
      const alvo = ctx.inscricoes.filter((i) => {
        const s = (i.situacao ?? "").toLowerCase();
        if (JA_RESOLVIDO.some((k) => s.includes(k))) return false;
        if (s && !SEM_GARANTIA.some((k) => s.includes(k))) return false;
        return true;
      });
      if (!alvo.length) return [];
      const total = alvo.reduce((s, i) => s + i.valor, 0);
      if (total < ctx.params.ticket_minimo) return [];
      const entes = [...new Set(alvo.map((i) => i.ente))].sort();
      return [{
        gatilho: "T6",
        modalidade: "FISCAL" as Modalidade,
        referencia: `DAU:${alvo.length}`,
        descricao:
          `${alvo.length} inscrição(ões) em dívida ativa (${entes.join(", ")}) somando ` +
          `${brl(total)}, em situação que ainda não indica garantia prestada. ` +
          `Portaria PGFN/MF 2.044/2024 admite garantir inclusive débito não inscrito.`,
        valorBase: total,
        deadline: null,
        confianca: 0.82,
        evidencia: { inscricoes: alvo.slice(0, 25) },
      }];
    },
  },
  {
    codigo: "T7",
    nome: "Contencioso administrativo federal (CARF)",
    modalidade: "FISCAL",
    produto: "Seguro garantia administrativo de créditos tributários",
    fonte: "CARF / DOU",
    fn: (ctx) => {
      const carf = ctx.restritivos.filter((r) => r.tipo === "CARF" && r.ativo);
      if (!carf.length) return [];
      const total = carf.reduce((s, r) => s + (r.valor ?? 0), 0);
      return [{
        gatilho: "T7",
        modalidade: "FISCAL" as Modalidade,
        referencia: "CARF",
        descricao:
          `Processo(s) administrativo(s) no CARF somando ${brl(total)}. ` +
          `Estoque nacional de ~R$ 800 bi — ticket alto, ciclo mais longo.`,
        valorBase: total,
        deadline: null,
        confianca: 0.7,
        evidencia: { itens: carf.map((r) => r.descricao) },
      }];
    },
  },

  // =====================================================================
  // LICITAÇÃO E PERFORMANCE
  // =====================================================================
  {
    codigo: "T8",
    nome: "Edital aberto exigindo garantia de proposta",
    modalidade: "LICITACAO",
    produto: "Seguro garantia — modalidade licitante (bid bond)",
    fonte: "PNCP (grátis)",
    fn: (ctx) =>
      ctx.editais
        .filter((e) => e.exige_garantia_proposta)
        .map((e) => {
          const pct = e.percentual_garantia ?? 0.01;
          return {
            gatilho: "T8",
            modalidade: "LICITACAO" as Modalidade,
            referencia: e.identificador,
            descricao:
              `Edital ${e.identificador} (${e.orgao ?? "—"}) exige garantia de proposta de ` +
              `${(pct * 100).toFixed(2)}% sobre ${brl(e.valor_estimado ?? 0)} ` +
              `(Lei 14.133/2021, art. 58). Encerramento: ${e.data_encerramento ?? "—"}.`,
            valorBase: e.valor_estimado ?? 0,
            deadline: e.data_encerramento,
            confianca: 0.8,
            fatorIs: pct,
            evidencia: { trecho: e.trecho_garantia, objeto: e.objeto },
          };
        }),
  },
  {
    codigo: "T9",
    nome: "Contrato público assinado — garantia contratual devida",
    modalidade: "PERFORMANCE",
    produto: "Seguro garantia — modalidade executante (performance bond)",
    fonte: "PNCP / Compras.gov (grátis)",
    fn: (ctx) => {
      const limite = diasAtras(60);
      return ctx.contratos.flatMap((c) => {
        if (c.data_assinatura && c.data_assinatura < limite) return [];
        const valor = c.valor ?? 0;
        if (valor < ctx.params.ticket_minimo) return [];
        const grande = c.obra_engenharia && valor > 200_000_000;
        const pct = grande ? 0.3 : 0.05;
        return [{
          gatilho: "T9",
          modalidade: "PERFORMANCE" as Modalidade,
          referencia: c.identificador,
          descricao:
            `Contrato público assinado com ${c.orgao ?? "órgão"} no valor de ${brl(valor)}. ` +
            `Garantia devida de ${(pct * 100).toFixed(0)}% (Lei 14.133/2021, art. ` +
            `${grande ? "99 — grande vulto, com cláusula de retomada" : "98"}).`,
          valorBase: valor,
          deadline: maisDias(c.data_assinatura, 10),
          confianca: 0.85,
          grandeVulto: grande,
          fatorIs: pct,
          evidencia: { objeto: c.objeto, identificador: c.identificador },
        }];
      });
    },
  },
  {
    codigo: "T10",
    nome: "Obra de grande vulto (> R$ 200 mi)",
    modalidade: "PERFORMANCE",
    produto: "Seguro garantia com cláusula de retomada",
    fonte: "PNCP (grátis)",
    // Qualificador do T9: eleva o fator para 30%, sem somar valor de novo.
    fn: (ctx) =>
      ctx.contratos
        .filter((c) => c.obra_engenharia && (c.valor ?? 0) > 200_000_000)
        .map((c) => ({
          gatilho: "T10",
          modalidade: "PERFORMANCE" as Modalidade,
          referencia: `GV:${c.identificador}`,
          descricao:
            `Obra de grande vulto: ${brl(c.valor ?? 0)}. Art. 99 da Lei 14.133/2021 admite ` +
            `garantia de até 30% na modalidade seguro-garantia com cláusula de retomada ` +
            `(art. 102).`,
          valorBase: 0,
          deadline: null,
          confianca: 0.9,
          grandeVulto: true,
          fatorIs: 0.3,
          evidencia: { objeto: c.objeto },
        })),
  },

  // =====================================================================
  // OUTROS PRODUTOS DA LAVORO (cross-sell)
  // =====================================================================
  {
    codigo: "T16",
    nome: "Cross-sell — fiança locatícia e demais produtos",
    modalidade: "LOCATICIA",
    produto: "Fiança locatícia / carta fiança / RC / riscos de engenharia",
    fonte: "RFB CNPJ + PNCP (grátis)",
    // Aviso honesto de cobertura: NÃO existe base pública que revele contrato
    // de locação. O que existe são proxies de expansão. Trate como lead de
    // cross-sell na carteira, não como gatilho legal.
    fn: (ctx) => {
      const e = ctx.empresa;
      const sinaisXsell: string[] = [];
      if (e.data_abertura && e.data_abertura >= diasAtras(365)) {
        sinaisXsell.push("CNPJ/filial aberta nos últimos 12 meses");
      }
      const recentes = ctx.contratos.filter(
        (c) => c.data_assinatura && c.data_assinatura >= diasAtras(120),
      );
      if (recentes.length) sinaisXsell.push(`${recentes.length} contrato(s) público(s) recente(s)`);
      if (e.relacao === "cliente") sinaisXsell.push("já é cliente da Lavoro — cross-sell direto");
      if (!sinaisXsell.length) return [];
      const base = Math.max(0, ...recentes.map((c) => c.valor ?? 0)) * 0.02;
      return [{
        gatilho: "T16",
        modalidade: "LOCATICIA" as Modalidade,
        referencia: `XSELL:${e.cnpj}`,
        descricao:
          "Indício de expansão/instalação: " + sinaisXsell.join("; ") +
          ". Oportunidade de fiança locatícia comercial, carta fiança, RC e riscos de " +
          "engenharia. Atenção: cobertura por proxy — confirmar em contato comercial.",
        valorBase: base,
        deadline: null,
        confianca: 0.45,
        evidencia: { sinais: sinaisXsell },
      }];
    },
  },
];

// T11 (concessões e PPPs) e T14 (precatórios) exigem coleta em diários
// oficiais e listas cronológicas dos tribunais — fase 3 do roadmap.

// =====================================================================
// Filtros negativos: motivos para NÃO acionar o comercial.
// Rodam sempre, antes do scoring.
// =====================================================================
export function bloqueios(ctx: Contexto): string[] {
  const out: string[] = [];
  const tipos = new Set(ctx.restritivos.filter((r) => r.ativo).map((r) => r.tipo));

  if (tipos.has("CEIS") || tipos.has("CNEP") || tipos.has("CEPIM")) {
    out.push("Sancionada (CEIS/CNEP/CEPIM) — impedida de contratar com a Administração");
  }
  if (tipos.has("RJ")) {
    out.push("Recuperação judicial ou falência — seguradora não subscreve");
  }
  for (const p of ctx.processos) {
    if (sinais(p).sinais.includes("RECUPERACAO_JUDICIAL")) {
      out.push(`Indício de recuperação judicial/falência no processo ${processoFmt(p.numero)}`);
      break;
    }
  }
  const sc = ctx.empresa.situacao_cadastral;
  if (sc && !sc.toUpperCase().includes("ATIVA")) {
    out.push(`Situação cadastral: ${sc}`);
  }
  return out;
}

export function cnaePrioritario(cnae: string | null): boolean {
  return CNAE_PRIORITARIOS.has((cnae ?? "").slice(0, 2));
}

export function catalogo() {
  return GATILHOS.map(({ fn: _fn, ...meta }) => meta);
}

/** Limpa o cache de análise entre execuções do motor. */
export function resetCache(): void {
  // WeakMap não precisa de limpeza explícita; função mantida para clareza
  // de intenção em quem lê o motor.
}
