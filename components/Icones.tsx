/**
 * Ícones desenhados do app (traço consistente, herdam a cor do texto).
 * Substituem os emojis "colados" — emoji fica só pra momentos de festa.
 */
function Base({
  children,
  size = 20,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string };

export const IconeVoltar = (p: P) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

export const IconeCasa = (p: P) => (
  <Base {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
  </Base>
);

export const IconeMais = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconeLixeira = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </Base>
);

export const IconeLupa = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Base>
);

export const IconeEngrenagem = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
  </Base>
);

export const IconeSair = (p: P) => (
  <Base {...p}>
    <path d="M9 4H4v16h5" />
    <path d="M21 12H9" />
    <path d="M17 8l4 4-4 4" />
  </Base>
);

export const IconeTrofeu = (p: P) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 01-8 0z" />
    <path d="M8 5H5a3 3 0 003 4M16 5h3a3 3 0 01-3 4" />
    <path d="M12 13v4M8 20h8" />
  </Base>
);

export const IconeMoeda = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M14.5 9.3c-.5-.8-1.4-1.3-2.5-1.3-1.5 0-2.6.9-2.6 2s1 1.6 2.6 2c1.6.4 2.6 1 2.6 2s-1.1 2-2.6 2c-1.1 0-2-.5-2.5-1.3" />
    <path d="M12 6.5V8M12 16v1.5" />
  </Base>
);

export const IconeRelogio = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconeImpressora = (p: P) => (
  <Base {...p}>
    <path d="M3 5h18" />
    <path d="M5 5v15M19 5v15" />
    <path d="M3 20h18" />
    <path d="M10 5h4l-2 4z" fill="currentColor" stroke="none" />
    <path d="M9 16h6M10 13h4" />
  </Base>
);

export const IconeRaio = (p: P) => (
  <Base {...p}>
    <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />
  </Base>
);

export const IconeCaixa = (p: P) => (
  <Base {...p}>
    <path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z" />
    <path d="M3 7.5l9 4.5 9-4.5M12 12v9" />
  </Base>
);

export const IconeEscudo = (p: P) => (
  <Base {...p}>
    <path d="M12 2.5l8 3v6c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10v-6z" />
    <path d="M9 12l2 2 4-4" />
  </Base>
);

export const IconeUsuario = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </Base>
);

export const IconeEtiqueta = (p: P) => (
  <Base {...p}>
    <path d="M3 11.5V4h7.5l10 10-7.5 7.5z" />
    <circle cx="7.5" cy="8" r="1.5" />
  </Base>
);

export const IconeAlerta = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5L1.8 20.5h20.4z" />
    <path d="M12 9.5v4.5M12 17.2v.1" />
  </Base>
);

export const IconeCadeado = (p: P) => (
  <Base {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 018 0v3" />
  </Base>
);

export const IconeCheck = (p: P) => (
  <Base {...p}>
    <path d="M4.5 12.5l5 5 10-11" />
  </Base>
);

export const IconeChave = (p: P) => (
  <Base {...p}>
    <path d="M14.5 3a6.5 6.5 0 00-6 9L3 17.5V21h3.5l5.5-5.5a6.5 6.5 0 002.5-12.5z" />
    <circle cx="16.5" cy="7.5" r="1.6" />
  </Base>
);
