"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { lerConfig, lerCores, lerProduto, lerPerfil } from "@/lib/db";
import { calcularProduto, acharCor } from "@/lib/calc-produto";
import { brl, num } from "@/lib/format";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Config, Cor, Produto, Unidade } from "@/lib/types";
import Confete from "@/components/Confete";
import Valor from "@/components/Valor";
import { Logo } from "@/components/Marca";
import { IconeAlerta, IconeCasa } from "@/components/Icones";

export default function ResultadoPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Resultado />
    </Suspense>
  );
}

function Carregando() {
  return (
    <main className="flex flex-col items-center pt-20 text-center">
      <Logo size={60} className="animate-wiggle" />
      <p className="mt-4 text-xl font-extrabold text-mute">
        Imprimindo a notinha...
      </p>
    </main>
  );
}

/** Mostra o peso na unidade preferida do produto. */
function peso(gramas: number, unidade: Unidade): string {
  if (unidade === "kg") {
    const kg = gramas / 1000;
    return `${num(kg, kg % 1 === 0 ? 0 : 2)} kg`;
  }
  return `${num(gramas, 0)} g`;
}

function Resultado() {
  const params = useSearchParams();
  const id = params.get("id");
  const ehNovo = params.get("novo") === "1";

  const [produto, setProduto] = useState<Produto | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [empresa, setEmpresa] = useState("");
  const [carregou, setCarregou] = useState(false);
  const [confete, setConfete] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [p, cfg, cs] = await Promise.all([
          id ? lerProduto(id) : Promise.resolve(null),
          lerConfig(),
          lerCores(),
        ]);
        if (!vivo) return;
        setProduto(p);
        setConfig(cfg);
        setCores(cs);
      } catch (e) {
        console.error(e);
      } finally {
        if (vivo) setCarregou(true);
      }
    })();
    lerPerfil()
      .then((p) => vivo && setEmpresa(p.nomeEmpresa))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!ehNovo) return;
    setConfete(true);
    const t = setTimeout(() => setConfete(false), 3600);
    return () => clearTimeout(t);
  }, [ehNovo]);

  const resultado = useMemo(() => {
    if (!produto || !config) return null;
    return calcularProduto(produto, config, cores);
  }, [produto, config, cores]);

  if (!id || (carregou && produto === null)) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center pt-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-borda bg-painel2 text-mute">
          <IconeAlerta size={30} />
        </span>
        <p className="mt-4 text-xl font-extrabold text-tinta">
          Não achei esse produto...
        </p>
        <Link
          href="/"
          className="btn-grande btn-neon mt-6 inline-flex items-center gap-2"
        >
          <IconeCasa size={20} /> Voltar pra fábrica
        </Link>
      </main>
    );
  }

  if (!resultado || !produto || !config) return <Carregando />;

  const r = resultado;
  const horasDec = produto.horas + produto.minutos / 60;
  const taxaFalhasPct = Math.round(config.taxaFalhas * 100);
  const coresUsadas = produto.coresIds.map((cid) => acharCor(cid, cores));
  const nomesCores = coresUsadas.map((c) => c.nome).join(" + ");
  const varias = coresUsadas.length >= 2;
  const prejuizo = r.lucro < 0;

  return (
    <main className="mx-auto w-full max-w-md">
      <Confete ativo={confete} />

      {/* só o botão de voltar — a página é a notinha */}
      <div className="mb-4">
        <Link
          href="/"
          aria-label="Voltar pra fábrica"
          className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <IconeCasa size={22} />
        </Link>
      </div>

      {/* ---------- A NOTINHA ---------- */}
      <div className="recibo mono px-5 py-6">
        <p className="display text-center text-lg font-bold uppercase tracking-[0.18em]">
          ★ {empresa || "Minha Startup"} ★
        </p>
        <p className="text-center text-xs font-bold uppercase tracking-widest text-[color:var(--papel-suave)]">
          nota da fabriquinha 3D
        </p>

        <div className="tracejado my-4" />

        <p className="text-sm font-extrabold uppercase">{produto.nome}</p>

        <div className="mt-3 space-y-2 text-sm font-bold">
          <div className="linha-recibo">
            <span className="rotulo uppercase">
              material {varias ? "(média)" : ""} ·{" "}
              {peso(produto.gramas, produto.unidade)}
            </span>
            <span className="pontos" />
            <span className="valor">{brl(r.custoMaterial)}</span>
          </div>
          <p className="-mt-1 text-xs text-[color:var(--papel-suave)]">
            {nomesCores}
          </p>
          <div className="linha-recibo">
            <span className="rotulo uppercase">
              energia · {num(horasDec, 1)} h
            </span>
            <span className="pontos" />
            <span className="valor">{brl(r.custoEnergia)}</span>
          </div>
          <div className="linha-recibo">
            <span className="rotulo uppercase">desgaste da impressora</span>
            <span className="pontos" />
            <span className="valor">{brl(r.custoDesgaste)}</span>
          </div>
          <div className="linha-recibo">
            <span className="rotulo uppercase">embalagem</span>
            <span className="pontos" />
            <span className="valor">{brl(r.custoExtras)}</span>
          </div>
          <div className="linha-recibo">
            <span className="rotulo uppercase">
              reserva p/ erros (+{taxaFalhasPct}%)
            </span>
            <span className="pontos" />
            <span className="valor">{brl(r.custoFalhas)}</span>
          </div>
        </div>

        <div className="tracejado my-4" />

        <div className="linha-recibo text-base font-extrabold">
          <span className="rotulo uppercase">custo total</span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoTotal)}</span>
        </div>
        <div className="linha-recibo mt-2 text-lg font-extrabold">
          <span className="rotulo uppercase">vendido por</span>
          <span className="pontos" />
          <span className="valor">{brl(r.precoVenda)}</span>
        </div>

        {/* Carimbo do resultado: rótulo em cima, número embaixo — em uma linha
            só ele encostava nas bordas do papel quando o valor era grande. */}
        <div className="caixa-valor mt-5 text-center">
          <span className={`carimbo ${prejuizo ? "carimbo-vermelho" : ""}`}>
            <span className="display block text-[0.7rem] uppercase tracking-[0.25em]">
              {prejuizo ? "prejuízo" : "seu lucro"}
            </span>
            {/* folga = padding + borda do carimbo, que a régua não enxerga */}
            <Valor
              valor={Math.abs(r.lucro)}
              max="1.75rem"
              min="1rem"
              folga="44px"
              className="block"
            />
          </span>
        </div>
      </div>
    </main>
  );
}
