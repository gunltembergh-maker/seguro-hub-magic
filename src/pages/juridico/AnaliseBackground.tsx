// =====================================================================
// Jurídico → Análise Background
//
// O módulo tem UM banco e TRÊS propósitos, e a tela deixa isso explícito
// em vez de misturar num carrossel de abas:
//
//   ORIGINAÇÃO      → time de Garantia. Fila por ramo, carteira, prêmio,
//                     comissão, prioridade. É venda.
//   JURÍDICO E
//   BACKGROUND      → Jurídico (instrução de caso), Compliance (cliente e
//                     fornecedor) e RH (colaborador e candidato). É risco.
//   ADMINISTRAÇÃO   → fontes, gatilhos, cotas e custos.
//
// Por que a separação é estrutural e não decorativa: o mesmo processo
// serve de lead comercial e de peça de instrução, mas a base legal, o
// público e a retenção são diferentes. Misturar as duas leituras na
// mesma tela é como se perde a minimização por finalidade — e, na
// prática, é como um analista de RH acaba vendo a fila de vendas.
//
// As chaves são administradas em Administração › Perfis de Acesso:
//   ab_garantia · ab_juridico · ab_compliance · ab_rh
//   ab_solicitar (pode gerar consulta paga) · ab_cota_gerir (define teto)
// ADMIN passa em tudo.
// =====================================================================

import { useMemo, useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePermissoesAb } from "@/hooks/use-analise-background";
import { EstadoVazio } from "@/components/analise-background/AbBits";
import type { Finalidade } from "@/lib/ab-types";
import OriginacaoGarantia from "./analise-background/OriginacaoGarantia";
import LeadDetalhe from "./analise-background/LeadDetalhe";
import Carteira from "./analise-background/Carteira";
import BackgroundCheck from "./analise-background/BackgroundCheck";
import ConsultaProcessual from "./analise-background/ConsultaProcessual";
import SolicitarPesquisa from "./analise-background/SolicitarPesquisa";
import FontesGatilhos from "./analise-background/FontesGatilhos";
import CotasCustos from "./analise-background/CotasCustos";

type Area = "originacao" | "risco" | "admin";

export interface PropsAnaliseBackground {
  /**
   * Onde a página abre. Não restringe nada — só escolhe a primeira aba.
   * Quem tem permissão continua vendo todos os grupos, venha por onde vier.
   */
  foco?: Area;
}

