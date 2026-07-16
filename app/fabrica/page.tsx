"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as db from "@/lib/db";
import { calcularProduto, acharCor } from "@/lib/calc-produto";
import type { Config, Cor, Produto } from "@/lib/types";
import { CORES_PADRAO, EMPRESA_PADRAO } from "@/lib/defaults";
import Confete from "@/components/Confete";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import Dialogo from "@/components/Dialogo";
import { Logo, ImpressoraIlustracao } from "@/components/Marca";
import {
  IconeAlerta,
  IconeEngrenagem,
  IconeLixeira,
  IconeLupa,
  IconeMais,
  IconeMoeda,
  IconeTrofeu,
} from "@/components/Icones";

type Aba = "catalogo" | "vendidos";

/** Caixinha rotulada do card do produto — é ela que serve de régua pro valor. */
function Etiqueta({
  rotulo,
  tom,
  largo,
  children,
}: {
  rotulo: string;
  tom?: "neon" | "perigo";
  largo?: boolean;
  children: React.ReactNode;
}) {
  const cor =
    tom === "neon"
      ? "border-neon/30 bg-neon/10"
      : tom === "perigo"
      ? "border-perigo/30 bg-perigo/10"
      : "border-borda bg-painel2";
  return (
    <div
      className={`caixa-valor rounded-lg border px-2 py-1.5 text-center ${cor} ${
        largo ? "col-span-2 px-3 py-2" : ""
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-mute">
        {rotulo}
      </p>
      {children}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [carregou, setCarregou] = useState(false);
  const [erro, setErro] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [aba, setAba] = useState<Aba>("catalogo");
  const [festa, setFesta] = useState(false);
  const [aviso, setAviso] = useState("");
  const [apagando, setApagando] = useState<Produto | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // Catraca: sem assinatura ativa, a fábrica fica na tela de planos.
        const assinatura = await db.lerAssinatura();
        if (!vivo) return;
        if (!assinatura.ativa) {
          router.replace("/planos");
          return;
        }
        const [ps, cfg, cs] = await Promise.all([
          db.lerProdutos(),
          db.lerConfig(),
          db.lerCores(),
        ]);
        if (!vivo) return;
        setProdutos(ps);
        setConfig(cfg);
        setCores(cs);
        setCarregou(true);
      } catch (e: any) {
        if (vivo) {
          setErro(String(e?.message ?? e));
          setCarregou(true);
        }
      }
    })();
    // Nome da empresa (não trava a tela se falhar).
    db.lerPerfil()
      .then((p) => vivo && setEmpresa(p.nomeEmpresa))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const calculos = useMemo(() => {
    if (!config) return [];
    return produtos.map((p) => ({
      produto: p,
      resultado: calcularProduto(p, config, cores),
    }));
  }, [produtos, config, cores]);

  const jaGanhei = calculos.reduce(
    (s, c) => s + c.resultado.lucro * (c.produto.vendidos || 0),
    0
  );
  const totalVendidos = produtos.reduce((s, p) => s + (p.vendidos || 0), 0);
  const vendidosLista = calculos.filter((c) => (c.produto.vendidos || 0) > 0);

  function falhou(e: unknown) {
    console.error(e);
    setAviso("Confere a internet e tenta de novo!");
  }

  function apagar(id: string) {
    const anterior = produtos;
    setProdutos(produtos.filter((p) => p.id !== id));
    db.apagarProduto(id).catch((e) => {
      setProdutos(anterior);
      falhou(e);
    });
  }

  function vender(id: string) {
    const alvo = produtos.find((p) => p.id === id);
    if (!alvo) return;
    const novo = (alvo.vendidos || 0) + 1;
    const anterior = produtos;
    setProdutos(produtos.map((p) => (p.id === id ? { ...p, vendidos: novo } : p)));
    setFesta(true);
    setTimeout(() => setFesta(false), 1600);
    db.atualizarVendidos(id, novo).catch((e) => {
      setProdutos(anterior);
      falhou(e);
    });
  }

  function desfazerVenda(id: string) {
    const alvo = produtos.find((p) => p.id === id);
    if (!alvo) return;
    const novo = Math.max(0, (alvo.vendidos || 0) - 1);
    const anterior = produtos;
    setProdutos(produtos.map((p) => (p.id === id ? { ...p, vendidos: novo } : p)));
    db.atualizarVendidos(id, novo).catch((e) => {
      setProdutos(anterior);
      falhou(e);
    });
  }

  return (
    <main>
      <Confete ativo={festa} />

      {/* A marca da fabriquinha */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo size={46} />
          <div className="min-w-0">
            <h1 className="display truncate text-2xl font-bold uppercase tracking-wide text-tinta sm:text-3xl">
              {empresa || EMPRESA_PADRAO}
            </h1>
            <p className="text-sm font-bold text-mute">
              fabriquinha de impressão 3D
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/cores"
            aria-label="Minhas cores"
            className="btn-escuro flex h-[54px] w-[54px] items-center justify-center rounded-[0.9rem]"
          >
            <Carretel cor="#22d3ee" size={24} />
          </Link>
          <Link
            href="/config"
            aria-label="Configurações"
            className="btn-escuro flex h-[54px] w-[54px] items-center justify-center rounded-[0.9rem]"
          >
            <IconeEngrenagem size={22} />
          </Link>
        </div>
      </header>

      {/* Erro de conexão / setup */}
      {erro && (
        <div className="card mb-5 flex items-center gap-3 border-perigo/40">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-perigo/40 bg-perigo/10 text-perigo">
            <IconeAlerta size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-tinta">
              Não consegui falar com o banco de dados
            </p>
            <p className="mt-0.5 text-sm font-bold text-mute">{erro}</p>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => setAba("catalogo")}
          className={`btn-grande ${
            aba === "catalogo" ? "btn-neon" : "btn-escuro"
          }`}
        >
          Meus produtos
        </button>
        <button
          onClick={() => setAba("vendidos")}
          className={`btn-grande ${
            aba === "vendidos" ? "btn-neon" : "btn-escuro"
          }`}
        >
          Já vendi
        </button>
      </div>

      {!carregou ? (
        <div className="card flex flex-col items-center py-8 text-center">
          <Logo size={54} className="animate-wiggle" />
          <p className="mt-3 font-extrabold text-mute">Ligando a fábrica...</p>
        </div>
      ) : aba === "catalogo" ? (
        /* ---------- ABA: CATÁLOGO ---------- */
        produtos.length === 0 ? (
          !erro && (
            <div className="card flex flex-col items-center py-8 text-center">
              <ImpressoraIlustracao size={160} />
              <p className="display mt-4 text-xl font-bold text-tinta">
                A fábrica está pronta!
              </p>
              <p className="mt-1 font-bold text-mute">
                Aperte o botão verde aí embaixo pra fabricar seu primeiro
                produto.
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calculos.map(({ produto, resultado }) => (
              <div
                key={produto.id}
                className="card animate-pop overflow-hidden p-0"
              >
                <div className="flex items-stretch">
                  {/* fios de filamento do produto */}
                  <div className="flex w-2.5 shrink-0 flex-col">
                    {(produto.coresIds.length
                      ? produto.coresIds.slice(0, 4)
                      : ["cinza"]
                    ).map((cid, i) => (
                      <span
                        key={i}
                        className="flex-1"
                        style={{ background: acharCor(cid, cores).hex }}
                      />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="display min-w-0 truncate text-lg font-bold text-tinta">
                        {produto.nome}
                      </h2>
                      <button
                        onClick={() => setApagando(produto)}
                        aria-label="Apagar produto"
                        className="shrink-0 rounded-lg p-1.5 text-mute hover:text-perigo active:scale-90"
                      >
                        <IconeLixeira size={18} />
                      </button>
                    </div>

                    {produto.vendidos > 0 && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-xs font-extrabold text-neon">
                        <IconeTrofeu size={13} />
                        {produto.vendidos} vendido
                        {produto.vendidos > 1 ? "s" : ""}
                      </p>
                    )}

                    {/* custo e preço lado a lado; o lucro é a estrela, ocupa
                        a linha inteira e fica vermelho se der prejuízo */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Etiqueta rotulo="custo">
                        <Valor
                          valor={resultado.custoTotal}
                          max="0.95rem"
                          className="block font-bold text-tinta"
                        />
                      </Etiqueta>
                      <Etiqueta rotulo="vender">
                        <Valor
                          valor={resultado.precoVenda}
                          max="0.95rem"
                          className="block font-bold text-ciano"
                        />
                      </Etiqueta>
                      <Etiqueta
                        rotulo={resultado.lucro < 0 ? "prejuízo" : "lucro"}
                        tom={resultado.lucro < 0 ? "perigo" : "neon"}
                        largo
                      >
                        <Valor
                          valor={Math.abs(resultado.lucro)}
                          max="1.6rem"
                          className={`block font-bold ${
                            resultado.lucro < 0 ? "text-perigo" : "text-neon"
                          }`}
                        />
                      </Etiqueta>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/resultado?id=${produto.id}`}
                        className="btn-escuro flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-extrabold"
                      >
                        <IconeLupa size={16} /> A conta
                      </Link>
                      <button
                        onClick={() => vender(produto.id)}
                        className="btn-neon flex flex-[1.3] items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-extrabold"
                      >
                        <IconeMoeda size={16} /> Vendi 1!
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : /* ---------- ABA: JÁ VENDI ---------- */
      vendidosLista.length === 0 ? (
        <div className="card flex flex-col items-center py-8 text-center">
          <IconeMoeda size={56} className="text-mute" />
          <p className="display mt-4 text-xl font-bold text-tinta">
            Ainda não vendeu nada
          </p>
          <p className="mt-1 font-bold text-mute">
            Quando vender um produto, aperte{" "}
            <span className="text-neon">“Vendi 1!”</span> lá na aba de produtos.
          </p>
        </div>
      ) : (
        <>
          {/* O cofrinho da empresa */}
          <div className="card caixa-valor mb-4 text-center">
            <p className="display text-xs font-bold uppercase tracking-[0.2em] text-mute">
              cofrinho da {empresa || "empresa"}
            </p>
            <Valor
              valor={Math.abs(jaGanhei)}
              max="3.5rem"
              min="1.5rem"
              className={`mt-1 block font-bold ${
                jaGanhei < 0 ? "text-perigo" : "brilho text-neon"
              }`}
            />
            <p className="mt-1 font-bold text-mute">
              ganho de verdade, com {totalVendidos} venda
              {totalVendidos > 1 ? "s" : ""} 🎉
            </p>
          </div>

          <div className="space-y-3">
            {vendidosLista.map(({ produto, resultado }) => (
              <div key={produto.id} className="card flex items-center gap-3">
                <span className="flex shrink-0 -space-x-2.5">
                  {produto.coresIds.slice(0, 3).map((id, idx) => (
                    <Carretel
                      key={idx}
                      cor={acharCor(id, cores).hex}
                      size={30}
                    />
                  ))}
                </span>
                <div className="caixa-valor min-w-0 flex-1">
                  <p className="display truncate text-lg font-bold text-tinta">
                    {produto.nome}
                  </p>
                  <p className="text-sm font-bold text-mute">
                    {produto.vendidos}× vendido · ganhou{" "}
                    <Valor
                      valor={resultado.lucro * produto.vendidos}
                      max="0.875rem"
                      className="text-neon"
                    />
                  </p>
                </div>
                <button
                  onClick={() => desfazerVenda(produto.id)}
                  aria-label="Tirar uma venda"
                  title="Errei, tirar uma venda"
                  className="btn-escuro shrink-0 rounded-lg px-3 py-2 font-extrabold"
                >
                  −1
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Botão flutuante Novo Produto (com um degradê pro conteúdo não
          encostar nele quando a lista é comprida) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-fundo via-fundo to-transparent pt-10">
        <div className="mx-auto max-w-xl px-4 pb-4">
          <Link
            href="/novo"
            className="btn-grande btn-neon pointer-events-auto flex w-full items-center justify-center gap-2 text-xl"
          >
            <IconeMais size={22} /> Novo Produto
          </Link>
        </div>
      </div>

      {apagando && (
        <Dialogo
          tom="perigo"
          icone={<IconeLixeira size={26} />}
          titulo={`Apagar “${apagando.nome}”?`}
          texto="A continha dele some da fábrica pra sempre."
          confirmar="Sim, apagar"
          cancelar="Não, deixa"
          onConfirmar={() => apagar(apagando.id)}
          onFechar={() => setApagando(null)}
        />
      )}

      {aviso && (
        <Dialogo
          tom="perigo"
          titulo="Não consegui salvar"
          texto={aviso}
          onFechar={() => setAviso("")}
        />
      )}
    </main>
  );
}
