"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import {
  lucroDaVenda,
  recebido,
  totalNoCaixa,
  totalQueTeDevem,
  totalGastoPraMim,
  totalDeGraca,
  vendasPagas,
  vendasPendentes,
} from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import {
  IconeMoeda,
  IconeRelogio,
  IconeUsuario,
  IconeCoracao,
} from "@/components/Icones";

/**
 * A lista de vendas — usada nas DUAS abas de dinheiro:
 *  - "pagas": a aba Vendidos. Em cima o cofrinho; cada venda tem "Editar".
 *  - "pendentes": a aba Falta receber. Em cima quanto te devem; cada venda
 *    tem "Recebi!" e permite corrigir o nome do produto.
 *
 * Recebe TODAS as vendas (pro cofrinho e o "te devem" somarem certo) e filtra
 * aqui dentro qual subconjunto mostrar, conforme o modo.
 */
export default function ListaVendidos({
  vendas,
  clientes,
  cores,
  empresa,
  modo,
  onReceber,
  onNomear,
  onEditar,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
  empresa: string;
  modo: "pagas" | "pendentes";
  onReceber: (vendaId: string) => void;
  onNomear: (venda: Venda) => void;
  /** Abre as opções de edição disponíveis para a venda. */
  onEditar: (venda: Venda) => void;
}) {
  const pagas = modo === "pagas";
  const lista = pagas ? vendasPagas(vendas) : vendasPendentes(vendas);

  const caixa = totalNoCaixa(vendas);
  const devendo = totalQueTeDevem(vendas);
  const quantasPagas = vendasPagas(vendas).length;
  const quantasPendentes = vendasPendentes(vendas).length;
  // "Fiz pra mim" / "de graça" viram duas caixinhas ao lado do cofrinho, mas só
  // depois que ela usa o recurso — antes disso a aba fica igual a antes.
  const gastoMim = totalGastoPraMim(vendas);
  const gastoGraca = totalDeGraca(vendas);
  const temFizParaMim = gastoMim > 0 || gastoGraca > 0;

  function nomeDoCliente(v: Venda): string | null {
    if (!v.clienteId) return null;
    return clientes.find((c) => c.id === v.clienteId)?.nome ?? null;
  }

  // Vazio: se nunca vendeu nada, o convite é o mesmo dos dois lados (ir pra
  // Meus produtos). Se já vendeu mas esta aba está vazia, a mensagem explica
  // pra onde a venda foi.
  if (lista.length === 0) {
    const nuncaVendeu = vendas.length === 0;
    return (
      <div className="card flex flex-col items-center py-8 text-center">
        {pagas ? (
          <IconeMoeda size={56} className="text-mute" />
        ) : (
          <IconeRelogio size={56} className="text-mute" />
        )}
        <p className="display mt-4 text-xl font-bold text-tinta">
          {nuncaVendeu
            ? "Ainda não vendeu nada"
            : pagas
            ? "Nada no cofrinho ainda"
            : "Ninguém te devendo! 🎉"}
        </p>
        <p className="mt-1 font-bold text-mute">
          {nuncaVendeu ? (
            <>
              Escolha uma peça em "Meus produtos" e toque em{" "}
              <span className="text-neon">"Fazer orçamento"</span>.
            </>
          ) : pagas ? (
            <>
              Suas vendas estão esperando em{" "}
              <span className="text-ciano">"Falta receber"</span>.
            </>
          ) : (
            "Todo mundo já pagou o que devia."
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      {pagas ? (
        /* O cofrinho: só o dinheiro que já entrou de verdade. */
        <div className="card caixa-valor mb-4 text-center">
          <p className="display text-xs font-bold uppercase tracking-[0.2em] text-mute">
            cofrinho da {empresa || "empresa"}
          </p>
          <Valor
            valor={Math.abs(caixa)}
            max="3.5rem"
            min="1.5rem"
            className={`mt-1 block font-bold ${
              caixa < 0 ? "text-perigo" : "brilho text-neon"
            }`}
          />
          <p className="mt-1 font-bold text-mute">
            ganho de verdade, com {quantasPagas} venda
            {quantasPagas === 1 ? "" : "s"} paga{quantasPagas === 1 ? "" : "s"} 🎉
          </p>

          {/* As duas caixinhas do "Fiz para mim", ao ladinho do cofrinho.
              Só o custo — não é dinheiro que entrou. Ver a aba pra detalhar. */}
          {temFizParaMim && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-borda pt-3">
              <div className="text-center">
                <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase leading-none text-mute">
                  <IconeUsuario size={12} /> gastei pra mim
                </p>
                <Valor
                  valor={gastoMim}
                  max="1.3rem"
                  min="0.85rem"
                  className="mt-1 block font-bold text-tinta"
                />
              </div>
              <div className="text-center">
                <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase leading-none text-mute">
                  <IconeCoracao size={12} /> dei de graça
                </p>
                <Valor
                  valor={gastoGraca}
                  max="1.3rem"
                  min="0.85rem"
                  className="mt-1 block font-bold text-tinta"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Quanto ainda vão te pagar — não é do cofrinho ainda, por isso ciano. */
        <div className="card caixa-valor mb-4 text-center">
          <p className="display text-xs font-bold uppercase tracking-[0.2em] text-mute">
            falta receber
          </p>
          <Valor
            valor={devendo}
            max="3.5rem"
            min="1.5rem"
            className="mt-1 block font-bold text-ciano"
          />
          <p className="mt-1 font-bold text-mute">
            {quantasPendentes} venda{quantasPendentes === 1 ? "" : "s"} esperando
            pagamento
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lista.map((v) => {
          const nome = nomeDoCliente(v);
          const pago = recebido(v);
          return (
            <div key={v.id} className="card">
              <div className="flex items-center gap-3">
                <span className="flex shrink-0 -space-x-2.5">
                  {v.coresIds.slice(0, 3).map((id, idx) => (
                    <Carretel key={idx} cor={acharCor(id, cores).hex} size={30} />
                  ))}
                </span>

                <div className="min-w-0 flex-1">
                  {/* O PRODUTO manda no card — é o título maior. */}
                  <p className="display truncate text-xl font-bold text-tinta">
                    {v.produtoNome}
                  </p>
                  {/* Quem comprou + preço logo abaixo: menor que o produto, mas
                      ainda bem legível. Sem nome, o próprio aviso É o botão de
                      preencher (com alvo de toque grande). */}
                  {nome ? (
                    <p className="truncate text-base font-bold text-mute">
                      <span className="text-tinta">{nome}</span> · {brl(v.preco)}
                    </p>
                  ) : (
                    <p className="text-base font-bold text-mute">
                      <button
                        onClick={() => onNomear(v)}
                        className="inline-flex min-h-[48px] items-center whitespace-nowrap rounded align-middle text-ciano underline"
                      >
                        ** falta o nome **
                      </button>
                      <span className="whitespace-nowrap">{" · "}{brl(v.preco)}</span>
                    </p>
                  )}
                </div>

                {/* Chip estreito (rótulo em cima, valor embaixo) pra sobrar
                    largura pro nome do produto no título. */}
                <span
                  className={`shrink-0 rounded-lg border px-2 py-1 text-center ${
                    pago
                      ? "border-neon/30 bg-neon/10"
                      : "border-ciano/30 bg-ciano/10"
                  }`}
                >
                  {pago ? (
                    <>
                      <span className="block text-[10px] font-bold uppercase leading-none text-neon/70">
                        ganhou
                      </span>
                      <span className="mt-0.5 block whitespace-nowrap text-xs font-bold text-neon">
                        {brl(lucroDaVenda(v))}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="block text-[10px] font-bold uppercase leading-none text-ciano/70">
                        falta
                      </span>
                      <span className="mt-0.5 block text-xs font-bold uppercase text-ciano">
                        pagar
                      </span>
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {pagas ? (
                  /* Já pagou: só dá pra arrumar (marcou sem querer / foi teste).
                     Trocar o nome fica no "** falta o nome **"; "Vender de novo"
                     mora nas unidades da peça (o diálogo "ver quem comprou" do
                     card), pra não duplicar a ação aqui. */
                  <button
                    onClick={() => onEditar(v)}
                    className="btn-grande btn-escuro min-h-[48px] flex-1 text-base"
                  >
                    Editar
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onEditar(v)}
                      className="btn-grande btn-escuro min-h-[48px] flex-1 text-base"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onReceber(v.id)}
                      className="btn-grande btn-neon min-h-[48px] flex-1 text-base"
                    >
                      Recebi!
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
