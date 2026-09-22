// Painel da Gerência — Garantia (Parte 5).
//
// Tela inteira sob `menu_garantia_painel`: gargalos e tempo até finalizar a
// demanda são informação de gestão. O corte real está nas RPCs
// `rpc_garantia_painel_*`, que devolvem vazio sem a permissão — a tela só
// acompanha.

import { useMemo, useState } from "react";
import { GarantiaShell } from "@/components/garantia/garantia-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bloco,
  BarrasNumero,
  BarrasValor,
  Cartao,
  COR_GRUPO,
  COR_QUANTIDADE,
  COR_RELOGIO,
  COR_VALOR,
} from "@/components/garantia/painel-blocos";
import {
  FILTROS_VAZIOS,
  useCarteiraPainel,
  useConversao,
  useEmJogo,
  usePerdas,
  useResultado,
  useSeguradorasPainel,
  useVelocidade,
  type FiltrosPainel,
  type LinhaAgrupada,
} from "@/hooks/use-garantia-painel";
import { useCanais, useResponsaveis } from "@/hooks/use-entrada-demandas";
import { rotuloMotivoPerda } from "@/hooks/use-garantia-negociacao";
import {
  MODALIDADES,
  moeda,
  rotuloEtapa,
  rotuloModalidade,
  ROTULO_PRODUTO,
} from "@/lib/garantia/formato";

