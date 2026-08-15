"use client";

import Link from "next/link";
import { Check, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";

const appearanceOptions = [
  { value: "light", label: "Claro", description: "Sempre usar a interface clara.", icon: Sun },
  { value: "dark", label: "Escuro", description: "Sempre usar a interface escura.", icon: Moon },
  { value: "system", label: "Sistema", description: "Acompanhar a preferência deste dispositivo.", icon: Monitor },
] as const;

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-4 md:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Preferências</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Configurações</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Ajuste somente preferências que o StudyFlash realmente suporta hoje. Opções que ainda não existem no produto não são exibidas como controles fictícios.
          </p>
        </header>

        <section aria-labelledby="appearance-heading" className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
          <div className="border-b border-border pb-5">
            <h2 id="appearance-heading" className="text-xl font-bold text-card-foreground">Aparência</h2>
            <p className="mt-1 text-sm text-muted-foreground">A preferência é aplicada neste navegador e pode seguir o tema do sistema.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Tema da interface">
            {appearanceOptions.map(({ value, label, description, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  aria-pressed={selected}
                  className={`relative rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    {selected && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Selecionado">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <span className="mt-4 block font-bold text-foreground">{label}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="account-heading" className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="account-heading" className="text-xl font-bold text-card-foreground">Perfil e conta</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Métricas de estudo ficam no perfil. Dados de autenticação e sessão continuam sob o provedor de identidade, acessível pelo menu do avatar no cabeçalho.
              </p>
            </div>
            <Link
              href="/perfil"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Ver perfil
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
