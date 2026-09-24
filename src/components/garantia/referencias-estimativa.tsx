// "Referências de estimativa" no Painel da Gerência. Edição só ADMIN (a RLS
// também barra); os demais veem leitura.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { hasRole } from "@/hooks/use-meu-perfil";
import {
  PARAM_COMISSAO,
  PARAM_TAXA,
  useParametrosGarantia,
  useSalvarParametro,
  valorParametro,
} from "@/hooks/use-garantia-parametros";
import { mensagemDeErro } from "@/lib/erro";

const ITENS = [
  { chave: PARAM_TAXA, rotulo: "Taxa anual de referência", sufixo: "% a.a." },
  { chave: PARAM_COMISSAO, rotulo: "Comissão de referência", sufixo: "%" },
];

function Item({ chave, rotulo, sufixo, admin }: (typeof ITENS)[number] & { admin: boolean }) {
  const { data } = useParametrosGarantia();
  const salvar = useSalvarParametro();
  const atual = valorParametro(data, chave);
  const descricao = data?.find((p) => p.chave === chave)?.descricao;
  const [texto, setTexto] = useState(String(atual).replace(".", ","));
  useEffect(() => setTexto(String(atual).replace(".", ",")), [atual]);

  const gravar = async () => {
    const v = Number(texto.replace(",", "."));
    if (!(v > 0)) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    try {
      await salvar.mutateAsync({ chave, valor: v });
      toast.success("Referência atualizada.");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {admin ? (
        <div className="flex items-center gap-2">
          <Input className="w-24" inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <span className="text-sm">{sufixo}</span>
          <Button size="sm" variant="outline" onClick={gravar} disabled={salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      ) : (
        <p className="text-lg font-semibold">
          {atual.toLocaleString("pt-BR")} {sufixo}
        </p>
      )}
      {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
    </div>
  );
}

export function ReferenciasEstimativa() {
  const admin = hasRole(useMeuPerfilEfetivo(), "ADMIN");
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">Referências de estimativa</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {ITENS.map((i) => (
          <Item key={i.chave} {...i} admin={admin} />
        ))}
      </div>
    </div>
  );
}
