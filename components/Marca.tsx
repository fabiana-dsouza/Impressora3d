/**
 * A marca da fabriquinha: um cubo sendo impresso em camadas,
 * com o bico da impressora terminando a camada de cima.
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
      aria-hidden
    >
      {/* camadas prontas */}
      <rect x="7" y="33" width="34" height="8" rx="2" fill="#2563eb" />
      <rect x="7" y="23" width="34" height="8" rx="2" fill="#22d3ee" />
      {/* camada sendo impressa agora */}
      <rect x="7" y="13" width="19" height="8" rx="2" fill="#4ade80" />
      {/* bico da impressora */}
      <path d="M28 3h10l-5 9z" fill="#8a97b0" />
      {/* fio saindo do bico */}
      <path
        d="M33 12v1"
        stroke="#4ade80"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
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
      aria-hidden
    >
      {/* pórtico */}
      <rect x="10" y="8" width="8" height="76" rx="3" fill="#26304a" />
      <rect x="112" y="8" width="8" height="76" rx="3" fill="#26304a" />
      <rect x="6" y="8" width="118" height="10" rx="4" fill="#31405f" />
      {/* cabeça de impressão */}
      <rect x="52" y="14" width="26" height="12" rx="3" fill="#8a97b0" />
      <path d="M58 26h14l-7 10z" fill="#aab6cc" />
      {/* fio caindo */}
      <path
        d="M65 36v6"
        stroke="#4ade80"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* pecinha sendo impressa (camadas) */}
      <rect x="46" y="62" width="38" height="7" rx="2" fill="#2563eb" />
      <rect x="46" y="54" width="38" height="7" rx="2" fill="#22d3ee" />
      <rect x="46" y="46" width="22" height="7" rx="2" fill="#4ade80" />
      {/* mesa */}
      <rect x="22" y="70" width="86" height="8" rx="3" fill="#31405f" />
      <rect x="14" y="84" width="102" height="9" rx="4" fill="#26304a" />
    </svg>
  );
}
