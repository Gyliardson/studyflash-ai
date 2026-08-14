"use client";

import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import UserHUD from "./UserHUD";
import { useEffect, useRef, useState } from "react";
import { BookOpen, BrainCircuit, Library, Menu, Moon, Plus, Settings, Sun, UserRound, X } from "lucide-react";
import { useTheme } from "next-themes";

const primaryLinks = [
    { href: "/dashboard", label: "Criar", icon: Plus },
    { href: "/colecao", label: "Coleção", icon: Library },
    { href: "/planos", label: "Planos", icon: BookOpen },
    { href: "/simulado", label: "Simulados", icon: BrainCircuit },
    { href: "/perfil", label: "Perfil", icon: UserRound },
    { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isMenuOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isMenuOpen]);

    const toggleTheme = () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    return (
        <header className="sticky top-3 z-50 mx-auto mb-8 w-full max-w-7xl px-3 md:top-4 md:px-6">
            <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur md:px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="rounded-lg p-2 text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                        aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={isMenuOpen}
                        aria-controls="mobile-primary-navigation"
                    >
                        {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
                    </button>

                    <Link href="/dashboard" className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground" aria-hidden="true">SF</span>
                        <span className="hidden text-lg font-extrabold tracking-tight text-foreground sm:inline">
                            Study<span className="text-primary">Flash</span>
                        </span>
                    </Link>
                </div>

                <SignedIn>
                    <nav aria-label="Navegação principal" className="hidden items-center gap-0.5 lg:flex">
                        {primaryLinks.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {label}
                            </Link>
                        ))}
                    </nav>
                </SignedIn>

                <div className="flex shrink-0 items-center gap-2">
                    {mounted && (
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="rounded-lg border border-border bg-background p-2 text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={resolvedTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                        >
                            {resolvedTheme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                        </button>
                    )}

                    <SignedIn>
                        <div className="hidden 2xl:block"><UserHUD /></div>
                    </SignedIn>

                    <div className="flex items-center border-l border-border pl-2">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button type="button" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    Entrar
                                </button>
                            </SignInButton>
                        </SignedOut>

                        <SignedIn>
                            <UserButton
                                afterSignOutUrl="/"
                                appearance={{ elements: { avatarBox: "w-9 h-9 border border-border shadow-sm" } }}
                            />
                        </SignedIn>
                    </div>
                </div>
            </div>

            {isMenuOpen && (
                <div id="mobile-primary-navigation" className="absolute left-3 right-3 top-full z-40 mt-2 rounded-2xl border border-border bg-card p-3 shadow-xl lg:hidden md:left-6 md:right-6">
                    <SignedIn>
                        <nav aria-label="Navegação principal móvel" className="grid gap-1 sm:grid-cols-2">
                            {primaryLinks.map(({ href, label, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 rounded-xl p-3 text-sm font-semibold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </span>
                                    {label}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-2 border-t border-border pt-3"><UserHUD /></div>
                    </SignedIn>
                </div>
            )}
        </header>
    );
}
