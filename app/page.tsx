import Link from "next/link";
import { PLANOS, economiaDoAnual } from "@/lib/planos";
import { brl } from "@/lib/format";
import { MARCA, TAGLINE } from "@/lib/marca";
import { temSessao } from "@/lib/supabase/servidor";
import { Logo, ImpressoraIlustracao } from "@/components/Marca";
import { IconeCadeado, IconeCheck } from "@/components/Icones";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import PecasFlutuantes from "@/components/PecasFlutuantes";

/** O que entra na conta = o que o produto é, dito em 5 linhas de nota. */
const NA_CONTA = [
  "filamento",
  "energia",
  "desgaste da impressora",
  "embalagem",
  "reserva pros erros",
];

/** Os dois pacotes dão exatamente isto — muda só quando você paga. */
const VEM_JUNTO = [
  "Produtos sem limite, com o preço certo na hora",
  "Notinha de cada venda, com o lucro de verdade",
  "Cofrinho somando tudo que você já ganhou",
  "Suas cores e a sua impressora na conta",
];

/**
 * A porta de entrada — no estilo portrait.so: canvas off-white com aurora
 * pastel e, no herói, um "big modal" de vidro fosco (a aurora brilha através)
 * onde mora o título; as imagens dos produtos encavalam os cantos do painel,
 * metade dentro, metade fora, respirando de leve como se flutuassem.
 *
 * Abre pra todo mundo, logado ou não: é o endereço do site.
 */
