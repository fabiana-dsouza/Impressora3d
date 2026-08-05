"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import { lucroDaVenda, recebido } from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import { IconeMoeda } from "@/components/Icones";

/**
 * A lista das unidades vendidas de UMA peça, pra abrir dentro do Dialogo do
 * card. Mostra quem comprou, o valor e se já pagou — e dá o atalho "Vender de
 * novo", que reabre a nota já com a mesma cliente e as mesmas cores. Receber e
 * trocar o nome continuam na aba Vendidos.
 */
export default function EspecificacoesProduto({
  vendas,
  clientes,
  cores,
  onVenderDeNovo,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
  /** Reabre a nota dessa peça com a cliente e as cores desta venda. */
  onVenderDeNovo: (venda: Venda) => void;
}) {
  function nomeDoCliente(v: Venda): string | null {
    if (!v.clienteId) return null;
    return clientes.find((c) => c.id === v.clienteId)?.nome ?? null;
  }

  return (
    <div className="space-y-2 text-left">
      {vendas.map((v) => {
        const nome = nomeDoCliente(v);
        const pago = recebido(v);
        return (
          <div
            key={v.id}
            className="rounded-xl border border-borda bg-painel2 p-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex shrink-0 -space-x-2">
                {v.coresIds.slice(0, 3).map((id, idx) => (
                  <Carretel key={idx} cor={acharCor(id, cores).hex} size={26} />
                ))}
              </span>

              <div className="min-w-0 flex-1">
                {/* O nome da VARIAÇÃO (pode diferir da peça, ex.: "Chaveiro do
                    Batman") manda no título; cliente e valor logo abaixo. */}
                <p className="truncate text-base font-bold text-tinta">
                  {v.produtoNome}
                </p>
                <p className="truncate text-sm font-bold text-mute">
                  {nome ?? "** falta o nome **"} · {brl(v.preco)}
                </p>
              </div>

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

            {/* Repete o pedido: reabre a nota com a mesma cliente e as mesmas
                cores desta venda, prontas pra ajustar. */}
            <button
              onClick={() => onVenderDeNovo(v)}
              className="btn-escuro mt-3 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold"
            >
              <IconeMoeda size={16} /> Vender de novo
            </button>
          </div>
        );
      })}
    </div>
  );
}
