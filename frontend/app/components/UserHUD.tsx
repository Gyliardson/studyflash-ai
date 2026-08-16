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

    async function fetchStats() {
        const dados = await obterPerfilUsuario();
        if (dados) {
            setStats({ xp: dados.xp, currentStreak: dados.currentStreak });
        }
        setLoading(false);
    }

    useEffect(() => {
        const initialRefresh = window.setTimeout(() => {
            void fetchStats();
        }, 0);

        window.addEventListener("user-hud-refresh", fetchStats);

        return () => {
            window.clearTimeout(initialRefresh);
            window.removeEventListener("user-hud-refresh", fetchStats);
        };
    }, []);

    if (loading) return (
        <div className="flex items-center gap-3 bg-muted/40 backdrop-blur-md border border-border/30 px-4 py-2 rounded-2xl shadow-sm animate-pulse">
            <div className="h-6 w-6 bg-muted-foreground/20 rounded-full"></div>
            <div className="h-4 w-20 bg-muted-foreground/20 rounded-full"></div>
        </div>
    );

    const { level, progress, xpToNext } = calcularNivel(stats.xp);

    return (
        <Link href="/perfil" className="block w-full">
            <div 
                className="group relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 bg-card/50 backdrop-blur-xl border border-border/50 px-5 py-3 sm:py-2.5 rounded-2xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all duration-500 hover:-translate-y-0.5 cursor-pointer overflow-hidden w-full"
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
                    <div className="flex flex-col leading-none items-center sm:items-start">
                        <span className={`text-lg font-black bg-clip-text text-transparent bg-linear-to-br ${stats.currentStreak > 0 ? "from-orange-500 to-red-600" : "from-muted-foreground to-muted-foreground/80"}`}>
                            {stats.currentStreak}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider -mt-0.5">
                            Dias
                        </span>
                    </div>
                </div>

                <div className="h-px w-full sm:w-px sm:h-8 bg-border mx-1 relative z-20"></div>

                <div className="relative z-20 flex items-center gap-3 w-full sm:w-auto justify-center">
                    <div className="relative">
                        <div className="w-10 h-10 flex items-center justify-center bg-linear-to-br from-primary to-info-solid text-primary-foreground font-extrabold text-sm rounded-xl shadow-lg shadow-primary/40 ring-2 ring-background transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                            {level}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 w-full sm:w-28 md:w-36">
                        <div className="flex justify-between items-end px-1">
                            <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                                Nível {level}
                            </span>
                            <span className="text-[9px] font-semibold text-muted-foreground">
                                {Math.floor(progress)}%
                            </span>
                        </div>
                        
                        <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden border border-border shadow-inner relative">
                            <div 
                                className="h-full bg-linear-to-r from-primary via-purple-500 to-pink-500 rounded-full shadow-sm relative overflow-hidden transition-all duration-1000 ease-out"
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
