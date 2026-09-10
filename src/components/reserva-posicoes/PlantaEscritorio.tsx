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
        <path
          d={`M${x + w / 2 - 31} ${cy + 4}h62M${x + w / 2} ${cy + 4}v27M${x + w / 2 - 18} ${cy + 31}h36`}
          fill="none"
          stroke="var(--color-office-frame)"
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.9}
        />
        <circle cx={x + w / 2 - 20} cy={cy + 32} r={4} fill="var(--color-office-frame)" />
        <circle cx={x + w / 2 + 20} cy={cy + 32} r={4} fill="var(--color-office-frame)" />
        <rect
          x={x + w / 2 - 30}
          y={cy - 17}
          width={60}
          height={34}
          rx={10}
          fill="var(--color-office-frame)"
        />
        <rect
          x={x + w / 2 - 22}
          y={cadeira === "cima" ? cy - 24 : cy + 10}
          width={44}
          height={14}
          rx={5}
          fill="var(--color-office-frame)"
        />
        <path d={`M${x + w / 2 - 35} ${cy - 3}h10M${x + w / 2 + 25} ${cy - 3}h10`} stroke="#66717A" strokeWidth={4} strokeLinecap="round" />
      </g>

      {/* sombra do tampo */}
      <rect x={x + 4} y={y + 6} width={w} height={h} rx={5} fill="var(--color-office-frame)" opacity={0.38} />

      {/* estrutura metálica */}
      <path
        d={`M${x + 10} ${y + h - 3}v18M${x + w - 10} ${y + h - 3}v18`}
        stroke="var(--color-office-frame)"
        strokeWidth={6}
      />

      {/* tampo amadeirado */}
      <rect x={x} y={y} width={w} height={h} rx={5} fill="url(#madeira)" stroke="var(--color-office-frame)" strokeWidth={2} />
      <rect x={x + 7} y={y + 7} width={w - 14} height={h - 14} rx={3} fill="url(#madeiraTopo)" opacity={0.3} />

      {/* acessórios discretos sobre o tampo */}
      <rect
        x={x + w / 2 - 23}
        y={y + h - 35}
        width={46}
        height={18}
        rx={6}
        fill="var(--color-office-frame)"
        opacity={0.72}
      />
      <circle cx={x + w - 42} cy={y + h / 2 + 5} r={5} fill="var(--color-office-frame)" opacity={0.8} />

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
  const H = 560;

  // Bancada do fundo: 3 mesas contínuas encostadas na janela.
  const bancadaX = 190;
  const bancadaW = 600;
  const mesaFundoW = bancadaW / 3;

  // Bloco da frente: uma fileira única de 3 colunas; cada coluna tem duas mesas frente a frente.
  const frenteX = 196;
  const mesaW = 188;
  const gapX = 12;
  const frenteYBase = 292;
  const mesaH = 86;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Planta do escritório">
          <defs>
            <linearGradient id="madeira" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-office-wood-light)" />
              <stop offset="55%" stopColor="var(--color-office-wood)" />
              <stop offset="100%" stopColor="#805329" />
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
          <rect x={0} y={0} width={W} height={H} rx={18} fill="var(--color-office-frame)" />
          <rect
            x={10}
            y={10}
            width={W - 20}
            height={H - 20}
            rx={14}
            fill="var(--color-office-carpet)"
          />
          <rect x={10} y={10} width={W - 20} height={H - 20} rx={14} fill="url(#placasCarpete)" />

          {/* vidro preto atrás da posição 1 */}
          <rect x={26} y={18} width={350} height={42} rx={8} fill="#111418" />
          <rect x={36} y={25} width={330} height={28} rx={5} fill="#252B31" opacity={0.9} />
          <text x={201} y={76} textAnchor="middle" fontSize={11} letterSpacing={2} fill="#7C8794">
            PAREDE DE VIDRO PRETO
          </text>

          {/* janela panorâmica somente atrás das posições 2 e 3 */}
          <rect x={386} y={18} width={406} height={42} rx={8} fill="url(#janela)" opacity={0.95} />
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={i}
              x1={386 + (406 / 6) * (i + 1)}
              y1={18}
              x2={386 + (406 / 6) * (i + 1)}
              y2={60}
              stroke="#33383E"
              strokeWidth={2}
              opacity={0.5}
            />
          ))}
          <text x={589} y={76} textAnchor="middle" fontSize={13} letterSpacing={3} fill="#9FC7DE">
            JANELA · VISTA DA CIDADE
          </text>
          {/* silhueta sutil de São Paulo além do vidro */}
          <g fill="#14405C" opacity={0.28}>
            <path d="M398 60V42h26v18M432 60V32h31v28M471 60V22h38v38M517 60V39h25v21M550 60V28h39v32M597 60V43h26v17M631 60V34h34v26M674 60V39h30v21M713 60V27h42v33" />
          </g>

          {/* parede de vidro preto (painel/TV) */}
          <rect x={26} y={120} width={26} height={400} rx={8} className="fill-[#111418]" />
          <rect x={31} y={170} width={16} height={200} rx={5} className="fill-[#30343A] dark:fill-[#090B0E]" />
          <text
            x={39}
            y={450}
            textAnchor="middle"
            fontSize={11}
            fill="#7C8794"
            transform="rotate(-90 39 450)"
          >
            PAINEL DE VIDRO
          </text>

          {/* janela lateral ao lado da posição 3, também com vista da cidade */}
          <rect x={804} y={82} width={30} height={154} rx={6} fill="url(#vidroVaranda)" />
          {[108, 146, 184].map((y) => (
            <line key={y} x1={804} y1={y} x2={834} y2={y} stroke="#D9EFF9" strokeWidth={1.5} opacity={0.7} />
          ))}
          <g fill="#14405C" opacity={0.28}>
            <path d="M808 225v-45h8v45m3 0v-68h10v68" />
          </g>
          <text x={821} y={159} textAnchor="middle" fontSize={9} letterSpacing={2} fill="#D9EFF9" transform="rotate(90 821 159)">
            VISTA DA CIDADE
          </text>

          {/* parede junto à posição 6 e metade da posição 9; o restante vira varanda */}
          <rect x={786} y={280} width={26} height={141} rx={5} fill="var(--color-office-wall)" opacity={0.98} />
          {[310, 370].map((y) => (
            <g key={y}>
              <rect x={791} y={y} width={20} height={42} rx={2} fill="#151719" />
              <rect x={794} y={y + 3} width={14} height={36} rx={1} fill="#B8B09F" />
              <path
                d={`M801 ${y + 33}c-7-8-5-17 0-20 6 4 7 12 0 20Zm0-11c5-7 9-6 10-3-1 5-4 8-10 10Z`}
                fill="#34483D"
                opacity={0.9}
              />
            </g>
          ))}

          {/* abertura envidraçada para a varanda a partir da metade da posição 9 */}
          <rect x={800} y={421} width={16} height={112} rx={7} fill="url(#vidroVaranda)" />
          {Array.from({ length: 3 }).map((_, i) => (
            <line
              key={i}
              x1={800}
              y1={421 + (112 / 3) * (i + 1)}
              x2={816}
              y2={421 + (112 / 3) * (i + 1)}
              stroke="#D9EFF9"
              strokeWidth={1.5}
              opacity={0.6}
            />
          ))}
          <rect x={822} y={421} width={38} height={112} rx={12} fill="#A8BAC0" opacity={0.16} />
          <text
            x={841}
            y={478}
            textAnchor="middle"
            fontSize={11}
            letterSpacing={3}
            fill="#A8CEDD"
            transform="rotate(90 841 478)"
          >
            VARANDA
          </text>
          {[432].map((y, i) => (
            <g key={y}>
              <path d={`M829 ${y + 14}h24l-4 21h-16Z`} fill="#776756" />
              <circle cx={841} cy={y + 8} r={i === 1 ? 14 : 12} fill="#266044" />
              <circle cx={833} cy={y + 2} r={7} fill="#3E835A" />
              <circle cx={849} cy={y} r={8} fill="#4B9265" />
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
          <text
            x={100}
            y={135}
            textAnchor="middle"
            fontSize={11}
            letterSpacing={2}
            fill="#9AA5B1"
            transform="rotate(-90 100 135)"
          >
            BLOCO FUNDO
          </text>


          {/* base contínua do bloco frontal */}
          <rect
            x={frenteX - 10}
            y={frenteYBase - 8}
            width={mesaW * 3 + gapX * 2 + 20}
            height={mesaH * 2 + 16}
            rx={14}
            className="fill-black/20"
          />

          {/* divisórias verticais finas entre colunas */}
          {[1, 2].map((col) => (
            <rect
              key={col}
              x={frenteX + col * (mesaW + gapX) - gapX / 2}
              y={frenteYBase - 8}
              width={gapX}
              height={mesaH * 2 + 16}
              rx={2}
              className="fill-black/30"
            />
          ))}

          {/* bloco da frente */}
          <text x={frenteX - 20} y={270} fontSize={12} letterSpacing={2} fill="#9AA5B1">
            BLOCO FRENTE
          </text>
          {frente.map((p, i) => {
            const col = i % 3;
            const ehInferior = i >= 3;
            return (
              <Mesa
                key={p.id}
                pos={p}
                x={frenteX + col * (mesaW + gapX)}
                y={frenteYBase + (ehInferior ? mesaH : 0)}
                w={mesaW}
                h={mesaH}
                cadeira={ehInferior ? "baixo" : "cima"}
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
