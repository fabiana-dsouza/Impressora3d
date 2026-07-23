"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { calcularProduto } from "@/lib/calc-produto";
import { precoBaseDaVenda } from "@/lib/vendas";
import { nomeLimpo } from "@/lib/clientes";
import { CORES_PADRAO } from "@/lib/defaults";
import type { Cliente, Config, Cor, Produto, Venda } from "@/lib/types";
import Confete from "@/components/Confete";
import { Logo } from "@/components/Marca";
import { IconeAlerta, IconeCasa, IconeMoeda } from "@/components/Icones";
import NotinhaInterna from "@/components/NotinhaInterna";
import NotinhaCliente from "@/components/NotinhaCliente";
import PrecoVendido from "@/components/PrecoVendido";
import Dialogo from "@/components/Dialogo";
import { montarOrcamento } from "@/lib/orcamento";

/** Quantas pastilhas de cliente recente cabem sem virar parede de botão. */
const QUANTAS_PASTILHAS = 6;

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

  // A nota tem dois modos: fazer um ORÇAMENTO (veio da tela de orçamento, tem
  // ?cores) mostra cliente + valor final + vender; só VER A CONTA (link da
  // fábrica ou peça recém-criada) mostra só as notinhas.
  const ehOrcamento = coresParam !== null;

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
  const [perguntandoPagou, setPerguntandoPagou] = useState(false);

  // O que ela decide na nota.
  const [cliente, setCliente] = useState(clienteParam);
  const [valorFinal, setValorFinal] = useState("");

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

  // A base do valor final: o último preço vendido dessa peça, ou o sugerido se
  // ela nunca foi vendida. Preenche uma vez só, quando os dados chegam — depois
  // quem manda é o que ela digita.
  const baseDefinida = useRef(false);
  useEffect(() => {
    if (baseDefinida.current || !carregou || !ehOrcamento || !resultado || !id) {
      return;
    }
    baseDefinida.current = true;
    setValorFinal(String(precoBaseDaVenda(vendas, id, resultado.precoVenda)));
  }, [carregou, ehOrcamento, resultado, vendas, id]);

  const precoNota = Number(valorFinal) || 0;

  // No orçamento, as notinhas mostram o valor final que ela digitou (com o lucro
  // recalculado em cima dele). Só vendo a conta, mostram a base da peça.
  const resultadoNota = useMemo(() => {
    if (!resultado) return null;
    if (!ehOrcamento) return resultado;
    return {
      ...resultado,
      precoVenda: precoNota,
      lucro: precoNota - resultado.custoTotal,
    };
  }, [resultado, ehOrcamento, precoNota]);

  // Memoizado porque NotinhaCliente redesenha o canvas toda vez que `dados`
  // muda de identidade — sem isto, um objeto novo a cada render viraria um
  // loop de repintura.
  const dadosOrcamento = useMemo(() => {
    if (!alvo || !resultadoNota) return null;
    return {
      ...montarOrcamento(alvo, resultadoNota, cores, empresa, new Date()),
      cliente: ehOrcamento ? nomeLimpo(cliente) : "",
    };
  }, [alvo, resultadoNota, cores, empresa, cliente, ehOrcamento]);

  const recentes = useMemo(
    () => clientes.slice(0, QUANTAS_PASTILHAS),
    [clientes]
  );

  const podeVender = nomeLimpo(cliente).length > 0 && precoNota > 0;

  async function registrarVenda(jaPagou: boolean) {
    if (!produto || !resultado || salvando) return;
    setSalvando(true);
    try {
      const clienteId = await acharOuCriarCliente(nomeLimpo(cliente));
      await criarVenda({
        produtoId: produto.id,
        produtoNome: produto.nome,
        clienteId,
        coresIds: coresParam
          ? coresParam.split(",").filter(Boolean)
          : produto.coresIds,
        // O valor final que ela digitou é o que fica congelado na venda — e é
        // ele que vira a base do próximo orçamento desta peça.
        preco: precoNota,
        custo: resultado.custoTotal,
        // "Sim, já recebi" cai direto no cofrinho; "Ainda não" fica em
        // "Falta receber" até ela marcar "Recebi!" lá.
        pagoEm: jaPagou ? Date.now() : null,
      });
      // Recebeu na hora? Vai pra Vendidos com confete. Se não, vai pra "Falta
      // receber", que é onde a venda esperando pagamento mora agora.
      router.push(
        jaPagou ? "/fabrica?aba=vendidos&festa=1" : "/fabrica?aba=falta"
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

  if (!resultado || !resultadoNota || !produto || !config || !alvo) {
    return <Carregando />;
  }

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

      {/* No orçamento, primeiro ela diz pra quem é e por quanto — os dois
          mudam a notinha ao vivo. */}
      {ehOrcamento && (
        <div className="mx-auto mb-8 max-w-md space-y-6">
          {ehNovo && (
            <div className="animate-pop rounded-2xl border-2 border-neon/40 bg-neon/10 p-4 text-center">
              <p className="display text-lg font-bold text-tinta">
                {produto.nome} entrou na fábrica!
              </p>
              <p className="mt-0.5 font-bold text-mute">
                Já quer fazer o primeiro orçamento?
              </p>
            </div>
          )}
          <div>
            <h2 className="display mb-3 text-xl font-bold text-tinta">
              Pra quem é?
            </h2>
            <input
              autoFocus={!clienteParam}
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              maxLength={24}
              placeholder="Ex: Maria"
              className="w-full rounded-2xl border-2 border-borda bg-painel2 p-4 text-xl font-bold text-tinta outline-none focus:border-neon"
            />
            {recentes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {recentes.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCliente(c.nome)}
                    className="btn-escuro min-h-[48px] rounded-full px-4 text-base font-bold"
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <PrecoVendido
            custoTotal={resultado.custoTotal}
            precoSugerido={resultado.precoVenda}
            valor={valorFinal}
            onChange={setValorFinal}
          />
        </div>
      )}

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
            resultado={resultadoNota}
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

      {ehOrcamento && (
        <div className="mt-10">
          <p className="mb-3 text-center text-base font-extrabold text-mute">
            {nomeLimpo(cliente)
              ? `E aí, ${nomeLimpo(cliente)} vai levar?`
              : "Fechou a venda?"}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button
              onClick={() => setPerguntandoPagou(true)}
              disabled={salvando || !podeVender}
              className="btn-grande btn-neon flex-1 disabled:opacity-60"
            >
              Vendido
            </button>
            <button
              onClick={() => router.push("/fabrica")}
              disabled={salvando}
              className="btn-grande btn-escuro flex-1 disabled:opacity-60"
            >
              Apenas orçamento
            </button>
          </div>
          <p className="mt-3 text-center font-bold text-mute">
            {!podeVender
              ? nomeLimpo(cliente).length === 0
                ? "Escreve pra quem é pra marcar como vendido."
                : "Põe o valor final pra marcar como vendido."
              : "Se vendeu, dá pra marcar quando o dinheiro chegar."}
          </p>
        </div>
      )}

      {perguntandoPagou && (
        <Dialogo
          icone={<IconeMoeda size={26} />}
          titulo="Já te pagou?"
          texto={`${nomeLimpo(cliente)} já colocou o dinheiro na sua mão?`}
          confirmar="Sim, já recebi! 🎉"
          secundario="Ainda não"
          onConfirmar={() => registrarVenda(true)}
          onSecundario={() => registrarVenda(false)}
          onFechar={() => setPerguntandoPagou(false)}
        />
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
