import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Ateliê Nuvem | Transforme sua arte em catálogo",
  description: "Fotos profissionais em segundos com IA. Escolha seu estúdio, ângulo, paleta de cores e crie imagens renderizadas de alta qualidade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${manrope.variable} bg-background text-on-surface min-h-screen pb-12 antialiased`}>
        {children}
      </body>
    </html>
  );
}
