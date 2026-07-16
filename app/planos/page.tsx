"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as db from "@/lib/db";
import { PLANOS, ehPlanoId, type PlanoId } from "@/lib/planos";
import { brl } from "@/lib/format";
import { Logo } from "@/components/Marca";
import { IconeCadeado, IconeCheck, IconeSair } from "@/components/Icones";

export default function PlanosPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Planos />
    </Suspense>
  );
}

function Carregando() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center">
      <Logo size={64} className="animate-wiggle" />
      <p className="mt-4 font-extrabold text-mute">Um segundinho...</p>
    </main>
  );
}

function Planos() {
  const router = useRouter();
  const params = useSearchParams();
  const voltouDoPagamento = params.get("volta") === "1";

  // Veio da criação de conta com um plano já escolhido na vitrine: pra ela,
  // "criar conta" e "assinar" são o mesmo gesto, então o pagamento abre
  // sozinho em vez de pedir que ela escolha o plano de novo.
  const planoBruto = params.get("plano");
  const planoAuto: PlanoId | null =
    params.get("auto") === "1" && ehPlanoId(planoBruto) ? planoBruto : null;

  const [assinatura, setAssinatura] = useState<db.Assinatura | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [indo, setIndo] = useState<PlanoId | null>(null);
  const [erro, setErro] = useState("");
  const [precisaSetup, setPrecisaSetup] = useState(false);
  const [precisaDeploy, setPrecisaDeploy] = useState(false);
  const [conferindo, setConferindo] = useState(voltouDoPagamento);
  /* Trava do disparo automático. É `ref`, e não `state`, de propósito: o
     StrictMode roda o efeito duas vezes antes de um setState commitar, e o
     preço de escorregar aqui é uma cobrança duplicada no Mercado Pago. */
  const jaDisparou = useRef(false);

  // Carrega o status; se voltou do pagamento, confere de novo por ~30s
  // (o aviso do Mercado Pago pode levar alguns segundos pra chegar).
  useEffect(() => {
    let vivo = true;
    let tentativas = 0;

    async function conferir() {
      try {
        const a = await db.lerAssinatura();
        if (!vivo) return;
        setAssinatura(a);
        setCarregou(true);
        if (a.ativa) {
          setConferindo(false);
          return;
        }
        if (voltouDoPagamento && tentativas < 10) {
          tentativas += 1;
          setTimeout(conferir, 3000);
        } else {
          setConferindo(false);
        }
      } catch (e) {
        console.error(e);
        if (vivo) {
          setCarregou(true);
          setConferindo(false);
        }
      }
    }

    conferir();
    return () => {
      vivo = false;
    };
  }, [voltouDoPagamento]);

  const assinar = useCallback(async (plano: PlanoId) => {
    setErro("");
    setIndo(plano);
    try {
      const resposta = await fetch("/api/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const dados = await resposta.json().catch(() => null);
      if (resposta.status === 501) {
        setPrecisaSetup(true);
        setIndo(null);
        return;
      }
      // Rodando em localhost: o MP não alcança este site.
      if (resposta.status === 503) {
        setPrecisaDeploy(true);
        setIndo(null);
        return;
      }
      if (!resposta.ok || !dados?.url) {
        throw new Error(dados?.detalhe ?? "sem-url");
      }
      window.location.href = dados.url; // página segura do Mercado Pago
    } catch (e) {
      console.error(e);
      setErro("Não consegui abrir o pagamento. Tenta de novo em instantes!");
      setIndo(null);
    }
  }, []);

  // Abre o pagamento sozinho — uma vez só. Se falhar, a trava segura o
  // gatilho e a pessoa cai na tela normal pra tentar no braço.
  useEffect(() => {
    if (!planoAuto || jaDisparou.current || !carregou || conferindo) return;
    if (assinatura?.ativa) return;
    jaDisparou.current = true;
    assinar(planoAuto);
  }, [planoAuto, carregou, conferindo, assinatura, assinar]);

  async function sairDaConta() {
    await db.sair().catch(() => {});
    window.location.href = "/";
  }

  if (!carregou || conferindo) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <Logo size={64} className="animate-wiggle" />
        <p className="mt-4 font-extrabold text-mute">
          {conferindo
            ? "Conferindo seu pagamento com o Mercado Pago..."
            : "Um segundinho..."}
        </p>
      </main>
    );
  }

  // Pagamento abrindo sozinho: sem isto a lista de planos pisca por um
  // instante antes do redirect. Se der erro, cai na tela normal.
  if (planoAuto && !assinatura?.ativa && !erro && !precisaSetup && !precisaDeploy) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <Logo size={64} className="animate-wiggle" />
        <p className="display mt-4 text-xl font-bold text-tinta">
          Conta criada! 🎉
        </p>
        <p className="mt-1 font-extrabold text-mute">
          Abrindo o pagamento no Mercado Pago...
        </p>
      </main>
    );
  }

  // Já pagou: só confirma e manda pra fábrica.
  if (assinatura?.ativa) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center">
        <div className="card text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-neon/40 bg-neon/10 text-neon">
            <IconeCheck size={28} />
          </span>
          {/* Este é o "comece agora": a conta existe, o pagamento passou e a
              pessoa nunca entrou na fábrica. É aqui que cabe dizer que ela
              está ligada — não na vitrine, onde ninguém tem conta ainda. */}
          <h1 className="display mt-4 text-2xl font-bold text-tinta">
            Sua fábrica está ligada!
          </h1>
          <p className="mt-1 font-bold text-mute">
            {assinatura.plano
              ? `Plano ${PLANOS[assinatura.plano].nome.toLowerCase()} — agora é só fabricar.`
              : "Agora é só fabricar."}
          </p>
          <button
            onClick={() => router.push("/fabrica")}
            className="btn-grande btn-neon mt-5 w-full text-xl"
          >
            Comece agora
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl py-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={64} />
        <h1 className="display mt-3 text-3xl font-bold uppercase tracking-wide text-tinta">
          Ligue sua fábrica
        </h1>
        <p className="mt-1 font-bold text-mute">
          Assine pra criar seus produtos, calcular preços e acompanhar seus
          lucros.
        </p>
      </div>

      {/* aviso pós-pagamento ainda não confirmado */}
      {voltouDoPagamento && !assinatura?.ativa && (
        <p className="mb-4 animate-pop rounded-xl border border-ciano/40 bg-ciano/10 p-3 text-center font-extrabold text-ciano">
          Pagamento em processamento... assim que o Mercado Pago confirmar,
          sua conta libera sozinha. Pode recarregar esta página daqui a pouco.
        </p>
      )}

      {assinatura?.status === "atrasada" && (
        <p className="mb-4 rounded-xl border border-perigo/40 bg-perigo/15 p-3 text-center font-extrabold text-perigo">
          Sua assinatura está com pagamento atrasado. Confira o cartão na sua
          conta do Mercado Pago.
        </p>
      )}

      {/* os dois planos */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Mensal */}
        <div className="card flex flex-col">
          <p className="display text-sm font-bold uppercase tracking-widest text-mute">
            {PLANOS.mensal.nome}
          </p>
          <p className="display mono mt-2 text-4xl font-bold text-tinta">
            {brl(PLANOS.mensal.preco)}
            <span className="text-base text-mute">/mês</span>
          </p>
          <p className="mt-1 text-sm font-bold text-mute">
            {PLANOS.mensal.legenda}
          </p>
          <div className="flex-1" />
          <button
            onClick={() => assinar("mensal")}
            disabled={indo !== null}
            className="btn-grande btn-escuro mt-5 w-full disabled:opacity-60"
          >
            {indo === "mensal" ? "Abrindo pagamento..." : "Assinar mensal"}
          </button>
        </div>

        {/* Anual (destaque) */}
        <div className="card flex flex-col border-neon/40">
          <div className="flex items-center justify-between">
            <p className="display text-sm font-bold uppercase tracking-widest text-mute">
              {PLANOS.anual.nome}
            </p>
            <span className="rounded-full border border-neon/40 bg-neon/10 px-2.5 py-0.5 text-xs font-extrabold text-neon">
              2 meses grátis
            </span>
          </div>
          <p className="display mono mt-2 text-4xl font-bold text-neon">
            {brl(PLANOS.anual.preco)}
            <span className="text-base text-mute">/ano</span>
          </p>
          <p className="mt-1 text-sm font-bold text-mute">
            sai por {brl(PLANOS.anual.porMes)}/mês — {PLANOS.anual.legenda}
          </p>
          <div className="flex-1" />
          <button
            onClick={() => assinar("anual")}
            disabled={indo !== null}
            className="btn-grande btn-neon mt-5 w-full disabled:opacity-60"
          >
            {indo === "anual" ? "Abrindo pagamento..." : "Assinar anual"}
          </button>
        </div>
      </div>

      {/* o que vem junto */}
      <div className="card mt-4">
        <ul className="space-y-2 font-bold text-mute">
          {[
            "Produtos ilimitados com preço certo na hora",
            "Notinha de cada venda com custo e lucro de verdade",
            "Cofrinho com tudo que você já ganhou",
            "Seus dados guardados na nuvem, só seus",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-neon">
                <IconeCheck size={18} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-bold text-mute">
        <IconeCadeado size={16} />
        O cartão é digitado na página segura do Mercado Pago — nunca aqui.
      </p>

      {erro && (
        <p className="mt-4 animate-pop rounded-xl border border-perigo/40 bg-perigo/15 p-3 text-center font-extrabold text-perigo">
          {erro}
        </p>
      )}

      {precisaDeploy && (
        <div className="card mt-4 border-ciano/40">
          <p className="display font-bold text-ciano">
            Só dá pra assinar no site publicado
          </p>
          <p className="mt-1 text-sm font-bold text-mute">
            Recado pra pessoa adulta responsável: este site está rodando em{" "}
            <code className="rounded bg-painel2 px-1.5 py-0.5 text-ciano">
              localhost
            </code>
            , e o Mercado Pago não alcança essa máquina — nem pra devolver a
            pessoa depois de pagar, nem pra avisar que o pagamento passou. Faça
            o deploy, cadastre o webhook no painel do MP e assine por lá. O
            passo a passo está no README.
          </p>
        </div>
      )}

      {precisaSetup && (
        <div className="card mt-4 border-ciano/40">
          <p className="display font-bold text-ciano">
            Pagamentos ainda não configurados
          </p>
          <p className="mt-1 text-sm font-bold text-mute">
            Recado pra pessoa adulta responsável: falta colocar o{" "}
            <code className="rounded bg-painel2 px-1.5 py-0.5 text-ciano">
              MP_ACCESS_TOKEN
            </code>{" "}
            do Mercado Pago no ambiente. O passo a passo completo está no
            README do projeto.
          </p>
        </div>
      )}

      <button
        onClick={sairDaConta}
        className="mx-auto mt-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-mute underline"
      >
        <IconeSair size={16} /> Sair da conta
      </button>
    </main>
  );
}
