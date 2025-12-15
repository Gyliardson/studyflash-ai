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
            <div className="flex justify-between items-center py-4 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800 rounded-2xl shadow-sm transition-colors duration-300">

                {/* LADO ESQUERDO: Logo e Navegação */}
                <div className="flex items-center gap-4 md:gap-8">
                    {/* HAMBURGER MENU BUTTON (MOBILE ONLY) */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden text-gray-800 dark:text-gray-200 p-1"
                        aria-label="Menu"
                    >
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <span className="text-2xl">⚡</span>
                        {/* Mobile Logo Fix: Ensure text is visible and consistent */}
                        <span className="text-xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">
                            Study<span className="text-blue-600 dark:text-blue-400">Flash</span>
                        </span>
                    </Link>

                    <SignedIn>
                        <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                Criar Novo
                            </Link>
                            <Link href="/colecao" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
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
                            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
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
                    <div className="pl-2 md:pl-4 border-l border-gray-200 dark:border-slate-700 ml-1 md:ml-2 flex items-center">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="group px-4 md:px-6 py-2 md:py-2.5 rounded-xl bg-gray-900 dark:bg-indigo-600 text-white font-bold text-xs md:text-sm transition-all hover:bg-gray-800 dark:hover:bg-indigo-500 hover:shadow-lg active:scale-95 flex items-center gap-2">
                                    <span>Entrar</span>
                                </button>
                            </SignInButton>
                        </SignedOut>

                        <SignedIn>
                            <UserButton
                                afterSignOutUrl="/"
                                appearance={{
                                    elements: {
                                        avatarBox: "w-8 h-8 md:w-10 md:h-10 border-2 border-white dark:border-slate-800 shadow-sm hover:scale-105 transition-transform"
                                    }
                                }}
                            />
                        </SignedIn>
                    </div>
                </div>
            </div>

            {/* MOBILE MENU DROPDOWN */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 mt-2 mx-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 z-40">
                    <SignedIn>
                        <div className="flex flex-col gap-2">
                            <Link
                                href="/"
                                onClick={() => setIsMenuOpen(false)}
                                className="p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium"
                            >
                                Criar Novo
                            </Link>
                            <Link
                                href="/colecao"
                                onClick={() => setIsMenuOpen(false)}
                                className="p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium"
                            >
                                Minha Coleção
                            </Link>
                        </div>
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            <UserHUD />
                        </div>
                    </SignedIn>
                </div>
            )}
        </header>
    );
}
