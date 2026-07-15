import { brl } from "@/lib/format";

/**
 * Um valor em R$ que nunca vaza da caixa onde mora.
 *
 * O elemento pai precisa ter a classe `caixa-valor`: é a largura dele que serve
 * de régua. O número então pega o maior tamanho que ainda cabe, até `max`.
 * Na prática: valor curto ocupa a caixa toda e valor comprido encolhe sozinho,
 * em vez de passar por cima da borda.
 */
export default function Valor({
  valor,
  max = "1rem",
  min,
  folga,
  sufixo,
  className = "",
}: {
  valor: number;
  /** Tamanho máximo — a intenção de design pra esse número (ex: "3.5rem"). */
  max?: string;
  /** Piso pra não sumir numa caixa muito estreita. */
  min?: string;
  /** Largura que a caixa gasta por dentro e a régua não vê (padding, borda). */
  folga?: string;
  /** Ex: "/kg" — entra menorzinho, colado no número. */
  sufixo?: string;
  className?: string;
}) {
  const texto = brl(valor);
  const estilo: Record<string, string> = {
    "--n": String(texto.length + (sufixo?.length ?? 0)),
    "--valor-max": max,
  };
  if (min) estilo["--valor-min"] = min;
  if (folga) estilo["--valor-folga"] = folga;

  return (
    <span className={`valor valor-fit ${className}`} style={estilo as React.CSSProperties}>
      {texto}
      {sufixo && <span className="text-[0.72em] opacity-75">{sufixo}</span>}
    </span>
  );
}
