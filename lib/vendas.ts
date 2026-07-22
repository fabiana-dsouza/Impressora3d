import type { Config, Cor, Produto, Venda } from "./types";
import { calcularProduto } from "./calc-produto";

/** Uma venda antes de existir no banco (sem id nem data ainda). */
export type NovaVenda = Omit<Venda, "id" | "criadoEm">;

/**
 * O que sobrou dessa venda. Usa o preço e o custo CONGELADOS na linha, nunca
 * recalcula — foi isso que aconteceu naquele dia.
 */
export function lucroDaVenda(v: Venda): number {
  return v.preco - v.custo;
}

/** Vender não é receber: o dinheiro às vezes chega depois. */
export function recebido(v: Venda): boolean {
  return v.pagoEm !== null;
}

/** O cofrinho: só o que já entrou de verdade. Soma LUCRO. */
export function totalNoCaixa(vendas: Venda[]): number {
  return vendas.filter(recebido).reduce((s, v) => s + lucroDaVenda(v), 0);
}

/**
 * Quanto ainda vão colocar na mão dela. Soma PREÇO, não lucro — e a diferença
 * é proposital: o cofrinho mede ganho, isto aqui mede dinheiro a chegar.
 */
export function totalQueTeDevem(vendas: Venda[]): number {
  return vendas.filter((v) => !recebido(v)).reduce((s, v) => s + v.preco, 0);
}

/**
 * O valor que já vem preenchido na nota daquela peça: o preço da ÚLTIMA venda
 * dessa mesma peça (a mais recente por `criadoEm`). Se ela nunca foi vendida,
 * vale o preço sugerido — assim a peça "lembra" quanto costuma vender, mas só
 * de vendas de verdade (um "apenas orçamento" não registra venda, não muda a base).
 */
export function precoBaseDaVenda(
  vendas: Venda[],
  produtoId: string,
  precoSugerido: number
): number {
  const ultima = vendas
    .filter((v) => v.produtoId === produtoId)
    .reduce<Venda | null>(
      (maisRecente, v) =>
        !maisRecente || v.criadoEm > maisRecente.criadoEm ? v : maisRecente,
      null
    );
  return ultima ? ultima.preco : precoSugerido;
}

/**
 * Converte o contador antigo (`produtos.vendidos`) em linhas de venda.
 *
 * Cada unidade vendida vira uma linha marcada como PAGA e SEM CLIENTE — quem
 * comprou nunca foi registrado, e o "** falta o nome **" na tela é justamente
 * o convite pra ela preencher.
 *
 * O preço e o custo saem de `calcularProduto`, a mesma função da tela. É isso
 * que garante que o cofrinho vale o mesmo antes e depois: o cofrinho antigo é
 * `lucro × vendidos`, e `lucro` é `precoVenda - custoTotal`.
 */
export function linhasDaMigracao(
  produtos: Produto[],
  config: Config,
  cores: Cor[]
): NovaVenda[] {
  const linhas: NovaVenda[] = [];

  for (const p of produtos) {
    const quantas = Math.max(0, Math.round(p.vendidos || 0));
    if (quantas === 0) continue;

    const r = calcularProduto(p, config, cores);

    for (let i = 0; i < quantas; i++) {
      linhas.push({
        produtoId: p.id,
        produtoNome: p.nome,
        clienteId: null,
        coresIds: [...p.coresIds],
        preco: r.precoVenda,
        custo: r.custoTotal,
        // A data da venda real nunca foi registrada; a da peça é o mais
        // perto da verdade que dá pra chegar.
        pagoEm: p.criadoEm ?? Date.now(),
      });
    }
  }

  return linhas;
}
