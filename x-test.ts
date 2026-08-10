import { readFileSync } from "node:fs";
import { runAnpAudit } from "./src/lib/garantia/anp-audit.server";
const bytes = new Uint8Array(readFileSync("/tmp/lavsys/assets/reference_models/modelo_alternativo_anp.pdf"));
const t = Date.now();
const r = await runAnpAudit(bytes, "teste.pdf", false);
console.log("ms", Date.now()-t, "modelo", r.selected_model.label, r.selected_model.similarity, "clausulas", r.clauses.length, "ai", r.ai_used);
console.log(r.match_summary);
console.log(r.clauses.slice(0,5).map(c=>[c.clause,c.similarity,c.risk,c.diagnostico.slice(0,60)]));
console.log(r.candidate_models);
