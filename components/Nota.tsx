"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calcularProduto, acharCor } from "@/lib/calc-produto";
import { precoBaseDaVenda } from "@/lib/vendas";
import { nomeLimpo } from "@/lib/clientes";
import { brl } from "@/lib/format";
import { montarOrcamento } from "@/lib/orcamento";
import type { Cliente, Config, Cor, Produto, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import PrecoVendido from "@/components/PrecoVendido";
import NotinhaInterna from "@/components/NotinhaInterna";
import NotinhaCliente from "@/components/NotinhaCliente";
import Dialogo from "@/components/Dialogo";
import { IconeMoeda } from "@/components/Icones";

/** Quantas pastilhas de cliente recente cabem sem virar parede de botão. */
const QUANTAS_PASTILHAS = 6;

/** O que o pai precisa pra gravar a venda (ele resolve cliente e persiste). */
export type DadosVenda = {
  coresIds: string[];
  produtoNome: string;
  preco: number;
  custo: number;
  cliente: string;
  jaPagou: boolean;
};

/**
 * A nota: o bloco de fechar uma venda (por quanto vai vender + as duas notinhas
 * + Vendido/Só orçamento + o cliente) OU, em `somenteLeitura`, só as duas
 * notinhas pra ver a conta. Não sabe gravar nem navegar — emite `onVender` /
 * `onSoOrcamento` e o pai (a /novo ou a /resultado) cuida do banco e da rota.
 */
export default function Nota({
  produto,
  config,
  cores,
  empresa,
  vendas,
  clientes,
  coresIniciais,
  clienteInicial,
  ehNovo = false,
  ehRepete = false,
  somenteLeitura = false,
  permiteMudarCor = true,
  salvando = false,
  onVender,
  onSoOrcamento,
}: {
  produto: Produto;
  config: Config;
  cores: Cor[];
  empresa: string;
  vendas: Venda[];
  clientes: Cliente[];
  coresIniciais: string[];
  clienteInicial: string;
  ehNovo?: boolean;
  ehRepete?: boolean;
  somenteLeitura?: boolean;
  /** Falso na /novo: as cores já foram escolhidas no wizard, não repete aqui. */
  permiteMudarCor?: boolean;
  salvando?: boolean;
  onVender?: (dados: DadosVenda) => void;
  onSoOrcamento?: () => void;
}) {
  const ehOrcamento = !somenteLeitura;

  const [coresIds, setCoresIds] = useState<string[]>(() => coresIniciais);
  const [valorFinal, setValorFinal] = useState("");
  const [cliente, setCliente] = useState(clienteInicial);
  // Ela apertou "Vendido": revela o passo do cliente.
  const [vendendo, setVendendo] = useState(false);
  // Modo repete: os editores começam escondidos; "Mudou algo?" liga.
  const [mudouAlgo, setMudouAlgo] = useState(false);
  // Nome DESTA venda — no repete vira variação sem renomear a peça.
  const [nomeVenda, setNomeVenda] = useState(produto.nome);
  const [perguntandoPagou, setPerguntandoPagou] = useState(false);

  const editando = !ehRepete || mudouAlgo;

  // A peça como está sendo vendida DESTA VEZ (cores podem diferir das da peça).
  const alvo = useMemo(
    () => (ehOrcamento ? { ...produto, coresIds } : produto),
    [ehOrcamento, produto, coresIds]
  );

  const resultado = useMemo(
    () => calcularProduto(alvo, config, cores),
    [alvo, config, cores]
  );

  // Base do valor final: última venda dessa peça, ou o sugerido. Uma vez só.
  const baseDefinida = useRef(false);
  useEffect(() => {
    if (baseDefinida.current || somenteLeitura) return;
    baseDefinida.current = true;
    setValorFinal(
      String(precoBaseDaVenda(vendas, produto.id, resultado.precoVenda))
    );
  }, [somenteLeitura, vendas, produto.id, resultado.precoVenda]);

  const precoNota = Number(valorFinal) || 0;

  // No orçamento, as notinhas mostram o valor final digitado (com o lucro
  // recalculado em cima). Só vendo a conta, mostram a base da peça.
  const resultadoNota = useMemo(() => {
    if (!ehOrcamento) return resultado;
    return {
      ...resultado,
      precoVenda: precoNota,
      lucro: precoNota - resultado.custoTotal,
    };
  }, [resultado, ehOrcamento, precoNota]);

  const dadosOrcamento = useMemo(
    () => ({
      ...montarOrcamento(alvo, resultadoNota, cores, empresa, new Date()),
      cliente: ehOrcamento ? nomeLimpo(cliente) : "",
    }),
    [alvo, resultadoNota, cores, empresa, cliente, ehOrcamento]
  );

  const recentes = useMemo(
    () => clientes.slice(0, QUANTAS_PASTILHAS),
    [clientes]
  );

  function alternarCor(id: string) {
    setCoresIds((atual) =>
      atual.includes(id) ? atual.filter((c) => c !== id) : [...atual, id]
    );
  }

  // Pra começar a venda (revelar o cliente) basta ter cor e valor. O nome do
  // cliente é exigido só no passo seguinte, na hora de confirmar.
  const podeIniciar = coresIds.length > 0 && precoNota > 0;

  function confirmarVenda(jaPagou: boolean) {
    setPerguntandoPagou(false);
    onVender?.({
      coresIds,
      produtoNome: ehRepete ? nomeVenda.trim() || produto.nome : produto.nome,
      preco: precoNota,
      custo: resultado.custoTotal,
      cliente: nomeLimpo(cliente),
      jaPagou,
    });
  }

  return (
    <>
      {ehOrcamento && (
        <div className="mx-auto mb-8 max-w-md space-y-6">
          {ehNovo && (
            <div className="animate-pop rounded-2xl border-2 border-neon/40 bg-neon/10 p-4 text-center">
              <p className="display text-lg font-bold text-tinta">
                {produto.nome} entrou na fábrica!
              </p>
              <p className="mt-0.5 font-bold text-mute">
                Bora vender pro seu cliente?
              </p>
            </div>
          )}
          {editando ? (
            <>
              {/* Só no repete: nome de variação ("Chaveiro do Batman") sem
                  renomear a peça no catálogo. */}
              {ehRepete && (
                <div>
                  <h2 className="display mb-3 text-xl font-bold text-tinta">
                    Qual o nome dessa vez?
                  </h2>
                  <input
                    value={nomeVenda}
                    onChange={(e) => setNomeVenda(e.target.value)}
                    maxLength={40}
                    placeholder={produto.nome}
                    className="w-full rounded-2xl border-2 border-borda bg-painel2 p-4 text-xl font-bold text-tinta outline-none focus:border-neon"
                  />
                  <p className="mt-2 text-sm font-bold text-mute">
                    Continua o mesmo produto — o nome muda só nesta venda.
                  </p>
                </div>
              )}

              {/* A cor desta venda. Escondida na /novo (já escolheu no wizard). */}
              {permiteMudarCor && (
                <div>
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
                      Você misturou {coresIds.length} cores! Vou usar o preço
                      médio delas.
                    </p>
                  )}
                </div>
              )}

              <PrecoVendido
                custoTotal={resultado.custoTotal}
                precoSugerido={resultado.precoVenda}
                valor={valorFinal}
                onChange={setValorFinal}
              />
            </>
          ) : (
            /* Repete colapsado: mostra a última venda pronta e só abre os
               editores se ela apertar "Mudou algo?". */
            <div className="card text-center">
              <p className="display text-lg font-bold text-tinta">
                Repetindo {produto.nome}
              </p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="flex -space-x-2">
                  {coresIds.slice(0, 4).map((cid, i) => (
                    <Carretel key={i} cor={acharCor(cid, cores).hex} size={30} />
                  ))}
                </span>
                <span className="mono text-2xl font-bold text-tinta">
                  {brl(precoNota)}
                </span>
              </div>
              <button
                onClick={() => setMudouAlgo(true)}
                className="btn-escuro mt-4 min-h-[48px] w-full rounded-xl text-base font-extrabold"
              >
                Mudou algo?
              </button>
            </div>
          )}
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
          <NotinhaCliente dados={dadosOrcamento} />
        </section>
      </div>

      {ehOrcamento && (
        <div className="mx-auto mt-10 max-w-md">
          {!vendendo ? (
            /* Ainda decidindo: as notinhas acima já servem de orçamento pra
               mandar. "Vendido" só revela o cliente; ainda não grava nada. */
            <>
              <p className="mb-3 text-center text-base font-extrabold text-mute">
                Fechou a venda?
              </p>
              <div className="flex flex-col gap-3 sm:flex-row-reverse">
                <button
                  onClick={() => setVendendo(true)}
                  disabled={salvando || !podeIniciar}
                  className="btn-grande btn-neon flex-1 disabled:opacity-60"
                >
                  {precoNota > 0 ? `Vendido por ${brl(precoNota)}` : "Vendido"}
                </button>
                <button
                  onClick={() => onSoOrcamento?.()}
                  disabled={salvando}
                  className="btn-grande btn-escuro flex-1 disabled:opacity-60"
                >
                  Só orçamento
                </button>
              </div>
              <p className="mt-3 text-center font-bold text-mute">
                {coresIds.length === 0
                  ? "Escolhe pelo menos uma cor."
                  : precoNota <= 0
                  ? "Põe o valor pra marcar como vendido."
                  : "A notinha do cliente aí em cima já dá pra mandar."}
              </p>
            </>
          ) : (
            /* Fechou: agora sim, pra quem foi. */
            <div className="space-y-4">
              <div>
                <h2 className="display mb-3 text-xl font-bold text-tinta">
                  Pra quem é?
                </h2>
                <input
                  autoFocus
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
              <div className="flex flex-col gap-3 sm:flex-row-reverse">
                <button
                  onClick={() => setPerguntandoPagou(true)}
                  disabled={salvando || nomeLimpo(cliente).length === 0}
                  className="btn-grande btn-neon flex-1 disabled:opacity-60"
                >
                  Confirmar venda
                </button>
                <button
                  onClick={() => setVendendo(false)}
                  disabled={salvando}
                  className="btn-grande btn-escuro flex-1 disabled:opacity-60"
                >
                  Voltar
                </button>
              </div>
              {nomeLimpo(cliente).length === 0 && (
                <p className="text-center font-bold text-mute">
                  Escreve pra quem é pra fechar a venda.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {perguntandoPagou && (
        <Dialogo
          icone={<IconeMoeda size={26} />}
          titulo="Já te pagou?"
          texto={`${nomeLimpo(cliente)} já colocou o dinheiro na sua mão?`}
          confirmar="Sim, já recebi! 🎉"
          secundario="Ainda não"
          onConfirmar={() => confirmarVenda(true)}
          onSecundario={() => confirmarVenda(false)}
          onFechar={() => setPerguntandoPagou(false)}
        />
      )}
    </>
  );
}
