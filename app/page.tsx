import Link from "next/link";
import { PLANOS, economiaDoAnual } from "@/lib/planos";
import { brl } from "@/lib/format";
import { MARCA, TAGLINE } from "@/lib/marca";
import { temSessao } from "@/lib/supabase/servidor";
import { Logo } from "@/components/Marca";
import { IconeCadeado, IconeCheck } from "@/components/Icones";
import Valor from "@/components/Valor";

/** O que entra na conta = o que o produto é, dito em 5 linhas de nota. */
const NA_CONTA = [
  "filamento",
  "energia",
  "desgaste da impressora",
  "embalagem",
  "reserva pros erros",
];

/** Os dois pacotes dão exatamente isto — muda só quando você paga. Por isso a
    lista aparece UMA vez, embaixo dos dois, e não repetida dentro de cada um. */
const VEM_JUNTO = [
  "Produtos sem limite, com o preço certo na hora",
  "Notinha de cada venda, com o lucro de verdade",
  "Cofrinho somando tudo que você já ganhou",
  "Suas cores e a sua impressora na conta",
];

/**
 * A porta de entrada do site.
 *
 * Enquadramento: no desktop as coisas ficam LADO A LADO (título + notinha,
 * pacote + pacote). Uma versão anterior empilhou tudo numa coluna de 448px e
 * a página virou 5 telas de scroll com margens vazias enormes — cada bloco
 * uma ilha solta. Largura existe pra ser usada; no celular tudo empilha.
 *
 * O gostinho é o carimbo: ele promete lucro sem mostrar número. O número é a
 * isca — quem quiser o dele faz a conta da própria peça no teste.
 *
 * Abre pra todo mundo, logado ou não: é o endereço do site.
 */
