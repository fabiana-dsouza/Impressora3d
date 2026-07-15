export type TipoCor = "basica" | "especial";

/** Unidade de peso escolhida pra digitar (o cálculo é sempre em gramas). */
export type Unidade = "g" | "kg";

export interface Cor {
  id: string;
  nome: string;
  hex: string;
  tipo: TipoCor;
  /** preço do rolo em R$ por kg */
  precoRoloKg: number;
}

export interface Config {
  /** potência da impressora em watts */
  potenciaWatts: number;
  /** tarifa de energia em R$ por kWh */
  tarifaKwh: number;
  /** preço da impressora em R$ */
  precoImpressora: number;
  /** vida útil da impressora em horas */
  vidaUtilHoras: number;
  /** taxa de falhas (0-1) */
  taxaFalhas: number;
  /** margem padrão sugerida (0-3) */
  margemPadrao: number;
  /** custo da embalagem em R$ — sempre incluído em todo produto */
  custoEmbalagem: number;
}

export interface Produto {
  id: string;
  nome: string;
  /** cores usadas (uma ou mais). Não sabemos o peso de cada, só o total. */
  coresIds: string[];
  /** peso TOTAL da peça em gramas */
  gramas: number;
  /** unidade preferida pra exibir o peso */
  unidade: Unidade;
  horas: number;
  minutos: number;
  /** margem usada pra calcular o preço SUGERIDO */
  margem: number;
  /**
   * Preço que a criança realmente vendeu (é o que aparece na notinha).
   * 0 = ainda não definiu, aí vale o preço sugerido.
   */
  precoVenda: number;
  criadoEm: number;
  /** quantas unidades desse produto já foram vendidas */
  vendidos: number;
}

/** Um material usado no cálculo: gramas × preço por grama. */
export interface MaterialUsado {
  gramas: number;
  precoPorGrama: number;
}

/** Entrada pura para o cálculo — tudo já resolvido em números. */
export interface EntradaCalculo {
  /** um ou mais materiais (cores) usados */
  materiais: MaterialUsado[];
  horasDecimais: number;
  custoEnergiaPorHora: number;
  desgastePorHora: number;
  /** custos avulsos (embalagem) em R$ */
  extras: number;
  taxaFalhas: number;
  margem: number;
  taxaMarketplace: number;
}

export interface ResultadoCalculo {
  custoMaterial: number;
  custoEnergia: number;
  custoDesgaste: number;
  custoExtras: number;
  subtotal: number;
  custoFalhas: number;
  custoTotal: number;
  precoBase: number;
  precoVenda: number;
  lucro: number;
}
