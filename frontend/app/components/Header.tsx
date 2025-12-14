"use client";

import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import UserHUD from "./UserHUD";

export default function Header() {
    return (
        // FIX 1: 'mx-auto' adicionado para centralizar o bloco na página
        // FIX 2: Voltamos para 'flex justify-between' para jogar XP/Auth para a direita
        <header className="w-full max-w-6xl mx-auto flex justify-between items-center mb-8 py-4 px-6 bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm sticky top-4 z-50">

            {/* LADO ESQUERDO: Logo e Navegação */}
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span className="text-2xl">⚡</span>
                    <span className="text-xl font-extrabold text-gray-800 tracking-tight hidden sm:inline">
                        Study<span className="text-blue-600">Flash</span>
                    </span>
                </Link>

                <SignedIn>
                    <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
                        <Link href="/" className="hover:text-blue-600 transition-colors">
                            Criar Novo
                        </Link>
                        <Link href="/colecao" className="hover:text-blue-600 transition-colors">
                            Minha Coleção
                        </Link>
                    </nav>
                </SignedIn>
            </div>

            {/* LADO DIREITO: Gamification + Auth */}
            <div className="flex items-center gap-4">
                
                {/* HUD (XP/Nível) - Fica na direita junto com o Auth */}
                <SignedIn>
                    <div className="hidden sm:block">
                        <UserHUD />
                    </div>
                </SignedIn>

                {/* Divisória e Auth */}
                <div className="pl-4 border-l border-gray-200 ml-2 flex items-center">
                    <SignedOut>
                        <SignInButton mode="modal">
                            <button className="group px-6 py-2.5 rounded-xl bg-gray-900 text-white font-bold text-sm transition-all hover:bg-gray-800 hover:shadow-lg active:scale-95 flex items-center gap-2">
                                <span>Entrar</span>
                            </button>
                        </SignInButton>
                    </SignedOut>

                    <SignedIn>
                        <UserButton
                            afterSignOutUrl="/"
                            appearance={{
                                elements: {
                                    avatarBox: "w-10 h-10 border-2 border-white shadow-sm hover:scale-105 transition-transform"
                                }
                            }}
                        />
                    </SignedIn>
                </div>
            </div>
        </header>
    );
}