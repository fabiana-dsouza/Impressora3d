import type { Cor, Produto, ResultadoCalculo } from "./types";
import { acharCor } from "./calc-produto";
import { EMPRESA_PADRAO } from "./defaults";
import { brl } from "./format";

/**
 * Tudo que a notinha do CLIENTE mostra — e nada além disso.
 *
 * Repare no que não existe aqui: custo, margem, lucro. Isso é de propósito.
 * A regra "o cliente não vê número de dentro da fábrica" mora nesta interface,
 * não num `if` lá na tela: o dado simplesmente não chega até o desenho.
 */
export interface DadosOrcamento {
  empresa: string;
  produto: string;
  /** nomes das cores já juntados, ex: "Roxo + Verde". "" se não tiver cor. */
  cores: string;
  preco: number;
  data: Date;
}

/**
 * `hoje` entra por parâmetro em vez de `new Date()` aqui dentro pra função
 * continuar pura — senão o teste dependeria do relógio da máquina.
 */
export function montarOrcamento(
  produto: Produto,
  resultado: ResultadoCalculo,
  cores: Cor[],
  nomeEmpresa: string,
  hoje: Date
): DadosOrcamento {
  return {
    empresa: nomeEmpresa.trim() || EMPRESA_PADRAO,
    produto: produto.nome.trim() || "Peça sem nome",
    cores: produto.coresIds.map((id) => acharCor(id, cores).nome).join(" + "),
    preco: resultado.precoVenda,
    data: hoje,
  };
}

/** 19/07/2026 */
export function dataBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** "Dinossauro Roxão" → "orcamento-dinossauro-roxao.png" */
export function nomeDoArquivo(nomeProduto: string): string {
  const slug = nomeProduto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira o acento, mantém a letra
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `orcamento-${slug || "peca"}.png`;
}

/**
 * A notinha é uma imagem, e imagem não tem texto pra leitor de tela. Esta
 * frase é o `aria-label` do canvas.
 */
export function textoDaNotinha(d: DadosOrcamento): string {
  const cores = d.cores ? `, nas cores ${d.cores}` : "";
  return `Orçamento da ${d.empresa}: ${d.produto}${cores}, preço ${brl(
    d.preco
  )}, em ${dataBR(d.data)}.`;
}
