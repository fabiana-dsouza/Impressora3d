/**
 * Carretel de filamento visto de frente — a "bolinha de cor" da fabriquinha.
 * Usado no seletor de cores, nos cards e onde uma cor aparecer.
 */
export default function Carretel({
  cor,
  size = 48,
  className,
}: {
  cor: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      {/* filamento enrolado */}
      <circle cx="24" cy="24" r="21" fill={cor} />
      <circle
        cx="24"
        cy="24"
        r="21"
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1.5"
      />
      {/* voltas do fio */}
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="2" />
      <circle cx="24" cy="24" r="12" fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="2" />
      <circle cx="24" cy="24" r="9" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
      {/* furo do meio */}
      <circle cx="24" cy="24" r="6" fill="#0b1220" />
      <circle
        cx="24"
        cy="24"
        r="6"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
