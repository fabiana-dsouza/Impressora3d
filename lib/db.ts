/**
 * Camada de dados: tudo que as telas precisam ler/gravar no Supabase.
 * A segurança de verdade está no banco (Row Level Security) — aqui a gente
 * só conversa com ele usando a sessão do usuário logado.
 */
import { supabase } from "./supabase/client";
import { CONFIG_PADRAO, CORES_PADRAO, EMPRESA_PADRAO } from "./defaults";
import type { Config, Cor, Produto } from "./types";
import {
  lerConfig as lerConfigLocal,
  lerCores as lerCoresLocal,
  lerProdutos as lerProdutosLocal,
} from "./storage";

type Linha = Record<string, any>;

async function idUsuario(): Promise<string> {
  const { data, error } = await supabase().auth.getUser();
  if (error || !data.user) {
    throw new Error("Você precisa entrar na sua conta!");
  }
  return data.user.id;
}

/* ---------------- mapeamento linha <-> tipos do app ---------------- */

function paraConfig(r: Linha): Config {
  return {
    potenciaWatts: Number(r.potencia_watts),
    tarifaKwh: Number(r.tarifa_kwh),
    precoImpressora: Number(r.preco_impressora),
    vidaUtilHoras: Number(r.vida_util_horas),
    taxaFalhas: Number(r.taxa_falhas),
    margemPadrao: Number(r.margem_padrao),
    custoEmbalagem: Number(r.custo_embalagem),
  };
}

function deConfig(c: Config, userId: string): Linha {
  return {
    user_id: userId,
    potencia_watts: c.potenciaWatts,
    tarifa_kwh: c.tarifaKwh,
    preco_impressora: c.precoImpressora,
    vida_util_horas: c.vidaUtilHoras,
    taxa_falhas: c.taxaFalhas,
    margem_padrao: c.margemPadrao,
    custo_embalagem: c.custoEmbalagem,
  };
}

function paraCor(r: Linha): Cor {
  return {
    id: String(r.id),
    nome: String(r.nome),
    hex: String(r.hex),
    tipo: r.tipo === "especial" ? "especial" : "basica",
    precoRoloKg: Number(r.preco_rolo_kg),
  };
}

function deCor(c: Cor, userId: string): Linha {
  return {
    id: c.id,
    user_id: userId,
    nome: c.nome,
    hex: c.hex,
    tipo: c.tipo,
    preco_rolo_kg: c.precoRoloKg,
  };
}

function paraProduto(r: Linha): Produto {
  return {
    id: String(r.id),
    nome: String(r.nome),
    coresIds: Array.isArray(r.cores_ids) ? r.cores_ids.map(String) : [],
    gramas: Number(r.gramas) || 0,
    unidade: r.unidade === "kg" ? "kg" : "g",
    horas: Number(r.horas) || 0,
    minutos: Number(r.minutos) || 0,
    margem: Number(r.margem) || 1,
    precoVenda: Number(r.preco_venda) || 0,
    criadoEm: r.criado_em ? Date.parse(r.criado_em) : 0,
    vendidos: Number(r.vendidos) || 0,
  };
}

function deProduto(p: Produto, userId: string): Linha {
  return {
    id: p.id,
    user_id: userId,
    nome: p.nome,
    cores_ids: p.coresIds,
    gramas: p.gramas,
    unidade: p.unidade,
    horas: p.horas,
    minutos: p.minutos,
    margem: p.margem,
    preco_venda: p.precoVenda,
    vendidos: p.vendidos,
    criado_em: new Date(p.criadoEm || Date.now()).toISOString(),
  };
}

/* ------- migração: sobe o que estava no localStorage (uma vez) ------- */

const FLAG_MIGRACAO = "startup:migrado-supabase";
let migracao: Promise<void> | null = null;

function migrarDadosLocais(): Promise<void> {
  if (!migracao) {
    migracao = fazerMigracao().catch((e) => {
      migracao = null; // deixa tentar de novo na próxima
      throw e;
    });
  }
  return migracao;
}

