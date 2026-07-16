"use client";

import Valor from "./Valor";

/**
 * "Por quanto você vendeu?" — o preço indicado vem preenchido, mas quem manda
 * é a criança: às vezes o preço final foi outro, e a notinha mostra a verdade.
 */
export default function PrecoVendido({
  custoTotal,
  precoSugerido,
  valor,
  onChange,
}: {
  custoTotal: number;
  precoSugerido: number;
  valor: string;
  onChange: (v: string) => void;
}) {
  const preco = Number(valor) || 0;
  const lucro = preco - custoTotal;
  const ganhou = lucro > 0.004;
  const perdeu = lucro < -0.004;
  const igualSugerido = Math.abs(preco - precoSugerido) < 0.005;

  function ajustar(delta: number) {
    onChange(String(Math.max(0, Math.round((preco + delta) * 100) / 100)));
  }

  return (
    <div className="card">
      <p className="display text-center text-lg font-bold text-tinta">
        Por quanto você vendeu?
      </p>
      <p className="mb-4 text-center text-sm font-bold text-mute">
        Se o preço final foi outro, muda aqui — é ele que vai na notinha.
      </p>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => ajustar(-0.5)}
          aria-label="Menos 50 centavos"
          className="btn-escuro flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold"
        >
          −
        </button>
        {/* o número digitado encolhe pra caber: a criança sempre vê o preço
            inteiro, sem o input rolar escondendo os dígitos */}
        <div className="caixa-valor flex min-w-0 flex-1 items-center gap-1 rounded-xl border-2 border-borda bg-painel2 px-3 py-2 focus-within:border-neon sm:max-w-[15rem]">
          <span className="shrink-0 text-lg font-extrabold text-mute">R$</span>
          <input
            type="number"
            inputMode="decimal"
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            style={
              {
                "--n": String(Math.max(valor.length, 4)),
                "--valor-min": "0.875rem",
                "--valor-max": "1.875rem",
                "--valor-folga": "26px", // o "R$" e o espacinho ao lado
              } as React.CSSProperties
            }
            className="valor valor-fit w-full min-w-0 bg-transparent text-center font-bold text-tinta outline-none"
          />
        </div>
        <button
          onClick={() => ajustar(0.5)}
          aria-label="Mais 50 centavos"
          className="btn-neon flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold"
        >
          +
        </button>
      </div>

      {/* atalho pra voltar ao preço indicado (que aparece logo acima) */}
      {!igualSugerido && precoSugerido > 0 && (
        <button
          onClick={() => onChange(String(precoSugerido))}
          className="mx-auto mt-3 block rounded-lg px-3 py-1 text-sm font-bold text-ciano underline"
        >
          voltar pro preço indicado
        </button>
      )}

      {/* o que acontece com esse preço */}
      <div
        className={`caixa-valor mt-4 animate-pop rounded-xl border p-4 text-center ${
          ganhou
            ? "border-neon/40 bg-neon/10"
            : perdeu
            ? "border-perigo/40 bg-perigo/10"
            : "border-borda bg-painel2"
        }`}
      >
        {ganhou && (
          <>
            <p className="text-xs font-extrabold uppercase tracking-widest text-mute">
              você ganha
            </p>
            <Valor
              valor={lucro}
              max="2.25rem"
              min="1.25rem"
              className="block font-bold text-neon"
            />
            <p className="mt-0.5 text-sm font-bold text-neon">Bom negócio! 🎉</p>
          </>
        )}
        {perdeu && (
          <>
            <p className="text-xs font-extrabold uppercase tracking-widest text-mute">
              você perde
            </p>
            <Valor
              valor={-lucro}
              max="2.25rem"
              min="1.25rem"
              className="block font-bold text-perigo"
            />
            <p className="mt-0.5 text-sm font-bold text-perigo">
              Tá barato demais! Vende por mais.
            </p>
          </>
        )}
        {!ganhou && !perdeu && (
          <p className="text-lg font-extrabold text-tinta">
            Nem ganha, nem perde — empate.
          </p>
        )}
      </div>
    </div>
  );
}
