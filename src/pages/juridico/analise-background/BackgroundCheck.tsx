// =====================================================================
// Background check.
//
// A tela é organizada por SUJEITO, não por parâmetro técnico. Quem usa
// não pensa em "finalidade COMPLIANCE": pensa em "vou checar um
// candidato", "vou homologar um fornecedor", "vou avaliar um cliente".
// Cada sujeito determina três coisas de uma vez — o tipo de documento
// esperado, a finalidade gravada no dossiê e a base legal exigida.
//
// A trava de LGPD é funcional, não decorativa: CPF sem base legal
// registrada e vigente é recusado pela rota com 403, e a tela oferece o
// registro ali mesmo — inclusive com base diferente de consentimento,
// que é o caso do Jurídico.
// =====================================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  BASE_LEGAL_LABEL, useBgCheck, useConsentimentos, useDossies,
  useRegistrarConsentimento, useRevogarConsentimento, type BaseLegal,
} from "@/hooks/use-analise-background";
import { cpfMask, dataFmt, docFmt, num, soDigitos } from "@/lib/ab-format";
import type { ResultadoBgCheck } from "@/lib/ab-types";
import {
  EstadoVazio, SeveridadeBadge, VereditoBadge,
} from "@/components/analise-background/AbBits";

type Perfil = "rh" | "compliance" | "garantia";

interface Sujeito {
  chave: string;
  rotulo: string;
  /** Documento que faz sentido para este sujeito. */
  doc: "CPF" | "CNPJ" | "AMBOS";
  /** Finalidade gravada em ab_dossie — define quem vê o dossiê depois. */
  finalidade: string;
  perfil: Perfil;
  baseLegalPadrao: BaseLegal;
  nota: string;
}

const SUJEITOS: Sujeito[] = [
  {
    chave: "COLABORADOR",
    rotulo: "Colaborador ou candidato",
    doc: "CPF",
    finalidade: "RH",
    perfil: "rh",
    baseLegalPadrao: "consentimento",
    nota:
      "Dado pessoal de pessoa física. Exige consentimento do titular, registrado e " +
      "vigente (LGPD art. 7º I). O dossiê fica visível só para quem tem ab_rh.",
  },
  {
    chave: "CLIENTE",
    rotulo: "Cliente",
    doc: "AMBOS",
    finalidade: "COMPLIANCE",
    perfil: "compliance",
    baseLegalPadrao: "legitimo_interesse",
    nota:
      "PJ em fonte pública oficial: legítimo interesse, sem consentimento. Se o cliente " +
      "for pessoa física, a regra do CPF vale igual.",
  },
  {
    chave: "FORNECEDOR",
    rotulo: "Fornecedor ou terceiro",
    doc: "CNPJ",
    finalidade: "FORNECEDOR",
    perfil: "compliance",
    baseLegalPadrao: "legitimo_interesse",
    nota:
      "Homologação de fornecedor. Sanção em CEIS/CNEP/CEPIM e situação cadastral " +
      "irregular reprovam; exposição fiscal ou judicial alta é risco a dimensionar, " +
      "não reprovação automática.",
  },
  {
    chave: "SUBSCRICAO",
    rotulo: "Subscrição de seguro",
    doc: "CNPJ",
    finalidade: "SUBSCRICAO",
    perfil: "garantia",
    baseLegalPadrao: "legitimo_interesse",
    nota:
      "Análise para aceitação de risco pela seguradora. Aqui a exposição alta é " +
      "informação de precificação, não veredito.",
  },
];

