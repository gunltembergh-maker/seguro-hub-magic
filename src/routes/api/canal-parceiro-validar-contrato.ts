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
  let m = txt.match(/(\d{1,2})\s*(?:de\s+)?([a-zç]{3,9})\.?\s*(?:de\s+)?(\d{4})/i);
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

  // Vigencia: "prazo de 12 (doze) meses, com inicio em <data>"
  let vigIni: string | null = null;
  let vigFim: string | null = null;
  const mPrazo = plano.match(/prazo[^.]{0,160}?(\d{1,3})\s*\(?[a-z\s]*\)?\s*(mes|meses|ano|anos)/);
  const mInicio = texto.match(/in[ií]cio\s+(?:em|no dia)?\s*([^,.;]{6,40})/i);
  if (mInicio) vigIni = acharData(mInicio[1]);
  if (!vigIni) {
    const mVig = texto.match(/vig[eê]ncia[^.]{0,80}/i);
    if (mVig) vigIni = acharData(mVig[0]);
  }
  if (vigIni && mPrazo) {
    const qtd = Number(mPrazo[1]);
    const meses = mPrazo[2].startsWith("ano") ? qtd * 12 : qtd;
    const d = new Date(`${vigIni}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + meses);
    d.setUTCDate(d.getUTCDate() - 1);
    vigFim = d.toISOString().slice(0, 10);
  }

  // Assinatura: bloco do Clicksign no fim do PDF
  const assinaturas = [
    ...texto.matchAll(
      /assin(?:ou|ado|atura)[^\n]{0,120}?(\d{1,2}\s+[a-zç]{3,9}\.?\s+\d{4}[^\n]{0,20}\d{2}:\d{2}(?::\d{2})?)/gi,
    ),
  ];
  let assinadoEm: string | null = null;
  for (const a of assinaturas) {
    const dia = acharData(a[1]);
    const hora = a[1].match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (dia) {
      const t = `${dia}T${hora ? `${hora[1]}:${hora[2]}:${hora[3] ?? "00"}` : "12:00:00"}-03:00`;
      if (!assinadoEm || t > assinadoEm) assinadoEm = t;
    }
  }
  const mSign = plano.match(/(\d{1,2})\s*(?:signat[aá]rios?|assinantes?)/);
  const signatarios = mSign ? Number(mSign[1]) : (assinaturas.length || null);
  const assinado = Boolean(assinadoEm) &&
    /clicksign|docusign|assinatura eletronica|assinado digitalmente|lista de assinaturas/.test(plano);

  // Importancia minima
  const mMin = texto.match(/(?:import[aâ]ncia\s+m[ií]nima|valor\s+m[ií]nimo)[^\d]{0,40}R?\$?\s*([\d.]+,\d{2})/i);
  const minimo = mMin ? Number(mMin[1].replace(/\./g, "").replace(",", ".")) : 100;

  // Tipo de documento
  const tipo = /aditivo/.test(plano) ? "ADITIVO" : /renova[cç][aã]o/.test(plano) ? "RENOVACAO" : "CONTRATO";

  return {
    nomes, cnpj,
    pct_beneficios: pctBeneficios,
    pct_garantia: pctGarantia,
    pct_demais: pctDemais,
    vigencia_inicio: vigIni,
    vigencia_fim: vigFim,
    assinado, assinado_em: assinadoEm, signatarios,
    minimo, tipo,
  };
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
      { path?: string; arquivo_nome?: string; canal_id?: string | null } | null;
    const path = body?.path;
    const arquivoNome: string = body?.arquivo_nome ?? path?.split("/").pop() ?? "contrato.pdf";
    const canalId: string | null = body?.canal_id ?? null;
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

    const e = extrair(texto);

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
      p_extracao: { ...e, cnpj: e.cnpj, paginas: pdf.numPages },
      // sempre da sessão do servidor, nunca do corpo da requisição
      p_enviado_por: quem.user.id,
      p_canal_id: canalId,
    });
    if (error) return json({ erro: error.message }, 400);

    const r = Array.isArray(data) ? data[0] : data;
    return json({ resultado: r, extracao: e, hash, paginas: pdf.numPages }, 200);
  } catch (err) {
    return json({ erro: String(err) }, 500);
  }
}
