"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setShowBanner(true);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie_consent", "true");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <aside
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border p-4 shadow-lg animate-in slide-in-from-bottom-full duration-500"
    >
      <div className="container mx-auto max-w-screen-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          <p>
            Utilizamos cookies para melhorar sua experiência e garantir o funcionamento da plataforma. Ao continuar navegando, você concorda com nossa{" "}
            <a href="/privacidade" className="underline hover:text-primary">Política de Privacidade</a>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={acceptCookies}
            className="whitespace-nowrap rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Aceitar
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="sm:hidden text-muted-foreground p-2"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}
