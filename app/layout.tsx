import type { Metadata, Viewport } from "next";
import { MARCA, TAGLINE } from "@/lib/marca";
import "./globals.css";

export const metadata: Metadata = {
  title: `${MARCA} — ${TAGLINE}`,
  description:
    "Descubra quanto custa e por quanto vender seus produtos de impressão 3D!",
};

export const viewport: Viewport = {
  themeColor: "#F7F7F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Fredoka (display arredondado) + Rubik (corpo) + Spectral itálica
            (a palavra-acento serifada, o toque do portrait.so — escolhida no
            lugar da Fraunces, que é fonte saturada demais). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@1,400;1,500;1,600&family=Fredoka:wght@500;600;700&family=Rubik:wght@500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-28 pt-4">
          {children}
        </div>
      </body>
    </html>
  );
}
