// =====================================================================
// Background check (portado de ab-bgcheck).
//
// Dossiê de CNPJ (Compliance) e de CPF (RH). Regras de projeto:
//
//   * PJ em fonte pública oficial → legítimo interesse, sem consentimento.
//   * PF → exige CONSENTIMENTO válido registrado. Sem ele, RECUSA com 403.
//     Não é checagem decorativa: é o que mantém RH e Compliance defensáveis.
//   * Exposição fiscal ou judicial alta é RISCO e OPORTUNIDADE — não é
//     motivo de reprovação. Só sanção, situação cadastral e criminal reprovam.
//
// DUAS CORREÇÕES EM RELAÇÃO À VERSÃO DENO:
//   1. As chaves de permissão eram "rh"/"garantia"/"compliance". As chaves
//      reais do Hub são ab_rh / ab_garantia / ab_compliance — com os nomes
//      antigos só ADMIN passava, e todo o resto tomava 403.
//   2. No ramo CPF, a busca de processo criminal não filtrava pelo titular:
//      lia 50 processos quaisquer de origem "bureau" e atribuía os criminais
//      à pessoa consultada. Agora é restrita ao registro do próprio CPF.
// =====================================================================

import { admin, exigirPerfil, json } from "./db.server.ts";
import { brl, cpfMask, soDigitos } from "./format.ts";

type Severidade = "ALTA" | "MEDIA" | "BAIXA" | "INFO";

interface Achado {
  severidade: Severidade;
  categoria: string;
  titulo: string;
  detalhe: string;
  valor?: number | null;
  fonte?: string;
}

const PESOS: Record<Severidade, number> = { ALTA: 30, MEDIA: 12, BAIXA: 4, INFO: 0 };

// Só estas categorias reprovam.
const CATEGORIAS_ELIMINATORIAS = new Set(["CEIS", "CNEP", "CEPIM", "RJ", "CADASTRAL", "CRIMINAL"]);

const CONSTRICAO = new Set(["BLOQUEIO_ATIVOS", "PENHORA_DEFERIDA", "ARRESTO", "EXIGE_GARANTIA"]);

function veredito(achados: Achado[]): string {
  const graves = achados.filter(
    (a) => a.severidade === "ALTA" && CATEGORIAS_ELIMINATORIAS.has(a.categoria),
  );
  if (graves.length) return "REPROVADO";
  if (achados.some((a) => a.severidade === "ALTA" || a.severidade === "MEDIA")) return "ATENCAO";
  return "APROVADO";
}

export interface CorpoBgCheck {
  documento?: string;
  finalidade?: string;
  nome?: string;
}

