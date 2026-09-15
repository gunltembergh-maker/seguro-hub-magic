import { lavoroAdmin } from "./src/integrations/supabase/lavoro-admin.server";
import { resumirResultadoMercado, normalizeLimiteResultado } from "./src/lib/garantia/garantia-judicial-normalizar.server";

const { data, error } = await lavoroAdmin
  .from("garantia_judicial_solicitacoes")
  .select("id, resultado_mercado")
  .eq("id", "b08bf48a-14d6-4d1c-a653-314117ab34cd")
  .maybeSingle();
if (error) { console.error("ERRO", error.message); process.exit(1); }
if (!data) { console.error("linha nao encontrada"); process.exit(1); }
const rm: any = data.resultado_mercado;
console.log("raiz:", Object.keys(rm || {}), "resultados:", rm?.resultados?.length);
const resumo = resumirResultadoMercado(rm);
console.log("\n== GRUPOS ==");
console.log("com_limite:", resumo.com_limite.map(s => s.key).join(", "));
console.log("sem_limite:", resumo.sem_limite.map(s => `${s.key} (${s.statusKey}: ${s.mensagem})`).join(" | "));
console.log("nao_consultado:", resumo.nao_consultado.map(s => `${s.key} (${s.statusKey}: ${s.mensagem.slice(0,120)})`).join(" | "));
console.log("\n== CAPACIDADE / CONDENSACAO ==");
for (const s of resumo.com_limite) {
  console.log(`${s.key}: cap=${s.capacidadeFmt} modalidades ${s.modalidadesAntes} -> ${s.modalidades.length}`);
}
console.log("\n== MODALIDADES: newe (onpoint) ==");
console.log(JSON.stringify(resumo.seguradoras.find(s=>s.key==="newe")?.modalidades ?? resumo.com_limite[0]?.modalidades, null, 1));
console.log("\n== MODALIDADES: jns ==");
console.log(JSON.stringify(resumo.seguradoras.find(s=>s.key==="jns")?.modalidades, null, 1));
console.log("\nnomeTomadorSugerido:", resumo.nomeTomadorSugerido);
console.log("\n== DETALHE POR SEGURADORA ==");
for (const r of (rm?.resultados||[])) {
  const n = normalizeLimiteResultado(r);
  console.log(r.seguradora, "| resp.status:", r.status, "| statusKey:", n.statusKey, "| mods:", n.modalidades.length, "| msg:", String(n.mensagem||"").slice(0,90));
}
