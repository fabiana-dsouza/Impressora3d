/**
 * Camada de dados: tudo que as telas precisam ler/gravar no Supabase.
 * A segurança de verdade está no banco (Row Level Security) — aqui a gente
 * só conversa com ele usando a sessão do usuário logado.
 */
import { supabase } from "./supabase/client";
import { CONFIG_PADRAO, CORES_PADRAO, EMPRESA_PADRAO } from "./defaults";
import type { Cliente, Config, Cor, Produto, Venda } from "./types";
import type { NovaVenda } from "./vendas";
import { linhasDaMigracao } from "./vendas";
import {
  lerConfig as lerConfigLocal,
  lerCores as lerCoresLocal,
  lerProdutos as lerProdutosLocal,
} from "./storage";
import { nomeLimpo, chaveDoCliente } from "./clientes";
import { novoId } from "./format";

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

/**
 * Diz se esse Gmail já tem conta (comparado na forma canônica — sem pontos nem
 * +apelido, igual o banco faz). O cadastro usa isto pra avisar "esse Gmail já
 * tem conta" ANTES de tentar criar, em vez de deixar a colisão virar o erro cru
 * "Database error saving new user".
 *
 * Falha PRA FORA (devolve false) se a função ainda não existir no banco: assim
 * um cadastro legítimo nunca fica travado por causa disso — a trava de verdade
 * continua sendo o índice único do banco.
 */
export async function emailExiste(email: string): Promise<boolean> {
  const { data, error } = await supabase().rpc("email_existe", {
    p_email: email,
  });
  if (error) return false;
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
  // Espelha a função assinatura_ativa() do banco (as duas TÊM que concordar,
  // senão a tela manda pra /planos quem o Postgres ainda deixaria fabricar):
  //   - ativa: folga de 3 dias pro webhook de renovação atrasado;
  //   - cancelada: vale até o fim do período pago, corte limpo no vencimento.
  const FOLGA_MS = 3 * 24 * 60 * 60 * 1000;
  const agora = Date.now();
  const ativa =
    (status === "ativa" &&
      (pagoAte === null || pagoAte > agora - FOLGA_MS)) ||
    (status === "cancelada" && pagoAte !== null && pagoAte > agora);
  return {
    status,
    plano: data?.plano === "anual" || data?.plano === "mensal" ? data.plano : null,
    pagoAte,
    ativa,
  };
}

/**
 * Cancela a assinatura no Mercado Pago (para as cobranças futuras). O acesso
 * continua até o fim do período já pago. Quem faz o trabalho é o servidor, que
 * tem o token do MP e a chave secreta do banco.
 */
export async function cancelarAssinatura(): Promise<void> {
  const resposta = await fetch("/api/assinar/cancelar", { method: "POST" });
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => null);
    throw new Error(String(dados?.erro ?? "falhou"));
  }
}

/* ----------------------------- Conta ----------------------------- */

export async function emailUsuario(): Promise<string> {
  const { data } = await supabase().auth.getUser();
  return data.user?.email ?? "";
}

export async function sair(): Promise<void> {
  await supabase().auth.signOut();
}

// =====================================================================
// CLIENTES
// =====================================================================

function paraCliente(r: Linha): Cliente {
  return {
    id: String(r.id),
    nome: String(r.nome),
    criadoEm: r.criado_em ? Date.parse(r.criado_em) : 0,
    usadoEm: r.usado_em ? Date.parse(r.usado_em) : 0,
  };
}