async function fazerMigracao(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(FLAG_MIGRACAO)) return;

  const uid = await idUsuario();
  const sb = supabase();

  // Produtos antigos só entram se a conta ainda não tem nenhum.
  const locais = lerProdutosLocal();
  if (locais.length > 0) {
    const { count, error } = await sb
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);
    if (error) throw error;
    if ((count ?? 0) === 0) {
      const { error: e2 } = await sb
        .from("produtos")
        .insert(locais.map((p) => deProduto(p, uid)));
      if (e2) throw e2;
    }
  }

  // Cores locais (inclui as padrão) — ignora as que já existem no banco.
  const coresLocais = lerCoresLocal();
  if (coresLocais.length > 0) {
    const { error } = await sb
      .from("cores")
      .upsert(coresLocais.map((c) => deCor(c, uid)), {
        onConflict: "user_id,id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  // Config local — só se a conta ainda não tem.
  const { error: e3 } = await sb
    .from("configs")
    .upsert(deConfig(lerConfigLocal(), uid), {
      onConflict: "user_id",
      ignoreDuplicates: true,
    });
  if (e3) throw e3;

  window.localStorage.setItem(FLAG_MIGRACAO, "1");
}

/* ---------------------------- Config ---------------------------- */

export async function lerConfig(): Promise<Config> {
  await migrarDadosLocais();
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("configs")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (data) return paraConfig(data);

  // Primeira vez: cria a config padrão pra esse usuário.
  const { error: e2 } = await supabase()
    .from("configs")
    .upsert(deConfig(CONFIG_PADRAO, uid), {
      onConflict: "user_id",
      ignoreDuplicates: true,
    });
  if (e2) throw e2;
  return { ...CONFIG_PADRAO };
}

export async function salvarConfig(config: Config): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("configs")
    .upsert(deConfig(config, uid), { onConflict: "user_id" });
  if (error) throw error;
}

/* ----------------------------- Cores ----------------------------- */

export async function lerCores(): Promise<Cor[]> {
  await migrarDadosLocais();
  const uid = await idUsuario();
  const buscar = () =>
    supabase()
      .from("cores")
      .select("*")
      .eq("user_id", uid)
      .order("criado_em", { ascending: true });

  let { data, error } = await buscar();
  if (error) throw error;

  // Primeira vez: semeia as cores padrão.
  if (!data || data.length === 0) {
    const { error: e2 } = await supabase()
      .from("cores")
      .upsert(CORES_PADRAO.map((c) => deCor(c, uid)), {
        onConflict: "user_id,id",
        ignoreDuplicates: true,
      });
    if (e2) throw e2;
    ({ data, error } = await buscar());
    if (error) throw error;
  }

  return (data ?? []).map(paraCor);
}

export async function salvarCor(cor: Cor): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("cores")
    .upsert(deCor(cor, uid), { onConflict: "user_id,id" });
  if (error) throw error;
}

export async function apagarCor(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("cores")
    .delete()
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/* ---------------------------- Produtos ---------------------------- */

export async function lerProdutos(): Promise<Produto[]> {
  await migrarDadosLocais();
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("produtos")
    .select("*")
    .eq("user_id", uid)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paraProduto);
}

export async function lerProduto(id: string): Promise<Produto | null> {
  await migrarDadosLocais();
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("produtos")
    .select("*")
    .eq("user_id", uid)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? paraProduto(data) : null;
}

/**
 * O banco recusou criar o produto porque a assinatura não está ativa.
 * Existe pra tela poder dizer "falta assinar" em vez de culpar a internet.
 */
export class SemAssinaturaError extends Error {
  constructor() {
    super("Sua assinatura não está ativa.");
    this.name = "SemAssinaturaError";
  }
}

/** 42501 = insufficient_privilege: a linha esbarrou na Row Level Security. */
function ehErroDeRls(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42501" || /row-level security/i.test(error.message ?? "")
  );
}

export async function criarProduto(produto: Produto): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("produtos")
    .insert(deProduto(produto, uid));
  if (!error) return;

  // A policy "cria produto com assinatura" exige assinatura_ativa(). Mas RLS
  // também barra outras coisas, então só acusamos falta de assinatura depois
  // de confirmar que é isso mesmo — chutar aqui seria mentir pra criança.
  if (ehErroDeRls(error)) {
    const assinatura = await lerAssinatura().catch(() => null);
    if (assinatura && !assinatura.ativa) throw new SemAssinaturaError();
  }
  throw error;
}

export async function apagarProduto(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("produtos")
    .delete()
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

export async function atualizarVendidos(
  id: string,
  vendidos: number
): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("produtos")
    .update({ vendidos: Math.max(0, Math.round(vendidos)) })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/* ----------------------------- Perfil / empresa ----------------------------- */

/**
 * Nome da empresa do usuário logado. O perfil nasce junto com a conta
 * (gatilho no banco), então aqui a gente só lê.
 */
export async function lerPerfil(): Promise<{ nomeEmpresa: string }> {
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("perfis")
    .select("nome_empresa")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return {
    nomeEmpresa: data?.nome_empresa
      ? String(data.nome_empresa)
      : EMPRESA_PADRAO,
  };
}

/**
 * Acha o email de uma empresa pro login. O banco só devolve o email se a
 * SENHA estiver certa — assim ninguém fica chutando nomes pra pescar emails.
 */
export async function emailDaEmpresa(
  nome: string,
  senha: string
): Promise<string | null> {
  const { data, error } = await supabase().rpc("email_da_empresa", {
    p_nome: nome,
    p_senha: senha,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Diz se já existe uma empresa com esse nome. */
export async function empresaExiste(nome: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("empresa_existe", {
    p_nome: nome,
  });
  if (error) throw error;
  return Boolean(data);
}

/* --------------------------- Assinatura --------------------------- */

export interface Assinatura {
  status: "nenhuma" | "pendente" | "ativa" | "atrasada" | "cancelada";
  plano: "mensal" | "anual" | null;
  pagoAte: number | null;
  /** true = pode usar a fábrica */
  ativa: boolean;
}

export async function lerAssinatura(): Promise<Assinatura> {
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("assinaturas")
    .select("status, plano, pago_ate")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;

  const status = (data?.status ?? "nenhuma") as Assinatura["status"];
  const pagoAte = data?.pago_ate ? Date.parse(data.pago_ate) : null;
  return {
    status,
    plano: data?.plano === "anual" || data?.plano === "mensal" ? data.plano : null,
    pagoAte,
    ativa: status === "ativa" && (pagoAte === null || pagoAte > Date.now()),
  };
}

/* ----------------------------- Conta ----------------------------- */

export async function emailUsuario(): Promise<string> {
  const { data } = await supabase().auth.getUser();
  return data.user?.email ?? "";
}

export async function sair(): Promise<void> {
  await supabase().auth.signOut();
}
