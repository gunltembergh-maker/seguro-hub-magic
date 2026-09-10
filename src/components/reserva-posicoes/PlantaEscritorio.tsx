import { cn } from "@/lib/utils";
import { hhmm, primeiroNome, type RpPosicaoGrade } from "@/lib/rp/rp-tipos";

export type EstadoPosicao = "livre" | "parcial" | "minha" | "fixa" | "inativa";

export function estadoDaPosicao(pos: RpPosicaoGrade): EstadoPosicao {
  if (!pos.ativa) return "inativa";
  if (pos.fixa) return "fixa";
  const ativas = pos.reservas.filter((r) => r.status !== "cancelada");
  if (ativas.some((r) => r.minha)) return "minha";
  if (ativas.length > 0) return "parcial";
  return "livre";
}

/** Cor do indicador de estado (usada na planta e na legenda). */
const COR_ESTADO: Record<EstadoPosicao, string> = {
  livre: "#10B981",
  parcial: "#F59E0B",
  minha: "#00BAF2",
  fixa: "#94A3B8",
  inativa: "#CBD5E1",
};

interface MesaProps {
  pos: RpPosicaoGrade;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lado em que a cadeira é desenhada. */
  cadeira: "cima" | "baixo";
  onSelecionar: (pos: RpPosicaoGrade) => void;
}

function Mesa({ pos, x, y, w, h, cadeira, onSelecionar }: MesaProps) {
  const estado = estadoDaPosicao(pos);
  const clicavel = estado !== "fixa" && estado !== "inativa";
  const ativas = pos.reservas.filter((r) => r.status !== "cancelada");

  const linhasTooltip = [
    `Posição ${pos.numero}${pos.apelido ? ` · ${pos.apelido}` : ""}`,
    estado === "inativa" ? "Posição inativa" : null,
    estado === "fixa" ? `Fixa${pos.fixa_nome ? ` · ${primeiroNome(pos.fixa_nome)}` : ""}` : null,
    estado === "livre" ? "Livre o dia todo" : null,
    ...ativas.map(
      (r) => `${hhmm(r.hora_inicio)}–${hhmm(r.hora_fim)} · ${r.minha ? "Você" : primeiroNome(r.nome)}`,
    ),
  ].filter(Boolean) as string[];

  const cy = cadeira === "cima" ? y - 22 : y + h + 22;

  return (
    <g
      role="button"
      tabIndex={clicavel ? 0 : -1}
      aria-label={linhasTooltip.join(". ")}
      onClick={() => clicavel && onSelecionar(pos)}
      onKeyDown={(e) => {
        if (clicavel && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelecionar(pos);
        }
      }}
      className={cn(
        "origin-center transition-[transform,filter] duration-150",
        clicavel
          ? "cursor-pointer hover:-translate-y-[3px] hover:[filter:drop-shadow(0_8px_10px_rgba(0,0,0,0.35))] focus:outline-none focus-visible:[filter:drop-shadow(0_0_0_3px_#00BAF2)]"
          : "cursor-not-allowed opacity-80",
      )}
    >
      <title>{linhasTooltip.join("\n")}</title>

      {/* cadeira preta */}
      <g>
        <rect
          x={x + w / 2 - 26}
          y={cy - 15}
          width={52}
          height={30}
          rx={12}
          className="fill-neutral-900 dark:fill-neutral-950"
        />
        <rect
          x={x + w / 2 - 18}
          y={cadeira === "cima" ? cy - 24 : cy + 10}
          width={36}
          height={12}
          rx={6}
          className="fill-neutral-800 dark:fill-neutral-900"
        />
      </g>

      {/* sombra do tampo */}
      <rect x={x + 3} y={y + 5} width={w} height={h} rx={10} className="fill-black/25" />

      {/* tampo amadeirado */}
      <rect x={x} y={y} width={w} height={h} rx={10} fill="url(#madeira)" stroke="#3A2415" strokeWidth={2} />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} rx={7} fill="url(#madeiraTopo)" opacity={0.35} />

      {/* acessórios discretos sobre o tampo */}
      <rect
        x={x + w / 2 - 23}
        y={y + h - 35}
        width={46}
        height={18}
        rx={6}
        fill="#17191C"
        opacity={0.72}
      />
      <circle cx={x + w - 42} cy={y + h / 2 + 5} r={5} fill="#24201D" opacity={0.8} />

      {/* faixa de estado */}
      <rect x={x} y={y + h - 10} width={w} height={10} rx={4} fill={COR_ESTADO[estado]} opacity={0.95} />

      {/* número */}
      <text
        x={x + 16}
        y={y + h / 2 + 2}
        className="font-display"
        fontSize={30}
        fontWeight={800}
        fill="#FFF6E9"
        style={{ paintOrder: "stroke", stroke: "#3A2415", strokeWidth: 4 }}
      >
        {pos.numero}
      </text>

      {pos.apelido && (
        <text x={x + 16} y={y + h / 2 + 24} fontSize={12} fill="#FFF1DC" opacity={0.95}>
          {pos.apelido.length > 18 ? `${pos.apelido.slice(0, 17)}…` : pos.apelido}
        </text>
      )}

      {/* marcador de estado / cadeado */}
      <circle cx={x + w - 20} cy={y + 20} r={9} fill={COR_ESTADO[estado]} stroke="#3A2415" strokeWidth={1.5} />
      {estado === "fixa" && (
        <g transform={`translate(${x + w - 25}, ${y + 15})`} fill="none" stroke="#1F2937" strokeWidth={1.6}>
          <rect x={1.5} y={4} width={7} height={5.5} rx={1.2} />
          <path d="M3.2 4V2.9a1.8 1.8 0 0 1 3.6 0V4" />
        </g>
      )}
    </g>
  );
}

