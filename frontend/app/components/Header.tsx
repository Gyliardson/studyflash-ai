"use client";

import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import UserHUD from "./UserHUD";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

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
        <header className="w-full max-w-6xl mx-auto mb-8 sticky top-4 z-50 px-4 md:px-6">
            <div className="flex justify-between items-center py-4 px-6 bg-card/80 backdrop-blur-md border border-border rounded-2xl shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-4 md:gap-8">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden text-foreground p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
                        aria-expanded={isMenuOpen}
                        aria-controls="mobile-primary-navigation"
                    >
                        {isMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
                    </button>

                    <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        <span className="text-2xl" aria-hidden="true">⚡</span>
                        <span className="text-xl font-extrabold text-foreground tracking-tight">
                            Study<span className="text-primary">Flash</span>
                        </span>
                    </Link>

                    <SignedIn>
                        <nav aria-label="Navegação principal" className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
                            <Link href="/dashboard" className="hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Criar Novo</Link>
                            <Link href="/colecao" className="hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Minha Coleção</Link>
                        </nav>
                    </SignedIn>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    {mounted && (
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            aria-label={resolvedTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                        >
                            {resolvedTheme === "dark" ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
                        </button>
                    )}

                    <SignedIn>
                        <div className="hidden md:block"><UserHUD /></div>
                    </SignedIn>

                    <div className="pl-2 md:pl-4 border-l border-border ml-1 md:ml-2 flex items-center">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button type="button" className="group px-4 md:px-6 py-2 md:py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs md:text-sm transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                                    <span>Entrar</span>
                                </button>
                            </SignInButton>
                        </SignedOut>

                        <SignedIn>
                            <UserButton
                                afterSignOutUrl="/"
                                appearance={{ elements: { avatarBox: "w-8 h-8 md:w-10 md:h-10 border-2 border-border shadow-sm hover:scale-105 transition-transform" } }}
                            />
                        </SignedIn>
                    </div>
                </div>
            </div>

            {isMenuOpen && (
                <div id="mobile-primary-navigation" className="md:hidden absolute top-full left-0 right-0 mt-2 mx-4 bg-card border border-border rounded-2xl shadow-xl p-4 animate-in slide-in-from-top-2 z-40">
                    <SignedIn>
                        <nav aria-label="Navegação principal móvel" className="flex flex-col gap-2">
                            <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} className="p-3 rounded-xl hover:bg-accent text-foreground font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Criar Novo</Link>
                            <Link href="/colecao" onClick={() => setIsMenuOpen(false)} className="p-3 rounded-xl hover:bg-accent text-foreground font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Minha Coleção</Link>
                        </nav>
                        <div className="pt-4 mt-2 border-t border-border"><UserHUD /></div>
                    </SignedIn>
                </div>
            )}
        </header>
    );
}