export default async function Entrada() {
  const logado = await temSessao();

  const assinarHref = (plano: "anual" | "mensal") =>
    logado
      ? `/planos?plano=${plano}&auto=1`
      : `/login?modo=criar&plano=${plano}`;

  return (
    <main className="mx-auto w-full max-w-5xl">
      {/* ---------- Barra do topo (pílula flutuando) ---------- */}
      <header className="flex items-center justify-between gap-3 rounded-full border border-borda bg-white/80 py-2 pl-3 pr-2 shadow-[0_12px_30px_-22px_rgba(8,48,76,0.5)] backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="pilula-arco flex h-10 w-10 items-center justify-center rounded-full">
            <Logo size={26} />
          </span>
          <p className="display truncate text-lg font-bold text-tinta sm:text-xl">
            {MARCA}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!logado && (
            <span className="hidden text-base font-bold text-mute sm:block">
              Já tem conta?
            </span>
          )}
          <Link
            href={logado ? "/fabrica" : "/login"}
            className="flex h-11 shrink-0 items-center rounded-full bg-tinta px-5 text-base font-extrabold text-white transition active:scale-95"
          >
            {logado ? "Minha fábrica" : "Entrar"}
          </Link>
        </div>
      </header>

      {/* ---------- Herói: big modal de vidro + peças flutuando pelas bordas ----------
          Sem overflow-hidden de propósito: as peças precisam vazar pra fora sem
          serem cortadas. O scroll horizontal já é barrado no body. */}
      <section className="relative py-12 sm:py-16 lg:py-24">
        <div className="aurora rounded-[2.5rem]" />

        <div className="relative mx-auto max-w-3xl">
          {/* As imagens dos produtos encavalando os cantos (client + GSAP) */}
          <PecasFlutuantes />

          {/* O big modal: painel de vidro fosco onde a aurora brilha através */}
          <div className="painel-vidro relative z-10 flex flex-col items-center px-6 py-12 text-center sm:px-12 sm:py-16">
            <Logo size={86} className="animate-flutua" />
            <h1 className="display mt-4 text-[2.9rem] font-bold leading-[0.98] text-tinta sm:text-7xl">
              Você imprime.
              <br />
              Ela faz a <span className="acento">conta.</span>
            </h1>
            <p className="mt-6 max-w-lg text-xl font-bold text-mute sm:text-2xl">
              Quanto custa e por quanto vender o que sai da sua impressora 3D.
            </p>
            <Link
              href={assinarHref("anual")}
              className="cta-arco mt-8 flex min-h-[60px] w-full max-w-xs items-center justify-center whitespace-nowrap px-8 text-xl font-extrabold sm:w-auto"
            >
              Criar a minha fábrica
            </Link>
            <p className="mt-4 text-base font-bold text-mute">
              A partir de {brl(PLANOS.anual.porMes)} por mês.{" "}
              <Link href="#pacotes" className="text-ciano underline">
                Ver os pacotes
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Blocos de cor: o app mostrado ---------- */}
      <section className="grid gap-4 pt-2 lg:grid-cols-2">
        {/* NOTINHA — bloco pêssego, alto no desktop */}
        <div className="bloco flex flex-col bg-pessego text-tinta lg:row-span-2">
          <h2 className="display text-2xl font-bold sm:text-3xl">
            Toda venda vira uma notinha.
          </h2>
          <p className="mt-2 text-lg font-bold text-tinta/70">
            Com o lucro de verdade carimbado nela.
          </p>

          <div className="recibo mono mx-auto mt-7 w-full max-w-xs">
            <p className="display text-center text-[1.3em] font-bold uppercase tracking-[0.16em]">
              ★ Dino Prints ★
            </p>
            <p className="text-center text-[0.8em] font-bold uppercase tracking-widest text-[color:var(--papel-suave)]">
              nota da fabriquinha 3D
            </p>
            <div className="tracejado my-[1.1em]" />
            <div className="space-y-[0.55em] text-[1em] font-bold">
              {NA_CONTA.map((item) => (
                <div key={item} className="linha-recibo">
                  <span className="rotulo uppercase">{item}</span>
                  <span className="pontos" />
                  <span className="valor">
                    <IconeCheck size={16} />
                  </span>
                </div>
              ))}
            </div>
            <div className="tracejado my-[1.1em]" />
            <div className="caixa-valor mt-[1.3em] text-center">
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
        </div>

        {/* COFRINHO — bloco menta */}
        <div className="bloco flex flex-col justify-between bg-menta text-tinta">
          <div>
            <h2 className="display text-2xl font-bold sm:text-3xl">
              Um cofrinho que soma tudo.
            </h2>
            <p className="mt-2 text-lg font-bold text-tinta/70">
              Cada venda entra no cofrinho da sua empresa.
            </p>
          </div>
          <div className="mt-6 rounded-2xl bg-white/60 px-4 py-5 text-center">
            <p className="display text-xs font-bold uppercase tracking-[0.2em] text-mute">
              já ganhei de verdade
            </p>
            <p className="valor-marca mt-1 text-5xl font-bold text-neon sm:text-6xl">
              R$ ✦✦✦
            </p>
            <p className="mt-1 text-sm font-bold text-mute">
              o seu número aparece aqui dentro
            </p>
          </div>
        </div>

        {/* CORES — bloco periwinkle */}
        <div className="bloco flex flex-col justify-between overflow-hidden bg-peri text-tinta">
          <div>
            <h2 className="display text-2xl font-bold sm:text-3xl">
              Suas cores e a sua impressora.
            </h2>
            <p className="mt-2 text-lg font-bold text-tinta/70">
              A conta usa o filamento e a máquina que são seus.
            </p>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="flex -space-x-3">
              {["#FF7EA8", "#2F6BE0", "#0F9D6E", "#FFC94D", "#DCC9FF"].map((c) => (
                <Carretel key={c} cor={c} size={44} />
              ))}
            </span>
            <ImpressoraIlustracao size={130} />
          </div>
        </div>
      </section>

      {/* ====================================================================
          PRECIFICAÇÃO — mantida como está (pedido da usuária). Só herda as
          cores novas pelos tokens; a estrutura e o conteúdo não mudam.
          ==================================================================== */}
      <section id="pacotes" className="scroll-mt-4 py-16 sm:py-20">
        <div className="flex flex-col items-center text-center">
          <h2 className="display text-3xl font-bold text-tinta sm:text-5xl">
            Ligue a sua fábrica
          </h2>
          <p className="mt-3 text-xl font-bold text-mute">
            Cancela quando quiser.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
          {/* Anual primeiro: é o que vale mais a pena */}
          <div className="card card-destaque flex flex-col">
            <div className="flex h-9 items-center justify-between gap-2">
              <p className="display text-base font-bold uppercase tracking-widest text-mute">
                {PLANOS.anual.nome}
              </p>
              <span className="shrink-0 rounded-full bg-neon/15 px-3 py-1 text-base font-extrabold text-neon">
                2 meses grátis
              </span>
            </div>
            <div className="caixa-valor mt-3">
              <Valor
                valor={PLANOS.anual.porMes}
                max="2.75rem"
                min="1.5rem"
                sufixo="/mês"
                className="valor-marca block font-bold text-tinta"
              />
            </div>
            <p className="mt-2 text-lg font-bold text-mute">
              cobrado {brl(PLANOS.anual.preco)} uma vez por ano
            </p>
            <div className="flex-1" />
            <p className="mt-4 rounded-2xl bg-neon/12 px-3 py-2.5 text-center text-lg font-extrabold text-neon">
              você economiza {brl(economiaDoAnual())}
            </p>
            <Link
              href={assinarHref("anual")}
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
            <p className="mt-4 rounded-2xl border border-borda px-3 py-2.5 text-center text-lg font-bold text-mute">
              dá {brl(PLANOS.mensal.preco * PLANOS.anual.frequenciaMeses)} no ano
            </p>
            <Link
              href={assinarHref("mensal")}
              className="btn-grande btn-escuro mt-6 flex w-full items-center justify-center text-xl"
            >
              Assinar mensal
            </Link>
          </div>
        </div>

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
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neon/15 text-neon">
                  <IconeCheck size={16} />
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
      <section className="relative overflow-hidden rounded-[2.5rem] py-16 text-center">
        <div className="aurora" />
        <div className="relative z-10 flex flex-col items-center">
          <Logo size={72} className="animate-flutua" />
          <p className="display mt-5 text-3xl font-bold leading-tight text-tinta sm:text-5xl">
            Bora ligar a sua <span className="acento">fábrica</span>
          </p>
          <p className="mt-3 max-w-sm text-xl font-bold text-mute">
            Preço certo em toda peça que sair da sua impressora.
          </p>
          <Link
            href={assinarHref("anual")}
            className="cta-arco mt-8 flex min-h-[60px] w-full max-w-md items-center justify-center px-6 text-xl font-extrabold"
          >
            Começar agora
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center">
        <p className="text-lg font-bold text-mute">
          {MARCA}, {TAGLINE}
        </p>
      </footer>
    </main>
  );
}
