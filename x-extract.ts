import { extractText, getDocumentProxy } from "unpdf";
import { readFileSync, writeFileSync } from "node:fs";
const out: Record<string,string> = {};
for (const [k,f] of [["standard","modelo_standard_anp.pdf"],["alternativo","modelo_alternativo_anp.pdf"]]) {
  const buf = new Uint8Array(readFileSync(`/tmp/lavsys/assets/reference_models/${f}`));
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  out[k] = text as string;
  console.log(k, (text as string).length);
}
writeFileSync("/tmp/ext/out.json", JSON.stringify(out));
console.log(out.standard.slice(0,600));
