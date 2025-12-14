"use client";

import { useEffect, useState } from "react";
import { obterPerfilUsuario } from "../actions";
import { calcularNivel } from "@/lib/gamification";
import Link from "next/link";

// --- UTILITÁRIO GLOBAL PARA ATUALIZAR O HUD ---
// Importe e chame esta função em qualquer lugar que o usuário ganhe XP
export const triggerHudRefresh = () => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("user-hud-refresh"));
    }
};

export default function UserHUD() {
    const [stats, setStats] = useState({ xp: 0, currentStreak: 0 });
    const [loading, setLoading] = useState(true);

    // Função de carregamento isolada para ser reutilizada
    async function fetchStats() {
        const dados = await obterPerfilUsuario();
        if (dados) {
            setStats({ xp: dados.xp, currentStreak: dados.currentStreak });
        }
        setLoading(false);
    }

    useEffect(() => {
        // 1. Carrega na montagem inicial
        fetchStats();

        // 2. Adiciona o ouvinte do evento global
        window.addEventListener("user-hud-refresh", fetchStats);

        // 3. Limpeza ao desmontar
        return () => {
            window.removeEventListener("user-hud-refresh", fetchStats);
        };
    }, []);

    if (loading) return (
        <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md border border-white/30 px-4 py-2 rounded-2xl shadow-sm animate-pulse">
            <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
            <div className="h-4 w-20 bg-gray-200 rounded-full"></div>
        </div>
    );

    const { level, progress, xpToNext } = calcularNivel(stats.xp);

    return (
        <Link href="/perfil">
            <div 
                className="group relative flex items-center gap-5 bg-linear-to-b from-indigo-50 to-white backdrop-blur-xl border border-indigo-100/50 px-5 py-2.5 rounded-2xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-500 hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                title={`Faltam ${xpToNext} XP para o nível ${level + 1}. Clique para ver perfil.`}
            >
                <div 
                    className="absolute inset-0 z-10 pointer-events-none animate-beam"
                    style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
                        width: '100%', 
                        height: '100%',
                        top: 0,
                        left: 0,
                        mixBlendMode: 'soft-light'
                    }}
                />

                <div className="relative z-20 flex items-center gap-2">
                    <div className={`text-2xl filter drop-shadow-sm transition-transform duration-700 ${stats.currentStreak > 0 ? "animate-pulse scale-110" : "grayscale opacity-50"}`}>
                        🔥
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className={`text-lg font-black bg-clip-text text-transparent bg-linear-to-br ${stats.currentStreak > 0 ? "from-orange-500 to-red-600" : "from-gray-400 to-gray-500"}`}>
                            {stats.currentStreak}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider -mt-0.5">
                            Dias
                        </span>
                    </div>
                </div>

                <div className="h-8 w-px bg-indigo-200/50 mx-1 relative z-20"></div>

                <div className="relative z-20 flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 flex items-center justify-center bg-linear-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-500/40 ring-2 ring-white transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                            {level}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 w-28 md:w-36">
                        <div className="flex justify-between items-end px-1">
                            <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">
                                Nível {level}
                            </span>
                            <span className="text-[9px] font-semibold text-indigo-400">
                                {Math.floor(progress)}%
                            </span>
                        </div>
                        
                        <div className="h-2.5 w-full bg-gray-200/50 rounded-full overflow-hidden border border-indigo-100 shadow-inner relative">
                            <div 
                                className="h-full bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-sm relative overflow-hidden transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                            >
                                <div 
                                    className="absolute inset-0 animate-stripes"
                                    style={{
                                        backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,0.3) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.3) 50%,rgba(255,255,255,0.3) 75%,transparent 75%,transparent)',
                                        backgroundSize: '1rem 1rem'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}