"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  lerConfig,
  lerCores,
  lerProduto,
  lerPerfil,
  lerVendas,
  lerClientes,
  acharOuCriarCliente,
  criarVenda,
} from "@/lib/db";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Cliente, Config, Cor, Produto, Venda } from "@/lib/types";
import Confete from "@/components/Confete";
import { Logo } from "@/components/Marca";
import { IconeAlerta, IconeCasa } from "@/components/Icones";
import Dialogo from "@/components/Dialogo";
import Nota, { type DadosVenda } from "@/components/Nota";

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

  // A nota tem dois modos: fazer um ORÇAMENTO (tem ?cores) mostra o fluxo de
  // vender; só VER A CONTA (sem ?cores) mostra só as notinhas.
  const ehOrcamento = coresParam !== null;
  const ehRepete = ehOrcamento && params.get("repete") === "1";

  const [produto, setProduto] = useState<Produto | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empresa, setEmpresa] = useState("");
  const [carregou, setCarregou] = useState(false);
  const [confete, setConfete] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [avisoVenda, setAvisoVenda] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [p, cfg, cs, vs, cls] = await Promise.all([
          id ? lerProduto(id) : Promise.resolve(null),
          lerConfig(),
          lerCores(),
          ehOrcamento ? lerVendas() : Promise.resolve<Venda[]>([]),
          ehOrcamento ? lerClientes() : Promise.resolve<Cliente[]>([]),
        ]);
        if (!vivo) return;
        setProduto(p);
        setConfig(cfg);
        setCores(cs);
        setVendas(vs);
        setClientes(cls);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!ehNovo) return;
    setConfete(true);
    const t = setTimeout(() => setConfete(false), 3600);
    return () => clearTimeout(t);
  }, [ehNovo]);

  // Grava a venda desta peça (que já existe) e vai pra Vendidos/Falta receber.
  async function vender(dados: DadosVenda) {
    if (!produto || salvando) return;
    setSalvando(true);
    try {
      const clienteId = await acharOuCriarCliente(dados.cliente);
      await criarVenda({
        produtoId: produto.id,
        produtoNome: dados.produtoNome,
        clienteId,
        coresIds: dados.coresIds,
        preco: dados.preco,
        custo: dados.custo,
        pagoEm: dados.jaPagou ? Date.now() : null,
      });
      router.push(
        dados.jaPagou ? "/fabrica?aba=vendidos&festa=1" : "/fabrica?aba=falta"
      );
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

  if (!carregou || !produto || !config) {
    return <Carregando />;
  }

  const coresIniciais = coresParam
    ? coresParam.split(",").filter(Boolean)
    : produto.coresIds;

  return (
    // max-w-4xl deixa 432px por coluna. Já tentei apertar pra 3xl (368px) pra
    // casar com os 360px naturais da notinha em canvas, mas a notinha interna
    // tem fonte fixa de 16px e começou a quebrar linha. Quem cede é o canvas.
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

      <Nota
        produto={produto}
        config={config}
        cores={cores}
        empresa={empresa}
        vendas={vendas}
        clientes={clientes}
        coresIniciais={coresIniciais}
        clienteInicial={clienteParam}
        ehNovo={ehNovo}
        ehRepete={ehRepete}
        somenteLeitura={!ehOrcamento}
        salvando={salvando}
        onVender={vender}
        onSoOrcamento={() => router.push("/fabrica")}
      />

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
