import type { RpParametros } from "@/lib/rp/rp-tipos";

export function ComoFunciona({
  params,
  livres,
  total,
}: {
  params?: RpParametros | null;
  livres: number;
  total: number;
}) {
  const dias = params?.rp_janela_antecedencia_dias ?? 30;
  const inicio = params?.rp_horario_funcionamento?.inicio ?? "07:00";
  const fim = params?.rp_horario_funcionamento?.fim ?? "20:00";
  const antes = params?.rp_checkin_liberado_antes_min ?? 15;
  const tolerancia = params?.rp_tolerancia_checkin_min ?? 30;

  const passos = [
    {
      titulo: "Escolha a mesa, o dia e o horário",
      texto: `Clique em uma posição livre na planta e confirme. Você pode reservar com até ${dias} dias de antecedência, em dias úteis, dentro do horário ${inicio} às ${fim}.`,
    },
    {
      titulo: "Confirmação por e-mail",
      texto: "Você e o RH recebem a confirmação da reserva na hora.",
    },
    {
      titulo: "Check-in ao chegar",
      texto: `No dia, conecte-se ao Wi-Fi do escritório, abra o Hub e clique em Fazer check-in na sua reserva, disponível a partir de ${antes} minutos antes do início.`,
    },
    {
      titulo: "Atenção ao prazo",
      texto: `Sem check-in em até ${tolerancia} minutos após o início, a reserva expira sozinha, a posição volta a ficar livre e o RH é notificado da ausência.`,
    },
  ];

  return (
    <aside className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-lg font-semibold text-foreground">Como funciona</h3>

      <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[15px]">
        <span className="font-bold text-foreground">{livres} de {total}</span>{" "}
        <span className="text-foreground">posições com horários livres no dia selecionado</span>
      </div>

      <ol className="mt-4 space-y-4">
        {passos.map((p, i) => (
          <li key={p.titulo} className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-primary">{p.titulo}</span>
              </div>
              <p className="mt-0.5 text-[15px] leading-relaxed text-foreground">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-border pt-3 text-[13px] leading-relaxed text-foreground/90">
        Precisa cancelar? Vá em Minhas reservas e cancele antes do horário de início.
      </p>
    </aside>
  );
}
