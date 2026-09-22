// Avisos por e-mail do Canal Parceiros: repasse (pedido, resposta, cobrança),
// conferência de contrato e alteração de percentual.
//
// Server-only: usa service role e o envio gerenciado do Hub. O aviso só é
// marcado depois que o envio dá certo — falhou, a rodada seguinte tenta de novo.
// Nenhum link para arquivo: todos os botões levam para a tela do Hub.
import { mensagemDeErro } from "@/lib/erro";
import { SITE_URL } from "@/lib/email-templates/_shared";

const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const dataHoraBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const moedaBR = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Percentuais vêm do banco como fração (0.30 → "30%"). */
const pctBR = (v: number | null | undefined) =>
  v == null
    ? "—"
    : `${(Number(v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

const simNao = (v: boolean | null | undefined) => (v == null ? "—" : v ? "sim" : "não");

type Destinatarios = string[] | null;

type RepassePendente = {
  tipo: string;
  demanda_id: string;
  parceiro: string | null;
  ciclo: string | null;
  linhas: number | null;
  valor_total: number | null;
  data_prevista: string | null;
  dias_de_atraso: number | null;
  solicitante_nome: string | null;
  solicitante_email: string | null;
  financeiro_nome: string | null;
  situacao?: string | null;
  observacao: string | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type VerificacaoPendente = {
  contrato_id: string;
  parceiro: string | null;
  arquivo_nome: string | null;
  situacao: string | null;
  motivo: string | null;
  origem_leitura: string | null;
  declarado_assinado: boolean | null;
  assinatura_lida: boolean | null;
  enviado_por_nome: string | null;
  enviado_em: string | null;
  repasse_acumulado: number | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type AlteracaoPendente = {
  tipo: string;
  alteracao_id: string;
  parceiro: string | null;
  pct_beneficios: number | null;
  pct_garantia: number | null;
  pct_demais: number | null;
  pct_beneficios_contrato: number | null;
  pct_garantia_contrato: number | null;
  pct_demais_contrato: number | null;
  minimo: number | null;
  vigencia_fim: string | null;
  justificativa: string | null;
  diretor_email: string | null;
  anexo_nome: string | null;
  solicitante_nome: string | null;
  solicitado_em: string | null;
  situacao: string | null;
  aprovador_nome: string | null;
  observacao: string | null;
  destinatarios: Destinatarios;
  assinatura_nome: string | null;
  assinatura_area: string | null;
};

type Envio = {
  template: string;
  assunto: string;
  destinatarios: string[];
  dados: Record<string, unknown>;
};

const RODAPE = "aviso automático do Canal Parceiros";

function telaFinanceiro(demandaId: string) {
  return `${SITE_URL}/financeiro/fluxo-diario?demanda=${demandaId}`;
}

function telaComercial(demandaId?: string) {
  return demandaId
    ? `${SITE_URL}/comercial/canal-parceiros?demanda=${demandaId}`
    : `${SITE_URL}/comercial/canal-parceiros`;
}

function mudancas(a: AlteracaoPendente) {
  const linhas: { rotulo: string; valor: string }[] = [];
  const par = [
    ["Benefícios", a.pct_beneficios, a.pct_beneficios_contrato],
    ["Garantia", a.pct_garantia, a.pct_garantia_contrato],
    ["Demais ramos", a.pct_demais, a.pct_demais_contrato],
  ] as const;
  for (const [rotulo, pedido, contrato] of par) {
    if (pedido == null) continue;
    linhas.push({ rotulo, valor: `${pctBR(contrato)} para ${pctBR(pedido)}` });
  }
  if (a.minimo != null) linhas.push({ rotulo: "Mínimo por ciclo", valor: moedaBR(a.minimo) });
  if (a.vigencia_fim) linhas.push({ rotulo: "Nova vigência até", valor: dataBR(a.vigencia_fim) });
  return linhas;
}

export async function enviarAvisosCanalParceiro(): Promise<
  { ok: true; enviados: number; falhas?: number } | { ok: false; erro: string }
> {
  const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");

  const [repasse, verificacoes, alteracoes] = await Promise.all([
    lavoroAdmin.rpc("canal_repasse_emails_pendentes" as never, {} as never),
    lavoroAdmin.rpc("canal_parceiro_verificacoes_para_email" as never, {} as never),
    lavoroAdmin.rpc("canal_parceiro_alteracoes_para_email" as never, {} as never),
  ]);

  const erro = repasse.error ?? verificacoes.error ?? alteracoes.error;
  if (erro) return { ok: false, erro: erro.message };

  const filaRepasse = (repasse.data ?? []) as RepassePendente[];
  const filaVerificacao = (verificacoes.data ?? []) as VerificacaoPendente[];
  const filaAlteracao = (alteracoes.data ?? []) as AlteracaoPendente[];

  if (filaRepasse.length === 0 && filaVerificacao.length === 0 && filaAlteracao.length === 0) {
    return { ok: true, enviados: 0 };
  }

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  let enviados = 0;
  let falhas = 0;

  /** Envia para todos os destinatários; só devolve true se todos saíram. */
  async function despachar(e: Envio, contexto: string): Promise<string | null> {
    const destinos = (e.destinatarios ?? []).filter((d) => typeof d === "string" && d.includes("@"));
    if (destinos.length === 0) {
      console.error(`[canal-parceiro-avisos] sem destinatários`, contexto);
      return null;
    }
    const messageId = crypto.randomUUID();
    let algumOk = false;
    for (const destino of destinos) {
      try {
        const r = await sendTemplateEmail(e.template, destino, {
          idempotencyKey: `${messageId}-${destino}`,
          templateData: {
            assunto: e.assunto,
            eyebrowTexto: "Canal Parceiros",
            rodape: RODAPE,
            preview: e.assunto,
            ...e.dados,
          },
        });
        if (r.sent) algumOk = true;
      } catch (err) {
        console.error(
          "[canal-parceiro-avisos] falha no envio",
          contexto,
          destino,
          mensagemDeErro(err),
        );
      }
    }
    return algumOk ? messageId : null;
  }

  // ---------- Fila 1: repasse ----------
  for (const r of filaRepasse) {
    const ciclo = r.ciclo ?? "—";
    const parceiro = r.parceiro ?? "—";
    let envio: Envio;

    if (r.tipo === "SOLICITACAO") {
      envio = {
        template: "canal-repasse-solicitacao",
        assunto: `Autorizar repasse de ${parceiro}, ciclo ${ciclo}`,
        destinatarios: r.destinatarios ?? [],
        dados: {
          assinaturaNome: r.assinatura_nome,
          assinaturaArea: r.assinatura_area,
          titulo: "Autorização de repasse",
          paragrafos: [
            `${r.solicitante_nome ?? "O Comercial"} conferiu a relação de repasse de **${parceiro}** do ciclo ${ciclo} e pede sua autorização para o envio ao parceiro, para emissão da nota fiscal.`,
          ],
          destaque: {
            titulo: moedaBR(r.valor_total),
            subtitulo: `${Number(r.linhas ?? 0)} parcelas`,
          },
          observacao: r.observacao
            ? { rotulo: "Observação de quem pediu", texto: r.observacao }
            : null,
          botao: { rotulo: "Abrir no Hub", href: telaFinanceiro(r.demanda_id) },
          notaFinal:
            "Na tela você confere o valor, autoriza e informa a data prevista do pagamento.",
        },
      };
    } else if (r.tipo === "RESPOSTA") {
      const aprovada = (r.situacao ?? "").toUpperCase() !== "RECUSADA" && !!r.data_prevista;
      envio = {
        template: "canal-repasse-resposta",
        assunto: `Financeiro respondeu o repasse de ${parceiro}, ciclo ${ciclo}`,
        destinatarios: r.destinatarios ?? [],
        dados: {
          assinaturaNome: r.assinatura_nome,
          assinaturaArea: r.assinatura_area,
          titulo: "Resposta do Financeiro",
          paragrafos: [
            aprovada
              ? `${r.financeiro_nome ?? "O Financeiro"} autorizou o envio da relação de **${parceiro}**, ciclo ${ciclo}. Pagamento previsto para ${dataBR(r.data_prevista)}, após o recebimento da nota fiscal.`
              : `${r.financeiro_nome ?? "O Financeiro"} não aprovou o envio da relação de **${parceiro}**, ciclo ${ciclo}.`,
          ],
          destaque: { titulo: moedaBR(r.valor_total), subtitulo: `${Number(r.linhas ?? 0)} parcelas` },
          observacao:
            !aprovada && r.observacao
              ? { rotulo: "Observação do Financeiro", texto: r.observacao }
              : null,
          botao: { rotulo: "Abrir no Hub", href: telaComercial(r.demanda_id) },
        },
      };
    } else {
      envio = {
        template: "canal-repasse-cobranca",
        assunto: `O repasse de ${parceiro} foi pago?`,
        destinatarios: r.destinatarios ?? [],
        dados: {
          assinaturaNome: r.assinatura_nome,
          assinaturaArea: r.assinatura_area,
          titulo: "O pagamento foi feito?",
          paragrafos: [
            `A data prevista de pagamento de **${parceiro}**, ciclo ${ciclo}, era ${dataBR(r.data_prevista)}, e já se passaram ${Number(r.dias_de_atraso ?? 0)} dia(s). O pagamento foi feito?`,
          ],
          destaque: { titulo: moedaBR(r.valor_total), subtitulo: `${Number(r.linhas ?? 0)} parcelas` },
          botao: { rotulo: "Responder no Hub", href: telaFinanceiro(r.demanda_id) },
          notaFinal: "Confirmando a data, o Hub dá baixa no repasse deste ciclo.",
        },
      };
    }

    const messageId = await despachar(envio, `repasse ${r.tipo} ${r.demanda_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    const { error: erroMarca } = await lavoroAdmin.rpc("canal_repasse_marcar_email" as never, {
      p_demanda_id: r.demanda_id,
      p_tipo: r.tipo,
      p_message_id: messageId,
    } as never);
    if (erroMarca) console.error("[canal-parceiro-avisos] falha ao marcar repasse", erroMarca.message);
    enviados += 1;
  }

  // ---------- Fila 2: conferência de contrato ----------
  for (const v of filaVerificacao) {
    const parceiro = v.parceiro ?? "—";
    const envio: Envio = {
      template: "canal-parceiro-conferencia",
      assunto: `Conferir contrato de ${parceiro}`,
      destinatarios: v.destinatarios ?? [],
      dados: {
        assinaturaNome: v.assinatura_nome,
        assinaturaArea: v.assinatura_area,
        titulo: "Contrato para conferência",
        paragrafos: [
          `Um contrato precisa da sua conferência. ${v.enviado_por_nome ?? "Alguém do Comercial"} enviou **${v.arquivo_nome ?? "o arquivo"}** em ${dataHoraBR(v.enviado_em)}.`,
        ],
        itens: [
          { rotulo: "Situação", valor: v.situacao ?? "—" },
          { rotulo: "Motivo", valor: v.motivo ?? "—" },
          { rotulo: "Como foi lido", valor: v.origem_leitura ?? "—" },
          {
            rotulo: "Declarado assinado / assinatura lida no arquivo",
            valor: `${simNao(v.declarado_assinado)} / ${simNao(v.assinatura_lida)}`,
          },
          { rotulo: "Repasse acumulado travado", valor: moedaBR(v.repasse_acumulado) },
        ],
        botao: { rotulo: "Abrir no Hub", href: telaComercial() },
        notaFinal: "Na tela você abre o documento por um link temporário e decide.",
      },
    };

    const destinos = (v.destinatarios ?? []).filter((d) => typeof d === "string" && d.includes("@"));
    const messageId = await despachar(envio, `verificacao ${v.contrato_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    for (const destino of destinos) {
      const { error: erroMarca } = await lavoroAdmin.rpc("canal_parceiro_marcar_aviso" as never, {
        p_contrato_id: v.contrato_id,
        p_tipo: "VERIFICAR",
        p_destinatario: destino,
        p_message_id: messageId,
      } as never);
      if (erroMarca)
        console.error("[canal-parceiro-avisos] falha ao marcar conferência", erroMarca.message);
    }
    enviados += 1;
  }

  // ---------- Fila 3: alteração de percentual ----------
  for (const a of filaAlteracao) {
    const parceiro = a.parceiro ?? "—";
    const itens = mudancas(a);
    let envio: Envio;

    if (a.tipo === "PEDIDO") {
      envio = {
        template: "canal-parceiro-alteracao-pedido",
        assunto: `Aprovar alteração de percentual de ${parceiro}`,
        destinatarios: a.destinatarios ?? [],
        dados: {
          assinaturaNome: a.assinatura_nome,
          assinaturaArea: a.assinatura_area,
          titulo: "Alteração de percentual",
          paragrafos: [
            `${a.solicitante_nome ?? "O Comercial"} pediu alteração de percentual de **${parceiro}**, com De Acordo de ${a.diretor_email ?? "—"}.`,
          ],
          itens: [...itens, { rotulo: "Anexo com o De Acordo", valor: a.anexo_nome ?? "—" }],
          observacao: a.justificativa
            ? { rotulo: "Justificativa", texto: a.justificativa }
            : null,
          botao: { rotulo: "Abrir no Hub", href: telaComercial() },
        },
      };
    } else {
      const aprovada = (a.situacao ?? "").toUpperCase() === "APROVADA";
      envio = {
        template: "canal-parceiro-alteracao-decisao",
        assunto: `Alteração de percentual de ${parceiro}: ${a.situacao ?? "decidida"}`,
        destinatarios: a.destinatarios ?? [],
        dados: {
          assinaturaNome: a.assinatura_nome,
          assinaturaArea: a.assinatura_area,
          titulo: "Alteração de percentual decidida",
          paragrafos: [
            `${a.aprovador_nome ?? "A diretoria"} ${aprovada ? "aprovou" : "recusou"} a alteração de percentual de **${parceiro}**.`,
          ],
          itens,
          observacao: a.observacao ? { rotulo: "Observação", texto: a.observacao } : null,
          botao: { rotulo: "Abrir no Hub", href: telaComercial() },
        },
      };
    }

    const messageId = await despachar(envio, `alteracao ${a.tipo} ${a.alteracao_id}`);
    if (!messageId) {
      falhas += 1;
      continue;
    }
    const { error: erroMarca } = await lavoroAdmin.rpc(
      "canal_parceiro_marcar_email_alteracao" as never,
      {
        p_alteracao_id: a.alteracao_id,
        p_tipo: a.tipo,
        p_message_id: messageId,
      } as never,
    );
    if (erroMarca)
      console.error("[canal-parceiro-avisos] falha ao marcar alteração", erroMarca.message);
    enviados += 1;
  }

  return { ok: true, enviados, falhas };
}
