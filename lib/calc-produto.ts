import type { Config, Cor, Produto, ResultadoCalculo } from "./types";
import { calcular, precoPorGrama, taxasDaConfig, horasDecimais } from "./calc";
import { CORES_PADRAO } from "./defaults";

/** Encontra a cor pelo id (com fallbacks seguros). */
export function acharCor(corId: string, cores: Cor[]): Cor {
  return (
    cores.find((c) => c.id === corId) ??
    CORES_PADRAO.find((c) => c.id === corId) ??
    CORES_PADRAO[0]
  );
}

/**
 * Preço médio por grama das cores usadas. Como não sabemos quanto foi de cada
 * cor (só o peso total), usamos a MÉDIA simples dos preços das cores escolhidas.
 */
export function precoMedioPorGrama(coresIds: string[], cores: Cor[]): number {
  if (coresIds.length === 0) return 0;
  const soma = coresIds.reduce(
    (s, id) => s + precoPorGrama(acharCor(id, cores).precoRoloKg),
    0
  );
  return soma / coresIds.length;
}

/**
 * Monta a EntradaCalculo a partir de um Produto salvo + config + lista de cores,
 * e devolve o resultado do cálculo. É a ponte entre os dados salvos e o módulo puro.
 *
 * Se a criança anotou o preço que REALMENTE vendeu, é ele que vale (e o lucro
 * é recalculado em cima dele) — a notinha tem que mostrar a verdade, não o palpite.
 */
export function calcularProduto(
  produto: Produto,
  config: Config,
  cores: Cor[]
): ResultadoCalculo {
  const precoG = precoMedioPorGrama(produto.coresIds, cores);
  const { custoEnergiaPorHora, desgastePorHora } = taxasDaConfig(config);

  const base = calcular({
    // Um material só: peso total × preço médio das cores.
    materiais: [{ gramas: produto.gramas, precoPorGrama: precoG }],
    horasDecimais: horasDecimais(produto.horas, produto.minutos),
    custoEnergiaPorHora,
    desgastePorHora,
    // Embalagem sempre incluída.
    extras: config.custoEmbalagem ?? 3,
    taxaFalhas: config.taxaFalhas,
    margem: produto.margem,
    // Sem marketplace: venda direta.
    taxaMarketplace: 0,
  });

  if (produto.precoVenda > 0) {
    return {
      ...base,
      precoVenda: produto.precoVenda,
      lucro: produto.precoVenda - base.custoTotal,
    };
  }
  return base;
}
