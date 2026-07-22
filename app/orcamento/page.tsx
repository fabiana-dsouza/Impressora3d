"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import * as db from "@/lib/db";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Cor, Produto } from "@/lib/types";
import Carretel from "@/components/Carretel";
import { Logo } from "@/components/Marca";
import { IconeCasa } from "@/components/Icones";

export default function OrcamentoPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Orcamento />
    </Suspense>
  );
}

function Carregando() {
  return (
    <main className="flex flex-col items-center pt-20 text-center">
      <Logo size={60} className="animate-wiggle" />
      <p className="mt-4 text-xl font-extrabold text-mute">Só um segundinho...</p>
    </main>
  );
}

function Orcamento() {
  const router = useRouter();
  const params = useSearchParams();
  const produtoId = params.get("produto");
  const deVenda = params.get("de");

  const [produto, setProduto] = useState<Produto | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [coresIds, setCoresIds] = useState<string[]>([]);
  // Cliente herdado de "vender de novo": aqui não tem campo de cliente (ele vive
  // na nota agora), só guardamos o nome pra a nota já vir preenchida.
  const [clienteDe, setClienteDe] = useState("");
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cs, vendas] = await Promise.all([db.lerCores(), db.lerVendas()]);
        if (!vivo) return;
        setCores(cs);

        // "Vender de novo": herda a peça, o cliente e as cores daquela venda.
        const anterior = deVenda ? vendas.find((v) => v.id === deVenda) : null;
        const idDaPeca = anterior?.produtoId ?? produtoId;

        const p = idDaPeca ? await db.lerProduto(idDaPeca) : null;
        if (!vivo) return;
        setProduto(p);
        setCoresIds(anterior ? anterior.coresIds : p?.coresIds ?? []);

        if (anterior?.clienteId) {
          const lista = await db.lerClientes();
          if (!vivo) return;
          setClienteDe(
            lista.find((c) => c.id === anterior.clienteId)?.nome ?? ""
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (vivo) setCarregou(true);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [produtoId, deVenda]);

  const podeSeguir = coresIds.length > 0;

  function alternarCor(id: string) {
    setCoresIds((atual) =>
      atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]
    );
  }

  function seguir() {
    if (!produto || !podeSeguir) return;
    const busca = new URLSearchParams({
      id: produto.id,
      cores: coresIds.join(","),
    });
    // Vindo de "vender de novo", a nota já abre com o cliente de antes.
    if (clienteDe) busca.set("cliente", clienteDe);
    router.push(`/resultado?${busca.toString()}`);
  }

  if (!carregou) return <Carregando />;

  if (!produto) {
    return (
      <main className="mx-auto flex max-w-xl flex-col items-center pt-20 text-center">
        <p className="text-xl font-extrabold text-tinta">
          Não achei essa peça...
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

  return (
    <main className="mx-auto w-full max-w-md">
      <div className="mb-4">
        <Link
          href="/fabrica"
          aria-label="Voltar pra fábrica"
          className="btn-escuro flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <IconeCasa size={22} />
        </Link>
      </div>

      {/* Deixa explícito que este nome é o do PRODUTO — quem é o cliente a gente
          pergunta só depois, na nota. */}
      <p className="mb-1 text-sm font-extrabold uppercase tracking-wide text-mute">
        Orçamento de
      </p>
      <h1 className="display mb-6 text-2xl font-bold text-tinta">
        {produto.nome}
      </h1>

      {/* ---------- Qual cor ---------- */}
      <h2 className="display mb-3 text-xl font-bold text-tinta">
        Qual cor dessa vez?
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {cores.map((c) => {
          const ativo = coresIds.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => alternarCor(c.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-painel2 p-2.5 transition-all active:translate-y-0.5 ${
                ativo ? "scale-105 border-neon" : "border-borda"
              }`}
            >
              <Carretel cor={c.hex} size={52} />
              <span
                className={`text-xs font-extrabold leading-tight ${
                  ativo ? "text-neon" : "text-tinta"
                }`}
              >
                {ativo ? "✓ " : ""}
                {c.nome}
              </span>
            </button>
          );
        })}
      </div>

      {coresIds.length >= 2 && (
        <p className="mt-4 animate-pop rounded-2xl border border-ciano/30 bg-ciano/10 p-3 text-center font-bold text-ciano">
          Você misturou {coresIds.length} cores! Vou usar o preço médio delas.
        </p>
      )}

      <button
        onClick={seguir}
        disabled={!podeSeguir}
        className="btn-grande btn-neon mt-8 w-full disabled:opacity-50"
      >
        Fazer a notinha
      </button>

      {!podeSeguir && (
        <p className="mt-3 text-center font-bold text-mute">
          Escolhe pelo menos uma cor.
        </p>
      )}
    </main>
  );
}
