import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapaDia } from "@/components/reserva-posicoes/MapaDia";
import { MinhasReservas } from "@/components/reserva-posicoes/MinhasReservas";

export const Route = createFileRoute("/_authenticated/reserva-posicoes")({
  head: () => ({
    meta: [
      { title: "Reserva de Posições | Hub Lavoro Seguros" },
      {
        name: "description",
        content:
          "Reserve sua posição no escritório da Lavoro Seguros: mapa do dia, horários e histórico das suas reservas.",
      },
      { property: "og:title", content: "Reserva de Posições | Hub Lavoro Seguros" },
      {
        property: "og:description",
        content: "Mapa do escritório, reserva por horário e acompanhamento das suas reservas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReservaPosicoesPage,
});

function ReservaPosicoesPage() {
  return (
    <div
      className="min-h-screen px-6 pb-10 pt-6 md:px-8 md:pt-8 lg:px-10 lg:pt-10"
      style={{ background: "#14405C" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <CalendarClock className="h-8 w-8 text-[#00BAF2]" />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Reserva de Posições
            </h1>
            <p className="mt-1 text-white/70">
              Escolha sua posição no escritório e acompanhe suas reservas.
            </p>
          </div>
        </div>

        <Tabs defaultValue="mapa">
          <TabsList className="mb-4">
            <TabsTrigger value="mapa">Mapa do dia</TabsTrigger>
            <TabsTrigger value="minhas">Minhas reservas</TabsTrigger>
          </TabsList>
          <TabsContent value="mapa">
            <MapaDia />
          </TabsContent>
          <TabsContent value="minhas">
            <MinhasReservas />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
