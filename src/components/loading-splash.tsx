import logoBranca from "@/assets/logo-branca.png.asset.json";
import fundo1 from "@/assets/fundo-1.png.asset.json";

export function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#14405C] bg-cover bg-center"
      style={{ backgroundImage: `url(${fundo1.url})` }}
    >
      <div className="absolute inset-0 bg-[#14405C]/40" />
      <div className="relative flex flex-col items-center gap-8">
        <img
          src={logoBranca.url}
          alt="Lavoro Seguros"
          className="w-64 max-w-[70vw] animate-pulse"
        />
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );
}
