"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import { lucroDaVenda, recebido, totalNoCaixa, totalQueTeDevem } from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import { IconeMoeda } from "@/components/Icones";

/**
 * A aba "Vendidos": o cofrinho em cima e as vendas embaixo.
 *
 * Duas coisas que a tela precisa deixar óbvias:
 *  - vender não é receber (só o recebido conta no cofrinho);
 *  - venda sem cliente é um convite pra preencher, não um defeito.
 */
export default function ListaVendidos({
  vendas,
  clientes,
  cores,
  empresa,
  onReceber,
  onNomear,
  onVenderDeNovo,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
  empresa: string;
  onReceber: (vendaId: string) => void;
  onNomear: (venda: Venda) => void;
  onVenderDeNovo: (venda: Venda) => void;
}) {
  if (vendas.length === 0) {
    return (
      <div className="card flex flex-col items-center py-8 text-center">
        <IconeMoeda size={56} className="text-mute" />
        <p className="display mt-4 text-xl font-bold text-tinta">
          Ainda não vendeu nada
        </p>
        <p className="mt-1 font-bold text-mute">
          Escolha uma peça em "Meus produtos" e toque em{" "}
          <span className="text-neon">"Fazer orçamento"</span>.
        </p>
      </div>
    );
  }

  const caixa = totalNoCaixa(vendas);
  const devendo = totalQueTeDevem(vendas);
  const quantasPagas = vendas.filter(recebido).length;

  function nomeDoCliente(v: Venda): string | null {
    if (!v.clienteId) return null;
    return clientes.find((c) => c.id === v.clienteId)?.nome ?? null;
  }

  return (
    <>
      {/* O cofrinho: só o dinheiro que já entrou de verdade. */}
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

        {devendo > 0 && (
          <p className="mt-3 border-t border-borda pt-3 font-bold text-mute">
            Ainda te devem{" "}
            <span className="text-ciano">{brl(devendo)}</span>
          </p>
        )}
      </div>

      <div className="space-y-3">
        {vendas.map((v) => {
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
                  {/* Sem nome, o próprio aviso É o botão de preencher. */}
                  {nome ? (
                    <p className="display truncate text-lg font-bold text-tinta">
                      {nome}
                    </p>
                  ) : (
                    <button
                      onClick={() => onNomear(v)}
                      className="display truncate text-lg font-bold text-perigo underline"
                    >
                      ** falta o nome **
                    </button>
                  )}
                  <p className="truncate font-bold text-mute">
                    {v.produtoNome} · {brl(v.preco)}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-bold uppercase ${
                    pago
                      ? "border-neon/30 bg-neon/10 text-neon"
                      : "border-ciano/30 bg-ciano/10 text-ciano"
                  }`}
                >
                  {pago ? `ganhou ${brl(lucroDaVenda(v))}` : "falta pagar"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!pago && (
                  <button
                    onClick={() => onReceber(v.id)}
                    className="btn-grande btn-neon min-h-[48px] flex-1 text-base"
                  >
                    Recebi!
                  </button>
                )}
                {nome && (
                  <button
                    onClick={() => onNomear(v)}
                    className="btn-grande btn-escuro min-h-[48px] flex-1 text-base"
                  >
                    Trocar o nome
                  </button>
                )}
                {v.produtoId && (
                  <button
                    onClick={() => onVenderDeNovo(v)}
                    className="btn-grande btn-escuro min-h-[48px] flex-1 text-base"
                  >
                    Vender de novo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
