import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Webhook do Mercado Pago: ele avisa aqui quando uma assinatura muda
 * (pagou, atrasou, cancelou) e a gente atualiza a tabela `assinaturas`.
 *
 * Segurança: a gente NUNCA confia no corpo do aviso. Pegamos só o id e
 * buscamos a assinatura direto na API do MP com o nosso token — só o que
 * o MP confirmar de verdade entra no banco.
 */
export async function POST(request: Request) {
  const mpToken = process.env.MP_ACCESS_TOKEN;
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!mpToken || !supaUrl || !serviceKey) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // O id pode vir no corpo (data.id) ou na query (?id= / ?data.id=)
  const { searchParams } = new URL(request.url);
  const corpo = await request.json().catch(() => null);
  const id =
    corpo?.data?.id ??
    searchParams.get("data.id") ??
    searchParams.get("id");
  const tipo = String(corpo?.type ?? searchParams.get("type") ?? searchParams.get("topic") ?? "");

  // Só nos interessam avisos de assinatura.
  if (!id || (tipo && !tipo.includes("preapproval") && !tipo.includes("subscription"))) {
    return NextResponse.json({ ok: true });
  }

  // Fonte da verdade: a própria API do Mercado Pago.
  const resposta = await fetch(
    `https://api.mercadopago.com/preapproval/${id}`,
    { headers: { Authorization: `Bearer ${mpToken}` } }
  );
  if (!resposta.ok) return NextResponse.json({ ok: true });
  const ass = await resposta.json();

  // external_reference = "<user_id>|<plano>" (definido na hora de assinar)
  const [userId, plano] = String(ass?.external_reference ?? "").split("|");
  if (!userId || userId.length < 30) return NextResponse.json({ ok: true });

  const mapa: Record<string, string> = {
    authorized: "ativa",
    paused: "atrasada",
    cancelled: "cancelada",
    pending: "pendente",
  };
  const status = mapa[String(ass?.status)] ?? "pendente";

  const admin = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.from("assinaturas").upsert(
    {
      user_id: userId,
      status,
      plano: plano === "anual" ? "anual" : "mensal",
      provedor: "mercadopago",
      provedor_id: String(ass?.id ?? id),
      pago_ate: ass?.next_payment_date ?? null,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error("Webhook: falhou ao gravar assinatura", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
