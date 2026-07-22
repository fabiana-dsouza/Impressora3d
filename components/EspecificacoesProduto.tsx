"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import { lucroDaVenda, recebido } from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";

/**
 * A lista das unidades vendidas de UMA peça, pra abrir dentro do Dialogo do
 * card. Só pra ver: quem comprou, o valor e se já pagou. Receber e trocar o
 * nome continuam na aba Vendidos — aqui não duplica ação nenhuma.
 */
export default function EspecificacoesProduto({
  vendas,
  clientes,
  cores,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
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
            className="flex items-center gap-3 rounded-xl border border-borda bg-painel2 p-3"
          >
            <span className="flex shrink-0 -space-x-2">
              {v.coresIds.slice(0, 3).map((id, idx) => (
                <Carretel key={idx} cor={acharCor(id, cores).hex} size={26} />
              ))}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-tinta">
                {nome ?? "** falta o nome **"}
              </p>
              <p className="text-sm font-bold text-mute">{brl(v.preco)}</p>
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
        );
      })}
    </div>
  );
}
