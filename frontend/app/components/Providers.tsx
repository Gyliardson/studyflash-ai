"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

// Definimos explicitamente que este componente aceita children
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}