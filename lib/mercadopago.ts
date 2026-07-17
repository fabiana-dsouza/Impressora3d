/**
 * Conversa com o Mercado Pago e grava o resultado na tabela `assinaturas`.
 *
 * SÓ SERVIDOR: usa o MP_ACCESS_TOKEN e a service_role do Supabase. Nunca
 * importe daqui em código que roda no navegador.
 *
 * A regra de ouro é a mesma em todo lugar: a fonte da verdade é a API do
 * Mercado Pago, NUNCA o corpo de um aviso (webhook) — qualquer um pode forjar
 * um aviso, mas ninguém forja a resposta autenticada do MP com o nosso token.
 */
import { createClient } from "@supabase/supabase-js";

const MP = "https://api.mercadopago.com";

/** status do preapproval no MP  ->  status na nossa tabela */
const STATUS: Record<string, string> = {
  authorized: "ativa",
  paused: "atrasada",
  cancelled: "cancelada",
  pending: "pendente",
};

function auth(mpToken: string) {
  return { headers: { Authorization: `Bearer ${mpToken}` } };
}

/**
 * Resolve o preapproval (a assinatura) a partir do id que veio num aviso.
 *
 * Existem DOIS tipos de aviso e o id de cada um aponta pra coisas diferentes:
 *   - `subscription_preapproval`         -> o id JÁ é o da assinatura;
 *   - `subscription_authorized_payment`  -> o id é de um PAGAMENTO (a cobrança
 *     do mês que passou), e é ele que aponta de volta pra assinatura.
 *
 * Tratar todo aviso como preapproval — como a versão antiga fazia — quebrava a
 * renovação: no mês 2 o MP manda o aviso de pagamento, o GET /preapproval/{id}
 * dava 404, o aviso era ignorado e o `pago_ate` congelava no 1º vencimento.
 * Um mês depois a conta de quem PAGOU era barrada.
 */
export async function resolverPreapproval(
  mpToken: string,
  id: string,
  tipo: string
): Promise<any | null> {
  // Aviso de cobrança mensal: o id é de pagamento -> vira preapproval.
  if (tipo.includes("authorized_payment")) {
    return viaPagamento(mpToken, id);
  }

  const r = await fetch(`${MP}/preapproval/${id}`, auth(mpToken));
  if (r.ok) return r.json();

  // O tipo veio vazio/errado e o id era de pagamento: tenta o outro caminho
  // antes de desistir, pra não perder uma renovação por causa do rótulo.
  return viaPagamento(mpToken, id);
}

/** id de um pagamento autorizado -> a assinatura (preapproval) dele. */
async function viaPagamento(
  mpToken: string,
  id: string
): Promise<any | null> {
  const r = await fetch(`${MP}/authorized_payments/${id}`, auth(mpToken));
  if (!r.ok) return null;
  const pagamento = await r.json();
  const preId = pagamento?.preapproval_id;
  if (!preId) return null;
  const rp = await fetch(`${MP}/preapproval/${preId}`, auth(mpToken));
  return rp.ok ? rp.json() : null;
}

/**
 * Acha a assinatura mais recente de um usuário pela external_reference
 * (`<user_id>|<plano>`). Usado quando a pessoa volta do pagamento e o webhook
 * ainda não chegou: em vez de só esperar, a gente pergunta pro MP na hora.
 */
export async function buscarPreapprovalPorReferencia(
  mpToken: string,
  ref: string
): Promise<any | null> {
  const r = await fetch(
    `${MP}/preapproval/search?external_reference=${encodeURIComponent(ref)}`,
    auth(mpToken)
  );
  if (!r.ok) return null;
  const dados = await r.json();
  const lista: any[] = Array.isArray(dados?.results) ? dados.results : [];
  if (lista.length === 0) return null;

  // A mais recente ganha (a pessoa pode ter tentado assinar mais de uma vez).
  return lista.sort((a, b) => {
    const da = Date.parse(a?.date_created ?? "") || 0;
    const dc = Date.parse(b?.date_created ?? "") || 0;
    return dc - da;
  })[0];
}

/**
 * Acha a assinatura mais recente de um usuário sem saber o plano de antemão:
 * tenta as duas external_references possíveis (`<id>|mensal` e `<id>|anual`)
 * e devolve a mais nova. Usado no retorno do pagamento pra não depender só do
 * webhook.
 */
export async function buscarPreapprovalDoUsuario(
  mpToken: string,
  userId: string
): Promise<any | null> {
  const candidatos = await Promise.all(
    ["mensal", "anual"].map((p) =>
      buscarPreapprovalPorReferencia(mpToken, `${userId}|${p}`)
    )
  );
  const achados = candidatos.filter(Boolean);
  if (achados.length === 0) return null;
  return achados.sort((a, b) => {
    const da = Date.parse(a?.date_created ?? "") || 0;
    const dc = Date.parse(b?.date_created ?? "") || 0;
    return dc - da;
  })[0];
}

/**
 * Cancela uma assinatura no Mercado Pago. Devolve true se o MP aceitou.
 * A gravação no nosso banco vem depois (pelo aviso ou na mão).
 */
export async function cancelarPreapproval(
  mpToken: string,
  preapprovalId: string
): Promise<boolean> {
  const r = await fetch(`${MP}/preapproval/${preapprovalId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  return r.ok;
}

/**
 * Grava (ou atualiza) a assinatura no banco a partir de um preapproval que já
 * veio da API do MP. Escreve com a service_role, que ignora a RLS — por isso
 * este arquivo é server-only.
 *
 * Devolve se a assinatura ficou ATIVA (a tela de retorno usa isso pra parar de
 * esperar) ou um erro simples.
 */
export async function gravarAssinatura(
  supaUrl: string,
  serviceKey: string,
  preapproval: any
): Promise<{ ativa: boolean } | { erro: string }> {
  // external_reference = "<user_id>|<plano>" (definido na hora de assinar)
  const [userId, plano] = String(preapproval?.external_reference ?? "").split(
    "|"
  );
  if (!userId || userId.length < 30) return { erro: "sem-usuario" };

  const status = STATUS[String(preapproval?.status)] ?? "pendente";

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quando o MP NÃO manda a próxima data (é o caso do cancelamento), a gente
  // NÃO zera o `pago_ate`: mantém o que já estava lá pra pessoa continuar
  // usando até o fim do período que ela pagou. Zerar aqui tiraria o acesso na
  // hora de quem só cancelou a renovação — que é o oposto do combinado.
  let pagoAte: string | null = preapproval?.next_payment_date ?? null;
  if (!pagoAte) {
    const { data: atual } = await admin
      .from("assinaturas")
      .select("pago_ate")
      .eq("user_id", userId)
      .maybeSingle();
    pagoAte = atual?.pago_ate ?? null;
  }

  const { error } = await admin.from("assinaturas").upsert(
    {
      user_id: userId,
      status,
      plano: plano === "anual" ? "anual" : "mensal",
      provedor: "mercadopago",
      provedor_id: String(preapproval?.id ?? ""),
      pago_ate: pagoAte,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("Falhou ao gravar assinatura", error);
    return { erro: "banco" };
  }
  return { ativa: status === "ativa" };
}
