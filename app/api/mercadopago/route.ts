import { NextResponse } from "next/server";
import { resolverPreapproval, gravarAssinatura } from "@/lib/mercadopago";

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
  const tipo = String(
    corpo?.type ?? searchParams.get("type") ?? searchParams.get("topic") ?? ""
  );

  // Só nos interessam avisos de assinatura (a criação/pausa/cancelamento) e de
  // cobrança da assinatura (a renovação de cada mês).
  const ehAssinatura =
    tipo.includes("preapproval") ||
    tipo.includes("subscription") ||
    tipo.includes("authorized_payment");
  if (!id || (tipo && !ehAssinatura)) {
    return NextResponse.json({ ok: true });
  }

  // Fonte da verdade: a própria API do Mercado Pago.
  const preapproval = await resolverPreapproval(mpToken, String(id), tipo);
  if (!preapproval) return NextResponse.json({ ok: true });

  const resultado = await gravarAssinatura(supaUrl, serviceKey, preapproval);
  if ("erro" in resultado && resultado.erro === "banco") {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
