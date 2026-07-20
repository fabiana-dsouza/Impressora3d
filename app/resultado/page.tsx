"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { lerConfig, lerCores, lerProduto, lerPerfil } from "@/lib/db";
import { calcularProduto } from "@/lib/calc-produto";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Config, Cor, Produto } from "@/lib/types";
import Confete from "@/components/Confete";
import { Logo } from "@/components/Marca";
import { IconeAlerta, IconeCasa } from "@/components/Icones";
import NotinhaInterna from "@/components/NotinhaInterna";
import NotinhaCliente from "@/components/NotinhaCliente";
import { montarOrcamento } from "@/lib/orcamento";

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

  // Memoizado porque NotinhaCliente redesenha o canvas toda vez que `dados`
  // muda de identidade — sem isto, um objeto novo a cada render viraria um
  // loop de repintura.
  const dadosOrcamento = useMemo(() => {
    if (!produto || !resultado) return null;
    return montarOrcamento(produto, resultado, cores, empresa, new Date());
  }, [produto, resultado, cores, empresa]);

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
          href="/fabrica"
          className="btn-grande btn-neon mt-6 inline-flex items-center gap-2"
        >
          <IconeCasa size={20} /> Voltar pra fábrica
        </Link>
      </main>
    );
  }

  if (!resultado || !produto || !config) return <Carregando />;

  return (
    // max-w-4xl deixa 432px por coluna. Já tentei apertar pra 3xl (368px) pra
    // casar com os 360px naturais da notinha em canvas, mas a notinha interna
    // tem fonte fixa de 16px e começou a quebrar linha ("...· 40 / G"). Quem
    // cede é o canvas, que se centraliza nos seus 360 — texto quebrado é pior
    // que 72px de folga.
    <main className="mx-auto w-full max-w-md lg:max-w-4xl">
      <Confete ativo={confete} />

      <div className="mb-4">
        <Link
          href="/fabrica"
          aria-label="Voltar pra fábrica"
          className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <IconeCasa size={22} />
        </Link>
      </div>

      {/* As duas notinhas se parecem de longe, e mandar a errada pro cliente
          seria o pior erro possível — por isso cada uma tem nome em cima. */}
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-8">
        <section>
          <p className="mb-3 text-center text-base font-extrabold uppercase tracking-wide text-mute">
            só sua
          </p>
          <NotinhaInterna
            produto={produto}
            config={config}
            cores={cores}
            resultado={resultado}
            empresa={empresa}
          />
        </section>

        <section>
          <p className="mb-3 text-center text-base font-extrabold uppercase tracking-wide text-mute">
            pro cliente
          </p>
          {dadosOrcamento && <NotinhaCliente dados={dadosOrcamento} />}
        </section>
      </div>
    </main>
  );
}
