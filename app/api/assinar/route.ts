import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PLANOS, ehPlanoId } from "@/lib/planos";

/**
 * Cria a assinatura recorrente no Mercado Pago e devolve o link de
 * pagamento. O cartão é digitado NA PÁGINA DO MERCADO PAGO — nunca aqui.
 */
export async function POST(request: Request) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const mpToken = process.env.MP_ACCESS_TOKEN;

  if (!supaUrl || !supaKey) {
    return NextResponse.json({ erro: "supabase-nao-configurado" }, { status: 500 });
  }
  // Sem token do Mercado Pago: a página de planos mostra o passo a passo.
  if (!mpToken) {
    return NextResponse.json({ erro: "pagamentos-nao-configurados" }, { status: 501 });
  }

  // Quem está pedindo precisa estar logado.
  const cookieStore = cookies();
  const supabase = createServerClient(supaUrl, supaKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ erro: "sem-login" }, { status: 401 });
  }

  const corpo = await request.json().catch(() => ({}));
  const plano = corpo?.plano;
  if (!ehPlanoId(plano)) {
    return NextResponse.json({ erro: "plano-invalido" }, { status: 400 });
  }
  const p = PLANOS[plano];

  const site =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  const resposta = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: `Calculadora da Minha Startup — plano ${p.nome.toLowerCase()}`,
      // amarra o pagamento ao usuário: é assim que o webhook sabe quem liberar
      external_reference: `${user.id}|${plano}`,
      payer_email: user.email,
      auto_recurring: {
        frequency: p.frequenciaMeses,
        frequency_type: "months",
        transaction_amount: p.preco,
        currency_id: "BRL",
      },
      back_url: `${site}/planos?volta=1`,
      status: "pending",
    }),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok || !dados?.init_point) {
    console.error("Mercado Pago recusou a assinatura:", dados);
    return NextResponse.json(
      { erro: "mp-falhou", detalhe: dados?.message ?? null },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: dados.init_point });
}
