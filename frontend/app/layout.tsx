import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Imports do Clerk
import { ClerkProvider } from '@clerk/nextjs'
import { ptPT } from '@clerk/localizations'

// 1. Importar o Analytics
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudyFlash AI",
  description: "Gera flashcards com IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // ClerkProvider envolve tudo
    <ClerkProvider localization={ptPT}>
      <html lang="pt" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}

            {/* 2. O Sensor fica aqui, invisível, coletando dados */}
            <Analytics />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}