import { acharCor } from "@/lib/calc-produto";
import { brl, num } from "@/lib/format";
import { EMPRESA_PADRAO } from "@/lib/defaults";
import type { Config, Cor, Produto, ResultadoCalculo, Unidade } from "@/lib/types";
import Valor from "@/components/Valor";

/** Mostra o peso na unidade preferida do produto. */
function peso(gramas: number, unidade: Unidade): string {
  if (unidade === "kg") {
    const kg = gramas / 1000;
    return `${num(kg, kg % 1 === 0 ? 0 : 2)} kg`;
  }
  return `${num(gramas, 0)} g`;
}

/**
 * A notinha de dentro da fábrica: mostra pra onde foi cada centavo e termina
 * no carimbo do lucro. É a única das duas que pode mostrar custo.
 *
 * Tudo aqui dentro mede em `em`: quem manda no tamanho é o font-size fluido de
 * .recibo, que acompanha a largura da tela.
 */
export default function NotinhaInterna({
  produto,
  config,
  cores,
  resultado: r,
  empresa,
}: {
  produto: Produto;
  config: Config;
  cores: Cor[];
  resultado: ResultadoCalculo;
  empresa: string;
}) {
  const horasDec = produto.horas + produto.minutos / 60;
  const taxaFalhasPct = Math.round(config.taxaFalhas * 100);
  const coresUsadas = produto.coresIds.map((cid) => acharCor(cid, cores));
  const nomesCores = coresUsadas.map((c) => c.nome).join(" + ");
  const varias = coresUsadas.length >= 2;
  const prejuizo = r.lucro < 0;

  return (
    <div className="recibo mono">
      <p className="display text-center text-[1.3em] font-bold uppercase tracking-[0.18em]">
        ★ {empresa || EMPRESA_PADRAO} ★
      </p>
      <p className="text-center text-[0.8em] font-bold uppercase tracking-widest text-[color:var(--papel-suave)]">
        nota da fabriquinha 3D
      </p>

      <div className="tracejado my-[1.15em]" />

      <p className="text-[1em] font-extrabold uppercase">{produto.nome}</p>

      <div className="mt-[0.9em] space-y-[0.6em] text-[1em] font-bold">
        <div className="linha-recibo">
          <span className="rotulo uppercase">
            material {varias ? "(média)" : ""} ·{" "}
            {peso(produto.gramas, produto.unidade)}
          </span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoMaterial)}</span>
        </div>
        <p className="-mt-[0.3em] text-[0.85em] text-[color:var(--papel-suave)]">
          {nomesCores}
        </p>
        <div className="linha-recibo">
          <span className="rotulo uppercase">
            energia · {num(horasDec, 1)} h
          </span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoEnergia)}</span>
        </div>
        <div className="linha-recibo">
          <span className="rotulo uppercase">desgaste da impressora</span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoDesgaste)}</span>
        </div>
        <div className="linha-recibo">
          <span className="rotulo uppercase">embalagem</span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoExtras)}</span>
        </div>
        <div className="linha-recibo">
          <span className="rotulo uppercase">
            reserva p/ erros (+{taxaFalhasPct}%)
          </span>
          <span className="pontos" />
          <span className="valor">{brl(r.custoFalhas)}</span>
        </div>
      </div>

      <div className="tracejado my-[1.15em]" />

      <div className="linha-recibo text-[1.1em] font-extrabold">
        <span className="rotulo uppercase">custo total</span>
        <span className="pontos" />
        <span className="valor">{brl(r.custoTotal)}</span>
      </div>
      <div className="linha-recibo mt-[0.6em] text-[1.25em] font-extrabold">
        <span className="rotulo uppercase">vendido por</span>
        <span className="pontos" />
        <span className="valor">{brl(r.precoVenda)}</span>
      </div>

      {/* Carimbo do resultado: rótulo em cima, número embaixo — em uma linha
          só ele encostava nas bordas do papel quando o valor era grande. */}
      <div className="caixa-valor mt-[1.4em] text-center">
        <span className={`carimbo ${prejuizo ? "carimbo-vermelho" : ""}`}>
          <span className="display block text-[0.75em] uppercase tracking-[0.25em]">
            {prejuizo ? "prejuízo" : "seu lucro"}
          </span>
          {/* folga = padding + borda do carimbo, que a régua não enxerga */}
          <Valor
            valor={Math.abs(r.lucro)}
            max="2.2em"
            min="1.15em"
            folga="44px"
            className="block"
          />
        </span>
      </div>
    </div>
  );
}