export default function AnaliseBackground({ foco }: PropsAnaliseBackground = {}) {
  const { isLoading, pode, temAlgum, isAdmin } = usePermissoesAb();
  const [aba, setAba] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  const podeGarantia = pode("ab_garantia");
  const podeJuridico = pode("ab_juridico");
  const podeCompliance = pode("ab_compliance");
  const podeRh = pode("ab_rh");
  const podeSolicitar = pode("ab_solicitar");
  const podeCota = pode("ab_cota_gerir");

  /** As finalidades que este usuário pode declarar numa solicitação. */
  const finalidades = useMemo(() => {
    const f: Finalidade[] = [];
    if (podeGarantia) f.push("GARANTIA");
    if (podeJuridico) f.push("JURIDICO");
    if (podeCompliance) f.push("COMPLIANCE");
    if (podeRh) f.push("RH");
    return f;
  }, [podeGarantia, podeJuridico, podeCompliance, podeRh]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!temAlgum) {
    return (
      <EstadoVazio
        titulo="Sem acesso ao módulo Análise Background"
        detalhe={
          "Peça a um administrador para marcar uma das chaves ab_garantia, ab_juridico, " +
          "ab_compliance ou ab_rh no seu perfil, em Administração › Perfis de Acesso. " +
          "Cada chave abre uma finalidade diferente — não é o mesmo acesso com nomes diferentes."
        }
      />
    );
  }

  // O detalhe do lead ocupa a tela inteira, sobre as abas.
  if (leadId) {
    return <LeadDetalhe leadId={leadId} onVoltar={() => setLeadId(null)} />;
  }

  // ---- monta as abas conforme as chaves ----------------------------
  const abas: { id: string; rotulo: string; area: Area; render: () => ReactNode }[] = [];

  if (podeGarantia) {
    abas.push({
      id: "originacao", rotulo: "Oportunidades", area: "originacao",
      render: () => <OriginacaoGarantia onAbrirLead={setLeadId} />,
    });
  }
  if (podeGarantia || podeCompliance || podeJuridico) {
    abas.push({
      id: "carteira", rotulo: "Carteira 360", area: "originacao",
      render: () => <Carteira />,
    });
  }
  if (podeJuridico) {
    abas.push({
      id: "processual", rotulo: "Consulta processual", area: "risco",
      render: () => <ConsultaProcessual />,
    });
  }
  if (podeCompliance || podeRh) {
    abas.push({
      id: "bgcheck", rotulo: "Background check", area: "risco",
      render: () => (
        <BackgroundCheck
          podeRh={podeRh}
          podeCompliance={podeCompliance}
          isAdmin={isAdmin}
        />
      ),
    });
  }
  if (podeSolicitar) {
    abas.push({
      id: "solicitar", rotulo: "Solicitar pesquisa", area: "risco",
      render: () => (
        <SolicitarPesquisa finalidadesPermitidas={finalidades} pode={pode} />
      ),
    });
  }
  if (podeGarantia || isAdmin) {
    abas.push({
      id: "fontes", rotulo: "Fontes e gatilhos", area: "admin",
      render: () => <FontesGatilhos podeExecutar={isAdmin || podeGarantia} />,
    });
  }
  abas.push({
    id: "cotas", rotulo: "Cotas e custos", area: "admin",
    render: () => <CotasCustos podeGerir={podeCota || isAdmin} />,
  });

  // Sem escolha do usuário, abre na primeira aba do grupo em foco; se o
  // perfil não tem acesso a esse grupo, cai na primeira que ele tem.
  const atual =
    abas.find((a) => a.id === aba) ??
    (foco ? abas.find((a) => a.area === foco) : undefined) ??
    abas[0];

  const grupos: { area: Area; titulo: string; nota: string }[] = [
    {
      area: "originacao", titulo: "Originação",
      nota: "venda de garantia — prêmio, comissão e prazo",
    },
    {
      area: "risco", titulo: "Jurídico e background",
      nota: "instrução de caso e due diligence — sem número comercial",
    },
    { area: "admin", titulo: "Administração", nota: "fontes, gatilhos e custo" },
  ];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Análise Background</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Um só acervo, dois usos. Para o time de <strong>Garantia</strong>, é um motor de
          originação: lê fonte pública oficial, classifica o que aparece no andamento
          processual e devolve fila com valor, prazo e argumento. Para o{" "}
          <strong>Jurídico, Compliance e RH</strong>, é due diligence de CNPJ e CPF — sem
          prêmio, sem comissão e com base legal registrada.
        </p>
      </header>

      <Tabs value={atual.id} onValueChange={setAba}>
        {/* Uma TabsList por grupo: o rótulo do grupo é o que evita a
            confusão entre "lead de garantia" e "background jurídico". */}
        <div className="space-y-2">
          {grupos.map((g) => {
            const doGrupo = abas.filter((a) => a.area === g.area);
            if (!doGrupo.length) return null;
            return (
              <div key={g.area} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="w-[168px] shrink-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                    {g.titulo}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{g.nota}</p>
                </div>
                <TabsList className="flex-wrap h-auto">
                  {doGrupo.map((a) => (
                    <TabsTrigger key={a.id} value={a.id}>{a.rotulo}</TabsTrigger>
                  ))}
                </TabsList>
              </div>
            );
          })}
        </div>

        {abas.map((a) => (
          <TabsContent key={a.id} value={a.id} className="mt-5">
            {a.render()}
          </TabsContent>
        ))}
      </Tabs>

      <footer className="flex flex-wrap gap-1.5 pt-2 border-t">
        <span className="text-[11px] text-muted-foreground mr-1">Suas chaves:</span>
        {([
          ["ab_garantia", podeGarantia],
          ["ab_juridico", podeJuridico],
          ["ab_compliance", podeCompliance],
          ["ab_rh", podeRh],
          ["ab_solicitar", podeSolicitar],
          ["ab_cota_gerir", podeCota],
        ] as [string, boolean][]).map(([chave, tem]) => (
          <Badge
            key={chave}
            variant={tem ? "secondary" : "outline"}
            className={`text-[10px] font-normal ${tem ? "" : "opacity-45"}`}
          >
            {chave}
          </Badge>
        ))}
        {isAdmin && (
          <Badge className="text-[10px] font-normal">ADMIN — passa em tudo</Badge>
        )}
      </footer>
    </div>
  );
}
