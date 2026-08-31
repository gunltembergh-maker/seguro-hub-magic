import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BeneficiosShell } from "@/components/beneficios/beneficios-shell";
import { NovoClienteModal } from "@/components/beneficios/novo-cliente-modal";
import { ImportarClientesModal } from "@/components/beneficios/importar-clientes-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientes, useContratos, useReferencia } from "@/hooks/use-beneficios";

export const Route = createFileRoute("/_authenticated/beneficios/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes de Benefícios — Hub Lavoro" },
      { name: "description", content: "Carteira de clientes e contratos de Benefícios da Lavoro Seguros." },
      { property: "og:title", content: "Clientes de Benefícios — Hub Lavoro" },
      { property: "og:description", content: "Carteira de clientes e contratos de Benefícios da Lavoro Seguros." },
    ],
  }),
  component: ClientesPage,
});

const NAVY = "#14405C";

function ClientesPage() {
  const [busca, setBusca] = useState("");
  const [canal, setCanal] = useState("todos");
  const [novo, setNovo] = useState(false);
  const [importar, setImportar] = useState(false);

  const clientes = useClientes();
  const contratos = useContratos();
  const canais = useReferencia("canais");

  const nomeCanal = useMemo(
    () => new Map((canais.data ?? []).map((c) => [c.id, c.nome])),
    [canais.data],
  );

  const porCliente = useMemo(() => {
    const m = new Map<string, { total: number; proxima: string | null }>();
    for (const c of contratos.data ?? []) {
      if (c.status !== "vigente") continue;
      const atual = m.get(c.cliente_id) ?? { total: 0, proxima: null };
      atual.total += 1;
      if (!atual.proxima || c.data_fim_vigencia < atual.proxima) atual.proxima = c.data_fim_vigencia;
      m.set(c.cliente_id, atual);
    }
    return m;
  }, [contratos.data]);

  const contratoDoCliente = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contratos.data ?? []) if (!m.has(c.cliente_id)) m.set(c.cliente_id, c.id);
    return m;
  }, [contratos.data]);

  const lista = (clientes.data ?? []).filter((c) => {
    const q = busca.trim().toLowerCase();
    const okBusca =
      !q ||
      c.nome_razao_social.toLowerCase().includes(q) ||
      c.cpf_cnpj.includes(q.replace(/\D/g, "")) ||
      (c.cidade ?? "").toLowerCase().includes(q);
    const okCanal = canal === "todos" || c.canal_id === canal;
    return okBusca && okCanal;
  });

  const vigentes = (contratos.data ?? []).filter((c) => c.status === "vigente");
  const limite = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  const renovando = vigentes.filter((c) => c.data_fim_vigencia >= hoje && c.data_fim_vigencia <= limite).length;

  return (
    <BeneficiosShell
      titulo="Clientes"
      trilha={["Clientes"]}
      acoes={
        <>
          <Button variant="outline" onClick={() => setNovo(true)}>+ Novo Cliente</Button>
          <Button onClick={() => setImportar(true)} style={{ background: "#00BAF2" }} className="text-white">
            ↑ Importar em massa
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Clientes cadastrados" valor={clientes.data?.length ?? 0} />
        <Kpi label="Contratos vigentes" valor={vigentes.length} cor="#1E7F4F" />
        <Kpi label="Renovando nos próx. 90 dias" valor={renovando} cor="#D98418" />
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CNPJ/CPF ou cidade"
          className="bg-white"
        />
        <Select value={canal} onValueChange={setCanal}>
          <SelectTrigger className="w-full bg-white md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            {(canais.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="p-4 text-left">Cliente</th>
              <th className="p-4 text-left">Documento</th>
              <th className="p-4 text-left">Cidade / UF</th>
              <th className="p-4 text-left">Canal</th>
              <th className="p-4 text-left">Contratos</th>
              <th className="p-4 text-left">Próxima vigência</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const agreg = porCliente.get(c.id);
              const contratoId = contratoDoCliente.get(c.id);
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="p-4 font-semibold" style={{ color: NAVY }}>
                    {c.nome_razao_social}
                    <span className="ml-2 text-xs font-normal text-gray-400">nº {c.numero_cliente}</span>
                  </td>
                  <td className="p-4 text-gray-500">{c.cpf_cnpj}</td>
                  <td className="p-4">{[c.cidade, c.estado].filter(Boolean).join(", ") || "—"}</td>
                  <td className="p-4">
                    <Badge variant="secondary">{nomeCanal.get(c.canal_id) ?? "—"}</Badge>
                  </td>
                  <td className="p-4">{agreg?.total ?? 0}</td>
                  <td className="p-4">{agreg?.proxima ?? "—"}</td>
                  <td className="p-4 text-right">
                    {contratoId ? (
                      <Link to="/beneficios/contratos/$id" params={{ id: contratoId }} className="text-[#00BAF2] hover:underline">
                        Ver ficha
                      </Link>
                    ) : (
                      <span className="text-gray-400">Sem contrato</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-sm text-gray-500">
                  Nenhum cliente cadastrado ainda. Use “Novo Cliente” ou “Importar em massa”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NovoClienteModal open={novo} onOpenChange={setNovo} />
      <ImportarClientesModal open={importar} onOpenChange={setImportar} />
    </BeneficiosShell>
  );
}

function Kpi({ label, valor, cor = "#14405C" }: { label: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold" style={{ color: cor }}>{valor}</p>
    </div>
  );
}
