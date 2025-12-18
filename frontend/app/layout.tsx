import type { Metadata, Viewport } from "next";
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
  title: "StudyFlash",
  description: "Gera flashcards com IA",
  manifest: "/manifest.webmanifest", // Link automático gerado pelo Next.js
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Sensação de app nativo (impede zoom acidental)
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