/** Mais recentemente usados primeiro — é a ordem das pastilhas de atalho. */
export async function lerClientes(): Promise<Cliente[]> {
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("clientes")
    .select("*")
    .eq("user_id", uid)
    .order("usado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paraCliente);
}

/**
 * Acha o cliente pelo nome (ignorando maiúscula e espaço sobrando) ou cria.
 * Devolve o id.
 */
export async function acharOuCriarCliente(nome: string): Promise<string> {
  const limpo = nomeLimpo(nome);
  if (!chaveDoCliente(nome)) {
    throw new Error("Escreve o nome de quem vai comprar!");
  }

  const uid = await idUsuario();
  const sb = supabase();

  const achado = await sb
    .from("clientes")
    .select("id")
    .eq("user_id", uid)
    // `ilike` é busca de padrão case-insensitive. Os curingas `%` e `_` são
    // sempre ativos, então a gente escapa eles pra se comportar como igualdade.
    .ilike("nome", semCuringa(limpo))
    .maybeSingle();
  if (achado.error) throw achado.error;
  if (achado.data?.id) return String(achado.data.id);

  const id = novoId();
  const { error } = await sb
    .from("clientes")
    .insert({ id, user_id: uid, nome: limpo });

  if (error) {
    // 23505 = violação de unicidade. Duas telas gravando o mesmo nome ao
    // mesmo tempo: quem perdeu a corrida busca de novo em vez de estourar.
    if ((error as { code?: string }).code === "23505") {
      const denovo = await sb
        .from("clientes")
        .select("id")
        .eq("user_id", uid)
        .ilike("nome", semCuringa(limpo))
        .maybeSingle();
      if (denovo.error) throw denovo.error;
      if (denovo.data?.id) return String(denovo.data.id);
    }
    throw error;
  }

  return id;
}

export async function renomearCliente(id: string, nome: string): Promise<void> {
  const limpo = nomeLimpo(nome);
  if (!chaveDoCliente(nome)) {
    throw new Error("Escreve o nome de quem vai comprar!");
  }
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("clientes")
    .update({ nome: limpo })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Escapa os curingas do LIKE. Sem isto, um cliente chamado "Ana_Maria" casaria
 * com "AnaXMaria" — o `_` é curinga, e a venda iria pro cliente errado.
 */
function semCuringa(texto: string): string {
  return texto.replace(/[%_\\]/g, "\\$&");
}

/** Sobe o cliente pro topo das pastilhas. Chamado ao criar uma venda. */
export async function marcarClienteUsado(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("clientes")
    .update({ usado_em: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

// =====================================================================
// VENDAS
// =====================================================================

function paraVenda(r: Linha): Venda {
  return {
    id: String(r.id),
    produtoId: r.produto_id ? String(r.produto_id) : null,
    produtoNome: String(r.produto_nome),
    clienteId: r.cliente_id ? String(r.cliente_id) : null,
    coresIds: Array.isArray(r.cores_ids) ? r.cores_ids.map(String) : [],
    preco: Number(r.preco) || 0,
    custo: Number(r.custo) || 0,
    pagoEm: r.pago_em ? Date.parse(r.pago_em) : null,
    // Linhas antigas (antes da coluna existir) voltam sem destino: são vendas.
    destino: r.destino === "mim" || r.destino === "graca" ? r.destino : "venda",
    criadoEm: r.criado_em ? Date.parse(r.criado_em) : 0,
  };
}

export async function lerVendas(): Promise<Venda[]> {
  const uid = await idUsuario();
  const { data, error } = await supabase()
    .from("vendas")
    .select("*")
    .eq("user_id", uid)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paraVenda);
}

export async function criarVenda(v: NovaVenda): Promise<string> {
  const uid = await idUsuario();
  const id = novoId();
  const { error } = await supabase().from("vendas").insert({
    id,
    user_id: uid,
    produto_id: v.produtoId,
    produto_nome: v.produtoNome,
    cliente_id: v.clienteId,
    cores_ids: v.coresIds,
    preco: v.preco,
    custo: v.custo,
    pago_em: v.pagoEm === null ? null : new Date(v.pagoEm).toISOString(),
    destino: v.destino,
  });
  if (error) throw error;

  // Sobe o cliente pro topo das pastilhas. Não trava a venda se falhar:
  // a ordem dos atalhos é comodidade, a venda é o que importa.
  if (v.clienteId) {
    marcarClienteUsado(v.clienteId).catch((e) => console.error(e));
  }

  return id;
}

export async function marcarPago(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("vendas")
    .update({ pago_em: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Desfaz o "recebi": a venda volta pra "falta pagar". Pra quando marcou pago
 * sem querer (apertou o botão errado). O oposto de marcarPago.
 */
export async function marcarNaoPago(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("vendas")
    .update({ pago_em: null })
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Apaga a venda de vez — some do cofrinho pra sempre. Pra linhas que foram só
 * teste. Não desfaz: por isso a tela pergunta antes.
 */
export async function apagarVenda(id: string): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("vendas")
    .delete()
    .eq("user_id", uid)
    .eq("id", id);
  if (error) throw error;
}

/**
 * Renomeia o produto no catálogo e mantém todas as vendas dele com o mesmo
 * nome — o nome na aba Vendidos bate com "Meus produtos". Usado tanto pelo
 * renomear do card quanto pelo "arrumar esta venda" (quando a peça existe).
 */
export async function renomearProduto(
  id: string,
  nome: string
): Promise<void> {
  const uid = await idUsuario();
  const sb = supabase();
  const limpo = nome.trim();

  const produto = await sb
    .from("produtos")
    .update({ nome: limpo })
    .eq("user_id", uid)
    .eq("id", id);
  if (produto.error) throw produto.error;

  const vendas = await sb
    .from("vendas")
    .update({ produto_nome: limpo })
    .eq("user_id", uid)
    .eq("produto_id", id);
  if (vendas.error) throw vendas.error;
}

/**
 * Renomeia o produto a partir de uma venda. Se o produto ainda existe, mantém
 * o catálogo e todas as vendas dele com o mesmo nome. Venda órfã muda sozinha.
 */
export async function renomearProdutoDaVenda(
  vendaId: string,
  produtoId: string | null,
  produtoNome: string
): Promise<void> {
  if (produtoId) {
    await renomearProduto(produtoId, produtoNome);
    return;
  }

  const uid = await idUsuario();
  const venda = await supabase()
    .from("vendas")
    .update({ produto_nome: produtoNome.trim() })
    .eq("user_id", uid)
    .eq("id", vendaId);
  if (venda.error) throw venda.error;
}

export async function definirClienteDaVenda(
  vendaId: string,
  clienteId: string
): Promise<void> {
  const uid = await idUsuario();
  const { error } = await supabase()
    .from("vendas")
    .update({ cliente_id: clienteId })
    .eq("user_id", uid)
    .eq("id", vendaId);
  if (error) throw error;
}

/** Nome da linha de controle em `migracoes`. Não mudar: é a trava. */
const MIGRACAO_VENDAS = "vendas-do-contador";

/**
 * Converte `produtos.vendidos` em linhas de venda pagas, uma vez por conta.
 *
 * O contador antigo NÃO é apagado: fica parado, sem ninguém ler. Se esta
 * migração sair errada, dá pra refazer a partir dele — apagar seria queimar
 * a ponte.
 *
 * Devolve true se migrou agora (quem chama recarrega as vendas).
 */
export async function migrarVendasAntigas(
  produtos: Produto[],
  config: Config,
  cores: Cor[]
): Promise<boolean> {
  const uid = await idUsuario();
  const sb = supabase();

  const jaFoi = await sb
    .from("migracoes")
    .select("nome")
    .eq("user_id", uid)
    .eq("nome", MIGRACAO_VENDAS)
    .maybeSingle();
  if (jaFoi.error) throw jaFoi.error;
  if (jaFoi.data) return false;

  // `migracoes` só tem policy de select/insert — não dá update nem delete.
  // Então a marca é IRREVERSÍVEL de dentro do app. Se `produtos` chegar vazio
  // (ainda não carregou, por exemplo), NÃO dá pra gravar "já migrei" tendo
  // migrado nada: os contadores antigos ficariam presos pra sempre, só
  // destravável com SQL na mão direto no banco vivo.
  if (produtos.length === 0) return false;

  const linhas = linhasDaMigracao(produtos, config, cores);

  // Os ids das linhas migradas são DETERMINÍSTICOS (não usam novoId()) de
  // propósito: se fosse um id aleatório, repetir a migração — internet caiu
  // logo depois do commit, aba fechou no meio do await, token expirou antes
  // da marca ser gravada, ou duas abas rodando ao mesmo tempo — geraria
  // linhas NOVAS em vez de bater com as que já existem, e o cofrinho da
  // criança dobraria de valor sozinho. Contando "a N-ésima venda deste
  // produto" o id fica igual em qualquer tentativa, e o upsert abaixo faz a
  // repetição não gravar nada de novo.
  const contadores = new Map<string, number>();
  const idDaLinha = (produtoId: string | null): string => {
    // Linha migrada sempre vem de um produto (ver linhasDaMigracao), então
    // produtoId não deveria ser null aqui — mas se vier, usa uma chave fixa
    // em vez de deixar `undefined-${n}` variar por engano.
    const chave = produtoId ?? "sem-produto";
    const n = contadores.get(chave) ?? 0;
    contadores.set(chave, n + 1);
    return `mig-${chave}-${n}`;
  };

  if (linhas.length > 0) {
    const { error } = await sb.from("vendas").upsert(
      linhas.map((l) => ({
        id: idDaLinha(l.produtoId),
        user_id: uid,
        produto_id: l.produtoId,
        produto_nome: l.produtoNome,
        cliente_id: l.clienteId,
        cores_ids: l.coresIds,
        preco: l.preco,
        custo: l.custo,
        pago_em: l.pagoEm === null ? null : new Date(l.pagoEm).toISOString(),
      })),
      { onConflict: "user_id,id", ignoreDuplicates: true }
    );
    if (error) throw error;
  }

  // A marca vai DEPOIS das linhas: se o insert acima falhar, a migração não
  // é dada como feita e roda de novo na próxima visita. Marcar antes deixaria
  // o dado velho pra trás pra sempre.
  const { error: e2 } = await sb
    .from("migracoes")
    .insert({ user_id: uid, nome: MIGRACAO_VENDAS });
  // 23505 = violação de unicidade: outra aba (ou outra chamada concorrente
  // desta mesma aba) já ganhou a corrida e gravou a marca primeiro. Não é
  // falha — as linhas já foram gravadas acima com upsert de ids determinísticos,
  // então quem perdeu a corrida não precisa (nem deve) fazer nada de novo.
  if (e2 && (e2 as { code?: string }).code !== "23505") throw e2;

  return linhas.length > 0;
}
