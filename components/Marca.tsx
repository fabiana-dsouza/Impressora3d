/**
 * O Cubinho: a marca da fabriquinha virou personagem.
 *
 * É um cubo impresso em camadas (a identidade 3D) que ganhou uma carinha — o
 * "mascote" no lugar do fantasminha do phantom. Aparece no topo do app, nos
 * títulos e como bichinho de carregar (é ele que balança). Continua desenho,
 * não emoji: o rosto é feito de formas, então escala sem serrilhar.
 */
export function Logo({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Cubinho, o mascote da fábrica"
    >
      {/* bico da impressora deixando a camada de cima */}
      <path d="M31 4h6l-3 6z" fill="#8478b8" />
      <path d="M34 10v2.5" stroke="#0F9D6E" strokeWidth="2.4" strokeLinecap="round" />

      {/* corpo em três camadas impressas, com cantos arredondados */}
      {/* camada de baixo (mais escura) */}
      <rect x="9" y="31" width="30" height="12" rx="6" fill="#9484ea" />
      {/* camada do meio */}
      <rect x="8" y="23" width="32" height="12" rx="6" fill="#AB9FF2" />
      {/* camada de cima (a que está saindo do bico agora), com a carinha */}
      <rect x="9" y="13" width="30" height="13" rx="6.5" fill="#BBB0F7" />

      {/* olhos */}
      <circle cx="20" cy="19.3" r="2.5" fill="#2F2650" />
      <circle cx="28" cy="19.3" r="2.5" fill="#2F2650" />
      <circle cx="20.9" cy="18.5" r="0.8" fill="#fff" />
      <circle cx="28.9" cy="18.5" r="0.8" fill="#fff" />
      {/* sorriso */}
      <path
        d="M21 22.4c1 1 4 1 5 0"
        stroke="#2F2650"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      {/* bochechas */}
      <circle cx="15.6" cy="21.4" r="1.5" fill="#F49CC4" opacity="0.75" />
      <circle cx="32.4" cy="21.4" r="1.5" fill="#F49CC4" opacity="0.75" />
    </svg>
  );
}

/** Impressora 3D grandinha pros estados vazios (fábrica sem produtos). */
export function ImpressoraIlustracao({ size = 150 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 100) / 130}
      viewBox="0 0 130 100"
      role="img"
      aria-label="Uma impressora 3D imprimindo uma peça"
    >
      {/* pórtico */}
      <rect x="10" y="8" width="8" height="76" rx="4" fill="#CFC6F2" />
      <rect x="112" y="8" width="8" height="76" rx="4" fill="#CFC6F2" />
      <rect x="6" y="8" width="118" height="10" rx="5" fill="#B7ABEF" />
      {/* cabeça de impressão */}
      <rect x="52" y="14" width="26" height="12" rx="4" fill="#8478B8" />
      <path d="M58 26h14l-7 10z" fill="#A99CD6" />
      {/* fio caindo */}
      <path d="M65 36v6" stroke="#0F9D6E" strokeWidth="3" strokeLinecap="round" />
      {/* pecinha sendo impressa (camadas) */}
      <rect x="46" y="62" width="38" height="7" rx="3" fill="#9484EA" />
      <rect x="46" y="54" width="38" height="7" rx="3" fill="#AB9FF2" />
      <rect x="46" y="46" width="22" height="7" rx="3" fill="#BBB0F7" />
      {/* mesa */}
      <rect x="22" y="70" width="86" height="8" rx="4" fill="#B7ABEF" />
      <rect x="14" y="84" width="102" height="9" rx="5" fill="#CFC6F2" />
    </svg>
  );
}