export function PlantaEscritorio({
  posicoes,
  onSelecionar,
}: {
  posicoes: RpPosicaoGrade[];
  onSelecionar: (pos: RpPosicaoGrade) => void;
}) {
  const fundo = posicoes.filter((p) => p.bloco === "fundo").sort((a, b) => a.numero - b.numero);
  const frente = posicoes.filter((p) => p.bloco !== "fundo").sort((a, b) => a.numero - b.numero);

  const W = 900;
  const H = 800;

  // Bancada do fundo: 3 mesas contínuas encostadas na janela.
  const bancadaX = 190;
  const bancadaW = 600;
  const mesaFundoW = bancadaW / 3;

  // Bloco da frente: três fileiras de 2, todas voltadas para a janela.
  const frenteX = 270;
  const mesaW = 190;
  const gapX = 54;
  const linhaY = [322, 488, 654];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Planta do escritório">
          <defs>
            <linearGradient id="madeira" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C08A4B" />
              <stop offset="55%" stopColor="#A9723A" />
              <stop offset="100%" stopColor="#8B5A28" />
            </linearGradient>
            <linearGradient id="madeiraTopo" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E4B67C" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#E4B67C" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#E4B67C" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="janela" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#BFE6FA" />
              <stop offset="100%" stopColor="#7FB6D9" />
            </linearGradient>
            <linearGradient id="vidroVaranda" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#78AFCF" stopOpacity={0.75} />
              <stop offset="100%" stopColor="#BFE6FA" stopOpacity={0.4} />
            </linearGradient>
            <pattern id="placasCarpete" width="52" height="52" patternUnits="userSpaceOnUse">
              <path d="M52 0H0V52" fill="none" stroke="#AAB2BB" strokeWidth={1} opacity={0.08} />
              <path d="M0 26H52M26 0V52" fill="none" stroke="#111418" strokeWidth={0.6} opacity={0.08} />
            </pattern>
          </defs>

          {/* carpete grafite */}
          <rect x={0} y={0} width={W} height={H} rx={18} className="fill-[#2A2E33] dark:fill-[#1B1E22]" />
          <rect
            x={10}
            y={10}
            width={W - 20}
            height={H - 20}
            rx={14}
            className="fill-[#33383E] dark:fill-[#23272C]"
          />
          <rect x={10} y={10} width={W - 20} height={H - 20} rx={14} fill="url(#placasCarpete)" />

          {/* janela panorâmica */}
          <rect x={26} y={18} width={W - 108} height={22} rx={8} fill="url(#janela)" opacity={0.9} />
          {Array.from({ length: 11 }).map((_, i) => (
            <line
              key={i}
              x1={26 + ((W - 108) / 11) * (i + 1)}
              y1={18}
              x2={26 + ((W - 108) / 11) * (i + 1)}
              y2={40}
              stroke="#33383E"
              strokeWidth={2}
              opacity={0.5}
            />
          ))}
          <text x={410} y={62} textAnchor="middle" fontSize={13} letterSpacing={3} fill="#9FC7DE">
            JANELA · VISTA DA CIDADE
          </text>

          {/* parede de vidro preto (painel/TV) */}
          <rect x={26} y={120} width={26} height={536} rx={8} className="fill-[#111418]" />
          <rect x={31} y={190} width={16} height={230} rx={5} className="fill-[#30343A] dark:fill-[#090B0E]" />
          <text
            x={39}
            y={520}
            textAnchor="middle"
            fontSize={11}
            fill="#7C8794"
            transform="rotate(-90 39 520)"
          >
            PAINEL DE VIDRO
          </text>

          {/* trecho de parede com quadros, antes do vidro lateral */}
          <rect x={806} y={76} width={28} height={178} rx={7} fill="#DDD1BB" opacity={0.9} />
          {[112, 174].map((y) => (
            <g key={y}>
              <rect x={810} y={y} width={20} height={42} rx={2} fill="#151719" />
              <rect x={813} y={y + 3} width={14} height={36} rx={1} fill="#B8B09F" />
              <path
                d={`M820 ${y + 33}c-7-8-5-17 0-20 6 4 7 12 0 20Zm0-11c5-7 9-6 10-3-1 5-4 8-10 10Z`}
                fill="#34483D"
                opacity={0.9}
              />
            </g>
          ))}

          {/* vidro lateral e varanda */}
          <rect x={818} y={270} width={16} height={458} rx={7} fill="url(#vidroVaranda)" />
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={i}
              x1={818}
              y1={270 + (458 / 6) * (i + 1)}
              x2={834}
              y2={270 + (458 / 6) * (i + 1)}
              stroke="#D9EFF9"
              strokeWidth={1.5}
              opacity={0.6}
            />
          ))}
          <rect x={840} y={270} width={38} height={458} rx={12} fill="#A8BAC0" opacity={0.16} />
          <text
            x={863}
            y={500}
            textAnchor="middle"
            fontSize={11}
            letterSpacing={3}
            fill="#A8CEDD"
            transform="rotate(90 863 500)"
          >
            VARANDA
          </text>
          {[326, 500, 672].map((y, i) => (
            <g key={y}>
              <path d={`M847 ${y + 14}h24l-4 21h-16Z`} fill="#776756" />
              <circle cx={859} cy={y + 8} r={i === 1 ? 14 : 12} fill="#266044" />
              <circle cx={851} cy={y + 2} r={7} fill="#3E835A" />
              <circle cx={867} cy={y} r={8} fill="#4B9265" />
            </g>
          ))}

          {/* bancada contínua do fundo */}
          <rect
            x={bancadaX - 10}
            y={82}
            width={bancadaW + 20}
            height={106}
            rx={12}
            className="fill-black/25"
          />
          {fundo.map((p, i) => (
            <Mesa
              key={p.id}
              pos={p}
              x={bancadaX + i * mesaFundoW + 6}
              y={88}
              w={mesaFundoW - 12}
              h={94}
              cadeira="baixo"
              onSelecionar={onSelecionar}
            />
          ))}
          <text x={bancadaX - 10} y={76} fontSize={12} letterSpacing={2} fill="#9AA5B1">
            BLOCO FUNDO
          </text>

          {/* plantas decorativas */}
          <circle cx={142} cy={260} r={16} className="fill-emerald-700" />
          <circle cx={142} cy={260} r={9} className="fill-emerald-500" opacity={0.8} />
          <circle cx={492} cy={304} r={12} className="fill-emerald-700" />
          <circle cx={492} cy={304} r={7} className="fill-emerald-500" opacity={0.8} />
          <circle cx={492} cy={470} r={11} className="fill-emerald-700" />
          <circle cx={492} cy={636} r={12} className="fill-emerald-700" />
          <circle cx={742} cy={610} r={14} className="fill-emerald-700" />
          <circle cx={742} cy={610} r={8} className="fill-emerald-500" opacity={0.8} />

          {/* bloco da frente */}
          <text x={frenteX - 20} y={300} fontSize={12} letterSpacing={2} fill="#9AA5B1">
            BLOCO FRENTE
          </text>
          {frente.map((p, i) => {
            const linha = Math.floor(i / 2);
            const col = i % 2;
            return (
              <Mesa
                key={p.id}
                pos={p}
                x={frenteX + col * (mesaW + gapX)}
                y={linhaY[linha] ?? 488}
                w={mesaW}
                h={82}
                cadeira="baixo"
                onSelecionar={onSelecionar}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function LegendaPlanta() {
  const itens: { estado: EstadoPosicao; label: string }[] = [
    { estado: "livre", label: "Livre agora" },
    { estado: "parcial", label: "Parcialmente reservada" },
    { estado: "minha", label: "Tenho reserva" },
    { estado: "fixa", label: "Fixa" },
    { estado: "inativa", label: "Inativa" },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
      {itens.map((i) => (
        <span key={i.estado} className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-full" style={{ background: COR_ESTADO[i.estado] }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