export async function bgcheck(req: Request): Promise<Response> {
  const sb = admin();
  let cfg: CorpoBgCheck = {};
  try { cfg = await req.json(); } catch { /* validado abaixo */ }

  const doc = soDigitos(cfg.documento);
  const finalidade = (cfg.finalidade ?? "COMPLIANCE").toUpperCase();

  if (doc.length !== 11 && doc.length !== 14) {
    return json({
      erro: "documento_invalido",
      detalhe: "Informe CNPJ (14) ou CPF (11 dígitos).",
    }, 400);
  }

  // ---- permissão por finalidade -----------------------------------
  const perfisNecessarios = finalidade === "RH"
    ? ["ab_rh"]
    : finalidade === "SUBSCRICAO"
    ? ["ab_garantia"]
    : ["ab_compliance"];
  const perm = await exigirPerfil(req, perfisNecessarios);
  if (perm instanceof Response) return perm;
  const { userId } = perm;

  const achados: Achado[] = [];
  const fontes: string[] = [];
  const indisponiveis: string[] = [];
  let score = 100;
  let nome: string | null = cfg.nome ?? null;

  const add = (a: Achado) => {
    achados.push(a);
    score = Math.max(0, score - PESOS[a.severidade]);
  };

  // =================================================================
  // CPF — trava de consentimento
  // =================================================================
  if (doc.length === 11) {
    const { data: cons } = await sb
      .from("ab_consentimento")
      .select("*")
      .eq("documento", doc)
      .is("revogado_em", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const termo = (cons ?? [])[0] as
      { id: string; nome: string | null; created_at: string; validade: string | null } | undefined;
    const valido = termo &&
      (!termo.validade || termo.validade >= new Date().toISOString().slice(0, 10));

    if (!valido) {
      return json({
        erro: "consentimento_ausente",
        detalhe:
          `Consulta de dado pessoal bloqueada: não há consentimento válido registrado para ` +
          `o CPF ${cpfMask(doc)}. Registre o termo antes de prosseguir (LGPD art. 7º).`,
        documento_mascarado: cpfMask(doc),
      }, 403);
    }

    nome = nome ?? termo!.nome;
    fontes.push(
      `Consentimento #${String(termo!.id).slice(0, 8)} de ${String(termo!.created_at).slice(0, 10)}`,
    );

    const provider = (process.env.BUREAU_PROVIDER ?? "none").toLowerCase();
    if (provider === "none") {
      indisponiveis.push("Antecedentes e processos por CPF — requer bureau pago contratado");
      indisponiveis.push(
        "Validação de CNH e documentoscopia — requer provedor (BigDataCorp / Direct Data)",
      );
      add({
        severidade: "INFO", categoria: "COBERTURA", titulo: "Checagem parcial",
        detalhe:
          "Sem bureau contratado o Hub cobre apenas sanções e PEP em fonte pública. " +
          "Antecedentes criminais e processos por CPF exigem contrato.",
        fonte: "—",
      });
    } else {
      // O bureau é consultado pelo webhook/monitoramento; aqui lemos o que
      // já está na base PARA ESTE CPF. O titular entra na base como registro
      // de ab_empresa com o documento normalizado em 14 posições — é assim
      // que upsertEmpresa grava tanto CNPJ quanto CPF monitorado.
      const chave = doc.padStart(14, "0");
      const { data: titular } = await sb
        .from("ab_empresa").select("id").eq("cnpj", chave).maybeSingle();

      if (!titular) {
        indisponiveis.push(
          "Sem processos deste CPF na base — registre o CPF no monitoramento do bureau",
        );
      } else {
        const { data: procs } = await sb
          .from("ab_processo")
          .select("numero, area")
          .eq("empresa_id", (titular as { id: string }).id)
          .ilike("fonte", "bureau%")
          .limit(200);
        const crim = ((procs ?? []) as { numero: string; area: string | null }[])
          .filter((p) => (p.area ?? "").toUpperCase().startsWith("CRIM"));
        if (crim.length) {
          add({
            severidade: "ALTA", categoria: "CRIMINAL",
            titulo: `${crim.length} processo(s) criminal(is)`,
            detalhe: crim.slice(0, 5).map((p) => p.numero).join("; "),
            fonte: provider,
          });
        }
      }
      fontes.push(`Bureau ${provider}`);
    }

    const resultado = {
      documento: doc, tipo: "CPF", nome, finalidade,
      veredito: veredito(achados), score, achados,
      fontes_consultadas: fontes, fontes_indisponiveis: indisponiveis,
    };
    await sb.from("ab_dossie").insert({
      tipo_documento: "CPF", documento: doc, nome, finalidade, solicitante: userId,
      veredito: resultado.veredito, score, achados,
      fontes_consultadas: fontes, fontes_indisponiveis: indisponiveis,
    });
    return json({ ok: true, ...resultado });
  }

  // =================================================================
  // CNPJ
  // =================================================================
  const { data: empRaw } = await sb.from("ab_empresa").select("*").eq("cnpj", doc).maybeSingle();
  const emp = empRaw as Record<string, any> | null;

  if (!emp) {
    const res = {
      documento: doc, tipo: "CNPJ", nome: null, finalidade,
      veredito: "SEM_DADOS", score: 0, achados: [],
      fontes_consultadas: [] as string[],
      fontes_indisponiveis: ["Empresa não está na base — rode a ingestão ou cadastre o CNPJ"],
    };
    await sb.from("ab_dossie").insert({
      tipo_documento: "CNPJ", documento: doc, finalidade, solicitante: userId,
      veredito: "SEM_DADOS", score: 0, achados: [],
      fontes_consultadas: [], fontes_indisponiveis: res.fontes_indisponiveis,
    });
    return json({ ok: true, ...res });
  }

  nome = emp.razao_social;
  fontes.push("Receita Federal — CNPJ dados abertos");

  // ---- cadastral --------------------------------------------------
  if (emp.situacao_cadastral && !String(emp.situacao_cadastral).toUpperCase().includes("ATIVA")) {
    add({
      severidade: "ALTA", categoria: "CADASTRAL",
      titulo: `Situação cadastral: ${emp.situacao_cadastral}`,
      detalhe: "CNPJ não ativo impede contratação e inviabiliza subscrição.",
      fonte: "RFB",
    });
  }
  if (emp.data_abertura) {
    const dias = (Date.now() - new Date(emp.data_abertura).getTime()) / 86_400_000;
    if (dias < 730) {
      add({
        severidade: "BAIXA", categoria: "CADASTRAL", titulo: "Empresa com menos de 2 anos",
        detalhe: `Abertura em ${emp.data_abertura}. Seguradoras costumam pedir histórico.`,
        fonte: "RFB",
      });
    }
  }

  // ---- sanções e restritivos --------------------------------------
  const { data: restr } = await sb
    .from("ab_restritivo").select("*").eq("empresa_id", emp.id).eq("ativo", true);
  if (restr?.length) fontes.push("Portal da Transparência — CEIS/CNEP/CEPIM");
  const SEV: Record<string, Severidade> = {
    CEIS: "ALTA", CNEP: "ALTA", CEPIM: "MEDIA", RJ: "ALTA",
    CNDT: "MEDIA", PROTESTO: "MEDIA", PEP: "INFO", CARF: "INFO",
  };
  for (const r of (restr ?? []) as Record<string, any>[]) {
    add({
      severidade: SEV[r.tipo] ?? "BAIXA",
      categoria: r.tipo,
      titulo: `${r.tipo}: ${r.descricao ?? "—"}`,
      detalhe: `Vigência: ${r.inicio ?? "—"} a ${r.fim ?? "indeterminada"}.`,
      valor: r.valor,
      fonte: r.fonte ?? "",
    });
  }

  // ---- fiscal -----------------------------------------------------
  const { data: insc } = await sb
    .from("ab_inscricao_divida").select("*").eq("empresa_id", emp.id);
  if (insc?.length) {
    fontes.push("PGFN — Dívida Ativa da União (dados abertos)");
    const linhas = insc as Record<string, any>[];
    const total = linhas.reduce((s, i) => s + Number(i.valor), 0);
    const abertas = linhas.filter((i) => {
      const s = (i.situacao ?? "").toLowerCase();
      return !["garantida", "suspensa", "negociada", "parcelada", "extinta"]
        .some((k) => s.includes(k));
    });
    add({
      severidade: total > 1_000_000 ? "ALTA" : total > 100_000 ? "MEDIA" : "BAIXA",
      categoria: "FISCAL",
      titulo: `${linhas.length} inscrição(ões) em dívida ativa — ${brl(total)}`,
      detalhe: `${abertas.length} sem indicação de garantia prestada. ` +
        `Também é oportunidade comercial (gatilho T6).`,
      valor: total,
      fonte: "PGFN",
    });
  }

  // ---- judicial ---------------------------------------------------
  const { data: procsRaw } = await sb
    .from("ab_processo").select("id, numero, polo, fase, valor_causa, valor_execucao")
    .eq("empresa_id", emp.id);
  const procs = (procsRaw ?? []) as Record<string, any>[];

  if (procs.length) {
    const provider = process.env.BUREAU_PROVIDER ?? "none";
    fontes.push(provider !== "none" ? `Bureau judicial (${provider})` : "Base judicial local");
    const passivos = procs.filter((p) => p.polo !== "ATIVO");
    const exposicao = passivos.reduce(
      (s, p) => s + Number(p.valor_execucao ?? p.valor_causa ?? 0), 0,
    );
    const emExec = passivos.filter((p) => p.fase === "EXECUCAO");

    const { data: movs } = await sb
      .from("ab_movimentacao")
      .select("processo_id, sinais")
      .in("processo_id", passivos.map((p) => p.id));
    const comBloqueio = new Set(
      ((movs ?? []) as { processo_id: string; sinais: string[] | null }[])
        .filter((m) => (m.sinais ?? []).some((s) => CONSTRICAO.has(s)))
        .map((m) => m.processo_id),
    );

    add({
      severidade: exposicao > 5_000_000 ? "ALTA" : exposicao > 500_000 ? "MEDIA" : "BAIXA",
      categoria: "JUDICIAL",
      titulo: `${passivos.length} processo(s) no polo passivo — exposição ${brl(exposicao)}`,
      detalhe: `${emExec.length} em fase de execução; ${comBloqueio.size} com indício de ` +
        `penhora/bloqueio.`,
      valor: exposicao,
      fonte: "bureau",
    });
    if (comBloqueio.size) {
      const nums = passivos.filter((p) => comBloqueio.has(p.id)).slice(0, 5).map((p) => p.numero);
      add({
        severidade: "ALTA", categoria: "JUDICIAL", titulo: "Indício de constrição de ativos",
        detalhe: nums.join("; "), fonte: "bureau",
      });
      score = Math.min(100, score + PESOS.ALTA / 2); // este achado pesa metade
    }
  } else {
    indisponiveis.push("Processos judiciais por CNPJ — requer bureau pago contratado");
  }

  // ---- QSA --------------------------------------------------------
  const { data: socios } = await sb
    .from("ab_socio").select("nome, qualificacao").eq("empresa_id", emp.id);
  if (socios?.length) {
    fontes.push("QSA (Receita Federal)");
    add({
      severidade: "INFO", categoria: "SOCIETARIO",
      titulo: `${socios.length} sócio(s) no QSA`,
      detalhe: (socios as { nome: string; qualificacao: string | null }[])
        .slice(0, 6).map((s) => `${s.nome} (${s.qualificacao ?? "—"})`).join("; "),
      fonte: "RFB",
    });
  }

  const vd = veredito(achados);
  await sb.from("ab_dossie").insert({
    tipo_documento: "CNPJ", documento: doc, nome, finalidade, solicitante: userId,
    veredito: vd, score, achados,
    fontes_consultadas: fontes, fontes_indisponiveis: indisponiveis,
  });

  return json({
    ok: true,
    documento: doc, tipo: "CNPJ", nome, finalidade,
    veredito: vd, score, achados,
    fontes_consultadas: fontes, fontes_indisponiveis: indisponiveis,
    empresa_id: emp.id,
  });
}
