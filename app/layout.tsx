import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:
    "BetSport Pro | Plataforma de Apuestas Deportivas en Tiempo Real - Milton H Flores Chino",
  description:
    "Plataforma web premium para apuestas a eventos deportivos en tiempo real, gestión segura de saldo, cuotas dinámicas y estadísticas transparentes. Desarrollado por Milton H Flores Chino.",
  keywords: [
    "apuestas deportivas",
    "sports betting",
    "champions league",
    "en vivo",
    "cuotas en tiempo real",
    "Milton H Flores Chino",
  ],
  authors: [{ name: "Milton H Flores Chino" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
