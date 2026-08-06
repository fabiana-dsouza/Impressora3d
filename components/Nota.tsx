"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { calcularProduto, acharCor } from "@/lib/calc-produto";
import { precoBaseDaVenda } from "@/lib/vendas";
import { nomeLimpo } from "@/lib/clientes";
import { brl } from "@/lib/format";
import { montarOrcamento } from "@/lib/orcamento";
import type { Cliente, Config, Cor, Destino, Produto, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import PrecoVendido from "@/components/PrecoVendido";
import NotinhaInterna from "@/components/NotinhaInterna";
import NotinhaCliente from "@/components/NotinhaCliente";
import Dialogo from "@/components/Dialogo";
import {
  IconeMoeda,
  IconeVoltar,
  IconeUsuario,
  IconeCoracao,
} from "@/components/Icones";

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
  /** "venda" normal, "mim" (fiz pra mim) ou "graca" (dei de graça). */
  destino: Destino;
};

/**
 * A nota, em duas telas:
 *  - "ajustar": o resumo (opcional) + o teste de negociação (por quanto vender);
 *    um botão "Ver a notinha" leva pra próxima.
 *  - "fechar": pra quem é (preenche a notinha ao vivo) + as duas notinhas +
 *    Vendido/Só orçamento.
 * Em `somenteLeitura` (ver a conta) mostra só as notinhas, sem telas.
 * Não sabe gravar nem navegar — emite `onVender` / `onSoOrcamento`.
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
  resumo,
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
  /** Mostrado no topo da fase "ajustar" (a /novo passa o "Quanto ficou?"). */
  resumo?: ReactNode;
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
  // Duas telas: "ajustar" (preço) → "Ver a notinha" → "fechar" (nome + vender).
  const [fase, setFase] = useState<"ajustar" | "fechar">("ajustar");
  // Modo repete: os editores começam escondidos; "Mudou algo?" liga.
  const [mudouAlgo, setMudouAlgo] = useState(false);
  // Nome DESTA venda — no repete vira variação sem renomear a peça.
  const [nomeVenda, setNomeVenda] = useState(produto.nome);
  const [perguntandoPagou, setPerguntandoPagou] = useState(false);
  // Na tela 2 ela pode marcar que NÃO foi venda: "pra mim" ou "de graça".
  // Nulo = venda normal. Liga/desliga tocando na pílula.
  const [modoEspecial, setModoEspecial] = useState<"mim" | "graca" | null>(null);

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

  // Pra ir pra tela da notinha basta ter cor e valor. O nome do cliente é
  // exigido só lá, na hora de marcar como vendido.
  const podeIniciar = coresIds.length > 0 && precoNota > 0;

  const nomeDaVenda = () =>
    ehRepete ? nomeVenda.trim() || produto.nome : produto.nome;

  function confirmarVenda(jaPagou: boolean) {
    setPerguntandoPagou(false);
    onVender?.({
      coresIds,
      produtoNome: nomeDaVenda(),
      preco: precoNota,
      custo: resultado.custoTotal,
      cliente: nomeLimpo(cliente),
      jaPagou,
      destino: "venda",
    });
  }

  // "Fiz pra mim" / "Dei de graça": não é venda, então nem pergunta se pagou —
  // grava na hora com o custo congelado. "Pra mim" ignora o nome (é ela); "de
  // graça" guarda quem ganhou, se ela escreveu.
  function registrarEspecial(destino: "mim" | "graca") {
    onVender?.({
      coresIds,
      produtoNome: nomeDaVenda(),
      preco: precoNota,
      custo: resultado.custoTotal,
      cliente: destino === "graca" ? nomeLimpo(cliente) : "",
      jaPagou: false,
      destino,
    });
  }

  // As duas notinhas — na fase "fechar" e no modo só-leitura.
  const notinhas = (
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
  );

  // Só ver a conta: as notinhas e mais nada.
  if (somenteLeitura) return notinhas;

  // TELA 1 — ajustar o preço. As notinhas só aparecem na tela 2.
  if (fase === "ajustar") {
    return (
      <div className="mx-auto max-w-md space-y-6">
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

        {resumo}

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
                    Você misturou {coresIds.length} cores! Vou usar o preço médio
                    delas.
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

        <div>
          <button
            onClick={() => setFase("fechar")}
            disabled={!podeIniciar}
            className="btn-grande btn-neon w-full text-xl disabled:opacity-60"
          >
            Ver a notinha
          </button>
          <p className="mt-3 text-center font-bold text-mute">
            {coresIds.length === 0
              ? "Escolhe pelo menos uma cor."
              : precoNota <= 0
              ? "Põe o valor pra ver a notinha."
              : "É essa notinha que você mostra e manda pro cliente."}
          </p>
        </div>
      </div>
    );
  }

  // TELA 2 — pra quem é, a notinha pronta, e vendeu ou não.
  // "pra mim" não pede nome; "de graça" ainda deixa dizer quem ganhou.
  const ehMim = modoEspecial === "mim";
  const ehGraca = modoEspecial === "graca";

  function alternarEspecial(qual: "mim" | "graca") {
    setModoEspecial((atual) => (atual === qual ? null : qual));
  }

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-md">
        <h2 className="display mb-3 text-xl font-bold text-tinta">
          {ehMim ? "É pra você!" : ehGraca ? "Deu pra quem?" : "Pra quem é?"}
        </h2>

        {ehMim ? (
          <div className="animate-pop rounded-2xl border-2 border-neon/40 bg-neon/10 p-4 text-center font-bold text-tinta">
            Essa peça é sua mesmo — não precisa de nome. Vai pra{" "}
            <span className="text-neon">"Fiz para mim"</span>.
          </div>
        ) : (
          <>
            <input
              autoFocus
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              maxLength={24}
              placeholder={ehGraca ? "Ex: Maria (se quiser)" : "Ex: Maria"}
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
          </>
        )}

        {/* Não foi venda? As duas pílulas que ligam/desligam o modo especial. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => alternarEspecial("mim")}
            aria-pressed={ehMim}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-full px-3 text-sm font-extrabold ${
              ehMim ? "btn-neon" : "btn-escuro"
            }`}
          >
            <IconeUsuario size={18} /> É pra mim mesma
          </button>
          <button
            onClick={() => alternarEspecial("graca")}
            aria-pressed={ehGraca}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-full px-3 text-sm font-extrabold ${
              ehGraca ? "btn-neon" : "btn-escuro"
            }`}
          >
            <IconeCoracao size={18} /> Dei de graça
          </button>
        </div>
      </div>

      {notinhas}

      <div className="mx-auto max-w-md">
        {modoEspecial ? (
          /* Não é venda: um botão só, sem "já pagou". */
          <>
            <button
              onClick={() => registrarEspecial(modoEspecial)}
              disabled={salvando}
              className="btn-grande btn-neon w-full disabled:opacity-60"
            >
              {ehMim ? "Guardar pra mim" : "Anotar que dei de graça"}
            </button>
            <p className="mt-3 text-center font-bold text-mute">
              Isso não é venda — não entra no cofrinho. Fica guardado em{" "}
              <span className="text-tinta">"Fiz para mim"</span>.
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 text-center text-base font-extrabold text-mute">
              {nomeLimpo(cliente)
                ? `E aí, ${nomeLimpo(cliente)} vai levar?`
                : "Fechou a venda?"}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <button
                onClick={() => setPerguntandoPagou(true)}
                disabled={salvando || nomeLimpo(cliente).length === 0}
                className="btn-grande btn-neon flex-1 disabled:opacity-60"
              >
                {`Vendido por ${brl(precoNota)}`}
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
              {nomeLimpo(cliente).length === 0
                ? "Escreve pra quem é pra marcar como vendido."
                : "Se vendeu, dá pra marcar quando o dinheiro chegar."}
            </p>
          </>
        )}
        <button
          onClick={() => setFase("ajustar")}
          disabled={salvando}
          className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-mute underline disabled:opacity-60"
        >
          <IconeVoltar size={16} /> mudar o preço
        </button>
      </div>

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
    </div>
  );
}
