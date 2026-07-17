"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import Carretel from "@/components/Carretel";

/**
 * As "imagens dos produtos" que encavalam os cantos do big modal do herói:
 * metade sobre o vidro, metade pra fora. Respiram devagar (GSAP), como se
 * flutuassem. Só no desktop — no celular o painel fica limpo, sem poluir.
 *
 * O herói é Server Component (lê a sessão); por isso as peças animadas moram
 * aqui, num componente client isolado.
 */

/** Uma notinha pequenininha — a assinatura da fabriquinha. */
function MiniNotinha() {
  return (
    <div className="recibo mono w-44 text-[0.58rem]">
      <p className="display text-center text-[1.15em] font-bold uppercase tracking-[0.12em]">
        ★ Dino Prints ★
      </p>
      <div className="tracejado my-[0.8em]" />
      <div className="linha-recibo">
        <span className="rotulo whitespace-nowrap uppercase">filamento</span>
        <span className="pontos" />
        <span className="valor">✓</span>
      </div>
      <div className="mt-[0.5em] linha-recibo">
        <span className="rotulo whitespace-nowrap uppercase">energia</span>
        <span className="pontos" />
        <span className="valor">✓</span>
      </div>
      <div className="tracejado my-[0.8em]" />
      <p className="text-center">
        <span className="carimbo text-[0.9em]">LUCRO R$ 5,50</span>
      </p>
    </div>
  );
}

/** Um card de produto em miniatura. */
function MiniProduto() {
  return (
    <div className="card flex w-52 items-center gap-3 p-3">
      <span
        className="flex shrink-0 flex-col overflow-hidden rounded-lg"
        style={{ width: 10, height: 44 }}
      >
        <span className="flex-1" style={{ background: "#A9E8C4" }} />
        <span className="flex-1" style={{ background: "#FFD3A6" }} />
      </span>
      <div className="min-w-0">
        <p className="display truncate text-sm font-bold text-tinta">Chaveiro Dino</p>
        <p className="text-xs font-bold text-mute">
          lucro <span className="text-neon">R$ 5,50</span>
        </p>
      </div>
    </div>
  );
}

/** Os carretéis de cor num chip pequeno. */
function Carreteis() {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className="flex -space-x-3">
        {["#FF7EA8", "#2F6BE0", "#0F9D6E"].map((c) => (
          <Carretel key={c} cor={c} size={40} />
        ))}
      </span>
      <p className="display pr-1 text-xs font-bold text-mute">suas cores</p>
    </div>
  );
}

/** O cofrinho que soma o lucro. */
function Cofrinho() {
  return (
    <div className="card px-4 py-3 text-center">
      <p className="display text-[0.7rem] font-bold uppercase tracking-widest text-mute">
        cofrinho
      </p>
      <p className="valor-marca text-2xl font-bold text-neon">R$ 247,50</p>
    </div>
  );
}

/** Uma peça = posição no canto + inclinação base (data-rot). */
const PECAS = [
  { chave: "produto", rot: -7, pos: "-left-24 -top-9", Peca: MiniProduto },
  { chave: "notinha", rot: 8, pos: "-right-16 -top-12", Peca: MiniNotinha },
  { chave: "cores", rot: 6, pos: "-bottom-9 -left-16", Peca: Carreteis },
  { chave: "cofrinho", rot: -5, pos: "-bottom-11 -right-20", Peca: Cofrinho },
] as const;

export default function PecasFlutuantes() {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const semMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      const pecas = gsap.utils.toArray<HTMLElement>(".peca-flutua");
      pecas.forEach((el, i) => {
        const base = Number(el.dataset.rot ?? 0);
        // A inclinação base é do GSAP (não do Tailwind), pra não brigar com
        // as transforms da animação.
        gsap.set(el, { rotation: base });
        if (semMovimento) return;
        gsap.to(el, {
          y: -8,
          scale: 1.03,
          rotation: base + (i % 2 === 0 ? 1.5 : -1.5),
          duration: 4.6 + i * 0.55,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: i * 0.45,
        });
      });
    }, raiz);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={raiz}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 hidden lg:block"
    >
      {PECAS.map(({ chave, rot, pos, Peca }) => (
        <div key={chave} className={`peca-flutua absolute ${pos}`} data-rot={rot}>
          <Peca />
        </div>
      ))}
    </div>
  );
}