const TODOS = "__todos__";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function menosDias(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
function inicioDoMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const horas = (v: number | null) =>
  v == null ? "—" : v < 48 ? `${v.toFixed(1)} h` : `${(v / 24).toFixed(1)} dias`;

function subconjunto(linhas: LinhaAgrupada[] | undefined, agrupamento: string) {
  return (linhas ?? []).filter((l) => l.agrupamento === agrupamento);
}

export default function Painel() {
  const [filtros, setFiltros] = useState<FiltrosPainel>({
    ...FILTROS_VAZIOS,
    de: menosDias(90),
    ate: hoje(),
  });
  const trocar = (parcial: Partial<FiltrosPainel>) =>
    setFiltros((f) => ({ ...f, ...parcial }));

  const canais = useCanais();
  const pessoas = useResponsaveis();

  const emJogo = useEmJogo(filtros);
  const perdas = usePerdas(filtros);
  const resultado = useResultado(filtros);
  const velocidade = useVelocidade(filtros);
  const conversao = useConversao(filtros);
  const carteira = useCarteiraPainel(filtros);
  const seguradoras = useSeguradorasPainel(filtros);

  const carregando =
    emJogo.isLoading || perdas.isLoading || resultado.isLoading || velocidade.isLoading;

  // ---- Em jogo -----------------------------------------------------
  const emJogoEtapa = useMemo(
    () =>
      subconjunto(emJogo.data, "etapa")
        .map((l) => ({ ...l, rotulo: rotuloEtapa(l.chave) }))
        .sort((a, b) => a.chave.localeCompare(b.chave)),
    [emJogo.data],
  );
  const emJogoStatus = useMemo(
    () => subconjunto(emJogo.data, "status").sort((a, b) => b.premio - a.premio),
    [emJogo.data],
  );
  const totalEmJogo = emJogoEtapa.reduce((s, l) => s + Number(l.premio), 0);
  const totalComissao = emJogoEtapa.reduce((s, l) => s + Number(l.comissao), 0);

  // ---- Deixado na mesa --------------------------------------------
  const perdaPor = (grupo: string, rotular?: (c: string) => string) =>
    subconjunto(perdas.data, grupo)
      .map((l) => ({ ...l, rotulo: rotular ? rotular(l.chave) : l.rotulo }))
      .sort((a, b) => Number(b.premio) - Number(a.premio));

  const perdaMotivo = perdaPor("motivo", rotuloMotivoPerda);
  const perdaResponsavel = perdaPor("responsavel");
  const perdaSeguradora = perdaPor("seguradora");
  const perdaModalidade = perdaPor("modalidade", (c) => rotuloModalidade(c));
  const perdaEtapa = perdaPor("etapa", (c) => (c === "sem_etapa" ? "Sem etapa" : rotuloEtapa(c)));
  const devolucao = subconjunto(perdas.data, "devolucao")[0];
  const totalPerdido = perdaMotivo.reduce((s, l) => s + Number(l.premio), 0);

  // ---- Resultado ---------------------------------------------------
  const linhasResultado = (resultado.data ?? []).map((l) => ({
    ...l,
    mesRotulo: new Date(`${l.mes.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    }),
  }));
  const premioEmitido = linhasResultado.reduce((s, l) => s + Number(l.premio_emitido), 0);
  const comissaoRecebida = linhasResultado.reduce((s, l) => s + Number(l.comissao_recebida), 0);

  // ---- Velocidade --------------------------------------------------
  // Interno × externo lado a lado, uma barra por relógio — um eixo só (horas).
  const velocidadePor = (grupo: string, rotular?: (c: string) => string) => {
    const linhas = (velocidade.data ?? []).filter((l) => l.agrupamento === grupo);
    const mapa = new Map<string, { rotulo: string; interno: number | null; externo: number | null; amostras: number }>();
    for (const l of linhas) {
      const atual = mapa.get(l.chave) ?? {
        rotulo: rotular ? rotular(l.chave) : l.rotulo,
        interno: null,
        externo: null,
        amostras: 0,
      };
      if (l.relogio === "externo") atual.externo = l.horas_media == null ? null : Number(l.horas_media);
      else atual.interno = l.horas_media == null ? null : Number(l.horas_media);
      atual.amostras += Number(l.amostras);
      mapa.set(l.chave, atual);
    }
    return [...mapa.values()].sort(
      (a, b) => (b.interno ?? 0) + (b.externo ?? 0) - ((a.interno ?? 0) + (a.externo ?? 0)),
    );
  };
  const velEtapa = velocidadePor("etapa", (c) => (c === "sem_etapa" ? "Sem etapa" : rotuloEtapa(c)));
  const velStatus = velocidadePor("status");
  const velResponsavel = velocidadePor("responsavel");
  const marcos = (velocidade.data ?? []).filter((l) => l.agrupamento === "marco");
  const marco = (chave: string) => marcos.find((m) => m.chave === chave);

  // ---- Conversão ---------------------------------------------------
  const conversaoPor = (grupo: string, rotular?: (c: string) => string) =>
    (conversao.data ?? [])
      .filter((l) => l.agrupamento === grupo && l.ganhos + l.perdidos > 0)
      .map((l) => ({ ...l, rotulo: rotular ? rotular(l.chave) : l.rotulo, pct: Number(l.pct_ganho ?? 0) }))
      .sort((a, b) => b.pct - a.pct);
  const convModalidade = conversaoPor("modalidade", (c) => rotuloModalidade(c));
  const convCanal = conversaoPor("canal");
  const convResponsavel = conversaoPor("responsavel");

  // ---- Carteira ----------------------------------------------------
  const limitePorCliente = (carteira.data ?? [])
    .filter((l) => l.agrupamento === "limite_cliente")
    .map((l) => ({ ...l, valor: Number(l.valor) }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 20);
  const renovacoes = (carteira.data ?? [])
    .filter((l) => l.agrupamento === "renovacao_120")
    .map((l) => ({ ...l, quantidade: Number(l.quantidade), valor: Number(l.valor) }))
    .sort((a, b) => a.chave.localeCompare(b.chave));

  // ---- Seguradoras -------------------------------------------------
  const linhasSeguradoras = (seguradoras.data ?? []).map((l) => ({
    ...l,
    com_limite: Number(l.com_limite),
    sem_limite: Number(l.sem_limite),
    nao_consultado: Number(l.nao_consultado),
  }));

  return (
    <GarantiaShell titulo="Painel da Gerência" trilha={["Painel"]}>
      {/* Filtros — valem para todos os blocos. */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="painel-de">De</label>
            <Input
              id="painel-de"
              type="date"
              className="h-9 w-[150px]"
              value={filtros.de ?? ""}
              onChange={(e) => trocar({ de: e.target.value || null })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="painel-ate">Até</label>
            <Input
              id="painel-ate"
              type="date"
              className="h-9 w-[150px]"
              value={filtros.ate ?? ""}
              onChange={(e) => trocar({ ate: e.target.value || null })}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => trocar({ de: inicioDoMes(), ate: hoje() })}>
              Mês atual
            </Button>
            <Button variant="outline" size="sm" onClick={() => trocar({ de: menosDias(90), ate: hoje() })}>
              Últimos 90 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => trocar({ de: `${new Date().getFullYear()}-01-01`, ate: hoje() })}
            >
              Ano
            </Button>
          </div>

          <Seletor
            rotulo="Produto"
            valor={filtros.produto}
            onChange={(v) => trocar({ produto: v })}
            opcoes={Object.entries(ROTULO_PRODUTO).map(([valor, rotulo]) => ({ valor, rotulo }))}
          />
          <Seletor
            rotulo="Modalidade"
            valor={filtros.modalidade}
            onChange={(v) => trocar({ modalidade: v })}
            opcoes={MODALIDADES}
          />
          <Seletor
            rotulo="Canal"
            valor={filtros.canal}
            onChange={(v) => trocar({ canal: v })}
            opcoes={(canais.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          />
          <Seletor
            rotulo="Responsável"
            valor={filtros.responsavel}
            onChange={(v) => trocar({ responsavel: v })}
            opcoes={(pessoas.data ?? []).map((p) => ({ valor: p.user_id, rotulo: p.nome }))}
          />
        </div>
      </div>

      {carregando ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao rotulo="Prêmio parado no funil" valor={moeda(totalEmJogo)} nota="Demandas em negociação e no CRM" />
            <Cartao rotulo="Comissão em jogo" valor={moeda(totalComissao)} />
            <Cartao rotulo="Prêmio deixado na mesa" valor={moeda(totalPerdido)} nota="Demandas perdidas no período" />
            <Cartao rotulo="Prêmio emitido" valor={moeda(premioEmitido)} nota={`Comissão recebida: ${moeda(comissaoRecebida)}`} />
          </div>

          {/* ---------------- Em jogo ---------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco
              titulo="Quanto está parado em cada etapa"
              descricao="Prêmio estimado das demandas ainda em aberto."
              dados={emJogoEtapa}
              colunas={[
                { chave: "rotulo", titulo: "Etapa", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Demandas", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio)), alinharDireita: true },
                { chave: "comissao", titulo: "Comissão", valor: (l) => moeda(Number(l.comissao)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={emJogoEtapa.map((l) => ({ rotulo: l.rotulo, premio: Number(l.premio), comissao: Number(l.comissao) }))}
                  chaveX="rotulo"
                  series={[
                    { chave: "premio", nome: "Prêmio estimado", cor: COR_VALOR },
                    { chave: "comissao", nome: "Comissão estimada", cor: COR_GRUPO.com_limite },
                  ]}
                />
              }
            />
            <Bloco
              titulo="Onde as demandas estão paradas"
              descricao="Quantidade de demandas por status atual."
              dados={emJogoStatus}
              colunas={[
                { chave: "rotulo", titulo: "Status", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Demandas", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio)), alinharDireita: true },
              ]}
              grafico={
                <BarrasNumero
                  dados={emJogoStatus.map((l) => ({ rotulo: l.rotulo, quantidade: Number(l.quantidade) }))}
                  chaveX="rotulo"
                  series={[{ chave: "quantidade", nome: "Demandas", cor: COR_QUANTIDADE }]}
                />
              }
            />
          </div>

          {/* ---------------- Deixado na mesa ---------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco
              titulo="Por que perdemos"
              descricao="Prêmio das demandas perdidas, por motivo."
              nota={
                devolucao
                  ? `Além disso, ${moeda(Number(devolucao.premio))} em prêmio devolvido em cancelamentos e substituições.`
                  : undefined
              }
              dados={perdaMotivo}
              colunas={[
                { chave: "rotulo", titulo: "Motivo", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Casos", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={perdaMotivo.map((l) => ({ rotulo: l.rotulo, premio: Number(l.premio) }))}
                  chaveX="rotulo"
                  series={[{ chave: "premio", nome: "Prêmio perdido", cor: COR_GRUPO.sem_limite }]}
                />
              }
            />
            <Bloco
              titulo="Perdas por etapa"
              descricao="Em que ponto do fluxo o caso caiu."
              dados={perdaEtapa}
              colunas={[
                { chave: "rotulo", titulo: "Etapa", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Casos", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={perdaEtapa.map((l) => ({ rotulo: l.rotulo, premio: Number(l.premio) }))}
                  chaveX="rotulo"
                  series={[{ chave: "premio", nome: "Prêmio perdido", cor: COR_GRUPO.sem_limite }]}
                />
              }
            />
            <Bloco
              titulo="Perdas por responsável"
              dados={perdaResponsavel}
              colunas={[
                { chave: "rotulo", titulo: "Responsável", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Casos", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={perdaResponsavel.map((l) => ({ rotulo: l.rotulo, premio: Number(l.premio) }))}
                  chaveX="rotulo"
                  series={[{ chave: "premio", nome: "Prêmio perdido", cor: COR_GRUPO.sem_limite }]}
                />
              }
            />
            <Bloco
              titulo="Perdas por seguradora e modalidade"
              descricao="Seguradora da cotação escolhida no caso perdido."
              dados={[...perdaSeguradora, ...perdaModalidade]}
              colunas={[
                { chave: "grupo", titulo: "Recorte", valor: (l) => (l.agrupamento === "seguradora" ? "Seguradora" : "Modalidade") },
                { chave: "rotulo", titulo: "Item", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Casos", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={perdaSeguradora.map((l) => ({ rotulo: l.rotulo, premio: Number(l.premio) }))}
                  chaveX="rotulo"
                  series={[{ chave: "premio", nome: "Prêmio perdido por seguradora", cor: COR_GRUPO.sem_limite }]}
                />
              }
            />
          </div>

          {/* ---------------- Virou resultado ---------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco
              titulo="O que virou apólice"
              descricao="Prêmio emitido por mês."
              dados={linhasResultado}
              colunas={[
                { chave: "mes", titulo: "Mês", valor: (l) => l.mesRotulo },
                { chave: "apolices", titulo: "Apólices", valor: (l) => String(l.apolices), alinharDireita: true },
                { chave: "premio", titulo: "Prêmio", valor: (l) => moeda(Number(l.premio_emitido)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={linhasResultado.map((l) => ({ rotulo: l.mesRotulo, premio: Number(l.premio_emitido) }))}
                  chaveX="rotulo"
                  series={[{ chave: "premio", nome: "Prêmio emitido", cor: COR_VALOR }]}
                />
              }
            />
            <Bloco
              titulo="Comissão prevista × recebida"
              descricao="O quanto já entrou do que foi previsto."
              dados={linhasResultado}
              colunas={[
                { chave: "mes", titulo: "Mês", valor: (l) => l.mesRotulo },
                { chave: "prev", titulo: "Prevista", valor: (l) => moeda(Number(l.comissao_prevista)), alinharDireita: true },
                { chave: "receb", titulo: "Recebida", valor: (l) => moeda(Number(l.comissao_recebida)), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={linhasResultado.map((l) => ({
                    rotulo: l.mesRotulo,
                    prevista: Number(l.comissao_prevista),
                    recebida: Number(l.comissao_recebida),
                  }))}
                  chaveX="rotulo"
                  series={[
                    { chave: "prevista", nome: "Comissão prevista", cor: COR_QUANTIDADE },
                    { chave: "recebida", nome: "Comissão recebida", cor: COR_GRUPO.com_limite },
                  ]}
                />
              }
            />
          </div>

          {/* ---------------- Velocidade ---------------- */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Cartao
              rotulo="Tempo até cadastrar"
              valor={horas(marco("tempo_cadastro")?.horas_media ?? null)}
              nota={`${marco("tempo_cadastro")?.amostras ?? 0} demandas`}
            />
            <Cartao
              rotulo="Da chegada até a emissão"
              valor={horas(marco("chegada_emissao")?.horas_media ?? null)}
              nota={`${marco("chegada_emissao")?.amostras ?? 0} apólices`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {[
              { titulo: "Quanto tempo cada etapa consome", dados: velEtapa, coluna: "Etapa" },
              { titulo: "Quanto tempo cada status consome", dados: velStatus, coluna: "Status" },
              { titulo: "Tempo médio por responsável", dados: velResponsavel, coluna: "Responsável" },
            ].map((b) => (
              <Bloco
                key={b.titulo}
                titulo={b.titulo}
                descricao="Média em horas, separando o que depende de nós (interno) do que depende de fora (externo)."
                nota="Os status do financeiro não contam tempo: o relógio da demanda termina quando a apólice é enviada ao financeiro."
                dados={b.dados}
                colunas={[
                  { chave: "rotulo", titulo: b.coluna, valor: (l) => l.rotulo },
                  { chave: "interno", titulo: "Interno", valor: (l) => horas(l.interno), alinharDireita: true },
                  { chave: "externo", titulo: "Externo", valor: (l) => horas(l.externo), alinharDireita: true },
                  { chave: "amostras", titulo: "Amostras", valor: (l) => String(l.amostras), alinharDireita: true },
                ]}
                grafico={
                  <BarrasNumero
                    dados={b.dados.map((l) => ({
                      rotulo: l.rotulo,
                      interno: l.interno ?? 0,
                      externo: l.externo ?? 0,
                    }))}
                    chaveX="rotulo"
                    sufixo=" h"
                    series={[
                      { chave: "interno", nome: "Interno", cor: COR_RELOGIO.interno },
                      { chave: "externo", nome: "Externo", cor: COR_RELOGIO.externo },
                    ]}
                  />
                }
              />
            ))}
          </div>

          {/* ---------------- Conversão ---------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            {[
              { titulo: "Quanto convertemos por modalidade", dados: convModalidade, coluna: "Modalidade" },
              { titulo: "Quanto convertemos por canal", dados: convCanal, coluna: "Canal" },
              { titulo: "Quanto convertemos por responsável", dados: convResponsavel, coluna: "Responsável" },
            ].map((b) => (
              <Bloco
                key={b.titulo}
                titulo={b.titulo}
                descricao="Ganho é a demanda que chegou ao CRM; perdido é a demanda encerrada como perdida."
                dados={b.dados}
                colunas={[
                  { chave: "rotulo", titulo: b.coluna, valor: (l) => l.rotulo },
                  { chave: "ganhos", titulo: "Ganhos", valor: (l) => String(l.ganhos), alinharDireita: true },
                  { chave: "perdidos", titulo: "Perdidos", valor: (l) => String(l.perdidos), alinharDireita: true },
                  { chave: "abertas", titulo: "Em aberto", valor: (l) => String(l.abertas), alinharDireita: true },
                  { chave: "pct", titulo: "% de ganho", valor: (l) => `${l.pct.toFixed(1)}%`, alinharDireita: true },
                ]}
                grafico={
                  <BarrasNumero
                    dados={b.dados.map((l) => ({ rotulo: l.rotulo, pct: l.pct }))}
                    chaveX="rotulo"
                    sufixo="%"
                    series={[{ chave: "pct", nome: "% de ganho", cor: COR_GRUPO.com_limite }]}
                  />
                }
              />
            ))}
          </div>

          {/* ---------------- Carteira ---------------- */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco
              titulo="Limite usado por cliente"
              descricao="Soma do limite ocupado nas consultas de mercado ainda válidas."
              dados={limitePorCliente}
              colunas={[
                { chave: "rotulo", titulo: "Cliente", valor: (l) => l.rotulo },
                { chave: "valor", titulo: "Limite usado", valor: (l) => moeda(l.valor), alinharDireita: true },
              ]}
              grafico={
                <BarrasValor
                  dados={limitePorCliente.map((l) => ({ rotulo: l.rotulo, valor: l.valor }))}
                  chaveX="rotulo"
                  series={[{ chave: "valor", nome: "Limite usado", cor: COR_VALOR }]}
                />
              }
            />
            <Bloco
              titulo="O que vence nos próximos 120 dias"
              descricao="Apólices vigentes por janela de vencimento."
              dados={renovacoes}
              colunas={[
                { chave: "rotulo", titulo: "Janela", valor: (l) => l.rotulo },
                { chave: "qtd", titulo: "Apólices", valor: (l) => String(l.quantidade), alinharDireita: true },
                { chave: "valor", titulo: "IS", valor: (l) => moeda(l.valor), alinharDireita: true },
              ]}
              grafico={
                <BarrasNumero
                  dados={renovacoes.map((l) => ({ rotulo: l.rotulo, quantidade: l.quantidade }))}
                  chaveX="rotulo"
                  series={[{ chave: "quantidade", nome: "Apólices a vencer", cor: COR_QUANTIDADE }]}
                />
              }
            />
          </div>

          {/* ---------------- Seguradoras ---------------- */}
          <Bloco
            titulo="Como cada seguradora respondeu"
            descricao="Consultas de limite do pipeline inteiro, agrupadas pelo rótulo da seguradora."
            nota={
              <span>
                <strong>Não consultado é falha técnica de consulta, não recusa comercial</strong> — e nunca é somado
                com “sem limite”. Trocar o rótulo de uma seguradora reinicia a série histórica dela.
              </span>
            }
            altura={320}
            dados={linhasSeguradoras}
            colunas={[
              { chave: "seg", titulo: "Seguradora", valor: (l) => l.seguradora },
              { chave: "com", titulo: "Com limite", valor: (l) => String(l.com_limite), alinharDireita: true },
              { chave: "sem", titulo: "Sem limite", valor: (l) => String(l.sem_limite), alinharDireita: true },
              { chave: "nao", titulo: "Não consultado", valor: (l) => String(l.nao_consultado), alinharDireita: true },
            ]}
            grafico={
              <BarrasNumero
                dados={linhasSeguradoras.map((l) => ({
                  rotulo: l.seguradora,
                  com_limite: l.com_limite,
                  sem_limite: l.sem_limite,
                  nao_consultado: l.nao_consultado,
                }))}
                chaveX="rotulo"
                empilhado
                series={[
                  { chave: "com_limite", nome: "Com limite", cor: COR_GRUPO.com_limite },
                  { chave: "sem_limite", nome: "Sem limite", cor: COR_GRUPO.sem_limite },
                  { chave: "nao_consultado", nome: "Não consultado", cor: COR_GRUPO.nao_consultado },
                ]}
              />
            }
          />
        </div>
      )}
    </GarantiaShell>
  );
}

function Seletor({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: string | null;
  opcoes: { valor: string; rotulo: string }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <Select value={valor ?? TODOS} onValueChange={(v) => onChange(v === TODOS ? null : v)}>
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
