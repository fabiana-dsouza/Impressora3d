import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"], // Spectral itálica (acento)
      },
      colors: {
        // ---------------------------------------------------------------
        // Paleta "portrait de fabriquinha": canvas off-white e arejado,
        // tinta azul-petróleo, e o ARCO-ÍRIS DE FILAMENTO como acento (o
        // iridescente do portrait.so relido como filamento colorido).
        // Os NOMES dos tokens seguem os mesmos: virar o tema é só remapear
        // o valor + reestilizar as classes-base; o app inteiro acompanha.
        // ---------------------------------------------------------------
        fundo: "#F7F7F7", // canvas off-white
        painel: "#FFFFFF", // card
        painel2: "#F0F0F2", // input / superfície elevada
        borda: "#E6E6E9", // bordas bem suaves
        tinta: "#08304C", // texto principal (azul-petróleo)
        mute: "#556170", // texto secundário (ardósia, legível)
        neon: "#0F9D6E", // VERDE do lucro / dinheiro que entra
        ciano: "#2F6BE0", // azul de link / segunda cor
        perigo: "#E5484D", // coral do prejuízo / apagar

        // Papéis
        brand: "#08304C", // primário = azul-petróleo (pílula escura)
        "brand-ink": "#FFFFFF", // texto por cima do primário
        "brand-soft": "#EAECEF", // pílula secundária (clara)
        "brand-deep": "#061F33", // sombra/afundar do primário
        creme: "#FFFDF6", // papel da notinha
        noite: "#10233A", // superfície escura (raro)

        // Blocos de cor viva das seções (o "mais cor pra criança")
        menta: "#A9E8C4",
        pessego: "#FFD3A6",
        peri: "#C3D4FF", // periwinkle
        lavanda: "#DCC9FF",
        sol: "#FFC94D",

        // Aliases antigos (para classes remanescentes)
        grana: {
          verde: "#0F9D6E",
          azul: "#2F6BE0",
          roxo: "#DCC9FF",
          rosa: "#FF7EA8",
          laranja: "#FFD3A6",
          amarelo: "#FFC94D",
          aco: "#556170",
          escuro: "#08304C",
        },
      },
      borderRadius: {
        pill: "9999px",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.92)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        flutua: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        sobe: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        wiggle: "wiggle 0.7s ease-in-out infinite",
        flutua: "flutua 3.4s ease-in-out infinite",
        sobe: "sobe 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
