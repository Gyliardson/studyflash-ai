"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import { obterPerfilUsuario } from "../actions";
import { calcularNivel } from "@/lib/gamification";
import { useUser } from "@clerk/nextjs";

export default function PerfilPage() {
    const { user } = useUser();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        obterPerfilUsuario().then((data) => {
            setProfile(data);
            setLoading(false);
        });
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-background flex justify-center items-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
        </div>
    );

    const { level, progress, xpToNext } = calcularNivel(profile?.xp || 0);

    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-6 transition-colors duration-300">
            <Header />

            <div className="w-full max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
                
                {/* --- CARTÃO PRINCIPAL --- */}
                <div className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border mb-8 relative">
                    
                    {/* 1. Header Colorido (Aumentei um pouco para h-40 para dar respiro) */}
                    <div className="h-40 bg-linear-to-r from-primary to-info-solid relative overflow-hidden">
                        {/* Efeito decorativo sutil no fundo */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    </div>

                    <div className="px-6 md:px-8 pb-8">
                        {/* 2. Layout Flexível: Avatar sobe, Texto fica */}
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                            
                            {/* AVATAR: Margem Negativa para subir (-mt-16) */}
                            <div className="-mt-16 relative z-10 shrink-0">
                                <img 
                                    src={user?.imageUrl} 
                                    alt="Avatar" 
                                    className="w-32 h-32 rounded-3xl border-4 border-card shadow-xl bg-muted object-cover"
                                />
                            </div>

                            {/* TEXTO: Margem Top positiva (mt-4) para descer e ficar no branco */}
                            <div className="flex-1 mt-4 md:mt-2 text-center md:text-left">
                                <h1 className="text-3xl font-bold text-foreground tracking-tight">{user?.fullName}</h1>
                                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-md border border-primary/20">
                                        Aluno
                                    </span>
                                    <p className="text-muted-foreground text-sm">
                                        Membro desde {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2024'}
                                    </p>
                                </div>
                            </div>

                            {/* STATS: Alinhados à direita, também no branco */}
                            <div className="mt-4 md:mt-2 flex gap-6 bg-muted p-3 rounded-2xl border border-border w-full md:w-auto justify-center">
                                <div className="text-center px-2">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Nível</p>
                                    <p className="text-2xl font-black text-primary leading-none">{level}</p>
                                </div>
                                <div className="w-px bg-border"></div>
                                <div className="text-center px-2">
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">XP Total</p>
                                    <p className="text-2xl font-black text-foreground leading-none">{profile?.xp || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* BARRA DE PROGRESSO */}
                        <div className="bg-muted/50 rounded-xl p-4 border border-border">
                            <div className="mb-2 flex justify-between text-sm font-medium text-foreground">
                                <span className="flex items-center gap-2">
                                    🚀 Próximo objetivo: <span className="font-bold text-primary">Nível {level + 1}</span>
                                </span>
                                <span className="text-muted-foreground font-normal">{Math.floor(progress)}%</span>
                            </div>
                            
                            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                                <div 
                                    className="h-full bg-linear-to-r from-primary to-info-solid transition-all duration-1000 relative overflow-hidden"
                                    style={{ width: `${progress}%` }}
                                >
                                    {/* ADICIONADO: animate-stripes na classe abaixo */}
                                    <div className="absolute inset-0 w-full h-full animate-stripes bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-size-[1rem_1rem] opacity-50" />
                                </div>
                            </div>
                            <p className="text-xs text-right text-muted-foreground mt-2">Faltam apenas <span className="font-bold text-foreground">{xpToNext} XP</span> para subir!</p>
                        </div>
                    </div>
                </div>

                {/* --- GRID DE ESTATÍSTICAS (Cards inferiores) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* STREAK */}
                    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 flex items-center justify-center bg-warning-bg text-warning-fg rounded-2xl text-2xl shadow-sm border border-warning-border">
                            🔥
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Ofensiva</p>
                            <p className="text-xl font-bold text-foreground">{profile?.currentStreak || 0} dias</p>
                        </div>
                    </div>

                    {/* RECORDE */}
                    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 flex items-center justify-center bg-warning-bg text-warning-fg rounded-2xl text-2xl shadow-sm border border-warning-border">
                            🏆
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Recorde</p>
                            <p className="text-xl font-bold text-foreground">{profile?.longestStreak || 0} dias</p>
                        </div>
                    </div>

                    {/* XP SEMANAL */}
                    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 flex items-center justify-center bg-success-bg text-success-fg rounded-2xl text-2xl shadow-sm border border-success-border">
                            ⚡
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Semana</p>
                            <p className="text-xl font-bold text-foreground">{profile?.weeklyXp || 0} XP</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
