// Etapa 6 — Curadoria.
//
// Painel de CONFERÊNCIA, não de digitação: tudo que aparece aqui já veio da
// negociação. O técnico confere e resolve só o que estiver faltando, com link
// para a aba onde aquilo se resolve.

import { useMemo } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

import { useResponsaveis } from "@/hooks/use-entrada-demandas";
import {
  nomeSeguradoraCotacao,
  useCotacoes,
  useSeguradorasGarantia,
} from "@/hooks/use-garantia-crm";
import { useDocumentosDaDemanda } from "@/hooks/use-garantia-documentos";
import { useAtualizarDemanda, type DemandaLista } from "@/hooks/use-garantia-negociacao";
import { pendenciasEtapa3b } from "@/lib/garantia/documentos-regra";
import { A_DEFINIR, ROTULO_PRODUTO, moeda, rotuloModalidade } from "@/lib/garantia/formato";

function Item({
  rotulo,
  valor,
  ok,
  onde,
}: {
  rotulo: string;
  valor: string;
  ok: boolean;
  onde?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right">
        <span className={ok ? "font-medium" : "font-medium text-amber-700"}>{valor}</span>
        {!ok && onde && <span className="block text-xs text-muted-foreground">Resolve em: {onde}</span>}
      </span>
    </div>
  );
}

export function AbaCuradoria({ demanda }: { demanda: DemandaLista }) {
  const { data: pessoas = [] } = useResponsaveis();
  const { data: cotacoes = [] } = useCotacoes(demanda.id);
  const { data: seguradoras = [] } = useSeguradorasGarantia();
  const { data: docs = [] } = useDocumentosDaDemanda(demanda.id);
  const atualizar = useAtualizarDemanda();

  const nome = (id: string | null) =>
    id ? (pessoas.find((p) => p.user_id === id)?.nome ?? A_DEFINIR) : A_DEFINIR;

  const escolhida = cotacoes.find((c) => c.escolhida) ?? null;
  const vigentes = useMemo(
    () => new Set(docs.filter((d) => !d.substituido_por_id).map((d) => d.tipo)),
    [docs],
  );

  // A trava do CCG é a MESMA da etapa 3b — a função é reusada, não reescrita.
  const pendenciaCcg = pendenciasEtapa3b(
    {
      produto: demanda.produto,
      exige_cadastro: demanda.exige_cadastro,
      balancos_assinados: demanda.balancos_assinados,
      dre_assinados: demanda.dre_assinados,
      precisa_nomeacao: demanda.precisa_nomeacao,
      precisa_ccg: demanda.precisa_ccg,
    },
    vigentes,
  ).filter((p) => p.texto.includes("CCG"));

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Tudo abaixo veio da negociação: nada precisa ser digitado de novo. Confira e resolva só o
        que estiver em falta.
      </p>

      <div className="rounded-md border p-3">
        <Item rotulo="Cliente" valor={demanda.cliente?.nome ?? A_DEFINIR} ok={!!demanda.cliente} onde="Dados" />
        <Item
          rotulo="Cliente novo ou da casa"
          valor={demanda.tipo_movimento === "novo" ? "Negócio novo" : "Cliente da casa (renovação/endosso)"}
          ok
        />
        <Item
          rotulo="Cartão CNPJ do segurado"
          valor={demanda.segurado?.cpf_cnpj ?? A_DEFINIR}
          ok={!!demanda.segurado?.cpf_cnpj}
          onde="Dados"
        />
        <Item
          rotulo={demanda.produto === "fianca_locaticia" ? "Locador" : "Segurado"}
          valor={demanda.segurado?.nome ?? A_DEFINIR}
          ok={!!demanda.segurado}
          onde="Dados"
        />
        <Item rotulo="Canal" valor={demanda.canal?.nome ?? A_DEFINIR} ok={!!demanda.canal} onde="Origem" />
        <Item
          rotulo="Responsável pelo cliente"
          valor={nome(demanda.responsavel_cliente_id)}
          ok={!!demanda.responsavel_cliente_id}
          onde="Dados"
        />
        <Item
          rotulo="Responsável técnico"
          valor={nome(demanda.responsavel_tecnico_id)}
          ok={!!demanda.responsavel_tecnico_id}
          onde="Dados"
        />
        <Item rotulo="Produto" valor={ROTULO_PRODUTO[demanda.produto] ?? demanda.produto} ok />
        <Item rotulo="Modalidade" valor={rotuloModalidade(demanda.modalidade)} ok={!!demanda.modalidade} onde="Dados" />
        <Item
          rotulo="Tipo de movimento"
          valor={demanda.tipo_movimento ?? A_DEFINIR}
          ok={!!demanda.tipo_movimento}
          onde="Dados"
        />
        <Item
          rotulo="Tipo de alteração"
          valor={demanda.tipo_movimento === "endosso" ? (demanda.tipo_alteracao ?? A_DEFINIR) : "não se aplica"}
          ok={demanda.tipo_movimento !== "endosso" || !!demanda.tipo_alteracao}
          onde="Dados"
        />
        <Item
          rotulo="Consulta a mercado"
          valor={
            demanda.produto === "fianca_locaticia"
              ? "não se aplica à fiança locatícia"
              : demanda.exige_cadastro
                ? "sem limite em nenhuma seguradora — cadastro foi exigido"
                : "limite encontrado no mercado"
          }
          ok
          onde="Limites"
        />
        <Item
          rotulo="Documentos anexados"
          valor={vigentes.size ? `${vigentes.size} tipo(s) com versão vigente` : "nenhum"}
          ok={vigentes.size > 0}
          onde="Documentos"
        />
        <Item
          rotulo="Cotação escolhida"
          valor={
            escolhida
              ? `${nomeSeguradoraCotacao(escolhida, seguradoras)} · ${moeda(escolhida.premio)}`
              : A_DEFINIR
          }
          ok={!!escolhida}
          onde="Cotações"
        />
      </div>

      <Separator />

      <div className="space-y-2 rounded-md border p-3">
        <h4 className="font-semibold text-[#14405C]">Decisão da curadoria</h4>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={demanda.precisa_ccg}
            onCheckedChange={(v) =>
              atualizar.mutate(
                { id: demanda.id, valores: { precisa_ccg: v === true } },
                { onError: () => toast.error("Não foi possível salvar a resposta.") },
              )
            }
          />
          Esse caso precisa de CCG?
        </label>
        {demanda.precisa_ccg ? (
          <p className="text-muted-foreground">
            Marcado: o avanço passa por “Aguardando assinatura do CCG” e exige o anexo do tipo CCG.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Não marcado: a curadoria segue direto para a minuta.
          </p>
        )}
        {pendenciaCcg.map((p, i) => (
          <p key={i} className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {p.texto} <span className="block text-xs">Motivo: {p.motivo}.</span>
            </span>
          </p>
        ))}
        {!pendenciaCcg.length && demanda.precisa_ccg && (
          <p className="flex items-center gap-2 text-[#338B85]">
            <Check className="h-4 w-4" /> CCG anexado.
          </p>
        )}
      </div>
    </div>
  );
}
