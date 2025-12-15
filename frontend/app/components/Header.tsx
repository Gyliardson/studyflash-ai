"use client";

import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import UserHUD from "./UserHUD";
import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Evita mismatch de hidratação
    useEffect(() => {
        setMounted(true);
    }, []);

    // Função segura para alternar o tema
    const toggleTheme = () => {
        if (resolvedTheme === 'dark') {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    };

    return (
        <header className="w-full max-w-6xl mx-auto mb-8 sticky top-4 z-50 px-4 md:px-6">
            <div className="flex justify-between items-center py-4 px-6 bg-card/80 backdrop-blur-md border border-border rounded-2xl shadow-sm transition-colors duration-300">

                {/* LADO ESQUERDO: Logo e Navegação */}
                <div className="flex items-center gap-4 md:gap-8">
                    {/* HAMBURGER MENU BUTTON (MOBILE ONLY) */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden text-foreground p-1"
                        aria-label="Menu"
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <span className="text-2xl">⚡</span>
                        {/* Mobile Logo Fix: Ensure text is visible and consistent */}
                        <span className="text-xl font-extrabold text-foreground tracking-tight">
                            Study<span className="text-primary">Flash</span>
                        </span>
                    </Link>

                    <SignedIn>
                        <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
                            <Link href="/" className="hover:text-primary transition-colors">
                                Criar Novo
                            </Link>
                            <Link href="/colecao" className="hover:text-primary transition-colors">
                                Minha Coleção
                            </Link>
                        </nav>
                    </SignedIn>
                </div>

                {/* LADO DIREITO: Gamification + Auth */}
                <div className="flex items-center gap-2 md:gap-4">

                    {/* Dark Mode Toggle */}
                    {mounted && (
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors"
                            aria-label="Alternar tema"
                        >
                            {resolvedTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                        </button>
                    )}

                    {/* HUD (XP/Nível) - Fica na direita junto com o Auth */}
                    <SignedIn>
                        <div className="hidden md:block">
                            <UserHUD />
                        </div>
                    </SignedIn>

                    {/* Divisória e Auth */}
                    <div className="pl-2 md:pl-4 border-l border-border ml-1 md:ml-2 flex items-center">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="group px-4 md:px-6 py-2 md:py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs md:text-sm transition-all hover:bg-primary/90 hover:shadow-lg active:scale-95 flex items-center gap-2">
                                    <span>Entrar</span>
                                </button>
                            </SignInButton>
                        </SignedOut>

                        <SignedIn>
                            <UserButton
                                afterSignOutUrl="/"
                                appearance={{
                                    elements: {
                                        avatarBox: "w-8 h-8 md:w-10 md:h-10 border-2 border-border shadow-sm hover:scale-105 transition-transform"
                                    }
                                }}
                            />
                        </SignedIn>
                    </div>
                </div>
            </div>

            {/* MOBILE MENU DROPDOWN */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 mt-2 mx-4 bg-card border border-border rounded-2xl shadow-xl p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 z-40">
                    <SignedIn>
                        <div className="flex flex-col gap-2">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                className="p-3 rounded-xl hover:bg-accent text-foreground font-medium"
                            >
                                Criar Novo
                            </Link>
                            <Link
                                href="/colecao"
                                onClick={() => setIsMenuOpen(false)}
                                className="p-3 rounded-xl hover:bg-accent text-foreground font-medium"
                            >
                                Minha Coleção
                            </Link>
                        </div>
                        <div className="pt-4 border-t border-border">
                            <UserHUD />
                        </div>
                    </SignedIn>
                </div>
            )}
        </header>
    );
}
