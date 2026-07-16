// ============================================================================
// sync-market-news
//
// Busca feeds RSS de fontes do setor (seguros, atuarial, benefícios, saúde),
// deduplica por link, insere em public.market_news_cache e limpa registros com
// mais de 30 dias.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Categoria = "mercado_seguros" | "atuarial" | "beneficios" | "saude";

interface Fonte {
  nome: string;
  url: string;
  categoria: Categoria;
}

const FONTES: Fonte[] = [
  // Mercado de Seguros
  { nome: "Sonho Seguro", url: "https://sonhoseguro.com.br/feed", categoria: "mercado_seguros" },
  { nome: "Revista Apólice", url: "https://revistaapolice.com.br/feed/", categoria: "mercado_seguros" },
  { nome: "Revista Cobertura", url: "https://www.revistacobertura.com.br/feed/", categoria: "mercado_seguros" },
  // Benefícios
  { nome: "Melhor RH", url: "https://www.melhorrh.com.br/feed", categoria: "beneficios" },
  { nome: "Você RH", url: "https://vocerh.abril.com.br/feed/", categoria: "beneficios" },
  { nome: "RH Portal", url: "https://www.rhportal.com.br/feed/", categoria: "beneficios" },
  // Saúde
  { nome: "Futuro da Saúde", url: "https://futurodasaude.com.br/feed/", categoria: "saude" },
  { nome: "Medicina S/A", url: "https://medicinasa.com.br/feed/", categoria: "saude" },
  { nome: "Saúde Business", url: "https://www.saudebusiness.com/feed/", categoria: "saude" },
  // Atuarial: nenhuma fonte com RSS válido identificada — categoria fica vazia.
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

interface ParsedItem {
  titulo: string;
  link: string;
  publicado_em: string | null;
}

function parseRss(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  const matches = xml.match(re) ?? [];
  for (const raw of matches) {
    const titulo = extractTag(raw, "title");
    let link = extractTag(raw, "link");
    if (!link) {
      const m = raw.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = m ? m[1] : null;
    }
    const pub = extractTag(raw, "pubDate") ?? extractTag(raw, "dc:date") ?? extractTag(raw, "published");
    if (!titulo || !link) continue;
    let publicado_em: string | null = null;
    if (pub) {
      const d = new Date(pub);
      publicado_em = isNaN(d.getTime()) ? null : d.toISOString();
    }
    items.push({ titulo: titulo.slice(0, 500), link: link.trim(), publicado_em });
  }
  return items;
}

async function fetchFonte(f: Fonte): Promise<{ ok: boolean; count: number; error?: string; items: ParsedItem[] }> {
  try {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(f.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "LavoroHubNewsBot/1.0 (+https://hub.lavoroseguros.com.br)" },
    });
    clearTimeout(to);
    if (!res.ok) return { ok: false, count: 0, error: `HTTP ${res.status}`, items: [] };
    const xml = await res.text();
    const items = parseRss(xml);
    return { ok: true, count: items.length, items };
  } catch (e) {
    return { ok: false, count: 0, error: (e as Error).message, items: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const relatorio: Record<string, { fonte: string; categoria: Categoria; ok: boolean; itens: number; inseridos: number; erro?: string }> = {};

  for (const f of FONTES) {
    const r = await fetchFonte(f);
    let inseridos = 0;
    if (r.ok && r.items.length) {
      const rows = r.items.map((it) => ({
        titulo: it.titulo,
        link: it.link,
        fonte: f.nome,
        categoria: f.categoria,
        publicado_em: it.publicado_em,
      }));
      const { data, error } = await supabase
        .from("market_news_cache")
        .upsert(rows, { onConflict: "link", ignoreDuplicates: true })
        .select("id");
      if (error) {
        relatorio[f.url] = { fonte: f.nome, categoria: f.categoria, ok: false, itens: r.count, inseridos: 0, erro: error.message };
        continue;
      }
      inseridos = data?.length ?? 0;
    }
    relatorio[f.url] = { fonte: f.nome, categoria: f.categoria, ok: r.ok, itens: r.count, inseridos, erro: r.error };
  }

  // Retenção 30 dias
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: delErr, count: delCount } = await supabase
    .from("market_news_cache")
    .delete({ count: "exact" })
    .lt("publicado_em", cutoff);

  console.log("[sync-market-news]", JSON.stringify({ relatorio, removidos: delCount ?? 0, delErr: delErr?.message }));

  return new Response(
    JSON.stringify({ ok: true, relatorio, removidos: delCount ?? 0 }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
