"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { lerConfig, lerCores, lerProduto, lerPerfil } from "@/lib/db";
import * as db from "@/lib/db";
import { calcularProduto } from "@/lib/calc-produto";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Config, Cor, Produto } from "@/lib/types";
import Confete from "@/components/Confete";
import { Logo } from "@/components/Marca";
import { IconeAlerta, IconeCasa } from "@/components/Icones";
import NotinhaInterna from "@/components/NotinhaInterna";
import NotinhaCliente from "@/components/NotinhaCliente";
import Dialogo from "@/components/Dialogo";
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
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const ehNovo = params.get("novo") === "1";
  const clienteParam = params.get("cliente") ?? "";
  const coresParam = params.get("cores");

  const [produto, setProduto] = useState<Produto | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [empresa, setEmpresa] = useState("");
  const [carregou, setCarregou] = useState(false);
  const [confete, setConfete] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [avisoVenda, setAvisoVenda] = useState("");

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

  // A peça como está sendo vendida DESTA VEZ, que pode usar cores diferentes das
  // cores salvas na peça. Ambas as notinhas devem ler daqui, senão vão discordar.
  const alvo = useMemo(() => {
    if (!produto) return null;
    const escolhidas = coresParam ? coresParam.split(",").filter(Boolean) : null;
    return escolhidas ? { ...produto, coresIds: escolhidas } : produto;
  }, [produto, coresParam]);

  // Com ?cores=, calcula com as cores DESTA venda em vez das da peça. É a
  // mesma calcularProduto — nenhuma regra de preço nova.
  const resultado = useMemo(() => {
    if (!alvo || !config) return null;
    return calcularProduto(alvo, config, cores);
  }, [alvo, config, cores]);

  // Memoizado porque NotinhaCliente redesenha o canvas toda vez que `dados`
  // muda de identidade — sem isto, um objeto novo a cada render viraria um
  // loop de repintura.
  const dadosOrcamento = useMemo(() => {
    if (!alvo || !resultado) return null;
    return {
      ...montarOrcamento(alvo, resultado, cores, empresa, new Date()),
      cliente: clienteParam,
    };
  }, [alvo, resultado, cores, empresa, clienteParam]);

  async function vendi() {
    if (!produto || !resultado || salvando) return;
    setSalvando(true);
    try {
      const clienteId = await db.acharOuCriarCliente(clienteParam);
      await db.criarVenda({
        produtoId: produto.id,
        produtoNome: produto.nome,
        clienteId,
        coresIds: coresParam ? coresParam.split(",").filter(Boolean) : produto.coresIds,
        preco: resultado.precoVenda,
        custo: resultado.custoTotal,
        // Vendeu agora, mas ainda não recebeu — quem marca é ela, depois.
        pagoEm: null,
      });
      router.push("/fabrica?aba=vendidos");
    } catch (e) {
      console.error(e);
      setAvisoVenda("Não consegui anotar a venda. Confere a internet!");
      setSalvando(false);
    }
  }

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

  if (!resultado || !produto || !config || !alvo) return <Carregando />;

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
            produto={alvo}
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

      {clienteParam && (
        <div className="mt-10">
          <p className="mb-3 text-center text-base font-extrabold text-mute">
            E aí, {clienteParam} vai levar?
          </p>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              onClick={vendi}
              disabled={salvando}
              className="btn-grande btn-neon flex-1 disabled:opacity-60"
            >
              Vendi!
            </button>
            <button
              onClick={() => router.push("/fabrica")}
              disabled={salvando}
              className="btn-grande btn-escuro flex-1 disabled:opacity-60"
            >
              Não vendi
            </button>
          </div>
          <p className="mt-3 text-center font-bold text-mute">
            Se vendeu, dá pra marcar quando o dinheiro chegar.
          </p>
        </div>
      )}

      {avisoVenda && (
        <Dialogo
          titulo="Não deu certo"
          texto={avisoVenda}
          onFechar={() => setAvisoVenda("")}
        />
      )}
    </main>
  );
}