export default async function Entrada() {
  const logado = await temSessao();

  return (
    <main className="mx-auto w-full max-w-5xl">
      {/* ---------- Barra do topo ---------- */}
      {/* Atravessa a tela toda: o layout prende tudo num max-w-6xl, então ela
          escapa com left-1/2 + w-screen. Uma barra que para no meio da tela
          lê como card solto flutuando, não como topo do site.
          (o -mt-4 come o padding de cima do layout pra ela colar no alto) */}
      <header className="relative left-1/2 -mt-4 w-screen -translate-x-1/2 border-b border-borda bg-painel/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-borda bg-painel2">
              <Logo size={28} />
            </span>
            <div className="min-w-0">
              <p className="display truncate text-lg font-bold uppercase tracking-wide text-tinta">
                {MARCA}
              </p>
              {/* some no celular em vez de truncar: "calculadora de impre…"
                  não informa nada e ainda parece defeito */}
              <p className="hidden truncate text-base font-bold text-mute sm:block">
                {TAGLINE}
              </p>
            </div>
          </div>
          {/* o "já tem conta?" mora aqui, não no rodapé: é no topo que quem
              já é cliente procura a porta */}
          <div className="flex shrink-0 items-center gap-3">
            {!logado && (
              <span className="hidden text-lg font-bold text-mute sm:block">
                Já tem conta?
              </span>
            )}
            <Link
              href={logado ? "/fabrica" : "/login"}
              className="btn-escuro flex h-12 shrink-0 items-center rounded-xl px-5 text-lg font-extrabold"
            >
              {logado ? "Minha fábrica" : "Entrar"}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Herói: texto de um lado, a notinha do outro ---------- */}
      <section className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <h1 className="display text-4xl font-bold leading-[1.05] text-tinta sm:text-6xl">
            Você imprime.
            <br />
            <span className="text-neon">Ela faz a conta.</span>
          </h1>
          <p className="mt-6 max-w-md text-xl font-bold text-mute sm:text-2xl">
            Quanto custa e por quanto vender o que sai da sua impressora 3D.
          </p>
          {/* lg:max-w-none junto com lg:w-auto: sem ele o max-w-xs continua
              valendo no desktop e o rótulo quebra em duas linhas */}
          <Link
            href="/login?modo=criar&plano=anual"
            className="btn-grande btn-neon mt-8 flex w-full max-w-xs items-center justify-center whitespace-nowrap text-xl lg:w-auto lg:max-w-none lg:px-9"
          >
            Criar a minha fábrica
          </Link>
          <p className="mt-4 text-lg font-bold text-mute">
            A partir de {brl(PLANOS.anual.porMes)} por mês.{" "}
            <Link href="#pacotes" className="text-ciano underline">
              Ver os pacotes
            </Link>
          </p>
        </div>

        {/* O gostinho: a notinha */}
        <div className="recibo mono mx-auto w-full max-w-sm">
          {/* Nome de exemplo, não a nossa marca: esta nota é a que a
              CRIANÇA vai imprimir, com a empresa dela em cima. É o mesmo
              exemplo que o /novo usa no placeholder. */}
          <p className="display text-center text-[1.3em] font-bold uppercase tracking-[0.18em]">
            ★ Dino Prints ★
          </p>
          <p className="text-center text-[0.8em] font-bold uppercase tracking-widest text-[color:var(--papel-suave)]">
            nota da fabriquinha 3D
          </p>

          <div className="tracejado my-[1.15em]" />

          <div className="space-y-[0.6em] text-[1em] font-bold">
            {NA_CONTA.map((item) => (
              <div key={item} className="linha-recibo">
                <span className="rotulo uppercase">{item}</span>
                <span className="pontos" />
                {/* sem flex aqui: o ✓ precisa sentar na mesma linha de base
                    do rótulo, senão descola do tracinho pontilhado */}
                <span className="valor">
                  <IconeCheck size={16} />
                </span>
              </div>
            ))}
          </div>

          <div className="tracejado my-[1.15em]" />

          {/* O gostinho mora aqui: o carimbo promete um lucro e não mostra
              número nenhum. Quem quiser o SEU número desce e faz a conta. */}
          <div className="caixa-valor mt-[1.4em] text-center">
            <span className="carimbo">
              <span className="display block text-[0.8em] uppercase tracking-[0.2em]">
                e mostra
              </span>
              <span className="display block text-[1.4em] uppercase tracking-[0.06em]">
                seu lucro
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ---------- Os pacotes ---------- */}
      {/* Preços vêm de lib/planos, o mesmo lugar que a cobrança usa: a vitrine
          não pode prometer um número e o cartão fazer outro. */}
      <section id="pacotes" className="scroll-mt-4 py-16 sm:py-20">
        <div className="flex flex-col items-center text-center">
          <h2 className="display text-3xl font-bold text-tinta sm:text-4xl">
            Ligue a sua fábrica
          </h2>
          <p className="mt-3 text-xl font-bold text-mute">
            Cancela quando quiser.
          </p>
        </div>

        {/* Lado a lado: preço só se compara vendo os dois juntos. Empilhado,
            a pessoa tinha que rolar e guardar o primeiro de cabeça. */}
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          {/* Anual primeiro: é o que vale mais a pena */}
          <div className="card card-destaque flex flex-col">
            {/* altura fixa nos dois cards: o selo "2 meses grátis" engorda
                esta linha e jogava o preço do anual pra baixo do outro */}
            <div className="flex h-9 items-center justify-between gap-2">
              <p className="display text-base font-bold uppercase tracking-widest text-mute">
                {PLANOS.anual.nome}
              </p>
              <span className="shrink-0 rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-base font-extrabold text-neon">
                2 meses grátis
              </span>
            </div>
            {/* Os dois cards falam em "por mês" de propósito: com R$ 1.200,00
                gritando aqui e R$ 120,00 no vizinho, o pacote que vale mais a
                pena parecia 10x mais caro. O valor cheio não some — vai logo
                abaixo, porque é ele que a pessoa vai ver na fatura. */}
            <div className="caixa-valor mt-3">
              <Valor
                valor={PLANOS.anual.porMes}
                max="2.75rem"
                min="1.5rem"
                sufixo="/mês"
                className="valor-marca block font-bold text-neon"
              />
            </div>
            <p className="mt-2 text-lg font-bold text-mute">
              cobrado {brl(PLANOS.anual.preco)} uma vez por ano
            </p>
            <div className="flex-1" />
            {/* a economia é calculada (lib/planos), nunca escrita na mão */}
            <p className="mt-4 rounded-xl border border-neon/30 bg-neon/10 px-3 py-2.5 text-center text-lg font-extrabold text-neon">
              você economiza {brl(economiaDoAnual())}
            </p>
            <Link
              href="/login?modo=criar&plano=anual"
              className="btn-grande btn-neon mt-4 flex w-full items-center justify-center text-xl"
            >
              Assinar anual
            </Link>
          </div>

          {/* Mensal */}
          <div className="card flex flex-col">
            <div className="flex h-9 items-center">
              <p className="display text-base font-bold uppercase tracking-widest text-mute">
                {PLANOS.mensal.nome}
              </p>
            </div>
            <div className="caixa-valor mt-3">
              <Valor
                valor={PLANOS.mensal.porMes}
                max="2.75rem"
                min="1.5rem"
                sufixo="/mês"
                className="valor-marca block font-bold text-tinta"
              />
            </div>
            <p className="mt-2 text-lg font-bold text-mute">
              {PLANOS.mensal.legenda}
            </p>
            <div className="flex-1" />
            {/* espelha a altura do selo de economia do card ao lado, pra os
                dois botões ficarem na mesma linha */}
            <p className="mt-4 rounded-xl border border-borda px-3 py-2.5 text-center text-lg font-bold text-mute">
              dá {brl(PLANOS.mensal.preco * PLANOS.anual.frequenciaMeses)} no ano
            </p>
            <Link
              href="/login?modo=criar&plano=mensal"
              className="btn-grande btn-escuro mt-6 flex w-full items-center justify-center text-xl"
            >
              Assinar mensal
            </Link>
          </div>
        </div>

        {/* O que a pessoa leva — sem isto a página pede R$ 1.200 e nunca diz
            o que vem na caixa. Uma vez só: os dois pacotes dão o mesmo. */}
        <div className="card mx-auto mt-4 max-w-3xl">
          <p className="display text-center text-xl font-bold text-tinta">
            Os dois vêm com
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-x-6">
            {VEM_JUNTO.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-lg font-bold text-mute"
              >
                <span className="mt-1 shrink-0 text-neon">
                  <IconeCheck size={20} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mx-auto mt-6 flex max-w-3xl items-center justify-center gap-2 text-center text-lg font-bold text-mute">
          <IconeCadeado size={20} className="shrink-0" />O cartão é digitado no
          Mercado Pago, nunca aqui.
        </p>
      </section>

      {/* ---------- O final: última chamada ---------- */}
      {/* Fala com quem AINDA NÃO TEM CONTA, que é pra quem esta página existe.
          Nada de "seus produtos estão te esperando" aqui: essa pessoa não tem
          produto nenhum. Quem já entrou tem o atalho na barra do topo. */}
      <section className="flex flex-col items-center border-t border-borda py-16 text-center sm:py-20">
        <Logo size={60} />
        <p className="display mt-5 text-3xl font-bold leading-tight text-tinta sm:text-4xl">
          Pronto pra ligar a sua fábrica?
        </p>
        <p className="mt-3 max-w-sm text-xl font-bold text-mute">
          Preço certo em toda peça que sair da sua impressora.
        </p>
        <Link
          href="/login?modo=criar&plano=anual"
          className="btn-grande btn-neon mt-8 flex w-full max-w-md items-center justify-center text-xl"
        >
          Comece agora
        </Link>
      </section>

      {/* O "já tem conta? entrar" subiu pra barra do topo; aqui fica só a
          assinatura, pra a página ter fim em vez de simplesmente parar. */}
      <footer className="border-t border-borda py-8 text-center">
        <p className="text-lg font-bold text-mute">
          {MARCA} · {TAGLINE}
        </p>
      </footer>
    </main>
  );
}
