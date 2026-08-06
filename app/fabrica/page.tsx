"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as db from "@/lib/db";
import { renomearCliente } from "@/lib/db";
import { calcularProduto, acharCor } from "@/lib/calc-produto";
import { ehVenda, recebido, vendasDaPeca, rotuloVendidos } from "@/lib/vendas";
import type {
  Cliente,
  Config,
  Cor,
  Destino,
  Produto,
  ResultadoCalculo,
  Venda,
} from "@/lib/types";
import { CORES_PADRAO, EMPRESA_PADRAO } from "@/lib/defaults";
import Confete from "@/components/Confete";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import Dialogo from "@/components/Dialogo";
import ListaVendidos from "@/components/ListaVendidos";
import ListaFizParaMim from "@/components/ListaFizParaMim";
import EspecificacoesProduto from "@/components/EspecificacoesProduto";
import { Logo, ImpressoraIlustracao } from "@/components/Marca";
import {
  IconeAlerta,
  IconeCoracao,
  IconeEngrenagem,
  IconeEtiqueta,
  IconeLixeira,
  IconeLupa,
  IconeMais,
  IconeMoeda,
  IconeUsuario,
} from "@/components/Icones";

type Aba = "catalogo" | "vendidos" | "falta" | "mim";

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
  // Renomear um produto direto no card do catálogo (só o nome).
  const [renomeandoProduto, setRenomeandoProduto] = useState<Produto | null>(
    null
  );
  const [nomeProduto, setNomeProduto] = useState("");
  const [vendoUnidadesDe, setVendoUnidadesDe] = useState<Produto | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [vendasCarregou, setVendasCarregou] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nomeando, setNomeando] = useState<Venda | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  // Menu "Editar" da venda (voltar pra não pago / apagar) e a confirmação de
  // apagar em si — a exclusão some do cofrinho pra sempre, então pergunta antes.
  const [editando, setEditando] = useState<Venda | null>(null);
  const [nomeProdutoVenda, setNomeProdutoVenda] = useState("");
  const [apagandoVenda, setApagandoVenda] = useState<Venda | null>(null);
  // Mensagem visível quando migrarVendasAntigas falha — console.error sozinho
  // deixaria o cofrinho parecendo zerado sem explicar por quê (ver efeito
  // de migração abaixo).
  const [avisoMigracao, setAvisoMigracao] = useState("");
  // Registrar "fiz uma sem vender" direto do card do catálogo. `passoGraca`
  // troca o diálogo pro campo de nome quando ela escolhe "dei de graça".
  const [fazendoSemVender, setFazendoSemVender] = useState<{
    produto: Produto;
    resultado: ResultadoCalculo;
  } | null>(null);
  const [passoGraca, setPassoGraca] = useState(false);
  const [nomeGraca, setNomeGraca] = useState("");

  function fecharSemVender() {
    setFazendoSemVender(null);
    setPassoGraca(false);
    setNomeGraca("");
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const abaQuery = q.get("aba");
    if (abaQuery === "vendidos") setAba("vendidos");
    if (abaQuery === "falta") setAba("falta");
    if (abaQuery === "mim") setAba("mim");
    // Veio de "Vendido → já recebi": comemora com o mesmo confete do "Recebi!".
    if (q.get("festa") === "1") {
      setFesta(true);
      setTimeout(() => setFesta(false), 1600);
    }
  }, []);

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

  // Tentou migrar nesta montagem da tela? Um ref, não estado: `produtos` ganha
  // identidade nova sempre que um produto é apagado, o que dispara este efeito
  // de novo. Sem essa trava, uma exclusão durante a primeira migração ainda em
  // andamento dispararia uma SEGUNDA chamada concorrente — e quem perdesse a
  // corrida da marca cairia no catch mesmo a migração tendo dado certo. Tem
  // que ser ref (não useState) porque o estado não teria comitado ainda
  // quando a segunda chamada começasse.
  const jaTentouMigrar = useRef(false);

  // Migra o contador antigo ANTES de mostrar a aba, senão a primeira
  // renderização apareceria com a lista vazia e o cofrinho zerado.
  useEffect(() => {
    if (!carregou || !config) return;
    if (jaTentouMigrar.current) return;
    jaTentouMigrar.current = true;
    let vivo = true;
    (async () => {
      try {
        await db.migrarVendasAntigas(produtos, config, cores);
        const [vs, cls] = await Promise.all([db.lerVendas(), db.lerClientes()]);
        if (!vivo) return;
        setVendas(vs);
        setClientes(cls);
      } catch (e) {
        if (!vivo) return;
        // `vendas` exige assinatura ativa pra inserir; `migracoes` não. Se a
        // assinatura caducou bem nessa hora, a migração é recusada pelo banco
        // e estoura aqui — SEM gravar marca (ver migrarVendasAntigas), então
        // o histórico velho continua intacto e ela pode tentar de novo. Mas
        // um console.error sozinho deixaria a tela mostrando lista vazia e
        // cofrinho zerado, sem avisar nada: a aba antiga que mostrava o
        // contador acabou de sumir nesta mesma tarefa, então esconder o erro
        // aqui apagaria o histórico dela da tela sem explicação nenhuma.
        console.error(e);
        setAvisoMigracao(
          "Não sumiu nada! As vendas de antes só não carregaram ainda. Sai dessa tela e entra de novo que a gente tenta outra vez."
        );
      } finally {
        // "Terminou de tentar" conta tanto sucesso quanto erro — senão a aba
        // Vendidos ficaria mostrando "carregando" pra sempre quando desse
        // errado, em vez de deixar o aviso da migração explicar.
        if (vivo) setVendasCarregou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [carregou, config, produtos, cores]);

  const calculos = useMemo(() => {
    if (!config) return [];
    return produtos.map((p) => ({
      produto: p,
      resultado: calcularProduto(p, config, cores),
    }));
  }, [produtos, config, cores]);

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

  // Renomear a peça no catálogo. O nome também é congelado nas vendas, então
  // troca nos dois lados na tela na hora — igual ao "arrumar esta venda".
  async function salvarNomeProduto() {
    const alvo = renomeandoProduto;
    const nome = nomeProduto.trim();
    if (!alvo || !nome) return;

    const produtosAnteriores = produtos;
    const vendasAnteriores = vendas;
    setRenomeandoProduto(null);
    setProdutos(produtos.map((p) => (p.id === alvo.id ? { ...p, nome } : p)));
    setVendas(
      vendas.map((v) =>
        v.produtoId === alvo.id ? { ...v, produtoNome: nome } : v
      )
    );
    try {
      await db.renomearProduto(alvo.id, nome);
    } catch (e) {
      setProdutos(produtosAnteriores);
      setVendas(vendasAnteriores);
      falhou(e);
    }
  }

  function receber(vendaId: string) {
    const anterior = vendas;
    setVendas(vendas.map((v) => (v.id === vendaId ? { ...v, pagoEm: Date.now() } : v)));
    setFesta(true);
    setTimeout(() => setFesta(false), 1600);
    db.marcarPago(vendaId).catch((e) => {
      setVendas(anterior);
      falhou(e);
    });
  }

  // Marcou "Recebi!" sem querer: a venda volta pra "falta pagar" (sem confete).
  function naoPagou(vendaId: string) {
    const anterior = vendas;
    setVendas(vendas.map((v) => (v.id === vendaId ? { ...v, pagoEm: null } : v)));
    db.marcarNaoPago(vendaId).catch((e) => {
      setVendas(anterior);
      falhou(e);
    });
  }

  // Apaga a venda de vez (foi só teste). Some da lista na hora; se o banco
  // recusar, ela volta pro lugar.
  function removerVenda(vendaId: string) {
    const anterior = vendas;
    setVendas(vendas.filter((v) => v.id !== vendaId));
    db.apagarVenda(vendaId).catch((e) => {
      setVendas(anterior);
      falhou(e);
    });
  }

  // Reclassifica um registro (venda ↔ pra mim ↔ de graça). Só troca de aba: o
  // preço, o custo e o "pago" congelados ficam intactos. Otimista, com desfazer.
  async function reclassificar(v: Venda, destino: Destino) {
    const anterior = vendas;
    setEditando(null);
    setVendas(vendas.map((x) => (x.id === v.id ? { ...x, destino } : x)));
    try {
      await db.mudarDestinoVenda(v.id, destino);
    } catch (e) {
      setVendas(anterior);
      falhou(e);
    }
  }

  // Registra uma unidade "pra mim" / "de graça" direto do card, sem orçamento —
  // congela o custo atual. "De graça" pode levar o nome de quem ganhou.
  async function registrarSemVenda(destino: "mim" | "graca", nome: string) {
    const alvo = fazendoSemVender;
    if (!alvo) return;
    const { produto, resultado } = alvo;
    fecharSemVender();
    try {
      const nomeLimpo = nome.trim();
      const clienteId =
        destino === "graca" && nomeLimpo
          ? await db.acharOuCriarCliente(nomeLimpo)
          : null;
      const nova = {
        produtoId: produto.id,
        produtoNome: produto.nome,
        clienteId,
        coresIds: [...produto.coresIds],
        preco: resultado.precoVenda,
        custo: resultado.custoTotal,
        // Pra mim / de graça já nascem quitadas (não têm pagamento).
        pagoEm: Date.now(),
        destino,
      };
      const id = await db.criarVenda(nova);
      setVendas((atual) => [{ ...nova, id, criadoEm: Date.now() }, ...atual]);
      // Só criou cliente novo no "de graça" com nome — recarrega a lista.
      if (clienteId) db.lerClientes().then(setClientes).catch(() => {});
      setFesta(true);
      setTimeout(() => setFesta(false), 1600);
    } catch (e) {
      falhou(e);
    }
  }

  async function salvarNomeProdutoVenda() {
    const alvo = editando;
    const nome = nomeProdutoVenda.trim();
    if (!alvo || !nome) return;

    const anterior = vendas;
    const produtosAnteriores = produtos;
    setEditando(null);
    setVendas(
      vendas.map((v) =>
        alvo.produtoId
          ? v.produtoId === alvo.produtoId
            ? { ...v, produtoNome: nome }
            : v
          : v.id === alvo.id
          ? { ...v, produtoNome: nome }
          : v
      )
    );
    if (alvo.produtoId) {
      setProdutos(
        produtos.map((p) =>
          p.id === alvo.produtoId ? { ...p, nome } : p
        )
      );
    }
    try {
      await db.renomearProdutoDaVenda(alvo.id, alvo.produtoId, nome);
    } catch (e) {
      setVendas(anterior);
      setProdutos(produtosAnteriores);
      falhou(e);
    }
  }

  async function salvarNome() {
    const alvo = nomeando;
    if (!alvo) return;
    setNomeando(null);
    try {
      if (alvo.clienteId === null) {
        // Venda sem cliente (ex: migração do contador antigo): está
        // ganhando um nome pela primeira vez, então gruda nela.
        const clienteId = await db.acharOuCriarCliente(nomeNovo);
        await db.definirClienteDaVenda(alvo.id, clienteId);
      } else {
        // Venda já tinha cliente: "Trocar o nome" corrige o cliente em si,
        // não troca pra outro — assim todas as vendas dele (que apontam
        // pro mesmo id) mudam de nome juntas.
        await renomearCliente(alvo.clienteId, nomeNovo);
      }
      const [vs, cls] = await Promise.all([db.lerVendas(), db.lerClientes()]);
      setVendas(vs);
      setClientes(cls);
    } catch (e) {
      // 23505 = já existe outra cliente com esse nome (índice único em
      // lower(nome)). Mensagem simples em vez de oferecer juntar as duas.
      if ((e as { code?: string })?.code === "23505") {
        setAviso("Você já tem uma cliente com esse nome!");
        return;
      }
      falhou(e);
    }
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
            <Carretel cor="#5B8DEF" size={24} />
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

      {/* Abas — quatro agora. Quatro numa linha só espremeria o rótulo no
          celular, então viram grade 2×2 (no desktop cabem lado a lado). */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["catalogo", "Meus produtos"],
            ["vendidos", "Vendidos"],
            ["falta", "Falta receber"],
            ["mim", "Fiz para mim"],
          ] as [Aba, string][]
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex min-h-[48px] items-center justify-center rounded-full px-1.5 text-center text-sm font-extrabold leading-tight ${
              aba === id ? "btn-neon" : "btn-escuro"
            }`}
          >
            {rotulo}
          </button>
        ))}
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

              {/* Empurrãozinho não bloqueante: os padrões funcionam, mas o preço
                  fica certo mesmo se ela ajustar a impressora e as cores dela
                  antes da primeira peça. Some sozinho quando existe produto. */}
              <p className="mt-5 text-sm font-bold text-mute">
                Antes de começar, deixa do seu jeito:
              </p>
              <div className="mt-2 flex w-full max-w-xs flex-col gap-2 sm:flex-row">
                <Link
                  href="/config"
                  className="btn-escuro flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-extrabold"
                >
                  <IconeEngrenagem size={18} /> Sua impressora
                </Link>
                <Link
                  href="/cores"
                  className="btn-escuro flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-extrabold"
                >
                  <Carretel cor="#5B8DEF" size={18} /> Suas cores
                </Link>
              </div>
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calculos.map(({ produto, resultado }) => {
              const vendasDesta = vendasDaPeca(vendas, produto.id);
              return (
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
                      <div className="flex shrink-0 items-center">
                        <button
                          onClick={() => {
                            setNomeProduto(produto.nome);
                            setRenomeandoProduto(produto);
                          }}
                          aria-label="Renomear produto"
                          className="rounded-lg p-1.5 text-mute hover:text-ciano active:scale-90"
                        >
                          <IconeEtiqueta size={18} />
                        </button>
                        <button
                          onClick={() => setApagando(produto)}
                          aria-label="Apagar produto"
                          className="rounded-lg p-1.5 text-mute hover:text-perigo active:scale-90"
                        >
                          <IconeLixeira size={18} />
                        </button>
                      </div>
                    </div>

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

                    {vendasDesta.length > 0 && (
                      <button
                        onClick={() => setVendoUnidadesDe(produto)}
                        className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-borda bg-painel2 px-3 py-2 active:translate-y-0.5"
                      >
                        <span className="text-sm font-extrabold text-tinta">
                          {rotuloVendidos(vendasDesta.length)}
                        </span>
                        <span className="text-sm font-bold text-ciano">
                          ver quem comprou ›
                        </span>
                      </button>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/resultado?id=${produto.id}`}
                        className="btn-escuro flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-extrabold"
                      >
                        <IconeLupa size={16} /> A conta
                      </Link>
                      <button
                        onClick={() =>
                          router.push(
                            `/resultado?id=${produto.id}&cores=${produto.coresIds.join(
                              ","
                            )}`
                          )
                        }
                        className="btn-grande btn-neon min-h-[48px] flex-1 text-base"
                      >
                        Fazer orçamento
                      </button>
                    </div>

                    {/* Atalho: registrar uma unidade pra si / de graça sem
                        passar pelo orçamento. Quieto, pra não roubar o CTA. */}
                    <button
                      onClick={() =>
                        setFazendoSemVender({ produto, resultado })
                      }
                      className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg text-sm font-bold text-mute hover:text-ciano active:translate-y-0.5"
                    >
                      <IconeCoracao size={15} /> fiz uma sem vender ›
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )
      ) : !vendasCarregou ? (
        /* ---------- ABA: VENDIDOS (ainda carregando) ---------- */
        // Sem isto, quem acabou de vender é jogada de volta pra esta aba e vê
        // por um instante "Ainda não vendeu nada" — a lista de vendas some
        // no mount, mas ainda não voltou do banco. Mostrar "carregando" em
        // vez do vazio evita esse susto falso.
        <div className="card flex flex-col items-center py-8 text-center">
          <Logo size={54} className="animate-wiggle" />
          <p className="mt-3 font-extrabold text-mute">Contando suas vendas...</p>
        </div>
      ) : aba === "mim" ? (
        /* ---------- ABA: FIZ PARA MIM ---------- */
        <ListaFizParaMim
          vendas={vendas}
          clientes={clientes}
          cores={cores}
          onEditar={(v) => {
            setEditando(v);
            setNomeProdutoVenda(v.produtoNome);
          }}
        />
      ) : (
        /* ---------- ABA: VENDIDOS / FALTA RECEBER ---------- */
        <ListaVendidos
          vendas={vendas}
          clientes={clientes}
          cores={cores}
          empresa={empresa}
          modo={aba === "vendidos" ? "pagas" : "pendentes"}
          onReceber={receber}
          onNomear={(v) => {
            setNomeando(v);
            setNomeNovo(clientes.find((c) => c.id === v.clienteId)?.nome ?? "");
          }}
          onEditar={(v) => {
            setEditando(v);
            setNomeProdutoVenda(v.produtoNome);
          }}
        />
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

      {renomeandoProduto && (
        <Dialogo
          icone={<IconeEtiqueta size={26} />}
          titulo="Novo nome do produto"
          texto="O novo nome também aparece nas vendas dele."
          dispensar="Deixa quieto"
          onFechar={() => setRenomeandoProduto(null)}
        >
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={nomeProduto}
              onChange={(e) => setNomeProduto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvarNomeProduto()}
              maxLength={40}
              placeholder={renomeandoProduto.nome}
              className="w-full rounded-xl border-2 border-borda bg-painel2 p-3 text-lg font-bold text-tinta outline-none focus:border-neon"
            />
            <button
              onClick={salvarNomeProduto}
              disabled={!nomeProduto.trim()}
              className="btn-grande btn-neon w-full disabled:opacity-40"
            >
              Salvar nome
            </button>
          </div>
        </Dialogo>
      )}

      {/* Janelinha só de ver: as unidades vendidas daquela peça. Receber e
          trocar nome continuam nas abas de venda, não aqui. */}
      {vendoUnidadesDe && (
        <Dialogo
          icone={<IconeMoeda size={26} />}
          titulo={`${vendoUnidadesDe.nome} — ${rotuloVendidos(
            vendasDaPeca(vendas, vendoUnidadesDe.id).length
          )}`}
          onFechar={() => setVendoUnidadesDe(null)}
        >
          <EspecificacoesProduto
            vendas={vendasDaPeca(vendas, vendoUnidadesDe.id)}
            clientes={clientes}
            cores={cores}
            onVenderDeNovo={(v) => {
              const nome =
                clientes.find((c) => c.id === v.clienteId)?.nome ?? "";
              const busca = new URLSearchParams({
                id: v.produtoId ?? "",
                cores: v.coresIds.join(","),
                // repete=1 abre a nota no modo "repetir a última venda": resumo
                // + "Mudou algo?" em vez dos editores todos abertos.
                repete: "1",
              });
              // Sem cliente (ex.: venda migrada do contador antigo) a nota abre
              // com o campo de nome vazio — cores prontas, nome ela preenche.
              if (nome) busca.set("cliente", nome);
              router.push(`/resultado?${busca.toString()}`);
            }}
          />
        </Dialogo>
      )}

      {aviso && (
        <Dialogo
          tom="perigo"
          titulo="Não consegui salvar"
          texto={aviso}
          onFechar={() => setAviso("")}
        />
      )}

      {avisoMigracao && (
        <Dialogo
          tom="perigo"
          titulo="Vendas antigas ainda não chegaram"
          texto={avisoMigracao}
          onFechar={() => setAvisoMigracao("")}
        />
      )}

      {nomeando && (
        <Dialogo
          titulo="Quem comprou?"
          confirmar="Salvar"
          cancelar="Deixa quieto"
          onConfirmar={salvarNome}
          onFechar={() => setNomeando(null)}
        >
          <input
            autoFocus
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            maxLength={24}
            placeholder="Ex: Maria"
            className="w-full rounded-xl border-2 border-borda bg-painel2 p-3 text-center text-lg font-bold text-tinta outline-none focus:border-neon"
          />
        </Dialogo>
      )}

      {/* O nome acompanha o produto do catálogo e as outras vendas dele. */}
      {editando && (
        <Dialogo
          icone={<IconeEngrenagem size={26} />}
          titulo={ehVenda(editando) ? "Arrumar esta venda" : "Arrumar este registro"}
          texto="O novo nome também aparece em Meus produtos."
          dispensar="Deixa quieto"
          onFechar={() => setEditando(null)}
        >
          <div className="flex flex-col gap-2">
            <label className="text-left text-sm font-extrabold text-mute">
              Nome do produto
              <input
                autoFocus
                value={nomeProdutoVenda}
                onChange={(e) => setNomeProdutoVenda(e.target.value)}
                maxLength={40}
                className="mt-1 w-full rounded-xl border-2 border-borda bg-painel2 p-3 text-lg font-bold text-tinta outline-none focus:border-neon"
              />
            </label>
            <button
              onClick={salvarNomeProdutoVenda}
              disabled={!nomeProdutoVenda.trim()}
              className="btn-grande btn-neon w-full disabled:opacity-40"
            >
              Salvar nome
            </button>

            {/* Reclassificar: os dois OUTROS destinos, pra corrigir um registro
                que ficou no lugar errado (a venda antiga que foi pra si mesma,
                ou o "pra mim" que na verdade foi vendido). Sempre reversível. */}
            <div className="mt-1 border-t border-borda pt-2">
              <p className="mb-1 text-left text-sm font-extrabold text-mute">
                Isso foi, na verdade…
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["venda", "Foi uma venda", <IconeMoeda key="v" size={18} />],
                    ["mim", "Foi pra mim", <IconeUsuario key="m" size={18} />],
                    ["graca", "Dei de graça", <IconeCoracao key="g" size={18} />],
                  ] as [Destino, string, React.ReactNode][]
                )
                  .filter(([d]) => d !== editando.destino)
                  .map(([d, rotulo, icone]) => (
                    <button
                      key={d}
                      onClick={() => reclassificar(editando, d)}
                      className="btn-grande btn-escuro flex w-full items-center justify-center gap-2"
                    >
                      {icone} {rotulo}
                    </button>
                  ))}
              </div>
            </div>

            {ehVenda(editando) && recebido(editando) && (
              <button
                onClick={() => {
                  naoPagou(editando.id);
                  setEditando(null);
                }}
                className="btn-grande btn-escuro w-full"
              >
                Ainda não me pagou
              </button>
            )}
            <button
              onClick={() => {
                const v = editando;
                setEditando(null);
                setApagandoVenda(v);
              }}
              className="btn-grande btn-perigo w-full"
            >
              Apagar este pedido
            </button>
          </div>
        </Dialogo>
      )}

      {/* Card do catálogo: registrar uma unidade sem vender. Passo 1 escolhe
          pra mim / de graça; "de graça" abre o campo de nome (opcional). */}
      {fazendoSemVender && (
        <Dialogo
          icone={<IconeCoracao size={26} />}
          titulo={`${fazendoSemVender.produto.nome} — sem vender`}
          texto={
            passoGraca
              ? "Pra quem você deu? (pode deixar em branco)"
              : "Essa unidade foi feita pra quê?"
          }
          dispensar="Deixa quieto"
          onFechar={fecharSemVender}
        >
          {passoGraca ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={nomeGraca}
                onChange={(e) => setNomeGraca(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && registrarSemVenda("graca", nomeGraca)
                }
                maxLength={24}
                placeholder="Pra quem? (opcional)"
                className="w-full rounded-xl border-2 border-borda bg-painel2 p-3 text-center text-lg font-bold text-tinta outline-none focus:border-neon"
              />
              <button
                onClick={() => registrarSemVenda("graca", nomeGraca)}
                className="btn-grande btn-neon w-full"
              >
                Registrar de graça
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => registrarSemVenda("mim", "")}
                className="btn-grande btn-escuro flex w-full items-center justify-center gap-2"
              >
                <IconeUsuario size={20} /> É pra mim mesma
              </button>
              <button
                onClick={() => setPassoGraca(true)}
                className="btn-grande btn-escuro flex w-full items-center justify-center gap-2"
              >
                <IconeCoracao size={20} /> Dei de graça
              </button>
            </div>
          )}
        </Dialogo>
      )}

      {apagandoVenda && (
        <Dialogo
          tom="perigo"
          icone={<IconeLixeira size={26} />}
          titulo="Apagar esta venda?"
          texto="Ela some do cofrinho pra sempre."
          confirmar="Sim, apagar"
          cancelar="Não, deixa"
          onConfirmar={() => removerVenda(apagandoVenda.id)}
          onFechar={() => setApagandoVenda(null)}
        />
      )}
    </main>
  );
}
