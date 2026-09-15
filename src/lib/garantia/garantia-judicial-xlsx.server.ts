// Planilha da Consulta de Mercado (Garantia Judicial), no layout Lavoro.
// Gera a partir do `resultado_mercado` já gravado, usando o resumo da
// normalização (mesma lógica da tela) e o exportador compartilhado.

import { montarXlsxBuffer, type ColunaExport } from "@/lib/export-xlsx";
import {
  resumirResultadoMercado,
  type SeguradoraResumo,
  type GrupoResumo,
} from "./garantia-judicial-normalizar.server";

const BUCKET = "garantia-judicial-anexos";
const OBS_MAX = 300;
const LABEL_MAX = 90;

const BASE_URL = (
  process.env.PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "https://hub.lavoroseguros.com.br"
).replace(/\/$/, "");

const SITUACAO: Record<GrupoResumo, string> = {
  com_limite: "Com limite",
  sem_limite: "Sem limite",
  nao_consultado: "Não consultado",
};

// Fundo suave por situação, só nesta planilha.
const COR_SITUACAO: Record<GrupoResumo, string> = {
  com_limite: "#E8F5EC",
  sem_limite: "#FDF3E3",
  nao_consultado: "#F1F3F5",
};

function pareceHtml(texto: string): boolean {
  return /<\s*(!doctype|html|head|body|div|span|p|title|script|style)\b/i.test(texto);
}

// Fator e Junto devolvem página HTML inteira no campo de erro: nunca vai para a
// célula. Qualquer observação fica limitada a OBS_MAX caracteres.
function limparObservacao(mensagem: string | null | undefined): string {
  const bruto = String(mensagem ?? "").trim();
  if (!bruto) return "";
  if (pareceHtml(bruto)) return "A seguradora não respondeu à consulta automática.";
  const limpo = bruto.replace(/\s+/g, " ");
  return limpo.length > OBS_MAX ? `${limpo.slice(0, OBS_MAX - 1)}…` : limpo;
}

// Os rótulos "Judiciais" da JNS concatenam dezenas de siglas.
function encurtarLabel(label: string): string {
  const s = String(label ?? "").trim();
  return s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s;
}

function parseBRL(valor: string): number | null {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[R$\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type Linha = {
  seguradora: string;
  situacao: string;
  capacidade: number | null;
  modalidade: string;
  limite: number | null;
  taxa: string;
  observacao: string;
  _grupo: GrupoResumo;
};

const ORDEM_GRUPO: Record<GrupoResumo, number> = { com_limite: 0, sem_limite: 1, nao_consultado: 2 };

function montarLinhas(seguradoras: SeguradoraResumo[]): Linha[] {
  const ordenadas = [...seguradoras].sort((a, b) => {
    const g = ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo];
    if (g !== 0) return g;
    if (a.grupo === "com_limite") return b.capacidade - a.capacidade;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  const linhas: Linha[] = [];
  for (const seg of ordenadas) {
    const base = {
      seguradora: seg.label,
      situacao: SITUACAO[seg.grupo],
      capacidade: seg.capacidade > 0 ? seg.capacidade : null,
      observacao: limparObservacao(seg.mensagem),
      _grupo: seg.grupo,
    };
    if (!seg.modalidades.length) {
      // Sem modalidade: uma linha só, com a mensagem em Observação.
      linhas.push({ ...base, modalidade: "", limite: null, taxa: "" });
      continue;
    }
    const mods = [...seg.modalidades].sort((a, b) => (parseBRL(b.limite) ?? 0) - (parseBRL(a.limite) ?? 0));
    mods.forEach((m, i) => {
      linhas.push({
        ...base,
        modalidade: encurtarLabel(m.label),
        limite: parseBRL(m.limite),
        // Taxa vai como TEXTO já formatado ("0,56%"): a API manda unidades de
        // percentual (0.56 = 0,56%) e o formato de célula percentual espera
        // fração — gravar como número arriscaria erro de 100x.
        taxa: m.taxa || "",
        observacao: i === 0 ? base.observacao : "",
      });
    });
  }
  return linhas;
}

export async function gerarXlsxConsultaMercado(solicitacaoId: string): Promise<
  { ok: true; xlsxPath: string } | { ok: false; erro: string; detalhe?: string }
> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const { data: sol, error: selErro } = await lavoroAdmin
    .from("garantia_judicial_solicitacoes")
    .select("id, protocolo, cnpj_tomador, nome_tomador, numero_processo, resultado_mercado, criado_em")
    .eq("id", solicitacaoId)
    .maybeSingle();

  if (selErro) return { ok: false, erro: "falha_ao_buscar", detalhe: selErro.message };
  if (!sol) return { ok: false, erro: "solicitacao_nao_encontrada" };
  if (!sol.resultado_mercado) return { ok: false, erro: "sem_resultado_mercado" };

  const resumo = resumirResultadoMercado(sol.resultado_mercado);
  const linhas = montarLinhas(resumo.seguradoras);

  const tomador = sol.nome_tomador || resumo.nomeTomadorSugerido || "—";
  const cnpj = sol.cnpj_tomador || resumo.cnpj || "—";
  const consultadoEm = resumo.consultadoEm
    ? new Date(resumo.consultadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";

  const colunas: ColunaExport[] = [
    { header: "Seguradora", key: "seguradora", width: 20 },
    {
      header: "Situação",
      key: "situacao",
      width: 16,
      corFundo: (row) => COR_SITUACAO[(row as unknown as Linha)._grupo],
    },
    { header: "Capacidade total", key: "capacidade", width: 20, formato: "moeda" },
    { header: "Modalidade", key: "modalidade", width: 52 },
    { header: "Limite", key: "limite", width: 18, formato: "moeda" },
    { header: "Taxa", key: "taxa", width: 10 },
    { header: "Observação", key: "observacao", width: 50 },
  ];

  const buffer = await montarXlsxBuffer({
    baseUrl: BASE_URL,
    cabecalho: {
      titulo: "Consulta de Mercado · Garantia Judicial",
      subtitulo: `${tomador} · ${cnpj}`,
      info: [
        { rotulo: "Tomador", valor: tomador },
        { rotulo: "CNPJ", valor: cnpj },
        { rotulo: "Protocolo", valor: sol.protocolo || "—" },
        { rotulo: "Nº do processo", valor: sol.numero_processo || "—" },
        { rotulo: "Data da consulta", valor: consultadoEm },
        {
          rotulo: "Resumo",
          valor:
            `${resumo.com_limite.length} com limite · ` +
            `${resumo.sem_limite.length} sem limite · ` +
            `${resumo.nao_consultado.length} não consultado`,
        },
      ],
    },
    abas: [
      {
        nome: "Consulta de Mercado",
        colunas,
        linhas: linhas as unknown as Record<string, unknown>[],
        nota:
          '"Não consultado" significa falha técnica na consulta automática àquela seguradora, ' +
          "e não recusa comercial: a seguradora pode ter limite disponível.",
      },
    ],
  });

  const xlsxPath = `${solicitacaoId}/consulta-mercado.xlsx`;
  const { error: upErro } = await lavoroAdmin.storage.from(BUCKET).upload(xlsxPath, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (upErro) return { ok: false, erro: "falha_no_upload", detalhe: upErro.message };

  const { error: updErro } = await lavoroAdmin
    .from("garantia_judicial_solicitacoes")
    .update({ xlsx_path: xlsxPath })
    .eq("id", solicitacaoId);
  if (updErro) return { ok: false, erro: "falha_ao_gravar_caminho", detalhe: updErro.message };

  return { ok: true, xlsxPath };
}
