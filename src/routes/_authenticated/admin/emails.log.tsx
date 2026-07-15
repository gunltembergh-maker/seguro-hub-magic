import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail,
  MailCheck,
  MailX,
  MailWarning,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { useMeuPerfil, hasRole } from "@/hooks/use-meu-perfil";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/emails/log")({
  component: EmailsLogPage,
});

type Row = {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  failed: "bg-amber-100 text-amber-700 border-amber-200",
  dlq: "bg-red-100 text-red-700 border-red-200",
  suppressed: "bg-yellow-100 text-yellow-700 border-yellow-200",
  rate_limited: "bg-orange-100 text-orange-700 border-orange-200",
  bounced: "bg-red-100 text-red-700 border-red-200",
  complained: "bg-red-100 text-red-700 border-red-200",
};

const RANGES = [
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7 dias", hours: 24 * 7 },
  { key: "30d", label: "30 dias", hours: 24 * 30 },
];

function fmtBRT(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function EmailsLogPage() {
  const { data: perfil } = useMeuPerfil();
  const isAdmin = hasRole(perfil, "ADMIN");
  const [range, setRange] = useState("7d");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const since = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return new Date(Date.now() - r.hours * 3600_000).toISOString();
  }, [range]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    enabled: isAdmin,
    queryKey: ["email-send-log", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const templates = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => r.template_name && set.add(r.template_name));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !r.recipient_email?.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [data, templateFilter, statusFilter, search]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      sent: filtered.filter((r) => r.status === "sent").length,
      failed: filtered.filter((r) => r.status === "dlq" || r.status === "failed").length,
      suppressed: filtered.filter((r) => r.status === "suppressed").length,
    }),
    [filtered],
  );

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 font-display text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas administradores podem visualizar o log de emails.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Log de Emails</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de envios pelo Hub — inclui reports, notificações e emails de teste.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1"
        >
          <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Mail} label="Total" value={stats.total} tone="default" />
        <StatCard icon={MailCheck} label="Enviados" value={stats.sent} tone="success" />
        <StatCard icon={MailX} label="Falharam" value={stats.failed} tone="danger" />
        <StatCard
          icon={MailWarning}
          label="Suprimidos"
          value={stats.suppressed}
          tone="warning"
        />
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Período</label>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <Button
                  key={r.key}
                  size="sm"
                  variant={range === r.key ? "default" : "outline"}
                  onClick={() => {
                    setRange(r.key);
                    setPage(0);
                  }}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Template</label>
            <Select
              value={templateFilter}
              onValueChange={(v) => {
                setTemplateFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="dlq">DLQ</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
                <SelectItem value="rate_limited">Rate limited</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Buscar destinatário</label>
            <Input
              placeholder="email@dominio.com"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quando (BRT)</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && pageRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Nenhum envio encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.template_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.recipient_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[r.status ?? ""] ?? ""}
                    >
                      {r.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtBRT(r.created_at)}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground max-w-[320px] truncate"
                    title={r.error_message ?? ""}
                  >
                    {r.error_message ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages} · {filtered.length} envios
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Mail;
  label: string;
  value: number;
  tone: "default" | "success" | "danger" | "warning";
}) {
  const toneClasses = {
    default: "text-slate-700",
    success: "text-emerald-700",
    danger: "text-red-700",
    warning: "text-amber-700",
  }[tone];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${toneClasses}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
