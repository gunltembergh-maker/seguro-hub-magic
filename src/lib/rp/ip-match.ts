/**
 * Utilitários de comparação de IP para o check-in da Reserva de Posições.
 * Aceita IPv4 exato, IPv6 exato e CIDR (IPv4 ou IPv6).
 * Sem dependências externas.
 */

/** Remove prefixo IPv4 mapeado, colchetes de IPv6 e porta anexada. */
export function normalizarIp(bruto: string): string {
  let ip = bruto.trim();
  if (!ip) return "";
  const m = ip.match(/^\[(.+)\](?::\d+)?$/);
  if (m?.[1]) ip = m[1];
  if ((ip.match(/:/g)?.length ?? 0) === 1 && ip.includes(".")) ip = ip.split(":")[0] ?? ip;
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped?.[1]) ip = mapped[1];
  return ip.trim().toLowerCase();
}

/** Normaliza item de lista (IP ou CIDR), preservando o sufixo /N. */
export function normalizarEntradaIp(bruto: string): string {
  const t = bruto.trim();
  if (!t) return "";
  const barra = t.indexOf("/");
  if (barra === -1) return normalizarIp(t);
  const base = normalizarIp(t.slice(0, barra));
  const bits = t.slice(barra + 1).trim();
  return base ? `${base}/${bits}` : "";
}

function ehIPv4(ip: string): boolean {
  const p = ip.split(".");
  if (p.length !== 4) return false;
  return p.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

/** IPv4 -> inteiro sem sinal (via >>> 0). */
function ipv4ParaBytes(ip: string): number[] | null {
  if (!ehIPv4(ip)) return null;
  return ip.split(".").map((o) => Number(o));
}

/** Expande IPv6 (inclusive com "::" e cauda IPv4) para 16 bytes. */
function ipv6ParaBytes(ip: string): number[] | null {
  if (!ip.includes(":")) return null;
  let texto = ip;

  // Cauda IPv4 embutida: ::ffff:1.2.3.4 ou 64:ff9b::1.2.3.4
  const ult = texto.split(":").pop() ?? "";
  if (ult.includes(".")) {
    const v4 = ipv4ParaBytes(ult);
    if (!v4) return null;
    const hexa =
      ((v4[0]! << 8) | v4[1]!).toString(16) + ":" + ((v4[2]! << 8) | v4[3]!).toString(16);
    texto = texto.slice(0, texto.length - ult.length) + hexa;
  }

  const partes = texto.split("::");
  if (partes.length > 2) return null;

  const parse = (s: string): number[] | null => {
    if (!s) return [];
    const grupos = s.split(":");
    const bytes: number[] = [];
    for (const g of grupos) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      const n = parseInt(g, 16);
      bytes.push((n >> 8) & 0xff, n & 0xff);
    }
    return bytes;
  };

  const esquerda = parse(partes[0] ?? "");
  if (!esquerda) return null;

  if (partes.length === 1) return esquerda.length === 16 ? esquerda : null;

  const direita = parse(partes[1] ?? "");
  if (!direita) return null;
  const faltando = 16 - esquerda.length - direita.length;
  if (faltando < 0) return null;
  return [...esquerda, ...new Array(faltando).fill(0), ...direita];
}

/** Converte um IP (v4 ou v6) em bytes; retorna null se inválido. */
export function ipParaBytes(ip: string): number[] | null {
  const limpo = normalizarIp(ip);
  if (!limpo) return null;
  return limpo.includes(":") ? ipv6ParaBytes(limpo) : ipv4ParaBytes(limpo);
}

/** true se o IP estiver dentro do CIDR (mesma família e N bits iguais). */
export function ipDentroDoCidr(ip: string, cidr: string): boolean {
  const [redeTxt, bitsTxt] = cidr.split("/");
  if (!redeTxt || bitsTxt === undefined) return false;
  const bits = Number(bitsTxt);
  if (!Number.isInteger(bits) || bits < 0) return false;

  const alvo = ipParaBytes(ip);
  const rede = ipParaBytes(redeTxt);
  if (!alvo || !rede || alvo.length !== rede.length) return false;
  if (bits > alvo.length * 8) return false;

  const bytesInteiros = Math.floor(bits / 8);
  for (let i = 0; i < bytesInteiros; i++) {
    if (alvo[i] !== rede[i]) return false;
  }
  const resto = bits % 8;
  if (resto) {
    const mascara = (0xff << (8 - resto)) & 0xff;
    if ((alvo[bytesInteiros]! & mascara) !== (rede[bytesInteiros]! & mascara)) return false;
  }
  return true;
}

/** Valida um item da lista: IPv4/IPv6 exato ou CIDR. */
export function entradaIpValida(entrada: string): boolean {
  const v = normalizarEntradaIp(entrada);
  if (!v) return false;
  if (v.includes("/")) {
    const [base, bitsTxt] = v.split("/");
    const bytes = base ? ipParaBytes(base) : null;
    const bits = Number(bitsTxt);
    return !!bytes && Number.isInteger(bits) && bits >= 0 && bits <= bytes.length * 8;
  }
  return !!ipParaBytes(v);
}

/** true se o IP casa com algum item da lista (exato ou faixa CIDR). */
export function ipAutorizado(ip: string, lista: string[]): boolean {
  const alvo = normalizarIp(ip);
  if (!alvo) return false;
  return lista.some((itemBruto) => {
    const item = normalizarEntradaIp(itemBruto);
    if (!item) return false;
    if (item.includes("/")) return ipDentroDoCidr(alvo, item);
    return item === alvo;
  });
}