export default function BackgroundCheck({
  podeRh, podeCompliance, isAdmin,
}: { podeRh: boolean; podeCompliance: boolean; isAdmin: boolean }) {

  const sujeitosVisiveis = SUJEITOS.filter(
    (s) => isAdmin ||
      (s.perfil === "rh" && podeRh) ||
      (s.perfil === "compliance" && podeCompliance),
  );

  const [sujeitoChave, setSujeitoChave] = useState(
    (sujeitosVisiveis[0] ?? SUJEITOS[0]).chave,
  );
  const sujeito = SUJEITOS.find((s) => s.chave === sujeitoChave) ?? SUJEITOS[0];
  const finalidade = sujeito.finalidade;

  const [documento, setDocumento] = useState("");
  const [resultado, setResultado] = useState<ResultadoBgCheck | null>(null);
  const [erroConsent, setErroConsent] = useState<string | null>(null);

  // formulário de base legal
  const [nomeTitular, setNomeTitular] = useState("");
  const [confirmaTermo, setConfirmaTermo] = useState(false);
  const [baseLegal, setBaseLegal] = useState<BaseLegal>("consentimento");
  const [justificativa, setJustificativa] = useState("");

  const checar = useBgCheck();
  const registrar = useRegistrarConsentimento();
  const revogar = useRevogarConsentimento();
  const { data: dossies } = useDossies();
  const { data: consentimentos } = useConsentimentos();

  const dig = soDigitos(documento);
  const ehCpf = dig.length === 11;
  const ehCnpj = dig.length === 14;

  /**
   * Documento que não combina com o sujeito é erro de intenção, não de
   * digitação: CNPJ em "colaborador" quase sempre significa que a pessoa
   * escolheu o sujeito errado, e deixar passar grava o dossiê na
   * finalidade errada — que é justamente o que a segregação evita.
   */
  const docIncompativel =
    (sujeito.doc === "CPF" && ehCnpj) || (sujeito.doc === "CNPJ" && ehCpf);

  const consultar = async () => {
    setResultado(null);
    setErroConsent(null);
    if (dig.length !== 11 && dig.length !== 14) {
      toast.error("Informe CNPJ (14 dígitos) ou CPF (11 dígitos).");
      return;
    }
    if (docIncompativel) {
      toast.error(
        `"${sujeito.rotulo}" espera ${sujeito.doc}.`,
        { description: "Troque o sujeito ou o documento — o dossiê é gravado na finalidade do sujeito escolhido." },
      );
      return;
    }
    try {
      const r = await checar.mutateAsync({ documento: dig, finalidade });
      setResultado(r);
    } catch (e) {
      const err = e as Error & { erro?: string };
      if (err.erro === "consentimento_ausente") setErroConsent(err.message);
      else toast.error(err.message);
    }
  };

  const registrarTermo = async () => {
    if (!nomeTitular.trim() || !confirmaTermo) {
      toast.error("Informe o nome do titular e confirme a declaração.");
      return;
    }
    if (baseLegal !== "consentimento" && justificativa.trim().length < 15) {
      toast.error("Descreva a justificativa.", {
        description:
          "Base legal que não é consentimento precisa dizer POR QUE se aplica — " +
          "número do processo, obrigação legal, o que for. É esse texto que sustenta " +
          "a decisão numa auditoria.",
      });
      return;
    }
    try {
      await registrar.mutateAsync({
        documento: dig,
        nome: nomeTitular,
        finalidade,
        baseLegal,
        justificativa: justificativa.trim() || undefined,
      });
      toast.success("Base legal registrada. Pode consultar.");
      setErroConsent(null);
      setNomeTitular("");
      setConfirmaTermo(false);
      setJustificativa("");
      await consultar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] items-start">
      <div className="space-y-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">CNPJ ou CPF</Label>
                <Input
                  className="w-[220px]"
                  placeholder="só números"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && consultar()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quem você está checando</Label>
                <Select value={sujeitoChave} onValueChange={setSujeitoChave}>
                  <SelectTrigger className="w-[290px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sujeitosVisiveis.map((s) => (
                      <SelectItem key={s.chave} value={s.chave}>
                        {s.rotulo}
                        <span className="ml-1.5 text-muted-foreground text-[11px]">
                          ({s.doc === "AMBOS" ? "CNPJ ou CPF" : s.doc})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={consultar} disabled={checar.isPending}>
                {checar.isPending ? "Consultando…" : "Consultar"}
              </Button>
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                <strong>{sujeito.rotulo}</strong> · dossiê gravado com finalidade{" "}
                <code>{finalidade}</code>. {sujeito.nota}
              </p>
              {docIncompativel && (
                <p className="text-xs text-destructive font-medium">
                  Este sujeito espera {sujeito.doc}, e você digitou{" "}
                  {ehCpf ? "um CPF" : "um CNPJ"}. Troque um dos dois.
                </p>
              )}
              {ehCpf && !docIncompativel && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  CPF é dado pessoal: a consulta só ocorre com base legal registrada e
                  vigente. O Hub bloqueia sem ela — e é isso que mantém RH, Compliance e
                  Jurídico defensáveis em auditoria.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {erroConsent && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-destructive">Consulta bloqueada — falta base legal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[13px]">{erroConsent}</p>

              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Nome do titular</Label>
                  <Input
                    className="w-[240px]"
                    value={nomeTitular}
                    onChange={(e) => setNomeTitular(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Base legal</Label>
                  <Select value={baseLegal} onValueChange={(v) => setBaseLegal(v as BaseLegal)}>
                    <SelectTrigger className="w-[340px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BASE_LEGAL_LABEL) as BaseLegal[]).map((b) => (
                        <SelectItem key={b} value={b}>{BASE_LEGAL_LABEL[b]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* A base legal muda o que precisa ser declarado. Consentimento
                  se comprova com o termo assinado; exercício regular de
                  direitos se comprova com o processo. Pedir "consentimento"
                  onde a base é outra registraria uma base falsa — que é pior
                  que não registrar, porque parece conforme. */}
              {baseLegal === "consentimento" ? (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={confirmaTermo}
                    onCheckedChange={(v) => setConfirmaTermo(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span>
                    Confirmo que o titular {cpfMask(dig)} assinou termo de consentimento
                    específico e informado para esta finalidade, com prazo definido, e que o
                    documento está arquivado e disponível para auditoria (LGPD art. 7º, I).
                  </span>
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Justificativa</Label>
                    <Input
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      placeholder="ex.: processo 1002328-36.2025.5.02.0386, em que a Lavoro é parte"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={confirmaTermo}
                      onCheckedChange={(v) => setConfirmaTermo(Boolean(v))}
                      className="mt-0.5"
                    />
                    <span>
                      Confirmo que o tratamento do CPF {cpfMask(dig)} se enquadra em{" "}
                      {BASE_LEGAL_LABEL[baseLegal]}, que a justificativa acima descreve o caso
                      concreto, e que respondo por esta declaração em auditoria.
                    </span>
                  </label>
                </div>
              )}

              <Button onClick={registrarTermo} disabled={registrar.isPending}>
                {registrar.isPending ? "Registrando…" : "Registrar base legal e consultar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {resultado && (
          <>
            <Card className={
              resultado.veredito === "REPROVADO" ? "border-destructive/50"
                : resultado.veredito === "ATENCAO" ? "border-amber-500/50" : "border-primary/40"
            }>
              <CardContent className="p-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold">
                    {resultado.nome ?? docFmt(resultado.documento)}
                  </h3>
                  <VereditoBadge veredito={resultado.veredito} />
                  <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                    score {num(resultado.score, 0)}/100
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {resultado.tipo} {docFmt(resultado.documento)} · finalidade {resultado.finalidade}
                </p>
                {resultado.veredito === "ATENCAO" && (
                  <p className="text-[13px] mt-2.5">
                    Atenção não é reprovação. Exposição fiscal e judicial alta é risco de
                    subscrição <em>e</em> oportunidade comercial — veja a aba Oportunidades.
                  </p>
                )}
              </CardContent>
            </Card>

            {resultado.achados.length ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Severidade</TableHead>
                      <TableHead className="w-[130px]">Categoria</TableHead>
                      <TableHead>Achado</TableHead>
                      <TableHead className="min-w-[260px]">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.achados.map((a, i) => (
                      <TableRow key={i}>
                        <TableCell><SeveridadeBadge severidade={a.severidade} /></TableCell>
                        <TableCell className="text-xs">{a.categoria}</TableCell>
                        <TableCell className="text-[13px] font-medium">{a.titulo}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.detalhe}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EstadoVazio titulo="Nenhum achado nas fontes consultadas" />
            )}
          </>
        )}
      </div>

      {/* ---------------- coluna direita ---------------- */}
      <div className="space-y-5">
        {resultado && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cobertura desta consulta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Fontes consultadas
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {resultado.fontes_consultadas.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              {!!resultado.fontes_indisponiveis.length && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Não coberto
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-600 dark:text-amber-400">
                    {resultado.fontes_indisponiveis.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Últimos dossiês</CardTitle></CardHeader>
          <CardContent className="p-0">
            {dossies?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Documento</TableHead>
                    <TableHead className="text-xs">Finalidade</TableHead>
                    <TableHead className="text-xs">Veredito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dossies.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{dataFmt(d.created_at)}</TableCell>
                      <TableCell className="text-xs">
                        {docFmt(d.documento)}
                        <div className="text-muted-foreground truncate max-w-[130px]">
                          {d.nome ?? ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{d.finalidade}</TableCell>
                      <TableCell><VereditoBadge veredito={d.veredito} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma consulta ainda.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Consentimentos ativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            {consentimentos?.length ? consentimentos.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {cpfMask(c.documento)}
                </Badge>
                <span className="text-muted-foreground flex-1">
                  {c.nome ?? "—"} · {c.finalidade} · até {dataFmt(c.validade)}
                </span>
                <button
                  onClick={() => revogar.mutate(c.id)}
                  className="text-xs underline text-muted-foreground shrink-0"
                >
                  revogar
                </button>
              </div>
            )) : (
              <p className="text-muted-foreground">Nenhum consentimento registrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
