"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { lerConfig, lerCores, criarProduto, SemAssinaturaError } from "@/lib/db";
import { CORES_PADRAO } from "@/lib/defaults";
import { calcular, taxasDaConfig, horasDecimais, travarMargem } from "@/lib/calc";
import { precoMedioPorGrama } from "@/lib/calc-produto";
import { novoId } from "@/lib/format";
import type { Config, Cor, Produto, Unidade } from "@/lib/types";
import PrecoVendido from "@/components/PrecoVendido";
import Valor from "@/components/Valor";
import Carretel from "@/components/Carretel";
import Dialogo from "@/components/Dialogo";
import {
  IconeCadeado,
  IconeEtiqueta,
  IconeMoeda,
  IconeRelogio,
  IconeVoltar,
} from "@/components/Icones";

const TOTAL_PASSOS = 4;

export default function NovoProduto() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [cores, setCores] = useState<Cor[]>(CORES_PADRAO);

  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState("");

  // Dados do produto sendo montado
  const [nome, setNome] = useState("");
  const [coresIds, setCoresIds] = useState<string[]>([]);
  const [gramas, setGramas] = useState(""); // peso TOTAL, na unidade escolhida
  const [unidade, setUnidade] = useState<Unidade>("g");
  const [horas, setHoras] = useState(0);
  const [minutos, setMinutos] = useState(0);
  const [precoVendido, setPrecoVendido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [trancada, setTrancada] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cfg, cs] = await Promise.all([lerConfig(), lerCores()]);
        if (!vivo) return;
        setConfig(cfg);
        setCores(cs);
      } catch (e) {
        console.error(e);
        if (vivo) setErro("Não consegui carregar seus dados");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /** Converte o valor digitado (na unidade atual) para gramas. */
  function paraGramas(valor: number): number {
    return unidade === "kg" ? valor * 1000 : valor;
  }

  const precoMedio = useMemo(
    () => precoMedioPorGrama(coresIds, cores),
    [coresIds, cores]
  );

  // Cálculo em tempo real com o que já temos.
  const resultado = useMemo(() => {
    if (!config) return null;
    const { custoEnergiaPorHora, desgastePorHora } = taxasDaConfig(config);
    return calcular({
      materiais: [
        { gramas: paraGramas(Number(gramas) || 0), precoPorGrama: precoMedio },
      ],
      horasDecimais: horasDecimais(horas, minutos),
      custoEnergiaPorHora,
      desgastePorHora,
      extras: config.custoEmbalagem,
      taxaFalhas: config.taxaFalhas,
      margem: config.margemPadrao, // preço sugerido usa a margem padrão
      taxaMarketplace: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, precoMedio, gramas, unidade, horas, minutos]);

  function toggleCor(id: string) {
    setCoresIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function trocarUnidade(u: Unidade) {
    if (u === unidade) return;
    const atual = Number(gramas);
    if (atual > 0) {
      const fator = u === "kg" ? 1 / 1000 : 1000;
      setGramas(String(Math.round(atual * fator * 1000) / 1000));
    }
    setUnidade(u);
  }

  function validarPasso(): boolean {
    setErro("");
    if (passo === 0 && nome.trim().length === 0) {
      setErro("Ops! Dá um nome pro seu produto");
      return false;
    }
    if (passo === 1) {
      if (coresIds.length === 0) {
        setErro("Escolhe pelo menos uma cor!");
        return false;
      }
      if (!(Number(gramas) > 0)) {
        setErro("Ops! Esqueceu o peso");
        return false;
      }
    }
    if (passo === 2 && horas === 0 && minutos === 0) {
      setErro("Quanto tempo a impressora trabalhou?");
      return false;
    }
    return true;
  }

  function avancar() {
    if (!validarPasso()) return;
    if (passo >= TOTAL_PASSOS - 1) return;
    const proximo = passo + 1;
    // Ao chegar no final, já deixa o preço sugerido preenchido.
    if (proximo === TOTAL_PASSOS - 1 && resultado) {
      setPrecoVendido(String(resultado.precoVenda));
    }
    setPasso(proximo);
  }
  function voltar() {
    setErro("");
    if (passo === 0) router.push("/fabrica");
    else setPasso((p) => p - 1);
  }

  async function salvar() {
    if (!config || salvando) return;
    const preco = Number(precoVendido) || 0;
    if (preco <= 0) {
      setErro("Põe por quanto você vendeu!");
      return;
    }
    const produto: Produto = {
      id: novoId(),
      nome: nome.trim(),
      coresIds,
      gramas: paraGramas(Number(gramas) || 0),
      unidade,
      horas,
      minutos,
      margem: config.margemPadrao,
      precoVenda: preco,
      criadoEm: Date.now(),
      vendidos: 0,
    };
    setSalvando(true);
    try {
      await criarProduto(produto);
      router.push(`/resultado?id=${produto.id}&novo=1`);
    } catch (e) {
      console.error(e);
      setSalvando(false);
      // Sem assinatura o banco recusa o INSERT. Culpar a internet aqui manda a
      // criança conferir o wi-fi por um problema que é de pagamento.
      if (e instanceof SemAssinaturaError) {
        setTrancada(true);
        return;
      }
      setErro("Não consegui salvar. Confere a internet e tenta de novo!");
    }
  }

  const progresso = ((passo + 1) / TOTAL_PASSOS) * 100;

  return (
    <main className="mx-auto w-full max-w-xl">
      {/* Progresso: camadas sendo impressas */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={voltar}
          aria-label="Voltar"
          className="btn-escuro flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        >
          <IconeVoltar size={22} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {Array.from({ length: TOTAL_PASSOS }).map((_, i) => (
            <div
              key={i}
              className={`h-3.5 flex-1 rounded-sm transition-colors duration-300 ${
                i <= passo ? "bg-neon" : "border border-borda bg-painel2"
              }`}
            />
          ))}
        </div>
        <span className="display shrink-0 text-sm font-bold text-mute">
          camada {passo + 1}/{TOTAL_PASSOS}
        </span>
      </div>

      <div key={passo} className="animate-pop">
        {/* PASSO 1 — Nome */}
        {passo === 0 && (
          <Passo
            pergunta="Qual é o nome do seu produto?"
            icone={<IconeEtiqueta size={30} />}
          >
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Chaveiro de dinossauro 🦖"
              className="w-full rounded-2xl border-2 border-borda bg-painel2 p-5 text-2xl font-bold text-tinta outline-none focus:border-neon"
            />
          </Passo>
        )}

        {/* PASSO 2 — Cores + peso total */}
        {passo === 1 && (
          <Passo
            pergunta="Quais cores você usou?"
            icone={<Carretel cor="#22d3ee" size={32} />}
          >
            <p className="mb-4 text-center font-bold text-mute">
              Toque em uma ou em várias — o que você misturou!
            </p>

            {/* Carretéis de filamento (pode escolher vários) */}
            <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {cores.map((c) => {
                const ativo = coresIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCor(c.id)}
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

            {/* Avisinho quando misturou cores */}
            {coresIds.length >= 2 && (
              <p className="mb-4 animate-pop rounded-2xl border border-ciano/30 bg-ciano/10 p-3 text-center font-bold text-ciano">
                Você misturou {coresIds.length} cores! Vou usar o preço médio
                delas.
              </p>
            )}

            {/* Peso TOTAL da peça */}
            <div className="card">
              <p className="display mb-3 text-center text-lg font-bold text-tinta">
                Quanto pesou {coresIds.length >= 2 ? "tudo junto" : "a peça"}?
              </p>
              <div className="flex items-center justify-center gap-3">
                <input
                  type="number"
                  inputMode="decimal"
                  value={gramas}
                  onChange={(e) => setGramas(e.target.value)}
                  placeholder="0"
                  className="display w-full min-w-0 flex-1 rounded-2xl border-2 border-borda bg-painel2 p-4 text-center text-4xl font-bold text-tinta outline-none focus:border-neon sm:max-w-[13rem]"
                />
                <UnidadeToggle unidade={unidade} onTrocar={trocarUnidade} />
              </div>
              <p className="mt-3 text-center text-sm font-bold text-mute">
                (Está escrito no seu slicer!)
              </p>
            </div>
          </Passo>
        )}

        {/* PASSO 3 — Tempo */}
        {passo === 2 && (
          <Passo
            pergunta="Quanto tempo demorou?"
            icone={<IconeRelogio size={30} />}
          >
            <div className="flex justify-center gap-4">
              <Stepper
                titulo="horas"
                valor={horas}
                onMenos={() => setHoras((h) => Math.max(0, h - 1))}
                onMais={() => setHoras((h) => h + 1)}
              />
              <Stepper
                titulo="minutos"
                valor={minutos}
                onMenos={() => setMinutos((m) => Math.max(0, m - 15))}
                onMais={() => setMinutos((m) => (m >= 45 ? 0 : m + 15))}
              />
            </div>
            <p className="mt-4 text-center font-bold text-mute">
              (Está escrito no seu slicer!)
            </p>
          </Passo>
        )}

        {/* PASSO 4 — Custo, preço indicado e o preço que realmente vendeu */}
        {passo === 3 && resultado && config && (
          <Passo pergunta="Quanto ficou?" icone={<IconeMoeda size={30} />}>
            {/* 1. Quanto custou pra fazer */}
            <div className="caixa-valor rounded-xl border border-borda bg-painel2 p-4 text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-mute">
                custo pra fabricar
              </p>
              <Valor
                valor={resultado.custoTotal}
                max="1.875rem"
                min="1.25rem"
                folga="36px"
                className="mt-0.5 block font-bold text-tinta"
              />
            </div>

            {/* 2. O preço que a calculadora indica — o destaque da tela */}
            <div className="caixa-valor mt-3 rounded-xl border-2 border-neon/40 bg-neon/10 p-4 text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-mute">
                preço indicado
              </p>
              <Valor
                valor={resultado.precoVenda}
                max="2.75rem"
                min="1.5rem"
                folga="38px"
                className="mt-0.5 block font-bold text-neon"
              />
              {/* a margem travada é a que o cálculo usou de verdade — o valor
                  cru da config podia dizer 10% e o preço acima mostrar 15% */}
              <p className="mt-1 text-sm font-bold text-mute">
                o custo + {Math.round(travarMargem(config.margemPadrao) * 100)}%
                de lucro pra você
              </p>
            </div>

            {/* 3. E, se quiser, o preço que ela vendeu de verdade */}
            <div className="mt-3">
              <PrecoVendido
                custoTotal={resultado.custoTotal}
                precoSugerido={resultado.precoVenda}
                valor={precoVendido}
                onChange={(v) => {
                  setPrecoVendido(v);
                  setErro("");
                }}
              />
            </div>
          </Passo>
        )}
      </div>

      {/* Mensagem de erro amigável */}
      {erro && (
        <p className="mt-4 animate-pop rounded-2xl border border-perigo/40 bg-perigo/15 p-3 text-center text-lg font-extrabold text-perigo">
          {erro}
        </p>
      )}

      {/* Botão avançar / salvar */}
      <div className="mt-6">
        {passo < TOTAL_PASSOS - 1 ? (
          <button
            onClick={avancar}
            className="btn-grande btn-neon flex w-full items-center justify-center gap-2 text-xl"
          >
            Continuar
          </button>
        ) : (
          <button
            onClick={salvar}
            disabled={salvando}
            className="btn-grande btn-neon flex w-full items-center justify-center gap-2 text-2xl disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar produto"}
          </button>
        )}
      </div>

      {trancada && (
        <Dialogo
          icone={<IconeCadeado size={26} />}
          titulo="A fábrica ainda está trancada"
          texto="Seu produto não foi salvo porque a assinatura ainda não está ativa. É só assinar que a fábrica liga!"
          confirmar="Quero assinar"
          cancelar="Agora não"
          onConfirmar={() => router.push("/planos")}
          onFechar={() => setTrancada(false)}
        />
      )}
    </main>
  );
}

/* ---------- Componentes auxiliares do wizard ---------- */

function Passo({
  pergunta,
  icone,
  children,
}: {
  pergunta: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="display mb-6 text-center text-2xl font-bold leading-tight text-tinta">
        <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-borda bg-painel2 text-ciano">
          {icone}
        </span>
        {pergunta}
      </h2>
      {children}
    </div>
  );
}

function UnidadeToggle({
  unidade,
  onTrocar,
}: {
  unidade: Unidade;
  onTrocar: (u: Unidade) => void;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-2xl border border-borda bg-painel2 p-1">
      {(["g", "kg"] as Unidade[]).map((u) => (
        <button
          key={u}
          onClick={() => onTrocar(u)}
          className={`rounded-xl px-4 py-3 text-lg font-extrabold transition-colors ${
            unidade === u ? "bg-neon text-fundo" : "text-mute"
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  titulo,
  valor,
  onMenos,
  onMais,
}: {
  titulo: string;
  valor: number;
  onMenos: () => void;
  onMais: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onMais}
        aria-label={`Mais ${titulo}`}
        className="btn-neon flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-extrabold active:translate-y-0.5"
      >
        ＋
      </button>
      <div className="w-28 rounded-2xl border border-borda bg-painel2 py-3 text-center">
        <span className="display text-4xl font-bold text-tinta">{valor}</span>
        <span className="block text-sm font-bold text-mute">{titulo}</span>
      </div>
      <button
        onClick={onMenos}
        aria-label={`Menos ${titulo}`}
        className="btn-escuro flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-extrabold active:translate-y-0.5"
      >
        －
      </button>
    </div>
  );
}
