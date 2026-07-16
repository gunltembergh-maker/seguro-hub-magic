import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useMeuPerfilEfetivo } from "@/contexts/view-as-context";
import { MuralNoticias } from "@/components/inicio/mural-noticias";
import fundoInicio from "@/assets/fundo-inicio.jpg";

export const Route = createFileRoute("/_authenticated/inicio")({
  component: InicioPage,
});

function saudacaoPorHora(h: number): string {
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function horaSaoPaulo(): number {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(h, 10);
}

function dataExtenso(): string {
  const s = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  // Capitaliza "quinta-feira, 16 de julho de 2026" -> "Quinta-feira, 16 de julho de 2026"
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function InicioPage() {
  const perfil = useMeuPerfilEfetivo();
  const primeiro = (perfil?.full_name || perfil?.email || "Usuário").split(" ")[0];

  const [hora, setHora] = useState(() => horaSaoPaulo());
  useEffect(() => {
    const id = setInterval(() => setHora(horaSaoPaulo()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-full">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${fundoInicio})` }}
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(135deg, rgba(14,46,67,0.92) 0%, rgba(20,64,92,0.85) 55%, rgba(27,86,128,0.75) 100%)",
        }}
      />

      <div className="relative z-0 p-6 md:p-8 lg:p-10">
        <div className="mx-auto grid max-w-[1400px] gap-6 lg:grid-cols-5">
          {/* Saudação */}
          <div className="lg:col-span-5">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              {saudacaoPorHora(hora)},{" "}
              <span className="text-[#00BAF2]">{primeiro}</span>!
            </h1>
            <p className="mt-2 text-base text-[#8AAFC9] md:text-lg">{dataExtenso()}</p>
          </div>

          {/* Mural + espaço reservado para blocos futuros */}
          <div className="lg:col-span-3">
            <MuralNoticias />
          </div>
          <div className="lg:col-span-2" aria-hidden />
        </div>
      </div>
    </div>
  );
}
