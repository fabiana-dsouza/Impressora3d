"use client";

import { acharCor } from "@/lib/calc-produto";
import { brl } from "@/lib/format";
import {
  naoFoiVenda,
  ehParaMim,
  totalGastoPraMim,
  totalDeGraca,
} from "@/lib/vendas";
import type { Cliente, Cor, Venda } from "@/lib/types";
import Carretel from "@/components/Carretel";
import Valor from "@/components/Valor";
import { IconeUsuario, IconeCoracao } from "@/components/Icones";

/** Uma das duas caixas de resumo: quanto de material foi pra cada categoria. */
function CaixaGasto({
  rotulo,
  valor,
  icone,
}: {
  rotulo: string;
  valor: number;
  icone: React.ReactNode;
}) {
  return (
    <div className="card caixa-valor text-center">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mute">
        <span className="text-ciano">{icone}</span>
        {rotulo}
      </p>
      <Valor
        valor={valor}
        max="1.8rem"
        min="1rem"
        className="mt-1 block font-bold text-tinta"
      />
    </div>
  );
}

/**
 * A aba "Fiz para mim": as peças que ela guardou pra si ou deu de graça. Não é
 * dinheiro — as caixas somam o CUSTO (o material que saiu do bolso), nunca o
 * preço. Sem "Recebi!" nem "falta pagar": é só o registro.
 */
export default function ListaFizParaMim({
  vendas,
  clientes,
  cores,
}: {
  vendas: Venda[];
  clientes: Cliente[];
  cores: Cor[];
}) {
  const lista = naoFoiVenda(vendas);
  const gastoMim = totalGastoPraMim(vendas);
  const gastoGraca = totalDeGraca(vendas);

  function nomeDoCliente(v: Venda): string | null {
    if (!v.clienteId) return null;
    return clientes.find((c) => c.id === v.clienteId)?.nome ?? null;
  }

  if (lista.length === 0) {
    return (
      <div className="card flex flex-col items-center py-8 text-center">
        <IconeCoracao size={56} className="text-mute" />
        <p className="display mt-4 text-xl font-bold text-tinta">
          Nada aqui ainda
        </p>
        <p className="mt-1 font-bold text-mute">
          Quando você fizer uma peça <span className="text-ciano">pra você</span>{" "}
          ou <span className="text-ciano">de graça</span>, ela aparece aqui — com
          o quanto de material você gastou.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* As duas caixas de custo, do ladinho. */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <CaixaGasto
          rotulo="gastei pra mim"
          valor={gastoMim}
          icone={<IconeUsuario size={14} />}
        />
        <CaixaGasto
          rotulo="dei de graça"
          valor={gastoGraca}
          icone={<IconeCoracao size={14} />}
        />
      </div>

      <div className="space-y-3">
        {lista.map((v) => {
          const mim = ehParaMim(v);
          const nome = nomeDoCliente(v);
          return (
            <div key={v.id} className="card">
              <div className="flex items-center gap-3">
                <span className="flex shrink-0 -space-x-2.5">
                  {v.coresIds.slice(0, 3).map((id, idx) => (
                    <Carretel key={idx} cor={acharCor(id, cores).hex} size={30} />
                  ))}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="display truncate text-xl font-bold text-tinta">
                    {v.produtoNome}
                  </p>
                  <p className="truncate text-base font-bold text-mute">
                    {mim
                      ? "fiz pra mim"
                      : nome
                      ? `dei pra ${nome}`
                      : "dei de graça"}
                  </p>
                </div>

                {/* Chip com a etiqueta e o custo congelado. */}
                <span className="shrink-0 rounded-lg border border-borda bg-painel2 px-2 py-1 text-center">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase leading-none text-mute">
                    {mim ? <IconeUsuario size={11} /> : <IconeCoracao size={11} />}
                    {mim ? "pra mim" : "de graça"}
                  </span>
                  <span className="mono mt-0.5 block whitespace-nowrap text-xs font-bold text-tinta">
                    {brl(v.custo)}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
