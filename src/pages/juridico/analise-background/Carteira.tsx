// Aba Carteira — visão consolidada por CNPJ, para Garantia e Compliance.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useCarteira, useRodarFuncao } from "@/hooks/use-analise-background";
import { cnpjFmt, num, tituloCase } from "@/lib/ab-format";
import { Dinheiro, EstadoVazio, RestritivoBadge } from "@/components/analise-background/AbBits";

export default function Carteira() {
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const [relacao, setRelacao] = useState<string>("todas");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const { data, isLoading } = useCarteira({
    busca: aplicada || undefined,
    relacao: relacao === "todas" ? undefined : relacao,
  });
  const rodar = useRodarFuncao();

  const alternar = (cnpj: string) => {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(cnpj) ? n.delete(cnpj) : n.add(cnpj);
      return n;
    });
  };

  const monitorar = async () => {
    if (!selecionados.size) return;
    try {
      const r = await rodar.mutateAsync({
        nome: "ab-bureau-monitorar",
        body: { cnpjs: [...selecionados] },
      }) as { provider?: string; registrados?: number; aviso?: string };
      if (r?.provider === "none") {
        toast.warning("Nenhum bureau contratado", { description: r.aviso });
      } else {
        toast.success(`${r?.registrados ?? 0} CNPJ(s) em monitoramento diário`);
      }
      setSelecionados(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Empresa, CNPJ ou UF"
          className="w-[240px]"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setAplicada(busca)}
        />
        <Select value={relacao} onValueChange={setRelacao}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as relações</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="fornecedor">Fornecedor</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={() => setAplicada(busca)}>Buscar</Button>
        <div className="ml-auto flex items-center gap-2">
          {selecionados.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selecionados.size} selecionada(s)
            </span>
          )}
          <Button onClick={monitorar} disabled={!selecionados.size || rodar.isPending}>
            {rodar.isPending ? "Registrando…" : "Monitorar no bureau"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !data?.length ? (
        <EstadoVazio
          titulo="Carteira vazia"
          detalhe="Rode a ingestão na aba Fontes, ou execute select ab_seed_demo() no SQL Editor para ver o módulo funcionando."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead className="min-w-[240px]">Empresa</TableHead>
                <TableHead>Relação</TableHead>
                <TableHead>CNAE</TableHead>
                <TableHead className="text-right">Proc.</TableHead>
                <TableHead className="text-right">Exposição judicial</TableHead>
                <TableHead className="text-right">Dívida ativa</TableHead>
                <TableHead className="text-right">Contratos públicos</TableHead>
                <TableHead>Restritivos</TableHead>
                <TableHead className="text-right">IS em aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.empresa_id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selecionados.has(r.cnpj)}
                      onChange={() => alternar(r.cnpj)}
                      aria-label={`Selecionar ${r.razao_social}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{tituloCase(r.razao_social)}</div>
                    <div className="text-xs text-muted-foreground">
                      {cnpjFmt(r.cnpj)} · {r.uf ?? "—"}
                      {r.situacao_cadastral &&
                        !r.situacao_cadastral.toUpperCase().includes("ATIVA") && (
                          <Badge variant="destructive" className="ml-1.5 text-[10px]">
                            {r.situacao_cadastral}
                          </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.relacao === "cliente" ? "default" : "secondary"}
                      className="text-[10px]">
                      {r.relacao}
                    </Badge>
                    {r.monitorado && (
                      <Badge variant="outline" className="text-[10px] ml-1">monitorada</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[190px] truncate"
                    title={r.cnae_descricao ?? ""}>
                    {r.cnae_descricao ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[13px]">
                    {num(r.n_processos)}
                    {r.n_em_execucao > 0 && (
                      <span className="text-xs text-destructive"> ({r.n_em_execucao} exec.)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right"><Dinheiro valor={r.exposicao_judicial} /></TableCell>
                  <TableCell className="text-right"><Dinheiro valor={r.divida_ativa} /></TableCell>
                  <TableCell className="text-right"><Dinheiro valor={r.contratos_publicos} /></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.restritivos ?? []).map((t) => <RestritivoBadge key={t} tipo={t} />)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dinheiro valor={r.is_potencial} forte />
                    {r.n_leads > 0 && (
                      <div className="text-xs text-muted-foreground">{r.n_leads} lead(s)</div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
