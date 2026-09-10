import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dataBR,
  hhmm,
  mensagemErro,
  STATUS_CLASSE,
  STATUS_LABEL,
  type RpReservaRetorno,
} from "@/lib/rp/rp-tipos";
import { enviarEmailReserva } from "@/lib/rp/rp-email.functions";
import { CancelarComMotivoDialog } from "@/components/reserva-posicoes/CancelarComMotivoDialog";


export const Route = createFileRoute("/_authenticated/admin/reservas")({
  head: () => ({
    meta: [
      { title: "Reserva de Posições | Administração | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Administração do módulo Reserva de Posições: posições, reservas do escritório, parâmetros e modelos de e-mail.",
      },
    ],
  }),
  component: AdminReservasPage,
});

interface PosicaoRow {
  id: string;
  numero: number;
  apelido: string | null;
  bloco: string;
  ativa: boolean;
  fixa: boolean;
  fixa_user_id: string | null;
  fixa_observacao: string | null;
}

interface ReservaRow {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  user_id: string;
  posicao_id: string;
  rp_posicoes: { numero: number; apelido: string | null } | null;
}

const CARD = "rounded-xl border border-slate-200 bg-white p-4 text-slate-800";

/* ------------------------------- Posições -------------------------------- */

function AbaPosicoes() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<PosicaoRow | null>(null);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: posicoes, isLoading } = useQuery({
    queryKey: ["rp-admin-posicoes"],
    queryFn: async (): Promise<PosicaoRow[]> => {
      const { data, error } = await supabase
        .from("rp_posicoes")
        .select("id, numero, apelido, bloco, ativa, fixa, fixa_user_id, fixa_observacao")
        .order("numero");
      if (error) throw error;
      return (data ?? []) as PosicaoRow[];
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["rp-usuarios-hub", busca],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_buscar_usuarios_hub", { p_busca: busca });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!edit,
  });

  const { data: nomes } = useQuery({
    queryKey: ["rp-usuarios-hub-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_buscar_usuarios_hub", { p_busca: "" });
      if (error) throw error;
      return new Map((data ?? []).map((u) => [u.user_id, u.nome || u.email]));
    },
  });

  const salvar = async () => {
    if (!edit) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("rp_posicoes")
        .update({
          apelido: edit.apelido?.trim() || null,
          ativa: edit.ativa,
          fixa: edit.fixa,
          fixa_user_id: edit.fixa ? edit.fixa_user_id : null,
          fixa_observacao: edit.fixa ? edit.fixa_observacao?.trim() || null : null,
        })
        .eq("id", edit.id);
      if (error) throw error;
      setEdit(null);
      await qc.invalidateQueries({ queryKey: ["rp-admin-posicoes"] });
      toast.success("Posição atualizada.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) {
    return (
      <div className={CARD}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className={CARD}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nº</TableHead>
            <TableHead>Apelido</TableHead>
            <TableHead>Bloco</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Reserva fixa</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(posicoes ?? []).map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-semibold">{p.numero}</TableCell>
              <TableCell>{p.apelido ?? "—"}</TableCell>
              <TableCell className="capitalize">{p.bloco}</TableCell>
              <TableCell>
                <Badge variant="outline" className={p.ativa ? STATUS_CLASSE.confirmada : STATUS_CLASSE.cancelada}>
                  {p.ativa ? "Ativa" : "Inativa"}
                </Badge>
              </TableCell>
              <TableCell>
                {p.fixa
                  ? `Sim${p.fixa_user_id ? ` · ${nomes?.get(p.fixa_user_id) ?? "colaborador"}` : ""}`
                  : "Não"}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => setEdit({ ...p })}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Posição {edit?.numero}</DialogTitle>
          </DialogHeader>

          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Apelido</Label>
                <Input
                  value={edit.apelido ?? ""}
                  onChange={(e) => setEdit({ ...edit, apelido: e.target.value })}
                  placeholder="Ex.: Janela, Canto do café"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <Label>Posição ativa</Label>
                <Switch checked={edit.ativa} onCheckedChange={(v) => setEdit({ ...edit, ativa: v })} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <Label>Reserva fixa</Label>
                <Switch checked={edit.fixa} onCheckedChange={(v) => setEdit({ ...edit, fixa: v })} />
              </div>

              {edit.fixa && (
                <>
                  <div className="space-y-1.5">
                    <Label>Colaborador (opcional)</Label>
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome ou e-mail"
                    />
                    <Select
                      value={edit.fixa_user_id ?? "__none__"}
                      onValueChange={(v) =>
                        setEdit({ ...edit, fixa_user_id: v === "__none__" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem colaborador definido" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="__none__">Sem colaborador definido</SelectItem>
                        {(usuarios ?? []).map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>
                            {u.nome || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Observação</Label>
                    <Textarea
                      value={edit.fixa_observacao ?? ""}
                      onChange={(e) => setEdit({ ...edit, fixa_observacao: e.target.value })}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- Reservas -------------------------------- */

function AbaReservas() {
  const qc = useQueryClient();
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const [de, setDe] = useState(iso(inicioMes));
  const [ate, setAte] = useState(iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
  const [colaborador, setColaborador] = useState("");
  const [posicao, setPosicao] = useState("__all__");
  const [status, setStatus] = useState("__all__");
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  const { data: posicoes } = useQuery({
    queryKey: ["rp-admin-posicoes-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rp_posicoes").select("id, numero").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: nomes } = useQuery({
    queryKey: ["rp-usuarios-hub-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_buscar_usuarios_hub", { p_busca: "" });
      if (error) throw error;
      return new Map((data ?? []).map((u) => [u.user_id, u.nome || u.email]));
    },
  });

  const { data: reservas, isLoading } = useQuery({
    queryKey: ["rp-admin-reservas", de, ate, posicao, status],
    queryFn: async (): Promise<ReservaRow[]> => {
      let q = supabase
        .from("rp_reservas")
        .select("id, data, hora_inicio, hora_fim, status, user_id, posicao_id, rp_posicoes(numero, apelido)")
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: false })
        .order("hora_inicio");
      if (posicao !== "__all__") q = q.eq("posicao_id", posicao);
      if (status !== "__all__") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ReservaRow[];
    },
  });

  const linhas = useMemo(() => {
    const termo = colaborador.trim().toLowerCase();
    return (reservas ?? [])
      .map((r) => ({ ...r, nome: nomes?.get(r.user_id) ?? "—" }))
      .filter((r) => !termo || r.nome.toLowerCase().includes(termo));
  }, [reservas, nomes, colaborador]);

  const cancelar = async (motivo: string) => {
    if (!alvo) return;
    setCancelandoId(alvo.id);
    try {
      await cancelarReservaComMotivo(alvo.id, motivo);
      await qc.invalidateQueries({ queryKey: ["rp-admin-reservas"] });
      setAlvo(null);
      toast.success("Reserva cancelada.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCancelandoId(null);
    }
  };


  const exportarCsv = () => {
    const cabecalho = ["Data", "Posição", "Apelido", "Colaborador", "Início", "Fim", "Status"];
    const corpo = linhas.map((r) => [
      dataBR(r.data),
      r.rp_posicoes?.numero ?? "",
      r.rp_posicoes?.apelido ?? "",
      r.nome,
      hhmm(r.hora_inicio),
      hhmm(r.hora_fim),
      STATUS_LABEL[r.status] ?? r.status,
    ]);
    const csv = [cabecalho, ...corpo]
      .map((l) => l.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservas_${de}_a_${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={CARD}>
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Colaborador</Label>
          <Input
            value={colaborador}
            onChange={(e) => setColaborador(e.target.value)}
            placeholder="Filtrar por nome"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Posição</Label>
          <Select value={posicao} onValueChange={setPosicao}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {(posicoes ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Posição {p.numero}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-slate-600">{linhas.length} reserva(s)</span>
        <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!linhas.length}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Posição</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{dataBR(r.data)}</TableCell>
                <TableCell>
                  {r.rp_posicoes?.numero}
                  {r.rp_posicoes?.apelido ? ` · ${r.rp_posicoes.apelido}` : ""}
                </TableCell>
                <TableCell>{r.nome}</TableCell>
                <TableCell>
                  {hhmm(r.hora_inicio)} às {hhmm(r.hora_fim)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_CLASSE[r.status] ?? ""}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {["reservada", "confirmada"].includes(r.status) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelar(r.id)}
                      disabled={cancelandoId === r.id}
                    >
                      {cancelandoId === r.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/* ------------------------------ Parâmetros ------------------------------- */

interface ParamsForm {
  janela: number;
  tolerancia: number;
  liberado: number;
  inicio: string;
  fim: string;
  emailUsuario: boolean;
  emailsRh: string[];
  ips: string[];
}

function AbaParametros() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ParamsForm | null>(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoIp, setNovoIp] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: ipAtual } = useQuery({
    queryKey: ["rp-ip-publico"],
    queryFn: async () => {
      const res = await fetch("https://api.ipify.org?format=json");
      const json = (await res.json()) as { ip: string };
      return json.ip;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });

  useQuery({
    queryKey: ["rp-admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_admin_settings")
        .select("key, value")
        .like("key", "rp_%");
      if (error) throw error;
      const map = new Map((data ?? []).map((r) => [r.key, r.value as any]));
      const horario = (map.get("rp_horario_funcionamento") ?? {}) as { inicio?: string; fim?: string };
      setForm({
        janela: Number(map.get("rp_janela_antecedencia_dias") ?? 30),
        tolerancia: Number(map.get("rp_tolerancia_checkin_min") ?? 15),
        liberado: Number(map.get("rp_checkin_liberado_antes_min") ?? 30),
        inicio: horario.inicio ?? "07:00",
        fim: horario.fim ?? "20:00",
        emailUsuario: map.get("rp_enviar_email_usuario") !== false,
        emailsRh: Array.isArray(map.get("rp_emails_rh")) ? map.get("rp_emails_rh") : [],
        ips: Array.isArray(map.get("rp_ips_escritorio")) ? map.get("rp_ips_escritorio") : [],
      });
      return data ?? [];
    },
  });

  const salvar = async () => {
    if (!form) return;
    setSalvando(true);
    try {
      const entradas: Array<{ key: string; value: any }> = [
        { key: "rp_janela_antecedencia_dias", value: form.janela },
        { key: "rp_tolerancia_checkin_min", value: form.tolerancia },
        { key: "rp_checkin_liberado_antes_min", value: form.liberado },
        { key: "rp_horario_funcionamento", value: { inicio: form.inicio, fim: form.fim } },
        { key: "rp_enviar_email_usuario", value: form.emailUsuario },
        { key: "rp_emails_rh", value: form.emailsRh },
        { key: "rp_ips_escritorio", value: form.ips },
      ];
      const falhas: string[] = [];
      for (const e of entradas) {
        // UPDATE primeiro (a linha já existe); se nada for afetado, INSERT.
        const { data: atualizado, error: errUpd } = await supabase
          .from("hub_admin_settings")
          .update({ value: e.value })
          .eq("key", e.key)
          .select("key");
        if (errUpd) {
          falhas.push(`${e.key}: ${errUpd.message}`);
          continue;
        }
        if (!atualizado?.length) {
          const { error: errIns } = await supabase
            .from("hub_admin_settings")
            .insert({ key: e.key, value: e.value });
          if (errIns) falhas.push(`${e.key}: ${errIns.message}`);
        }
      }

      // recarrega o que foi realmente gravado
      await qc.invalidateQueries({ queryKey: ["rp-admin-settings"] });
      await qc.invalidateQueries({ queryKey: ["rp-parametros"] });

      if (falhas.length) {
        toast.error("Alguns parâmetros não foram salvos.", {
          description: falhas.join(" · "),
          duration: 10000,
        });
      } else {
        toast.success("Parâmetros salvos.");
      }
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  if (!form) {
    return (
      <div className={CARD}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h3 className="mb-3 font-semibold text-[#14405C]">Regras de reserva</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Janela de antecedência (dias)</Label>
            <Input
              type="number"
              min={1}
              value={form.janela}
              onChange={(e) => setForm({ ...form, janela: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tolerância de check-in (min)</Label>
            <Input
              type="number"
              min={0}
              value={form.tolerancia}
              onChange={(e) => setForm({ ...form, tolerancia: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Check-in liberado antes (min)</Label>
            <Input
              type="number"
              min={0}
              value={form.liberado}
              onChange={(e) => setForm({ ...form, liberado: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Abertura</Label>
            <Input
              type="time"
              value={form.inicio}
              onChange={(e) => setForm({ ...form, inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fechamento</Label>
            <Input
              type="time"
              value={form.fim}
              onChange={(e) => setForm({ ...form, fim: e.target.value })}
            />
          </div>
          <div className="flex items-end justify-between rounded-lg border border-slate-200 p-3">
            <Label>Enviar e-mail ao colaborador</Label>
            <Switch
              checked={form.emailUsuario}
              onCheckedChange={(v) => setForm({ ...form, emailUsuario: v })}
            />
          </div>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="mb-3 font-semibold text-[#14405C]">E-mails do RH</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {form.emailsRh.map((e) => (
            <Badge key={e} variant="outline" className="gap-1 py-1">
              {e}
              <button
                type="button"
                onClick={() => setForm({ ...form, emailsRh: form.emailsRh.filter((x) => x !== e) })}
                aria-label={`Remover ${e}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {form.emailsRh.length === 0 && <span className="text-sm text-slate-500">Nenhum e-mail cadastrado.</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
            placeholder="rh@lavoroseguros.com.br"
          />
          <Button
            variant="outline"
            onClick={() => {
              const v = novoEmail.trim().toLowerCase();
              if (!v.includes("@")) return toast.error("Informe um e-mail válido.");
              if (form.emailsRh.includes(v)) return toast.error("E-mail já cadastrado.");
              setForm({ ...form, emailsRh: [...form.emailsRh, v] });
              setNovoEmail("");
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="mb-1 font-semibold text-[#14405C]">IPs do escritório</h3>
        <p className="mb-3 text-sm text-slate-600">
          Seu IP público agora: <strong>{ipAtual ?? "não identificado"}</strong>
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {form.ips.map((ip) => (
            <Badge key={ip} variant="outline" className="gap-1 py-1">
              {ip}
              <button
                type="button"
                onClick={() => setForm({ ...form, ips: form.ips.filter((x) => x !== ip) })}
                aria-label={`Remover ${ip}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {form.ips.length === 0 && <span className="text-sm text-slate-500">Nenhum IP cadastrado.</span>}
        </div>
        <div className="flex gap-2">
          <Input value={novoIp} onChange={(e) => setNovoIp(e.target.value)} placeholder="200.100.50.10" />
          <Button
            variant="outline"
            onClick={() => {
              const v = novoIp.trim();
              if (!v) return;
              if (form.ips.includes(v)) return toast.error("IP já cadastrado.");
              setForm({ ...form, ips: [...form.ips, v] });
              setNovoIp("");
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
          </Button>
          {ipAtual && !form.ips.includes(ipAtual) && (
            <Button variant="ghost" onClick={() => setForm({ ...form, ips: [...form.ips, ipAtual] })}>
              Usar meu IP
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={salvando}>
          {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar parâmetros
        </Button>
      </div>

      <ModelosEmail />
    </div>
  );
}

/* --------------------------- Modelos de e-mail ---------------------------- */

const VARIAVEIS = [
  "nome",
  "posicao",
  "data",
  "hora_inicio",
  "hora_fim",
  "tolerancia_min",
  "checkin_antes_min",
];
const EXEMPLO: Record<string, string> = {
  nome: "Alessandro Oliveira",
  posicao: "4",
  data: "10/09/2026",
  hora_inicio: "09:00",
  hora_fim: "18:00",
  tolerancia_min: "15",
  checkin_antes_min: "30",
};
const TIPO_LABEL: Record<string, string> = {
  confirmacao: "Confirmação de reserva (colaborador)",
  cancelamento: "Cancelamento de reserva (colaborador)",
  ausencia: "Ausência / no-show (colaborador)",
  rh_confirmacao: "RH · Confirmação de reserva",
  rh_cancelamento: "RH · Cancelamento de reserva",
  rh_ausencia: "RH · Ausência / no-show",
};

function aplicar(texto: string) {
  return VARIAVEIS.reduce((acc, v) => acc.replaceAll(`{{${v}}}`, EXEMPLO[v] ?? ""), texto ?? "");
}

function ModelosEmail() {
  const qc = useQueryClient();
  const [rascunho, setRascunho] = useState<Record<string, { assunto: string; corpo_html: string }>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ assunto: string; html: string } | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["rp-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rp_email_templates")
        .select("id, tipo, assunto, corpo_html, ativo")
        .order("tipo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const salvar = async (id: string) => {
    const r = rascunho[id];
    if (!r) return;
    setSalvandoId(id);
    try {
      const { error } = await supabase
        .from("rp_email_templates")
        .update({ assunto: r.assunto, corpo_html: r.corpo_html })
        .eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["rp-email-templates"] });
      toast.success("Modelo salvo.");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvandoId(null);
    }
  };

  return (
    <div className={CARD}>
      <h3 className="mb-1 font-semibold text-[#14405C]">Modelos de e-mail</h3>
      <p className="mb-4 text-sm text-slate-600">
        Variáveis disponíveis: {VARIAVEIS.map((v) => `{{${v}}}`).join(", ")}
      </p>

      <div className="space-y-6">
        {(templates ?? []).map((t) => {
          const atual = rascunho[t.id] ?? { assunto: t.assunto, corpo_html: t.corpo_html };
          return (
            <div key={t.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-medium text-slate-800">{TIPO_LABEL[t.tipo] ?? t.tipo}</h4>
                <Badge variant="outline">{t.ativo ? "Ativo" : "Inativo"}</Badge>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input
                    value={atual.assunto}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, [t.id]: { ...atual, assunto: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Corpo (HTML)</Label>
                  <Textarea
                    rows={8}
                    className="font-mono text-xs"
                    value={atual.corpo_html}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, [t.id]: { ...atual, corpo_html: e.target.value } })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setPreview({ assunto: aplicar(atual.assunto), html: aplicar(atual.corpo_html) })
                    }
                  >
                    Pré-visualizar
                  </Button>
                  <Button onClick={() => salvar(t.id)} disabled={salvandoId === t.id}>
                    {salvandoId === t.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar modelo
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[80vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.assunto}</DialogTitle>
          </DialogHeader>
          <div
            className="rounded border border-slate-200 p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: preview?.html ?? "" }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- Página -------------------------------- */

function AdminReservasPage() {
  return (
    <div className="px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Reserva de Posições
          </h1>
          <p className="mt-1 text-white/70">
            Posições do escritório, reservas dos colaboradores e parâmetros do módulo.
          </p>
        </div>

        <Tabs defaultValue="posicoes">
          <TabsList className="mb-4">
            <TabsTrigger value="posicoes">Posições</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          </TabsList>
          <TabsContent value="posicoes">
            <AbaPosicoes />
          </TabsContent>
          <TabsContent value="reservas">
            <AbaReservas />
          </TabsContent>
          <TabsContent value="parametros">
            <AbaParametros />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
