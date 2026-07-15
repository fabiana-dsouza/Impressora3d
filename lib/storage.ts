import type { Config, Cor, Produto } from "./types";
import { CONFIG_PADRAO, CORES_PADRAO } from "./defaults";

const K_CONFIG = "startup:config";
const K_CORES = "startup:cores";
const K_PRODUTOS = "startup:produtos";

function ler<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const raw = window.localStorage.getItem(chave);
    if (!raw) return padrao;
    return JSON.parse(raw) as T;
  } catch {
    return padrao;
  }
}

function salvar<T>(chave: string, valor: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // localStorage cheio ou indisponível — ignora silenciosamente.
  }
}

export function lerConfig(): Config {
  return { ...CONFIG_PADRAO, ...ler<Partial<Config>>(K_CONFIG, {}) };
}
export function salvarConfig(config: Config): void {
  salvar(K_CONFIG, config);
}

export function lerCores(): Cor[] {
  const cores = ler<Cor[]>(K_CORES, CORES_PADRAO);
  return Array.isArray(cores) && cores.length > 0 ? cores : CORES_PADRAO;
}
export function salvarCores(cores: Cor[]): void {
  salvar(K_CORES, cores);
}

export function lerProdutos(): Produto[] {
  const p = ler<unknown[]>(K_PRODUTOS, []);
  if (!Array.isArray(p)) return [];
  return p.map(migrarProduto).filter((x): x is Produto => x !== null);
}

/** Converte produtos de formatos antigos pro novo (coresIds + peso total). */
function migrarProduto(raw: unknown): Produto | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  let coresIds: string[] = Array.isArray(r.coresIds)
    ? (r.coresIds as unknown[]).map(String)
    : [];
  let gramas = Number(r.gramas) || 0;

  // Formato intermediário: itens = [{ corId, gramas }, ...]
  if (coresIds.length === 0 && Array.isArray(r.itens)) {
    const itens = r.itens as Array<{ corId?: unknown; gramas?: unknown }>;
    coresIds = itens.map((i) => String(i.corId ?? "")).filter(Boolean);
    if (!gramas) {
      gramas = itens.reduce((s, i) => s + (Number(i.gramas) || 0), 0);
    }
  }
  // Formato mais antigo: corId único.
  if (coresIds.length === 0 && typeof r.corId === "string") {
    coresIds = [r.corId];
  }

  return {
    id: String(r.id ?? Date.now().toString(36)),
    nome: String(r.nome ?? "Produto"),
    coresIds,
    gramas,
    unidade: r.unidade === "kg" ? "kg" : "g",
    horas: Number(r.horas) || 0,
    minutos: Number(r.minutos) || 0,
    margem: Number(r.margem) || 1,
    precoVenda: Number(r.precoVenda) || 0,
    criadoEm: Number(r.criadoEm) || 0,
    vendidos: Number(r.vendidos) || 0,
  };
}
export function salvarProdutos(produtos: Produto[]): void {
  salvar(K_PRODUTOS, produtos);
}
