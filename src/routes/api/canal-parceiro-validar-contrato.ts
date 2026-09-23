// Leitura do contrato de parceria (Canal Parceiros).
//
// Rota AUTENTICADA (não é hook de cron): o usuário logado envia o PDF para o
// bucket `canal-parceiros-contratos` e chama esta rota com o path do arquivo.
//
// Ordem das checagens, que é o ponto desta etapa:
//   1. sessão válida (401 sem sessão);
//   2. `pode_ver_canal_parceiro()` com o cliente DO USUÁRIO (403 se não vier true).
// Só depois disso o service_role entra, para baixar o PDF e chamar
// `canal_parceiro_registrar_contrato` — que é service_role-only de propósito:
// se o navegador pudesse chamá-la, bastaria mandar `assinado: true`.
//
// POST /api/canal-parceiro-validar-contrato
//   { "path": "...", "arquivo_nome": "...", "canal_id": "..." | null }
import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "canal-parceiros-contratos";

export const Route = createFileRoute("/api/canal-parceiro-validar-contrato")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Cliente no contexto do usuário que chamou — respeita RLS. */
function comoUsuario(req: Request): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
  const anon =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

const MESES: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4,
  maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8,
  setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Le uma data em qualquer das formas que aparecem nos contratos. */
function acharData(txt: string): string | null {
  let m = txt.match(
    /(\d{1,2})\s*(?:de\s+)?([a-zA-ZçÇáàâãéêíóôõúüÁ-Úà-ú]{3,9})\.?\s*(?:de\s+)?(\d{4})/i,
  );
  if (m) {
    const mes = MESES[semAcento(m[2]).toLowerCase()];
    if (mes) return iso(+m[3], mes, +m[1]);
  }
  m = txt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

/** Percentual proximo de uma palavra-chave de ramo, numa janela de 220 caracteres. */
function percentualPerto(txt: string, chaves: string[]): number | null {
  const plano = semAcento(txt).toLowerCase();
  const re = /(\d{1,3})(?:[.,](\d{1,2}))?\s*%/g;
  let achado: RegExpExecArray | null;
  while ((achado = re.exec(plano)) !== null) {
    const ini = Math.max(0, achado.index - 220);
    const fim = Math.min(plano.length, achado.index + 220);
    const janela = plano.slice(ini, fim);
    if (chaves.some((k) => janela.includes(k))) {
      const inteiro = Number(achado[1]);
      const dec = achado[2] ? Number(achado[2]) / (achado[2].length === 1 ? 10 : 100) : 0;
      const pct = (inteiro + dec) / 100;
      if (pct > 0 && pct <= 1) return Number(pct.toFixed(4));
    }
  }
  return null;
}

function extrair(texto: string) {
  const plano = semAcento(texto).toLowerCase();

  // CNPJ: o primeiro que nao e o da Lavoro (24.297.493/0001-31)
  const cnpjs = [...texto.matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)].map((x) => x[0]);
  const cnpj = cnpjs.find((c) => !c.startsWith("24.297.493")) ?? cnpjs[0] ?? null;

  // Razao social: nome em caixa alta terminado em tipo societario
  const nomes: string[] = [];
  for (const m of texto.matchAll(
    /([A-ZÀ-Ü0-9][A-ZÀ-Ü0-9&.\-\s]{5,90}?(?:LTDA|S\.?A\.?|EIRELI|ME|MEI|EPP))\b/g,
  )) {
    const n = m[1].replace(/\s+/g, " ").trim();
    if (!/LAVORO|L\s*FARIAS/i.test(n) && !nomes.includes(n)) nomes.push(n);
  }

  // Apelidos: "doravante denominada X"
  for (const m of texto.matchAll(
    /(?:doravante\s+(?:denominad[ao]\s+)?(?:simplesmente\s+)?)["“']?([A-ZÀ-Ü][A-ZÀ-Ü\s]{2,40})["”']?/gi,
  )) {
    const n = m[1].replace(/\s+/g, " ").trim();
    if (n.length >= 3 && !/PARCEIRA|PARTES|CONTRATO/i.test(n) && !nomes.includes(n)) nomes.push(n);
  }

  // Percentual por ramo
  const pctBeneficios = percentualPerto(texto, ["beneficio"]);
  const pctGarantia = percentualPerto(texto, ["garantia", "garantias"]);
  const pctDemais = percentualPerto(texto, ["demais ramos", "outros ramos"]);

  // Vigencia: intervalo explicito, senao data de inicio + prazo em meses
  let vigIni: string | null = null;
  let vigFim: string | null = null;
  let vigOrigem: "INTERVALO" | "TEXTO" | "ASSINATURA" | null = null;
  const mPrazo = plano.match(/prazo[^.]{0,160}?(\d{1,3})\s*\(?[a-z\s]*\)?\s*(mes|meses|ano|anos)/);

  const mIntervalo = texto.match(
    /vig[eê]ncia[^.]{0,120}?(\d{1,2}[^\s]*\s*(?:de\s+)?[^\s,;]+\s*(?:de\s+)?\d{4}|\d{2}\/\d{2}\/\d{4})\s*(?:a|at[eé])\s*(\d{1,2}[^\s]*\s*(?:de\s+)?[^\s,;]+\s*(?:de\s+)?\d{4}|\d{2}\/\d{2}\/\d{4})/i,
  );
  if (mIntervalo) {
    const ini = acharData(mIntervalo[1]);
    const fim = acharData(mIntervalo[2]);
    if (ini && fim) {
      vigIni = ini;
      vigFim = fim;
      vigOrigem = "INTERVALO";
    }
  }

  if (!vigIni) {
    const padroes = [
      /efeitos?\s+retroativos?\s+a\s+([^,.;]{6,60})/i,
      /(?:com\s+)?in[ií]cio\s+(?:em|no\s+dia|a\s+partir\s+de)?\s*([^,.;]{6,60})/i,
      /a\s+partir\s+de\s+([^,.;]{6,60})/i,
      /viger[aá]\s+(?:de|a\s+partir\s+de)\s*([^,.;]{6,60})/i,
      /vig[eê]ncia[^.]{0,80}/i,
    ];
    for (const re of padroes) {
      const m = texto.match(re);
      if (!m) continue;
      const d = acharData(m[1] ?? m[0]);
      if (d) {
        vigIni = d;
        vigOrigem = "TEXTO";
        break;
      }
    }
  }

  const fecharPeloPrazo = (inicio: string) => {
    if (!mPrazo) return null;
    const qtd = Number(mPrazo[1]);
    const meses = mPrazo[2].startsWith("ano") ? qtd * 12 : qtd;
    const d = new Date(`${inicio}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + meses);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  if (vigIni && !vigFim) vigFim = fecharPeloPrazo(vigIni);

  // Assinatura: os padrões rodam sobre o texto com espaços normalizados, porque
  // plataformas como ZapSign quebram "Assinado ... por Nome" e a data em linhas
  // separadas, e [^\n] não atravessa. Mantém o formato Clicksign (mês por
  // extenso) e acrescenta o numérico; fica a data/hora mais recente.
  const linear = texto.replace(/\s+/g, " ");
  const assinaturas = [
    ...linear.matchAll(
      /assin(?:ou|ado|atura)[^\n]{0,120}?(\d{1,2}\s+[a-zç]{3,9}\.?\s+\d{4}[^\n]{0,20}\d{2}:\d{2}(?::\d{2})?)/gi,
    ),
    ...linear.matchAll(
      /assin(?:ou|ado|atura)[\s\S]{0,160}?(\d{2}\/\d{2}\/\d{4})[\s,]*(\d{2}:\d{2}(?::\d{2})?)/gi,
    ),
  ];
  let assinadoEm: string | null = null;
  for (const a of assinaturas) {
    const trecho = `${a[1]} ${a[2] ?? ""}`;
    const dia = acharData(trecho);
    const hora = trecho.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (dia) {
      const t = `${dia}T${hora ? `${hora[1]}:${hora[2]}:${hora[3] ?? "00"}` : "12:00:00"}-03:00`;
      if (!assinadoEm || t > assinadoEm) assinadoEm = t;
    }
  }
  const mSign = plano.match(/(\d{1,2})\s*(?:signat[aá]rios?|assinantes?)/);
  const nDeclarado = mSign ? Number(mSign[1]) : null;
  const nOcorrencias = linear.match(
    /assinado\s+(?:digitalmente|eletronicamente)\s+(?:na|no|por)/gi,
  )?.length ?? 0;
  const signatarios =
    Math.max(nDeclarado ?? 0, nOcorrencias, assinaturas.length) || null;
  const plataformaRe = /(zapsign|clicksign|docusign)/i.exec(linear);
  const plataformaMapa: Record<string, string> = {
    zapsign: "ZapSign",
    clicksign: "Clicksign",
    docusign: "DocuSign",
  };
  const assinaturaPlataforma = plataformaRe
    ? plataformaMapa[plataformaRe[1].toLowerCase()]
    : null;
  const assinado = Boolean(assinadoEm) &&
    /zapsign|clicksign|docusign|assinatura eletronica|assinado digitalmente|assinado eletronicamente|lista de assinaturas|mp 2\.200-2/.test(plano);

  // Importancia minima
  const mMin = texto.match(/(?:import[aâ]ncia\s+m[ií]nima|valor\s+m[ií]nimo)[^\d]{0,40}R?\$?\s*([\d.]+,\d{2})/i);
  const minimo = mMin ? Number(mMin[1].replace(/\./g, "").replace(",", ".")) : 100;

  // Sem data de inicio no texto, mas com prazo e assinatura: deduz pela assinatura
  if (!vigIni && mPrazo && assinadoEm) {
    vigIni = assinadoEm.slice(0, 10);
    vigOrigem = "ASSINATURA";
    vigFim = fecharPeloPrazo(vigIni);
  }

  // Tipo de documento
  const tipo = /aditivo/.test(plano) ? "ADITIVO" : /renova[cç][aã]o/.test(plano) ? "RENOVACAO" : "CONTRATO";

  return {
    nomes, cnpj,
    pct_beneficios: pctBeneficios,
    pct_garantia: pctGarantia,
    pct_demais: pctDemais,
    vigencia_inicio: vigIni,
    vigencia_fim: vigFim,
    vigencia_origem: vigOrigem,
    assinado, assinado_em: assinadoEm, signatarios,
    minimo, tipo,
  };
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A camada de texto do PDF esta legivel? PDFs exportados do Word com mapa de
 *  caracteres quebrado caem aqui e precisam de OCR. */
function textoLegivel(t: string): boolean {
  const latinas   = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const estranhas = (t.match(/[Ā-ӿ]/g) || []).length;
  return latinas > 300 && estranhas < latinas * 0.2;
}

interface DadosManuais {
  razao_social?: string;
  cnpj?: string;
  vigencia_inicio?: string;
  vigencia_fim?: string;
  pct_beneficios?: number;
  pct_garantia?: number;
  pct_demais?: number;
  minimo?: number;
}

async function handle(request: Request): Promise<Response> {
  try {
    // Quem esta enviando precisa estar logado e enxergar o cadastro
    const usuario = comoUsuario(request);
    const { data: quem } = await usuario.auth.getUser();
    if (!quem?.user) return json({ erro: "Sessao invalida" }, 401);

    const { data: podeVer } = await usuario.rpc("pode_ver_canal_parceiro");
    if (podeVer !== true) return json({ erro: "Sem permissao para enviar contrato" }, 403);

    const body = await request.json().catch(() => null) as
      {
        path?: string;
        arquivo_nome?: string;
        canal_id?: string | null;
        declarado_assinado?: boolean;
        texto_ocr?: string;
        dados_manuais?: DadosManuais;
      } | null;
    const path = body?.path;
    const arquivoNome: string = body?.arquivo_nome ?? path?.split("/").pop() ?? "contrato.pdf";
    const canalId: string | null = body?.canal_id ?? null;
    const declaradoAssinado = body?.declarado_assinado === true;
    const textoOcr = typeof body?.texto_ocr === "string" ? body.texto_ocr : null;
    const manuais = body?.dados_manuais ?? null;
    if (!path) return json({ erro: "Informe o path do arquivo" }, 400);

    const { lavoroAdmin } = await import("@/integrations/supabase/lavoro-admin.server");
    const admin = lavoroAdmin as unknown as SupabaseClient;

    const { data: arquivo, error: erroDown } = await admin.storage.from(BUCKET).download(path);
    if (erroDown || !arquivo) {
      return json({ erro: `Nao consegui abrir o arquivo: ${erroDown?.message}` }, 400);
    }

    const buf = await arquivo.arrayBuffer();
    const hash = await sha256(buf);
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    const texto = Array.isArray(text) ? text.join("\n") : text;

    // Leitura do proprio servidor: e a UNICA fonte de assinatura, data e
    // signatarios. Nada disso vem do navegador, em nenhum dos tres modos.
    const leituraServidor = extrair(texto);

    const legivel = textoLegivel(texto) &&
      Boolean(
        leituraServidor.vigencia_inicio ||
        leituraServidor.pct_beneficios ||
        leituraServidor.pct_garantia ||
        leituraServidor.pct_demais,
      );

    let e = leituraServidor;
    let origem: "TEXTO" | "OCR" | "MANUAL" = "TEXTO";
    const camposManuais: string[] = [];

    if (!legivel && !manuais) {
      if (textoOcr) {
        const o = extrair(textoOcr);
        origem = "OCR";
        e = {
          ...o,
          // assinatura sempre da leitura do servidor
          assinado: leituraServidor.assinado,
          assinado_em: leituraServidor.assinado_em,
          signatarios: leituraServidor.signatarios,
        };
      } else {
        return json(
          {
            precisa_ocr: true,
            paginas: pdf.numPages,
            motivo:
              "A camada de texto deste PDF está corrompida. Vou tentar reconhecer as páginas por imagem.",
          },
          200,
        );
      }
    }

    // O que o usuario informou a mao vence a leitura, campo a campo, legivel ou nao.
    if (manuais) {
      const base = e;
      const pega = <T,>(valor: T | undefined | null | "", campo: string, lido: T): T => {
        if (valor === undefined || valor === null || valor === "") return lido;
        camposManuais.push(campo);
        return valor;
      };
      origem = "MANUAL";
      e = {
        ...base,
        nomes: manuais.razao_social
          ? (camposManuais.push("razao_social"), [manuais.razao_social, ...base.nomes])
          : base.nomes,
        cnpj: pega(manuais.cnpj, "cnpj", base.cnpj),
        vigencia_inicio: pega(manuais.vigencia_inicio, "vigencia_inicio", base.vigencia_inicio),
        vigencia_fim: pega(manuais.vigencia_fim, "vigencia_fim", base.vigencia_fim),
        pct_beneficios: pega(manuais.pct_beneficios, "pct_beneficios", base.pct_beneficios),
        pct_garantia: pega(manuais.pct_garantia, "pct_garantia", base.pct_garantia),
        pct_demais: pega(manuais.pct_demais, "pct_demais", base.pct_demais),
        minimo: pega(manuais.minimo, "minimo", base.minimo),
        // assinatura sempre da leitura do servidor
        assinado: leituraServidor.assinado,
        assinado_em: leituraServidor.assinado_em,
        signatarios: leituraServidor.signatarios,
      };
    }


    const { data, error } = await admin.rpc("canal_parceiro_registrar_contrato", {
      p_nomes_do_contrato: e.nomes,
      p_arquivo_path: path,
      p_arquivo_nome: arquivoNome,
      p_hash_sha256: hash,
      p_tipo: e.tipo,
      p_assinado: e.assinado,
      p_assinado_em: e.assinado_em,
      p_signatarios: e.signatarios,
      p_vigencia_inicio: e.vigencia_inicio,
      p_vigencia_fim: e.vigencia_fim,
      p_pct_beneficios: e.pct_beneficios,
      p_pct_garantia: e.pct_garantia,
      p_pct_demais: e.pct_demais,
      p_minimo: e.minimo,
      p_extracao: { ...e, cnpj: e.cnpj, paginas: pdf.numPages, origem_leitura: origem },
      // sempre da sessão do servidor, nunca do corpo da requisição
      p_enviado_por: quem.user.id,
      p_canal_id: canalId,
      p_declarado_assinado: declaradoAssinado,
      p_origem_leitura: origem,
    } as never);
    if (error) return json({ erro: error.message }, 400);

    const r = Array.isArray(data) ? data[0] : data;
    return json(
      {
        resultado: r,
        extracao: e,
        hash,
        paginas: pdf.numPages,
        origem_leitura: origem,
        vigencia_origem: e.vigencia_origem,
        manual_aplicado: camposManuais.length > 0,
        campos_manuais: camposManuais,
      },
      200,
    );
  } catch (err) {
    return json({ erro: String(err) }, 500);
  }
}
